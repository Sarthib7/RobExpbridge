/**
 * peaq settlement adapter — isolated from matching / simulation.
 *
 * Default mode is explicitly simulated. Live mode is opt-in and will not
 * fabricate explorer links, hashes, or success receipts on error.
 *
 * Official SDK reference (verify before live use):
 * https://github.com/peaqnetwork/peaq-sdk-js
 */

export type PeaqMode = "simulated" | "live";

export interface LicensePaymentRequest {
  experienceId: string;
  payerMachineId: string;
  payeeOrganization: string;
  license: string;
  /** Opaque idempotency key for later paid workflows. */
  idempotencyKey: string;
  /** Demo amount label only; not a market price claim. */
  amountLabel?: string;
}

export type LicensePaymentReceipt =
  | {
      status: "simulated";
      mode: "simulated";
      experienceId: string;
      payerMachineId: string;
      payeeOrganization: string;
      license: string;
      idempotencyKey: string;
      amountLabel: string;
      note: string;
      /** Never a real explorer URL in simulated mode. */
      explorerUrl: null;
      transactionHash: null;
    }
  | {
      status: "submitted";
      mode: "live";
      experienceId: string;
      payerMachineId: string;
      payeeOrganization: string;
      license: string;
      idempotencyKey: string;
      amountLabel: string;
      transactionHash: string;
      explorerUrl: string;
    }
  | {
      status: "error";
      mode: PeaqMode;
      experienceId: string;
      idempotencyKey: string;
      error: string;
      /** Explicit: errors never yield a success receipt. */
      transactionHash: null;
      explorerUrl: null;
    };

export interface PeaqConfig {
  mode: PeaqMode;
  enabled: boolean;
  rpcUrl?: string;
  /** Test-only seed; never log or commit. */
  seed?: string;
}

export function loadPeaqConfig(env: NodeJS.ProcessEnv = process.env): PeaqConfig {
  const mode = (env.PEAQ_MODE === "live" ? "live" : "simulated") as PeaqMode;
  return {
    mode,
    enabled: env.PEAQ_ENABLED === "true",
    rpcUrl: env.PEAQ_RPC_URL,
    seed: env.PEAQ_SEED,
  };
}

export class PeaqAdapter {
  constructor(private readonly config: PeaqConfig = loadPeaqConfig()) {}

  getMode(): PeaqMode {
    return this.config.mode;
  }

  /**
   * Attempt a license-access settlement attribution.
   * Without live credentials/network, returns a conspicuously simulated receipt.
   */
  async payForLicense(req: LicensePaymentRequest): Promise<LicensePaymentReceipt> {
    const amountLabel = req.amountLabel ?? "demo-license-access (not a market price)";

    if (this.config.mode === "simulated" || !this.config.enabled) {
      return {
        status: "simulated",
        mode: "simulated",
        experienceId: req.experienceId,
        payerMachineId: req.payerMachineId,
        payeeOrganization: req.payeeOrganization,
        license: req.license,
        idempotencyKey: req.idempotencyKey,
        amountLabel,
        note:
          "SIMULATED peaq receipt — no chain transaction was submitted. " +
          "Set PEAQ_MODE=live, PEAQ_ENABLED=true, PEAQ_RPC_URL and test-only PEAQ_SEED to attempt a real testnet payment.",
        explorerUrl: null,
        transactionHash: null,
      };
    }

    // Live path: refuse to invent success without a verified SDK submission.
    if (!this.config.rpcUrl || !this.config.seed) {
      return {
        status: "error",
        mode: "live",
        experienceId: req.experienceId,
        idempotencyKey: req.idempotencyKey,
        error:
          "live peaq mode enabled but PEAQ_RPC_URL or PEAQ_SEED missing; refusing to fabricate a success receipt",
        transactionHash: null,
        explorerUrl: null,
      };
    }

    // Intentional stub: do not call network or invent hashes until SDK/network
    // parameters are confirmed against current official documentation.
    return {
      status: "error",
      mode: "live",
      experienceId: req.experienceId,
      idempotencyKey: req.idempotencyKey,
      error:
        "live peaq submission not implemented in v0.1 — SDK/network parameters must be verified against current peaq-sdk-js docs before any real transaction; no fake hash returned",
      transactionHash: null,
      explorerUrl: null,
    };
  }
}
