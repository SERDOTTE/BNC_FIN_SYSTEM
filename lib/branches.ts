export type BranchCode = "CANCUN" | "PUNTA_CANA";

export type BranchDefinition = {
  code: BranchCode;
  prefix: string;
  label: string;
};

export const BRANCHES: BranchDefinition[] = [
  { code: "CANCUN", prefix: "CCN", label: "CANCUN" },
  { code: "PUNTA_CANA", prefix: "PCN", label: "PUNTA CANA" }
];

const BRANCH_MAP: Record<BranchCode, BranchDefinition> = {
  CANCUN: BRANCHES[0],
  PUNTA_CANA: BRANCHES[1]
};

export function normalizeBranchCode(value: unknown): BranchCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "CANCUN") return "CANCUN";
  if (normalized === "PUNTA_CANA" || normalized === "PUNTA CANA" || normalized === "PUNTACANA") {
    return "PUNTA_CANA";
  }
  return null;
}

export function resolveBranchDefinition(value: unknown): BranchDefinition | null {
  const code = normalizeBranchCode(value);
  return code ? BRANCH_MAP[code] : null;
}

export function fallbackBranchDefinition(): BranchDefinition {
  return BRANCH_MAP.CANCUN;
}
