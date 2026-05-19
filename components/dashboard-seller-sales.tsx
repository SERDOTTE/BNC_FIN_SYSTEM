"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { getDashboardMonthlyBreakdown } from "@/lib/api-client";
import { formatCurrency, formatDate, installmentStatusLabel, resolveInstallmentStatus } from "@/lib/formatters";
import type { BranchCode, DashboardMonthlyBreakdown } from "@/lib/types";

type DashboardSellerSalesProps = {
  initialMonth: number;
  initialYear: number;
  initialData: DashboardMonthlyBreakdown;
};

type SellerRow = {
  sellerId?: string;
  sellerName: string;
  salesCount: number;
  averageUsdRate: number;
  totalSalesUsd: number;
  totalSalesBrl: number;
  receivableInMonthBrl: number;
};

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

const branchOptions: Array<{ value: BranchCode; label: string }> = [
  { value: "CANCUN", label: "Cancun" },
  { value: "PUNTA_CANA", label: "Puntacana" }
];

function saleLabel(sale: DashboardMonthlyBreakdown["sales"][number]) {
  if (sale.saleCode) {
    return sale.saleCode;
  }
  if (sale.saleNumber) {
    return `Venda #${sale.saleNumber}`;
  }
  return "Sem codigo";
}

function safeCurrency(value: number | undefined, currency: string) {
  return formatCurrency(Number.isFinite(value) ? Number(value) : 0, currency);
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

export function DashboardSellerSales({ initialMonth, initialYear, initialData }: DashboardSellerSalesProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [branch, setBranch] = useState<BranchCode>("CANCUN");
  const [data, setData] = useState<DashboardMonthlyBreakdown>(initialData);
  const [error, setError] = useState("");
  const [activeSellerKey, setActiveSellerKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const next = await getDashboardMonthlyBreakdown(month, year);
        setData(next);
        setError("");
      } catch {
        setError("Nao foi possivel carregar a relacao de vendas por vendedor.");
      }
    });
  }, [month, year]);

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

  const filteredSales = useMemo(() => {
    return data.sales.filter((sale) => sale.branchCode === branch);
  }, [data.sales, branch]);

  const filteredMonthlyInstallments = useMemo(() => {
    return [
      ...data.installmentsReceived.filter((item) => item.branchCode === branch),
      ...data.installmentsToReceive.filter((item) => item.branchCode === branch),
      ...data.installmentsOverdue.filter((item) => item.branchCode === branch)
    ];
  }, [data.installmentsOverdue, data.installmentsReceived, data.installmentsToReceive, branch]);

  const sellerRows = useMemo(() => {
    const base = data.sellerSummaries
      .filter((seller) =>
        filteredSales.some(
          (sale) => (sale.sellerName || "Sem vendedor") === seller.sellerName && (sale.sellerId || "") === (seller.sellerId || "")
        )
      )
      .map((seller) => ({ ...seller }));

    if (base.length > 0) {
      return base;
    }

    const fallbackMap = new Map<string, SellerRow>();
    for (const installment of filteredMonthlyInstallments) {
      const sellerId = installment.sellerId;
      const sellerName = installment.sellerName || "Sem vendedor";
      const key = `${sellerId || "no-id"}-${sellerName}`;
      const existing = fallbackMap.get(key);
      if (existing) {
        existing.receivableInMonthBrl += installment.amountBrl;
      } else {
        fallbackMap.set(key, {
          sellerId,
          sellerName,
          salesCount: 0,
          averageUsdRate: 0,
          totalSalesUsd: 0,
          totalSalesBrl: 0,
          receivableInMonthBrl: installment.amountBrl
        });
      }
    }

    return Array.from(fallbackMap.values()).sort((left, right) => left.sellerName.localeCompare(right.sellerName, "pt-BR"));
  }, [data.sellerSummaries, filteredMonthlyInstallments, filteredSales]);

  const activeSeller = useMemo(() => {
    if (!activeSellerKey) {
      return null;
    }
    return sellerRows.find((row) => `${row.sellerId || "no-id"}-${row.sellerName}` === activeSellerKey) || null;
  }, [activeSellerKey, sellerRows]);

  const activeSellerSales = useMemo(() => {
    if (!activeSeller) {
      return [] as DashboardMonthlyBreakdown["sales"];
    }
    return filteredSales.filter(
      (sale) => (sale.sellerName || "Sem vendedor") === activeSeller.sellerName && (sale.sellerId || "") === (activeSeller.sellerId || "")
    );
  }, [activeSeller, filteredSales]);

  const activeSellerInstallments = useMemo(() => {
    if (!activeSeller) {
      return [] as Array<
        DashboardMonthlyBreakdown["installmentsReceived"][number]
      >;
    }

    return filteredMonthlyInstallments.filter(
      (item) => (item.sellerName || "Sem vendedor") === activeSeller.sellerName && (item.sellerId || "") === (activeSeller.sellerId || "")
    );
  }, [activeSeller, filteredMonthlyInstallments]);

  function exportSellerSalesPdf() {
    if (!activeSeller) {
      return;
    }

    if (activeSellerSales.length === 0) {
      const headers = [
        "Venda",
        "Cliente",
        "Parcela",
        "Vencimento",
        "Pagamento",
        "Status",
        "Valor BRL"
      ];

      const rows = activeSellerInstallments.map((item) => [
        item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo"),
        item.customerName,
        String(item.installmentNumber),
        formatDate(item.dueDate),
        item.paymentDate ? formatDate(item.paymentDate) : "-",
        installmentStatusLabel(resolveInstallmentStatus(item.status, item.dueDate)),
        safeCurrency(item.amountBrl, "BRL")
      ]);

      openPrintWindow(
        `Relacao de recebimentos - ${activeSeller.sellerName}`,
        `${months.find((item) => item.value === month)?.label || month} / ${year} | Filial ${branch === "CANCUN" ? "Cancun" : "Puntacana"} | Composicao do recebimento no mes`,
        headers,
        rows
      );
      return;
    }

    const headers = [
      "Venda",
      "Cliente",
      "Data venda",
      "Parcelas",
      "Cotacao USD",
      "Total USD",
      "Total BRL",
      "Recebimento no mes BRL"
    ];

    const rows = activeSellerSales.map((sale) => [
      saleLabel(sale),
      sale.customerName,
      formatDate(sale.saleDate),
      String(sale.installmentsCount),
      sale.fxRateUsdBrl > 0 ? sale.fxRateUsdBrl.toFixed(4) : "-",
      safeCurrency(sale.totalSaleUsd, "USD"),
      safeCurrency(sale.totalSaleBrl, "BRL"),
      safeCurrency(sale.receivableInMonthBrl, "BRL")
    ]);

    openPrintWindow(
      `Relacao de vendas - ${activeSeller.sellerName}`,
      `${months.find((item) => item.value === month)?.label || month} / ${year} | Filial ${branch === "CANCUN" ? "Cancun" : "Puntacana"} | Vendas: ${activeSellerSales.length}`,
      headers,
      rows
    );
  }

  return (
    <section className="seller-sales-card" aria-label="Relacao de vendas por vendedor">
      <div className="seller-sales-head">
        <div>
          <span className="chip warning">Relacao de Vendas</span>
          <h3>Dashboard das vendas realizadas por vendedor</h3>
          <p className="subtle">Selecione mes e ano para ver os totais de vendas por vendedor em ordem alfabetica.</p>
        </div>

        <div className="seller-sales-filters">
          <div className="field month-field">
            <label htmlFor="seller-dashboard-month">Mes</label>
            <select id="seller-dashboard-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field month-field">
            <label htmlFor="seller-dashboard-year">Ano</label>
            <select id="seller-dashboard-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field month-field">
            <label htmlFor="seller-dashboard-branch">Filial</label>
            <select id="seller-dashboard-branch" value={branch} onChange={(event) => setBranch(event.target.value as BranchCode)}>
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="seller-sales-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Total de vendas</th>
              <th>Media cotacao USD</th>
              <th>Total vendido USD</th>
              <th>Total vendido BRL</th>
              <th>Recebimento no mes (BRL)</th>
            </tr>
          </thead>
          <tbody>
            {sellerRows.map((seller) => (
              <tr key={`${seller.sellerId ?? "no-id"}-${seller.sellerName}`}>
                <td>
                  <button
                    type="button"
                    className="seller-link"
                    onClick={() => setActiveSellerKey(`${seller.sellerId ?? "no-id"}-${seller.sellerName}`)}
                  >
                    {seller.sellerName}
                  </button>
                </td>
                <td>{seller.salesCount}</td>
                <td>{seller.averageUsdRate > 0 ? seller.averageUsdRate.toFixed(4) : "-"}</td>
                <td>{safeCurrency(seller.totalSalesUsd, "USD")}</td>
                <td>{safeCurrency(seller.totalSalesBrl, "BRL")}</td>
                <td>{safeCurrency(seller.receivableInMonthBrl, "BRL")}</td>
              </tr>
            ))}
            {sellerRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="subtle">Nenhuma venda ou recebimento encontrado para os filtros selecionados.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isPending ? <p className="subtle">Atualizando relacao de vendedores...</p> : null}
      {error ? <p className="subtle">{error}</p> : null}

      {activeSeller ? (
        <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label={`Vendas de ${activeSeller.sellerName}`}>
          <div className="flow-detail-modal">
            <div className="flow-detail-header">
              <div>
                <h3>Vendas de {activeSeller.sellerName}</h3>
                <p className="subtle">
                  {months.find((item) => item.value === month)?.label || month} / {year} · Filial {branch === "CANCUN" ? "Cancun" : "Puntacana"}
                </p>
              </div>
              <div className="modal-actions-row">
                <button className="btn secondary" type="button" onClick={exportSellerSalesPdf}>
                  Exportar PDF
                </button>
                <button className="btn secondary" type="button" onClick={() => setActiveSellerKey(null)}>
                  Fechar
                </button>
              </div>
            </div>

            <div className="flow-detail-table-wrap">
              <table>
                <thead>
                  {activeSellerSales.length > 0 ? (
                    <tr>
                      <th>Venda</th>
                      <th>Cliente</th>
                      <th>Data venda</th>
                      <th>Parcelas</th>
                      <th>Cotacao USD</th>
                      <th>Total USD</th>
                      <th>Total BRL</th>
                      <th>Recebimento no mes BRL</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Venda</th>
                      <th>Cliente</th>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th>Pagamento</th>
                      <th>Status</th>
                      <th>Valor BRL</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeSellerSales.length > 0
                    ? activeSellerSales.map((sale) => (
                        <tr key={sale.receivableId}>
                          <td>{saleLabel(sale)}</td>
                          <td>{sale.customerName}</td>
                          <td>{formatDate(sale.saleDate)}</td>
                          <td>{sale.installmentsCount}</td>
                          <td>{sale.fxRateUsdBrl > 0 ? sale.fxRateUsdBrl.toFixed(4) : "-"}</td>
                          <td>{safeCurrency(sale.totalSaleUsd, "USD")}</td>
                          <td>{safeCurrency(sale.totalSaleBrl, "BRL")}</td>
                          <td>{safeCurrency(sale.receivableInMonthBrl, "BRL")}</td>
                        </tr>
                      ))
                    : activeSellerInstallments.map((item) => (
                        <tr key={item.installmentId}>
                          <td>{item.saleCode || (item.saleNumber ? `Venda #${item.saleNumber}` : "Sem codigo")}</td>
                          <td>{item.customerName}</td>
                          <td>{item.installmentNumber}</td>
                          <td>{formatDate(item.dueDate)}</td>
                          <td>{item.paymentDate ? formatDate(item.paymentDate) : "-"}</td>
                          <td>{installmentStatusLabel(resolveInstallmentStatus(item.status, item.dueDate))}</td>
                          <td>{safeCurrency(item.amountBrl, "BRL")}</td>
                        </tr>
                      ))}
                  {activeSellerSales.length === 0 && activeSellerInstallments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="subtle">Este vendedor nao possui registros para o periodo/filial selecionados.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .seller-sales-card {
          border: 1px solid rgba(185, 139, 34, 0.28);
          background:
            radial-gradient(circle at 0% 0%, rgba(244, 206, 96, 0.26), transparent 38%),
            radial-gradient(circle at 100% 0%, rgba(247, 231, 160, 0.28), transparent 34%),
            linear-gradient(140deg, rgba(255, 251, 229, 0.95), rgba(255, 247, 204, 0.92));
          border-radius: var(--radius-lg);
          box-shadow: 0 18px 44px rgba(167, 119, 12, 0.14);
          padding: 22px;
          display: grid;
          gap: 14px;
        }

        .seller-sales-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .seller-sales-head h3 {
          margin: 10px 0 6px;
          font-size: clamp(1.15rem, 1.9vw, 1.45rem);
          color: #5f4609;
        }

        .seller-sales-head :global(.subtle) {
          color: #876629;
          margin: 0;
        }

        .seller-sales-filters {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          flex-wrap: wrap;
          min-width: 390px;
        }

        .seller-sales-filters :global(.month-field) {
          min-width: 120px;
        }

        .seller-link {
          background: transparent;
          border: none;
          color: #63490d;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          font: inherit;
        }

        .seller-link:hover {
          color: #8a6518;
        }

        .seller-sales-filters :global(label) {
          color: #7a5c1f;
          font-weight: 600;
        }

        .seller-sales-filters :global(select) {
          border-color: rgba(166, 125, 34, 0.35);
          background: rgba(255, 251, 237, 0.96);
        }

        .seller-sales-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(165, 128, 46, 0.24);
          border-radius: 16px;
          background: rgba(255, 250, 229, 0.66);
        }

        .seller-sales-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        .seller-sales-table-wrap th,
        .seller-sales-table-wrap td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(162, 125, 40, 0.2);
          text-align: left;
          white-space: nowrap;
        }

        .seller-sales-table-wrap th {
          color: #805f1d;
          font-size: 0.76rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .seller-sales-table-wrap td {
          color: #5f4609;
          font-size: 0.92rem;
        }

        .seller-sales-table-wrap tbody tr:last-child td {
          border-bottom: none;
        }

        @media (max-width: 920px) {
          .seller-sales-card {
            padding: 16px;
          }
        }
      `}</style>
    </section>
  );
}
