import Fastify from "fastify";
import {
  ExperienceInputSchema,
  ExperienceSchema,
  QueryRequestSchema,
  SimulationRequestSchema,
} from "./domain/schema.js";
import { PeaqAdapter } from "./economics/peaq.js";
import { queryExperiences } from "./memory/match.js";
import { defaultStorePath, JsonExperienceStore, StoreError } from "./memory/store.js";
import { verifyDigest } from "./memory/integrity.js";
import { runAssemblySimulation } from "./sim/assembly.js";

export interface BuildServerOptions {
  store?: JsonExperienceStore;
  peaq?: PeaqAdapter;
  logger?: boolean;
}

export async function buildServer(opts: BuildServerOptions = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const store = opts.store ?? new JsonExperienceStore(defaultStorePath());
  const peaq = opts.peaq ?? new PeaqAdapter();

  app.get("/health", async () => ({
    ok: true,
    service: "experiencebridge",
    version: "0.1.0",
    peaqMode: peaq.getMode(),
    disclaimer:
      "Advisory-only simulator MVP. No physical robot commands. No TEE confidentiality claim.",
  }));

  app.post("/experiences", async (req, reply) => {
    try {
      const input = ExperienceInputSchema.parse(req.body);
      const published = await store.publish(input);
      return reply.code(201).send(published);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>("/experiences/:id", async (req, reply) => {
    try {
      const exp = await store.get(req.params.id);
      if (!exp) {
        return reply.code(404).send({ error: "not found" });
      }
      const check = verifyDigest(exp);
      if (!check.ok) {
        return reply.code(409).send({ error: check.reason, details: check });
      }
      return {
        ...exp,
        integrityVerified: true,
        note: "Digest verifies integrity relative to stored hash, not physical observation truth.",
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/experiences/query", async (req, reply) => {
    try {
      const query = QueryRequestSchema.parse(req.body);
      const experiences = await store.list();
      const outcome = queryExperiences(experiences, query);
      return {
        ...outcome.result,
        candidatesChecked: outcome.candidatesChecked,
        queryTimeMs: outcome.queryTimeMs,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/simulation/run", async (req, reply) => {
    try {
      const body = SimulationRequestSchema.parse(req.body);
      return runAssemblySimulation(body);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/economics/license-payment", async (req, reply) => {
    try {
      const body = req.body as {
        experienceId?: string;
        payerMachineId?: string;
        idempotencyKey?: string;
      };
      if (!body.experienceId || !body.payerMachineId || !body.idempotencyKey) {
        return reply.code(400).send({
          error: "experienceId, payerMachineId and idempotencyKey are required",
        });
      }
      const exp = await store.get(body.experienceId);
      if (!exp) {
        return reply.code(404).send({ error: "experience not found" });
      }
      ExperienceSchema.parse(exp);
      const receipt = await peaq.payForLicense({
        experienceId: exp.id,
        payerMachineId: body.payerMachineId,
        payeeOrganization: exp.contributor.organization,
        license: exp.rights.license,
        idempotencyKey: body.idempotencyKey,
      });
      const code = receipt.status === "error" ? 502 : 200;
      return reply.code(code).send(receipt);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  return { app, store, peaq };
}

function sendError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof StoreError) {
    const status =
      err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : err.code === "INTEGRITY" ? 409 : 400;
    return reply.code(status).send({ error: err.message, details: err.details });
  }
  if (err && typeof err === "object" && "issues" in err) {
    return reply.code(400).send({ error: "validation failed", details: (err as { issues: unknown }).issues });
  }
  const message = err instanceof Error ? err.message : "unknown error";
  return reply.code(500).send({ error: message });
}

async function main() {
  const port = Number(process.env.PORT ?? 8787);
  const { app } = await buildServer({ logger: true });
  await app.listen({ port, host: "0.0.0.0" });
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
