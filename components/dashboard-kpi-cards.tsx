"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { getDashboardMonthlyBreakdown } from "@/lib/api-client";
import { formatCurrency, formatDate, installmentStatusLabel, resolveInstallmentStatus } from "@/lib/formatters";
import type { BranchCode, DashboardMonthlyBreakdown } from "@/lib/types";

type DashboardKpiCardsProps = {
  initialMonth: number;
  initialYear: number;
  initialData: DashboardMonthlyBreakdown;
};

type ActiveKpiModal = "sales" | "sold" | "cash" | "unreceived" | null;

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

const branches: Array<{ code: BranchCode; label: string }> = [
  { code: "CANCUN", label: "Cancun" },
  { code: "PUNTA_CANA", label: "Puntacana" }
];

function resolveBranch(data: DashboardMonthlyBreakdown, code: BranchCode) {
  return data.branchSummaries.find((item) => item.branchCode === code);
}

function receiptRate(received: number, toReceive: number, overdue: number) {
  const base = received + toReceive + overdue;
  if (base <= 0) {
    return 0;
  }
  return (received / base) * 100;
}

function totalCashValue(received: number, toReceive: number, overdue: number) {
  return received + toReceive + overdue;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    h2 { margin: 18px 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
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

function openGroupedPrintWindow(
  title: string,
  subtitle: string,
  tableHeaders: string[],
  groups: Array<{ title: string; rows: string[][]; subtotalLabel: string; subtotalValue: string }>,
  grandTotal?: { label: string; value: string }
) {
  const popup = window.open("", "_blank", "width=1200,height=900");
  if (!popup) {
    return;
  }

  const headersHtml = tableHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const groupsHtml = groups
    .map((group) => {
      const rowsHtml = group.rows
        .map((row) => `<tr>${row.map((col) => `<td>${escapeHtml(col)}</td>`).join("")}</tr>`)
        .join("");

      return `
        <section class="group-block">
          <h2>${escapeHtml(group.title)}</h2>
          <table>
            <thead>
              <tr>${headersHtml}</tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="99">Nenhum registro no periodo.</td></tr>'}
            </tbody>
          </table>
          <div class="subtotal-row">
            <strong>${escapeHtml(group.subtotalLabel)}:</strong>
            <span>${escapeHtml(group.subtotalValue)}</span>
          </div>
        </section>`;
    })
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
    h2 { margin: 18px 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border-bottom: 1px solid #e5edf3; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { color: #4d6780; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    td { font-size: 12px; }
    .group-block { margin-bottom: 18px; }
    .subtotal-row { display: flex; justify-content: flex-end; gap: 8px; font-size: 12px; }
    .grand-total-row { margin-top: 10px; border-top: 2px solid #d9e5ee; padding-top: 10px; display: flex; justify-content: flex-end; gap: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="print-wrap">
    <div class="print-head">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    ${groupsHtml}
    ${grandTotal ? `<div class="grand-total-row"><strong>${escapeHtml(grandTotal.label)}:</strong><span>${escapeHtml(grandTotal.value)}</span></div>` : ""}
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

export function DashboardKpiCards({ initialMonth, initialYear, initialData }: DashboardKpiCardsProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<DashboardMonthlyBreakdown>(initialData);
  const [error, setError] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveKpiModal>(null);
  const [isPending, startTransition] = useTransition();

  const yearOptions = useMemo(() => {
    const options: number[] = [];
    for (let current = initialYear - 5; current <= initialYear + 1; current += 1) {
      options.push(current);
    }
    if (!options.includes(year)) {
      options.push(year);
      options.sort((a, b) => a - b);
    }
    return options;
  }, [initialYear, year]);

  useEffect(() => {
    startTransition(async () => {
      try {
        const next = await getDashboardMonthlyBreakdown(month, year);
        setData(next);
        setError("");
      } catch {
        setError("Nao foi possivel atualizar os indicadores por mes/ano.");
      }
    });
  }, [month, year]);

  const currentReceiptRate = useMemo(() => {
    return receiptRate(data.monthReceived, data.monthToReceive, data.monthOverdue);
  }, [data.monthOverdue, data.monthReceived, data.monthToReceive]);

  const currentCashValue = useMemo(() => {
    return totalCashValue(data.monthReceived, data.monthToReceive, data.monthOverdue);
  }, [data.monthOverdue, data.monthReceived, data.monthToReceive]);

  const branchRows = useMemo(() => {
    return branches.map((branch) => {
      const summary = resolveBranch(data, branch.code);
      const salesCount = summary?.salesCount ?? 0;
      const sold = summary?.totalSalesBrl ?? 0;
      const received = summary?.monthReceivedBrl ?? 0;
      const toReceive = summary?.monthToReceiveBrl ?? 0;
      const overdue = summary?.monthOverdueBrl ?? 0;

      return {
        ...branch,
        salesCount,
        sold,
        received,
        cashValue: totalCashValue(received, toReceive, overdue),
        rate: receiptRate(received, toReceive, overdue)
      };
    });
  }, [data]);

  const salesByBranch = useMemo(() => {
    return branches
      .map((branch) => ({
        ...branch,
        rows: data.sales
          .filter((sale) => sale.branchCode === branch.code)
          .sort((left, right) => left.saleDate.localeCompare(right.saleDate))
      }))
      .filter((branch) => branch.rows.length > 0);
  }, [data.sales]);

  const cashByBranch = useMemo(() => {
    const rows = [...data.installmentsReceived, ...data.installmentsToReceive, ...data.installmentsOverdue];

    return branches
      .map((branch) => ({
        ...branch,
        rows: rows
          .filter((item) => item.branchCode === branch.code)
          .sort((left, right) => {
            const leftDate = left.paymentDate || left.dueDate;
            const rightDate = right.paymentDate || right.dueDate;
            return leftDate.localeCompare(rightDate);
          })
      }))
      .filter((branch) => branch.rows.length > 0);
  }, [data.installmentsOverdue, data.installmentsReceived, data.installmentsToReceive]);

  const unreceivedByBranch = useMemo(() => {
    const rows = [...data.installmentsToReceive, ...data.installmentsOverdue];

    return branches
      .map((branch) => ({
        ...branch,
        rows: rows
          .filter((item) => item.branchCode === branch.code)
          .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
      }))
      .filter((branch) => branch.rows.length > 0);
  }, [data.installmentsOverdue, data.installmentsToReceive]);

  const modalTitle = useMemo(() => {
    if (activeModal === "sales") {
      return "Relação de vendas do total de vendas";
    }

    if (activeModal === "sold") {
      return "Relação de vendas da receita vendida";
    }

    if (activeModal === "cash") {
      return "Relação da receita em caixa";
    }

    if (activeModal === "unreceived") {
      return "Relação de parcelas ainda não recebidas";
    }

    return "";
  }, [activeModal]);

  function exportCashPdf() {
    const headers = ["Data recebimento", "Venda", "Cliente", "Parcela", "Vencimento", "Status", "Valor BRL"];

    const groups = cashByBranch.map((branch) => {
      const rows = branch.rows.map((item) => {
        const resolvedStatus = resolveInstallmentStatus(item.status, item.dueDate);

        return [
          formatDate(item.paymentDate || item.dueDate),
          item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo"),
          item.customerName,
          `${item.installmentNumber}/${item.totalInstallments}`,
          formatDate(item.dueDate),
          installmentStatusLabel(resolvedStatus),
          formatCurrency(item.amountBrl, "BRL")
        ];
      });

      const subtotal = branch.rows.reduce((sum, item) => sum + item.amountBrl, 0);

      return {
        title: branch.label,
        rows,
        subtotalLabel: `Subtotal ${branch.label}`,
        subtotalValue: formatCurrency(subtotal, "BRL")
      };
    });

    const grandTotal = cashByBranch.reduce(
      (sum, branch) => sum + branch.rows.reduce((partial, item) => partial + item.amountBrl, 0),
      0
    );

    openGroupedPrintWindow(
      "Relacao da receita em caixa",
      `${month}/${year} · separado por filial`,
      headers,
      groups,
      {
        label: "Total geral",
        value: formatCurrency(grandTotal, "BRL")
      }
    );
  }

  function exportUnreceivedPdf() {
    const headers = ["Vencimento", "Venda", "Cliente", "Parcela", "Status", "Valor BRL"];

    const groups = unreceivedByBranch.map((branch) => {
      const rows = branch.rows.map((item) => {
        const resolvedStatus = resolveInstallmentStatus(item.status, item.dueDate);

        return [
          formatDate(item.dueDate),
          item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo"),
          item.customerName,
          `${item.installmentNumber}/${item.totalInstallments}`,
          installmentStatusLabel(resolvedStatus),
          formatCurrency(item.amountBrl, "BRL")
        ];
      });

      const subtotal = branch.rows.reduce((sum, item) => sum + item.amountBrl, 0);

      return {
        title: branch.label,
        rows,
        subtotalLabel: `Subtotal ${branch.label}`,
        subtotalValue: formatCurrency(subtotal, "BRL")
      };
    });

    const grandTotal = unreceivedByBranch.reduce(
      (sum, branch) => sum + branch.rows.reduce((partial, item) => partial + item.amountBrl, 0),
      0
    );

    openGroupedPrintWindow(
      "Relacao de parcelas ainda nao recebidas",
      `${month}/${year} · separado por filial`,
      headers,
      groups,
      {
        label: "Total geral",
        value: formatCurrency(grandTotal, "BRL")
      }
    );
  }

  return (
    <>
      <section className="trip-kpi-filter-bar">
        <div className="field month-field">
          <label htmlFor="dashboard-kpi-month">Mes</label>
          <select id="dashboard-kpi-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {months.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field month-field">
          <label htmlFor="dashboard-kpi-year">Ano</label>
          <select id="dashboard-kpi-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <span className="subtle">{isPending ? "Atualizando indicadores..." : `Indicadores de ${month}/${year}`}</span>
      </section>

      <section className="trip-kpi-grid">
        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Vendas Totais</h3>
            <span className="trip-kpi-badge">
              <img className="trip-kpi-icon" src="/images/kpi/vendas.png" alt="Vendas totais" />
            </span>
          </div>
          <button type="button" className="trip-kpi-value-button" onClick={() => setActiveModal("sales")}>
            <strong>{data.salesCount}</strong>
          </button>
          <div className="trip-kpi-branches">
            {branchRows.map((branch) => (
              <span key={`sales-${branch.code}`} className="subtle">
                {branch.label}: {branch.salesCount}
              </span>
            ))}
          </div>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Receita Vendida (Bruta)</h3>
            <span className="trip-kpi-badge">
              <img className="trip-kpi-icon" src="/images/kpi/receita_vendida.png" alt="Receita vendida" />
            </span>
          </div>
          <button type="button" className="trip-kpi-value-button" onClick={() => setActiveModal("sold")}>
            <strong>{formatCurrency(data.totalSalesMonthBrl, "BRL")}</strong>
          </button>
          <div className="trip-kpi-branches">
            {branchRows.map((branch) => (
              <span key={`sold-${branch.code}`} className="subtle">
                {branch.label}: {formatCurrency(branch.sold, "BRL")}
              </span>
            ))}
          </div>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Receita em Caixa (Liquida)</h3>
            <span className="trip-kpi-badge">
              <img className="trip-kpi-icon" src="/images/kpi/receita_em_caixa.png" alt="Receita em caixa" />
            </span>
          </div>
          <button type="button" className="trip-kpi-value-button" onClick={() => setActiveModal("cash")}>
            <strong>{formatCurrency(currentCashValue, "BRL")}</strong>
          </button>
          <div className="trip-kpi-branches">
            {branchRows.map((branch) => (
              <span key={`received-${branch.code}`} className="subtle">
                {branch.label}: {formatCurrency(branch.cashValue, "BRL")}
              </span>
            ))}
          </div>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Percentual já recebido</h3>
            <span className="trip-kpi-badge">
              <img className="trip-kpi-icon" src="/images/kpi/taxa_recebimento.png" alt="Taxa de recebimento" />
            </span>
          </div>
          <button type="button" className="trip-kpi-value-button" onClick={() => setActiveModal("unreceived")}>
            <strong>{currentReceiptRate.toFixed(1)}%</strong>
          </button>
          <div className="trip-kpi-branches">
            {branchRows.map((branch) => (
              <span key={`rate-${branch.code}`} className="subtle">
                {branch.label}: {branch.rate.toFixed(1)}%
              </span>
            ))}
          </div>
        </article>
      </section>

      {error ? <p className="subtle">{error}</p> : null}

      {activeModal ? (
        <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label={modalTitle}>
          <div className="flow-detail-modal">
            <div className="flow-detail-header">
              <div>
                <h3>{modalTitle}</h3>
                <p className="subtle">{month}/{year} · separado por filial</p>
              </div>
              <div className="modal-actions-row">
                {activeModal === "cash" ? (
                  <button className="btn secondary" type="button" onClick={exportCashPdf}>
                    Exportar PDF
                  </button>
                ) : null}
                {activeModal === "unreceived" ? (
                  <button className="btn secondary" type="button" onClick={exportUnreceivedPdf}>
                    Exportar PDF
                  </button>
                ) : null}
                <button className="btn secondary" type="button" onClick={() => setActiveModal(null)}>
                  Fechar
                </button>
              </div>
            </div>

            {activeModal === "sales" || activeModal === "sold" ? (
              <div className="trip-kpi-modal-groups">
                {salesByBranch.map((branch) => (
                  <section key={branch.code} className="trip-kpi-modal-section">
                    <h4>{branch.label}</h4>
                    <div className="flow-detail-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Data venda</th>
                            <th>Venda</th>
                            <th>Cliente</th>
                            <th>Parcelas</th>
                            <th>Total BRL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branch.rows.map((sale) => (
                            <tr key={sale.receivableId}>
                              <td>{formatDate(sale.saleDate)}</td>
                              <td>{sale.saleCode || (sale.saleNumber ? `Venda #${sale.saleNumber}` : "Sem codigo")}</td>
                              <td>{sale.customerName}</td>
                              <td>{sale.installmentsCount}</td>
                              <td>{formatCurrency(sale.totalSaleBrl, "BRL")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {activeModal === "cash" ? (
              <div className="trip-kpi-modal-groups">
                {cashByBranch.map((branch) => (
                  <section key={branch.code} className="trip-kpi-modal-section">
                    <h4>{branch.label}</h4>
                    <div className="flow-detail-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Data recebimento</th>
                            <th>Venda</th>
                            <th>Cliente</th>
                            <th>Parcela</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                            <th>Valor BRL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branch.rows.map((item) => {
                            const resolvedStatus = resolveInstallmentStatus(item.status, item.dueDate);

                            return (
                              <tr key={item.installmentId}>
                                <td>{formatDate(item.paymentDate || item.dueDate)}</td>
                                <td>{item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo")}</td>
                                <td>{item.customerName}</td>
                                <td>{item.installmentNumber}/{item.totalInstallments}</td>
                                <td>{formatDate(item.dueDate)}</td>
                                <td>{installmentStatusLabel(resolvedStatus)}</td>
                                <td>{formatCurrency(item.amountBrl, "BRL")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {activeModal === "unreceived" ? (
              <div className="trip-kpi-modal-groups">
                {unreceivedByBranch.map((branch) => (
                  <section key={branch.code} className="trip-kpi-modal-section">
                    <h4>{branch.label}</h4>
                    <div className="flow-detail-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Vencimento</th>
                            <th>Venda</th>
                            <th>Cliente</th>
                            <th>Parcela</th>
                            <th>Status</th>
                            <th>Valor BRL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branch.rows.map((item) => {
                            const resolvedStatus = resolveInstallmentStatus(item.status, item.dueDate);

                            return (
                              <tr key={item.installmentId}>
                                <td>{formatDate(item.dueDate)}</td>
                                <td>{item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo")}</td>
                                <td>{item.customerName}</td>
                                <td>{item.installmentNumber}/{item.totalInstallments}</td>
                                <td>{installmentStatusLabel(resolvedStatus)}</td>
                                <td>{formatCurrency(item.amountBrl, "BRL")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
