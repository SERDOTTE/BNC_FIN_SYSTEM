"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { getDailyCashFlowByMonth } from "@/lib/api-client";
import { formatCurrency } from "@/lib/formatters";
import type { DailyFlowPoint } from "@/lib/types";

type DashboardDailyFlowChartProps = {
  initialData: DailyFlowPoint[];
  initialMonth: number;
  initialYear: number;
};

type TooltipState = {
  x: number;
  y: number;
  guideX: number;
  title: string;
  lines: Array<{ label: string; value: string; tone?: "positive" | "negative" }>;
};

const months = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
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

export function DashboardDailyFlowChart({ initialData, initialMonth, initialYear }: DashboardDailyFlowChartProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState(Array.isArray(initialData) ? initialData : []);
  const [error, setError] = useState<string>("");
  const [barTooltip, setBarTooltip] = useState<TooltipState | null>(null);
  const [lineTooltip, setLineTooltip] = useState<TooltipState | null>(null);
  const [selectedInflowDay, setSelectedInflowDay] = useState<DailyFlowPoint | null>(null);
  const [isPending, startTransition] = useTransition();

  const monthLabel = months.find((item) => item.value === month)?.label ?? "Mês";

  const summarizeOriginalByCurrency = (point: DailyFlowPoint) => {
    const details = point.inflowDetails ?? [];
    if (!details.length) {
      return [["BRL", point.inflow] as const];
    }

    const totals = details.reduce<Record<string, number>>((acc, detail) => {
      acc[detail.currency] = (acc[detail.currency] ?? 0) + detail.amount;
      return acc;
    }, {});

    return Object.entries(totals).sort(([left], [right]) => left.localeCompare(right));
  };

  const summarizeDayInflowBrl = (point: DailyFlowPoint) => {
    const details = point.inflowDetails ?? [];
    if (!details.length) {
      return point.inflow;
    }

    return details.reduce((total, detail) => total + detail.amountBrl, 0);
  };

  const getTooltipPosition = (event: ReactMouseEvent<SVGElement>, tooltipWidth = 220) => {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const rawX = event.clientX - rect.left + 12;
    const rawY = event.clientY - rect.top - 90;
    return {
      x: Math.min(Math.max(8, rawX), Math.max(8, rect.width - tooltipWidth - 8)),
      y: Math.max(8, rawY)
    };
  };

  useEffect(() => {
    startTransition(async () => {
      try {
        const next = await getDailyCashFlowByMonth(month, year);
        setData(Array.isArray(next) ? next : []);
        setError("");
        setBarTooltip(null);
        setLineTooltip(null);
        setSelectedInflowDay(null);
      } catch {
        setError("Não foi possível carregar o fluxo diário para o período selecionado.");
      }
    });
  }, [month, year]);

  const chart = useMemo(() => {
    const width = 1000;
    const barHeight = 320;
    const lineHeight = 280;
    const padding = 42;
    const plotWidth = width - padding * 2;
    const barPlotHeight = barHeight - padding * 2;
    const linePlotHeight = lineHeight - padding * 2;
    const maxBarValue = Math.max(1, ...data.map((item) => Math.max(summarizeDayInflowBrl(item), item.outflow)));

    const cumulative = data.reduce<Array<DailyFlowPoint & { balance: number }>>((acc, item) => {
      const previous = acc[acc.length - 1]?.balance ?? 0;
      const nextBalance = previous + summarizeDayInflowBrl(item) - item.outflow;
      acc.push({ ...item, balance: nextBalance });
      return acc;
    }, []);

    const minBalance = Math.min(0, ...cumulative.map((item) => item.balance));
    const maxBalance = Math.max(0, ...cumulative.map((item) => item.balance));
    const balanceRange = Math.max(1, maxBalance - minBalance);

    const slotWidth = plotWidth / Math.max(1, data.length);
    const barWidth = Math.max(3, slotWidth * 0.34);

    const balancePath = cumulative
      .map((item, index) => {
        const x = padding + ((item.day - 1) / Math.max(1, data.length - 1)) * plotWidth;
        const y = padding + linePlotHeight - ((item.balance - minBalance) / balanceRange) * linePlotHeight;
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");

    const dayLabels = data.filter((item) => item.day === 1 || item.day % 5 === 0 || item.day === data.length);
    const totalOut = data.reduce((total, item) => total + item.outflow, 0);
    const finalBalance = cumulative[cumulative.length - 1]?.balance ?? 0;

    const totalInBrl = data.reduce((total, item) => total + summarizeDayInflowBrl(item), 0);
    const totalOriginalByCurrency = data.reduce<Record<string, number>>((acc, item) => {
      const originals = summarizeOriginalByCurrency(item);
      for (const [currency, amount] of originals) {
        acc[currency] = (acc[currency] ?? 0) + amount;
      }
      return acc;
    }, {});

    const totalOriginalEntries = Object.entries(totalOriginalByCurrency).sort(([left], [right]) =>
      left.localeCompare(right)
    );

    return {
      width,
      barHeight,
      lineHeight,
      padding,
      maxBarValue,
      barPlotHeight,
      linePlotHeight,
      slotWidth,
      barWidth,
      cumulative,
      minBalance,
      maxBalance,
      balancePath,
      dayLabels,
      totalInBrl,
      totalOut,
      finalBalance,
      totalOriginalEntries
    };
  }, [data]);

  const selectedDaySummary = useMemo(() => {
    const details = selectedInflowDay?.inflowDetails ?? [];
    const byCurrency = details.reduce<Record<string, number>>((acc, item) => {
      acc[item.currency] = (acc[item.currency] ?? 0) + item.amount;
      return acc;
    }, {});

    return {
      details,
      currencyTotals: Object.entries(byCurrency),
      totalBrl: details.reduce((total, item) => total + item.amountBrl, 0)
    };
  }, [selectedInflowDay]);

  return (
    <div className="daily-flow-chart">
      <div className="daily-flow-toolbar">
        <div className="daily-flow-selectors">
          <div className="field">
            <label htmlFor="flow-month">Mês</label>
            <select id="flow-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="flow-year">Ano</label>
            <input
              id="flow-year"
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot legend-in" /> Entradas (azul)
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-out" /> Saídas (vermelho)
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-balance" /> Saldo acumulado
          </span>
        </div>
      </div>

      <div className="chart-meta">
        <span className="subtle">Entradas no mês (base BRL): {formatCurrency(chart.totalInBrl, "BRL")}</span>
        <span className="subtle">
          Entradas no mês (moeda original):{" "}
          {chart.totalOriginalEntries.map(([currency, amount]) => formatCurrency(amount, currency as "BRL" | "USD" | "EUR" | "ARS")).join(" · ")}
        </span>
        <span className="subtle">Saídas no mês: {formatCurrency(chart.totalOut, "BRL")}</span>
        <span className={`subtle ${chart.finalBalance >= 0 ? "money positive" : "money negative"}`}>
          Saldo final: {formatCurrency(chart.finalBalance, "BRL")}
        </span>
        <span className="subtle">{isPending ? "Atualizando..." : "Dados atualizados"}</span>
      </div>

      <div className="chart-wrap">
        <svg viewBox={`0 0 ${chart.width} ${chart.barHeight}`} role="img" aria-label="Fluxo diário em colunas">
          <line x1={chart.padding} y1={chart.padding} x2={chart.padding} y2={chart.barHeight - chart.padding} className="axis-line" />
          <line x1={chart.padding} y1={chart.barHeight - chart.padding} x2={chart.width - chart.padding} y2={chart.barHeight - chart.padding} className="axis-line" />

          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chart.padding + chart.barPlotHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={chart.padding}
                  y1={y}
                  x2={chart.width - chart.padding}
                  y2={y}
                  className="grid-line"
                />
                <text x={8} y={y + 4} className="axis-label">
                  {Math.round(chart.maxBarValue * ratio)}
                </text>
              </g>
            );
          })}

          {barTooltip ? (
            <line
              x1={barTooltip.guideX}
              y1={chart.padding}
              x2={barTooltip.guideX}
              y2={chart.barHeight - chart.padding}
              className="hover-guide-line"
            />
          ) : null}

          {data.map((item) => {
            const baseX = chart.padding + (item.day - 1) * chart.slotWidth;
            const inflowBrl = summarizeDayInflowBrl(item);
            const inflowHeight = (inflowBrl / chart.maxBarValue) * chart.barPlotHeight;
            const outflowHeight = (item.outflow / chart.maxBarValue) * chart.barPlotHeight;
            const netValue = inflowBrl - item.outflow;
            const inflowOriginal = summarizeOriginalByCurrency(item);

            return (
              <g key={item.day}>
                <rect
                  x={baseX + chart.slotWidth * 0.08}
                  y={chart.padding + chart.barPlotHeight - inflowHeight}
                  width={chart.barWidth}
                  height={Math.max(1, inflowHeight)}
                  className={`bar-inflow ${item.inflowDetails?.length ? "clickable" : ""}`}
                  rx={3}
                  onMouseMove={(event) => {
                    const pos = getTooltipPosition(event);
                    setBarTooltip({
                      x: pos.x,
                      y: pos.y,
                      guideX: baseX + chart.slotWidth / 2,
                      title: `Dia ${item.day} de ${monthLabel} / ${year}`,
                      lines: [
                        { label: "Entradas (base BRL)", value: formatCurrency(inflowBrl, "BRL"), tone: "positive" },
                        {
                          label: "Entradas (original)",
                          value: inflowOriginal
                            .map(([currency, amount]) => formatCurrency(amount, currency as "BRL" | "USD" | "EUR" | "ARS"))
                            .join(" · ")
                        },
                        { label: "Saídas", value: formatCurrency(item.outflow, "BRL"), tone: "negative" },
                        {
                          label: "Clique para ver parcelas",
                          value: item.inflowDetails?.length ? `${item.inflowDetails.length} itens` : "Sem parcelas"
                        }
                      ]
                    });
                  }}
                  onMouseLeave={() => setBarTooltip(null)}
                  onClick={() => {
                    if ((item.inflowDetails?.length ?? 0) > 0) {
                      setSelectedInflowDay(item);
                    }
                  }}
                />
                <rect
                  x={baseX + chart.slotWidth * 0.52}
                  y={chart.padding + chart.barPlotHeight - outflowHeight}
                  width={chart.barWidth}
                  height={Math.max(1, outflowHeight)}
                  className="bar-outflow"
                  rx={3}
                />
                <rect
                  x={baseX}
                  y={chart.padding}
                  width={chart.slotWidth}
                  height={chart.barPlotHeight}
                  className="bar-hit-area"
                  onMouseMove={(event) => {
                    const pos = getTooltipPosition(event);
                    setBarTooltip({
                      x: pos.x,
                      y: pos.y,
                      guideX: baseX + chart.slotWidth / 2,
                      title: `Dia ${item.day} de ${monthLabel} / ${year}`,
                      lines: [
                        { label: "Entradas (base BRL)", value: formatCurrency(inflowBrl, "BRL"), tone: "positive" },
                        {
                          label: "Entradas (original)",
                          value: inflowOriginal
                            .map(([currency, amount]) => formatCurrency(amount, currency as "BRL" | "USD" | "EUR" | "ARS"))
                            .join(" · ")
                        },
                        { label: "Saídas", value: formatCurrency(item.outflow, "BRL"), tone: "negative" },
                        { label: "Saldo do dia", value: formatCurrency(netValue, "BRL"), tone: netValue >= 0 ? "positive" : "negative" }
                      ]
                    });
                  }}
                  onMouseLeave={() => setBarTooltip(null)}
                />
              </g>
            );
          })}

          {chart.dayLabels.map((item) => {
            const x = chart.padding + ((item.day - 1) / Math.max(1, data.length - 1)) * (chart.width - chart.padding * 2);
            return (
              <text key={item.day} x={x} y={chart.barHeight - 10} className="axis-label" textAnchor="middle">
                {item.day}
              </text>
            );
          })}
        </svg>
        {barTooltip ? (
          <div className="chart-tooltip" style={{ left: barTooltip.x, top: barTooltip.y }}>
            <strong>{barTooltip.title}</strong>
            {barTooltip.lines.map((line) => (
              <div className="tooltip-row" key={line.label}>
                <span className="subtle">{line.label}</span>
                <span className={`money ${line.tone === "negative" ? "negative" : "positive"}`}>{line.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="chart-wrap">
        <svg viewBox={`0 0 ${chart.width} ${chart.lineHeight}`} role="img" aria-label="Saldo acumulado diário em linha">
          <line x1={chart.padding} y1={chart.padding} x2={chart.padding} y2={chart.lineHeight - chart.padding} className="axis-line" />
          <line x1={chart.padding} y1={chart.lineHeight - chart.padding} x2={chart.width - chart.padding} y2={chart.lineHeight - chart.padding} className="axis-line" />

          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chart.padding + chart.linePlotHeight * (1 - ratio);
            const value = chart.minBalance + (chart.maxBalance - chart.minBalance) * ratio;

            return (
              <g key={ratio}>
                <line x1={chart.padding} y1={y} x2={chart.width - chart.padding} y2={y} className="grid-line" />
                <text x={8} y={y + 4} className="axis-label">{Math.round(value)}</text>
              </g>
            );
          })}

          <path d={chart.balancePath} className="line-balance" />

          {chart.cumulative.map((item) => {
            const x = chart.padding + ((item.day - 1) / Math.max(1, data.length - 1)) * (chart.width - chart.padding * 2);
            const y = chart.padding + chart.linePlotHeight - ((item.balance - chart.minBalance) / Math.max(1, chart.maxBalance - chart.minBalance)) * chart.linePlotHeight;

            return (
              <g key={item.day}>
                <circle cx={x} cy={y} r={2.6} className="point-balance" />
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  className="point-hit-area"
                  onMouseMove={(event) => {
                    const pos = getTooltipPosition(event, 210);
                    setLineTooltip({
                      x: pos.x,
                      y: pos.y,
                      guideX: x,
                      title: `Dia ${item.day} de ${monthLabel} / ${year}`,
                      lines: [
                        {
                          label: "Saldo acumulado",
                          value: formatCurrency(item.balance, "BRL"),
                          tone: item.balance >= 0 ? "positive" : "negative"
                        }
                      ]
                    });
                  }}
                  onMouseLeave={() => setLineTooltip(null)}
                />
              </g>
            );
          })}

          {lineTooltip ? (
            <line
              x1={lineTooltip.guideX}
              y1={chart.padding}
              x2={lineTooltip.guideX}
              y2={chart.lineHeight - chart.padding}
              className="hover-guide-line"
            />
          ) : null}

          {chart.dayLabels.map((item) => {
            const x = chart.padding + ((item.day - 1) / Math.max(1, data.length - 1)) * (chart.width - chart.padding * 2);
            return (
              <text key={item.day} x={x} y={chart.lineHeight - 10} className="axis-label" textAnchor="middle">
                {item.day}
              </text>
            );
          })}
        </svg>
        {lineTooltip ? (
          <div className="chart-tooltip" style={{ left: lineTooltip.x, top: lineTooltip.y }}>
            <strong>{lineTooltip.title}</strong>
            {lineTooltip.lines.map((line) => (
              <div className="tooltip-row" key={line.label}>
                <span className="subtle">{line.label}</span>
                <span className={`money ${line.tone === "negative" ? "negative" : "positive"}`}>{line.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="subtle">{error}</p> : null}

      {selectedInflowDay ? (
        <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label="Detalhes das entradas do dia">
          <div className="flow-detail-modal">
            <div className="flow-detail-header">
              <div>
                <h3>Entradas do dia {selectedInflowDay.day}</h3>
                <p className="subtle">{monthLabel} / {year} · {selectedDaySummary.details.length} parcelas</p>
              </div>
              <button className="btn secondary small" type="button" onClick={() => setSelectedInflowDay(null)}>
                Fechar
              </button>
            </div>

            <div className="flow-currency-summary">
              {selectedDaySummary.currencyTotals.map(([currency, amount]) => (
                <span key={currency} className="chip warning">
                  {currency}: {formatCurrency(amount, currency as "BRL" | "USD" | "EUR" | "ARS")}
                </span>
              ))}
              <span className="chip positive">Base BRL: {formatCurrency(selectedDaySummary.totalBrl, "BRL")}</span>
            </div>

            <div className="flow-detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Cliente</th>
                    <th>Parcela</th>
                    <th>Moeda</th>
                    <th>Valor</th>
                    <th>Base BRL</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDaySummary.details.map((detail) => (
                    <tr key={detail.installmentId}>
                      <td>{detail.saleCode || (detail.saleNumber ? `Venda #${detail.saleNumber}` : "Sem código")}</td>
                      <td>{detail.customerName}</td>
                      <td>{detail.installmentNumber}</td>
                      <td>{detail.currency}</td>
                      <td>{formatCurrency(detail.amount, detail.currency)}</td>
                      <td>{formatCurrency(detail.amountBrl, "BRL")}</td>
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