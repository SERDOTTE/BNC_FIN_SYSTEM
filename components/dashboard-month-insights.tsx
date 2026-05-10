"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { getDashboardMonthlyBreakdown } from "@/lib/api-client";
import { formatCurrency, formatDate, installmentStatusLabel, resolveInstallmentStatus, installmentStatusTone } from "@/lib/formatters";
import type { DashboardMonthlyBreakdown, DashboardMonthlyInstallmentDetail, DashboardMonthlySaleDetail } from "@/lib/types";

type DashboardMonthInsightsProps = {
  initialMonth: number;
  initialYear: number;
  initialData: DashboardMonthlyBreakdown;
};

type DetailModal = "received" | "toReceive" | "overdue" | "sales" | null;

const months = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Marco" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" }
];

function installmentLabel(item: DashboardMonthlyInstallmentDetail) {
  if (item.saleCode) {
    return item.saleCode;
  }

  if (item.saleNumber) {
    return `Venda #${item.saleNumber}`;
  }

  return "Sem codigo";
}

function saleLabel(item: DashboardMonthlySaleDetail) {
  if (item.saleCode) {
    return item.saleCode;
  }

  if (item.saleNumber) {
    return `Venda #${item.saleNumber}`;
  }

  return "Sem codigo";
}

function saleStatusLabel(status: string) {
  switch (status) {
    case "PAID":          return "Recebido";
    case "PARTIALLY_PAID": return "Parcialmente recebido";
    case "OVERDUE":       return "Em atraso";
    case "CANCELED":      return "Cancelado";
    default:              return "Em aberto";
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function DashboardMonthInsights({ initialMonth, initialYear, initialData }: DashboardMonthInsightsProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<DashboardMonthlyBreakdown>(initialData);
  const [error, setError] = useState("");
  const [activeModal, setActiveModal] = useState<DetailModal>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const next = await getDashboardMonthlyBreakdown(month, year);
        setData(next);
        setError("");
      } catch {
        setError("Nao foi possivel carregar os detalhes mensais do dashboard.");
      }
    });
  }, [month, year]);

  const monthLabel = useMemo(() => {
    return months.find((item) => item.value === month)?.label ?? "Mes";
  }, [month]);

  const modalConfig = useMemo(() => {
    if (activeModal === "received") {
      return {
        title: "Parcelas recebidas no mes",
        subtitle: `${monthLabel} / ${year}`,
        amount: data.monthReceived,
        rows: data.installmentsReceived,
        showPaymentDate: true
      };
    }

    if (activeModal === "toReceive") {
      return {
        title: "Parcelas a receber no mes",
        subtitle: `${monthLabel} / ${year}`,
        amount: data.monthToReceive,
        rows: data.installmentsToReceive,
        showPaymentDate: false
      };
    }

    if (activeModal === "overdue") {
      return {
        title: "Parcelas em atraso no mes",
        subtitle: `${monthLabel} / ${year}`,
        amount: data.monthOverdue,
        rows: data.installmentsOverdue,
        showPaymentDate: false
      };
    }

    return null;
  }, [activeModal, data, monthLabel, year]);

  function openPrintWindow(title: string, subtitle: string, tableHeaders: string[], tableRows: string[][]) {
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) {
      return;
    }

    const headersHtml = tableHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const rowsHtml = tableRows
      .map((row) => `<tr>${row.map((col) => `<td>${escapeHtml(col)}</td>`).join("")}</tr>`)
      .join("");

    popup.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 1.2cm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Manrope", "Segoe UI", sans-serif; color: #0f2b45; background: #fff; font-size: 12px; }
    .print-wrap { padding: 6px; }
    .print-head { margin-bottom: 12px; border-bottom: 1px solid #d9e5ee; padding-bottom: 8px; }
    h1 { margin: 0; font-size: 19px; }
    p { margin: 4px 0 0; color: #4d6780; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5edf3; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { color: #4d6780; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    td { font-size: 12px; }
  </style>
</head>
<body>
  <div class="print-wrap">
    <div class="print-head">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <table>
      <thead>
        <tr>${headersHtml}</tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="99">Nenhum registro no periodo.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`);

    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 300);
  }

  function exportInstallmentsPdf() {
    if (!modalConfig) {
      return;
    }

    const headers = ["Venda", "Cliente", "Parcela", "Vencimento"];
    if (modalConfig.showPaymentDate) {
      headers.push("Pagamento");
    }
    headers.push("Status", "Valor BRL");

    const rows = modalConfig.rows.map((item) => {
      const base = [
        installmentLabel(item),
        item.customerName,
        String(item.installmentNumber),
        formatDate(item.dueDate)
      ];

      if (modalConfig.showPaymentDate) {
        base.push(item.paymentDate ? formatDate(item.paymentDate) : "-");
      }

      base.push(installmentStatusLabel(resolveInstallmentStatus(item.status, item.dueDate)), formatCurrency(item.amountBrl, "BRL"));
      return base;
    });

    openPrintWindow(
      modalConfig.title,
      `${modalConfig.subtitle} | Total: ${formatCurrency(modalConfig.amount, "BRL")}`,
      headers,
      rows
    );
  }

  function exportSalesPdf() {
    const headers = [
      "Venda",
      "Cliente",
      "Data venda",
      "Parcelas",
      "Total venda BRL",
      "Previsto receber BRL"
    ];

    const rows = data.sales.map((sale) => [
      saleLabel(sale),
      sale.customerName,
      formatDate(sale.saleDate),
      String(sale.installmentsCount),
      formatCurrency(sale.totalSaleBrl, "BRL"),
      formatCurrency(sale.projectedReceiptsBrl, "BRL")
    ]);

    openPrintWindow(
      "Vendas realizadas no mes",
      `${monthLabel} / ${year} | Quantidade: ${data.salesCount} | Total vendido: ${formatCurrency(data.totalSalesMonthBrl, "BRL")}`,
      headers,
      rows
    );
  }

  return (
    <div className="month-insights-wrap">
      <div className="month-insights-left">
        <div className="month-filter-row">
          <div className="field month-field">
            <label htmlFor="dashboard-month">Mes</label>
            <select id="dashboard-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field month-field">
            <label htmlFor="dashboard-year">Ano</label>
            <input
              id="dashboard-year"
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="kpi-list month-kpi-list">
          <button type="button" className="month-kpi-button" onClick={() => setActiveModal("received")}>
            <span className="subtle">Recebido no mes</span>
            <strong>{formatCurrency(data.monthReceived, "BRL")}</strong>
            <span className="subtle">Clique para abrir a janela com as parcelas</span>
          </button>

          <button type="button" className="month-kpi-button" onClick={() => setActiveModal("toReceive")}>
            <span className="subtle">A receber no mes</span>
            <strong>{formatCurrency(data.monthToReceive, "BRL")}</strong>
            <span className="subtle">Clique para abrir a janela com as parcelas</span>
          </button>

          <button type="button" className="month-kpi-button" onClick={() => setActiveModal("overdue")}>
            <span className="subtle">Em atraso no mes</span>
            <strong>{formatCurrency(data.monthOverdue, "BRL")}</strong>
            <span className="subtle">Clique para abrir a janela com as parcelas</span>
          </button>
        </div>
      </div>

      <aside className="month-sales-panel">
        <span className="chip warning">Resumo de vendas</span>
        <strong>{formatCurrency(data.totalSalesMonthBrl, "BRL")}</strong>
        <span className="subtle">Total de vendas realizadas em {monthLabel} / {year}</span>

        <div className="kpi-list">
          <div className="kpi-row">
            <span className="subtle">Quantidade de vendas</span>
            <button type="button" className="month-link-button" onClick={() => setActiveModal("sales")}>
              {data.salesCount}
            </button>
          </div>
          <div className="kpi-row">
            <span className="subtle">Previsto de recebimento</span>
            <span>{formatCurrency(data.projectedReceiptsMonthBrl, "BRL")}</span>
          </div>
        </div>
      </aside>

      {isPending ? <p className="subtle">Atualizando composicao mensal...</p> : null}
      {error ? <p className="subtle">{error}</p> : null}

      {modalConfig ? (
        <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label={modalConfig.title}>
          <div className="flow-detail-modal">
            <div className="flow-detail-header">
              <div>
                <h3>{modalConfig.title}</h3>
                <p className="subtle">{modalConfig.subtitle} · {formatCurrency(modalConfig.amount, "BRL")}</p>
              </div>
              <div className="modal-actions-row">
                <button className="btn secondary" type="button" onClick={exportInstallmentsPdf}>
                  Exportar PDF
                </button>
                <button className="btn secondary" type="button" onClick={() => setActiveModal(null)}>
                  Fechar
                </button>
              </div>
            </div>

            <div className="flow-detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Cliente</th>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    {modalConfig.showPaymentDate ? <th>Pagamento</th> : null}
                    <th>Status</th>
                    <th>Valor BRL</th>
                  </tr>
                </thead>
                <tbody>
                  {modalConfig.rows.map((item) => (
                    <tr key={item.installmentId}>
                      <td>{installmentLabel(item)}</td>
                      <td>{item.customerName}</td>
                      <td>{item.installmentNumber}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      {modalConfig.showPaymentDate ? <td>{item.paymentDate ? formatDate(item.paymentDate) : "-"}</td> : null}
                      <td>
                        {(() => {
                          const resolved = resolveInstallmentStatus(item.status, item.dueDate);
                          return (
                            <span className={`chip ${installmentStatusTone(resolved)}`}>
                              {installmentStatusLabel(resolved)}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{formatCurrency(item.amountBrl, "BRL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === "sales" ? (
        <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label="Vendas do mes">
          <div className="flow-detail-modal">
            <div className="flow-detail-header">
              <div>
                <h3>Vendas realizadas no mes</h3>
                <p className="subtle">{monthLabel} / {year} · {data.salesCount} vendas</p>
              </div>
              <div className="modal-actions-row">
                <button className="btn secondary" type="button" onClick={exportSalesPdf}>
                  Exportar PDF
                </button>
                <button className="btn secondary" type="button" onClick={() => setActiveModal(null)}>
                  Fechar
                </button>
              </div>
            </div>

            <div className="flow-detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Cliente</th>
                    <th>Data venda</th>
                    <th>Parcelas</th>
                    <th>Total venda BRL</th>
                    <th>Previsto receber BRL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((sale) => (
                    <tr key={sale.receivableId}>
                      <td>{saleLabel(sale)}</td>
                      <td>{sale.customerName}</td>
                      <td>{formatDate(sale.saleDate)}</td>
                      <td>{sale.installmentsCount}</td>
                      <td>{formatCurrency(sale.totalSaleBrl, "BRL")}</td>
                      <td>{formatCurrency(sale.projectedReceiptsBrl, "BRL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
