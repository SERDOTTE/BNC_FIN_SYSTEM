"use client";

import { useRef, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";

type ReconciliationInstallment = {
  id: string;
  installmentNumber: number;
  amountUsd: number;
  amountBrl: number;
  dueDate: string;
  status: string;
  paymentDate?: string;
};

type ReconciliationSale = {
  id: string;
  saleCode?: string;
  saleNumber?: number;
  customerName: string;
  saleDate: string;
  totalAmount: number;
  currency: string;
  fxRateUsdBrl?: number;
  totalAmountBrl: number;
  meioPagamentoNome?: string;
  accountName?: string;
  status: string;
  installments: ReconciliationInstallment[];
};

type ReportData = {
  month: string;
  sales: ReconciliationSale[];
};

function statusLabel(status: string) {
  switch (status) {
    case "PAID": return "Recebido";
    case "PENDING": return "A Receber";
    case "OVERDUE": return "Atrasado";
    case "CANCELED": return "Cancelado";
    default: return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "PAID": return "chip positive";
    case "PENDING": return "chip warning";
    case "OVERDUE": return "chip danger";
    case "CANCELED": return "chip";
    default: return "chip";
  }
}

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, mon - 1, 1));
}

export function SalesReconciliationReport() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/api/reports/sales-reconciliation?month=${selectedMonth}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar relatório.");
        return;
      }
      setReport(data as ReportData);
    } catch {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!report || !printRef.current) return;

    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Conciliação de Vendas – ${monthLabel(report.month)}</title>
  <style>
    @page { size: A4 landscape; margin: 1.2cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 0.72rem; color: #111; background: white; }
    h2 { font-size: 1rem; margin-bottom: 0.25rem; }
    p { margin-bottom: 0.2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.72rem; margin-bottom: 0.5rem; }
    th { text-align: left; padding: 0.2rem 0.3rem; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
    th:not(:first-child):not(:nth-child(5)):not(:nth-child(6)):not(:nth-child(7)):not(:nth-child(8)) { text-align: right; }
    td { padding: 0.2rem 0.3rem; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; font-variant-numeric: tabular-nums; }
    .recon-sale-block { margin-bottom: 1.2rem; page-break-inside: avoid; }
    .sale-header { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
    .sale-code { font-weight: 700; font-size: 0.75rem; color: #888; }
    .sale-name { font-weight: 700; font-size: 0.85rem; }
    .sale-date { font-size: 0.72rem; color: #6b7280; }
    .chip { border: 1px solid #ccc; border-radius: 3px; padding: 0 4px; font-size: 0.68rem; }
    .chip.positive { border-color: #16a34a; color: #16a34a; }
    .chip.warning { border-color: #d97706; color: #d97706; }
    .chip.danger { border-color: #dc2626; color: #dc2626; }
    tfoot td { font-weight: 600; border-top: 1px solid #d1d5db; border-bottom: none; padding-top: 0.3rem; }
    .totals { border-top: 2px solid #374151; padding-top: 0.75rem; margin-top: 0.75rem; display: flex; gap: 2rem; flex-wrap: wrap; page-break-inside: avoid; }
    .totals-item p:first-child { font-size: 0.65rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem; }
    .totals-item .big { font-size: 1.1rem; font-weight: 700; }
    .totals-item .positive { color: #16a34a; }
    .totals-item .warning { color: #d97706; }
    .subtle { color: #6b7280; }
    .print-header { margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="print-header">
    <h2>Conciliação de Vendas</h2>
    <p class="subtle">Período: ${monthLabel(report.month)}</p>
  </div>
  ${content}
</body>
</html>`);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }

  const totalBrlAll = report?.sales.reduce((sum, sale) => {
    const paidBrl = sale.installments
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + i.amountBrl, 0);
    const pendingBrl = sale.installments
      .filter((i) => i.status !== "PAID" && i.status !== "CANCELED")
      .reduce((s, i) => s + i.amountBrl, 0);
    return sum + paidBrl + pendingBrl;
  }, 0) ?? 0;

  const totalPaidBrl = report?.sales.reduce((sum, sale) =>
    sum + sale.installments.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountBrl, 0), 0) ?? 0;

  const totalPendingBrl = report?.sales.reduce((sum, sale) =>
    sum + sale.installments.filter((i) => i.status !== "PAID" && i.status !== "CANCELED").reduce((s, i) => s + i.amountBrl, 0), 0) ?? 0;

  return (
    <div>
      {/* Controls – hidden on print */}
      <div className="recon-controls no-print" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input"
          style={{ maxWidth: "180px" }}
        />
        <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
          {loading ? "Gerando..." : "Gerar Relatório"}
        </button>
        {report && (
          <button className="btn-secondary no-print" onClick={handlePrint}>
            Imprimir / PDF
          </button>
        )}
      </div>

      {error && (
        <p className="no-print" style={{ color: "var(--danger, #dc2626)", marginTop: "1rem" }}>{error}</p>
      )}

      {report && (
        <div ref={printRef} className="recon-print-area" style={{ marginTop: "1.5rem" }}>
          {/* Print header */}
          <div className="print-only" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ margin: 0 }}>Conciliação de Vendas</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#555" }}>
              Período: {monthLabel(report.month)}
            </p>
          </div>

          {report.sales.length === 0 ? (
            <p className="subtle">Nenhuma venda encontrada para o período selecionado.</p>
          ) : (
            <>
              {report.sales.map((sale) => {
                const salePaidBrl = sale.installments
                  .filter((i) => i.status === "PAID")
                  .reduce((s, i) => s + i.amountBrl, 0);
                const salePendingBrl = sale.installments
                  .filter((i) => i.status !== "PAID" && i.status !== "CANCELED")
                  .reduce((s, i) => s + i.amountBrl, 0);

                return (
                  <div key={sale.id} className="recon-sale-block" style={{ marginBottom: "2rem", pageBreakInside: "avoid" }}>
                    {/* Sale header */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                      {sale.saleCode && (
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#888" }}>#{sale.saleCode}</span>
                      )}
                      <strong style={{ fontSize: "1rem" }}>{sale.customerName}</strong>
                      <span className="subtle" style={{ fontSize: "0.8rem" }}>{formatDate(sale.saleDate)}</span>
                      {sale.meioPagamentoNome && (
                        <span className="chip" style={{ fontSize: "0.75rem" }}>{sale.meioPagamentoNome}</span>
                      )}
                      {sale.accountName && (
                        <span className="chip" style={{ fontSize: "0.75rem" }}>{sale.accountName}</span>
                      )}
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Parcela</th>
                          <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Valor USD</th>
                          <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Cotação</th>
                          <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Valor BRL</th>
                          <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Vencimento</th>
                          <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Status</th>
                          <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Meio de Pagto.</th>
                          <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", color: "#6b7280", fontWeight: 600 }}>Conta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.installments.map((inst) => (
                          <tr key={inst.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "0.35rem 0.5rem" }}>Parcela {inst.installmentNumber}</td>
                            <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {sale.currency === "USD"
                                ? formatCurrency(inst.amountUsd, "USD")
                                : "—"}
                            </td>
                            <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {sale.fxRateUsdBrl ? sale.fxRateUsdBrl.toFixed(2) : "—"}
                            </td>
                            <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(inst.amountBrl, "BRL")}
                            </td>
                            <td style={{ padding: "0.35rem 0.5rem" }}>{formatDate(inst.dueDate)}</td>
                            <td style={{ padding: "0.35rem 0.5rem" }}>
                              <span className={statusClass(inst.status)}>{statusLabel(inst.status)}</span>
                            </td>
                            <td style={{ padding: "0.35rem 0.5rem", color: "#6b7280" }}>{sale.meioPagamentoNome ?? "—"}</td>
                            <td style={{ padding: "0.35rem 0.5rem", color: "#6b7280" }}>{sale.accountName ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "1px solid #d1d5db", fontWeight: 600 }}>
                          <td colSpan={3} style={{ padding: "0.4rem 0.5rem", color: "#6b7280" }}>Subtotal da venda</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(salePaidBrl + salePendingBrl, "BRL")}
                          </td>
                          <td colSpan={4} style={{ padding: "0.4rem 0.5rem", fontSize: "0.78rem", color: "#6b7280" }}>
                            Recebido: {formatCurrency(salePaidBrl, "BRL")} · A Receber: {formatCurrency(salePendingBrl, "BRL")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}

              {/* Grand total */}
              <div style={{
                borderTop: "2px solid #374151",
                paddingTop: "1rem",
                marginTop: "1rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "2rem",
                pageBreakInside: "avoid"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Total Geral do Mês ({monthLabel(report.month)})
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "1.4rem", fontWeight: 700 }}>
                    {formatCurrency(totalBrlAll, "BRL")}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recebido</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--positive, #16a34a)" }}>
                    {formatCurrency(totalPaidBrl, "BRL")}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>A Receber</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--warning, #d97706)" }}>
                    {formatCurrency(totalPendingBrl, "BRL")}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vendas no Mês</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "1.1rem", fontWeight: 600 }}>
                    {report.sales.length}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
