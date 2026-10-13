import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ExperienceInputSchema,
  ExperienceSchema,
  type Experience,
  type ExperienceInput,
} from "../domain/schema.js";
import { verifyDigest, withDigest } from "./integrity.js";

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: "VALIDATION" | "INTEGRITY" | "NOT_FOUND" | "DUPLICATE",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export interface ExperienceStore {
  publish(input: ExperienceInput): Promise<Experience>;
  get(id: string): Promise<Experience | null>;
  list(): Promise<Experience[]>;
  /** Replace store contents (tests / demo seed). */
  replaceAll(experiences: Experience[]): Promise<void>;
}

/**
 * Local JSON file store. Synthetic data only by default.
 * Integrity is checked on every read path.
 */
export class JsonExperienceStore implements ExperienceStore {
  private experiences = new Map<string, Experience>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new StoreError("store file must be a JSON array", "VALIDATION");
      }
      for (const item of parsed) {
        const exp = ExperienceSchema.parse(item);
        const check = verifyDigest(exp);
        if (!check.ok) {
          throw new StoreError(check.reason, "INTEGRITY", check);
        }
        this.experiences.set(exp.id, exp);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.experiences.clear();
      } else if (err instanceof StoreError) {
        throw err;
      } else if (err instanceof SyntaxError) {
        throw new StoreError("corrupt store JSON", "VALIDATION", err.message);
      } else {
        throw err;
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const list = [...this.experiences.values()];
    await writeFile(this.filePath, JSON.stringify(list, null, 2) + "\n", "utf8");
  }

  async publish(input: ExperienceInput): Promise<Experience> {
    await this.ensureLoaded();
    const parsed = ExperienceInputSchema.parse(input);
    if (this.experiences.has(parsed.id)) {
      throw new StoreError(`experience already exists: ${parsed.id}`, "DUPLICATE");
    }
    const experience = withDigest(parsed);
    ExperienceSchema.parse(experience);
    this.experiences.set(experience.id, experience);
    await this.persist();
    return experience;
  }

  async get(id: string): Promise<Experience | null> {
    await this.ensureLoaded();
    const exp = this.experiences.get(id) ?? null;
    if (!exp) return null;
    const check = verifyDigest(exp);
    if (!check.ok) {
      throw new StoreError(check.reason, "INTEGRITY", check);
    }
    return exp;
  }

  async list(): Promise<Experience[]> {
    await this.ensureLoaded();
    const out: Experience[] = [];
    for (const exp of this.experiences.values()) {
      const check = verifyDigest(exp);
      if (!check.ok) {
        throw new StoreError(check.reason, "INTEGRITY", check);
      }
      out.push(exp);
    }
    return out;
  }

  async replaceAll(experiences: Experience[]): Promise<void> {
    this.experiences.clear();
    for (const item of experiences) {
      const exp = ExperienceSchema.parse(item);
      const check = verifyDigest(exp);
      if (!check.ok) {
        throw new StoreError(check.reason, "INTEGRITY", check);
      }
      this.experiences.set(exp.id, exp);
    }
    this.loaded = true;
    await this.persist();
  }
}

export function defaultStorePath(dataDir = process.env.DATA_DIR ?? "./data"): string {
  return path.resolve(dataDir, "store", "experiences.json");
}
