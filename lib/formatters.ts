export type ResolvedInstallmentStatus = "PAID" | "OVERDUE" | "PENDING" | "CANCELED";

/**
 * Resolve o status de exibição de uma parcela, considerando dinamicamente
 * se o vencimento já passou (parcela PENDING vencida → OVERDUE).
 */
export function resolveInstallmentStatus(status: string, dueDate: string): ResolvedInstallmentStatus {
  if (status === "PAID") return "PAID";
  if (status === "CANCELED") return "CANCELED";
  if (status === "OVERDUE") return "OVERDUE";

  // PENDING/OPEN/PARTIALLY_PAID vencido pela data → tratar como OVERDUE
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (due.getTime() < today.getTime()) return "OVERDUE";

  return "PENDING";
}

/** Rótulo padrão para exibição do status de parcelas (recebíveis). */
export function installmentStatusLabel(status: ResolvedInstallmentStatus): string {
  switch (status) {
    case "PAID":     return "Recebido";
    case "OVERDUE":  return "Atraso";
    case "CANCELED": return "Cancelado";
    default:         return "Receber";
  }
}

/** Classe de cor (chip tone) para o status de parcelas. */
export function installmentStatusTone(status: ResolvedInstallmentStatus): string {
  switch (status) {
    case "PAID":    return "positive";
    case "OVERDUE": return "danger";
    default:        return "warning";
  }
}

/** Rótulo padrão para exibição do status de contas a pagar. */
export function payableStatusLabel(rawStatus: string, dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const isLate = rawStatus !== "PAID" && rawStatus !== "CANCELED" && due.getTime() < today.getTime();
  const resolved = isLate ? "OVERDUE" : rawStatus;

  switch (resolved) {
    case "PAID":     return "Pago";
    case "OVERDUE":  return "Atraso";
    case "CANCELED": return "Cancelado";
    default:         return "A pagar";
  }
}

export function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium"
  }).format(parsed);
}