import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { formatCurrency } from "@/lib/formatters";
import { buildReportsData } from "@/lib/server/loaders";

export default async function ReportsPage() {
  const report = await buildReportsData();

  return (
    <div className="page">
      <PageHeader title="Relatórios" description="Leitura do fluxo realizado, projeção por cenário e exposição líquida em USD." />

      <section className="stats-grid">
        {report.scenarioCards.map((scenario) => (
          <div key={scenario.name} className="stat-card">
            <span className={`chip ${scenario.name === "Pessimista" ? "danger" : scenario.name === "Base" ? "warning" : "positive"}`}>{scenario.name}</span>
            <strong>{formatCurrency(scenario.netProjected, "BRL")}</strong>
            <span className="subtle">Taxa {scenario.usdRate.toFixed(2)}</span>
          </div>
        ))}
      </section>

      <section className="two-col">
        <SectionCard title="Fluxo diário" description="Consolidado de entradas e saídas futuras por data.">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {report.projectedByDate.map((item) => (
                <tr key={item.date}>
                  <td>{item.date}</td>
                  <td className="money positive">{formatCurrency(item.inflow, "BRL")}</td>
                  <td className="money negative">{formatCurrency(item.outflow, "BRL")}</td>
                  <td className={`money ${item.net >= 0 ? "positive" : "negative"}`}>{formatCurrency(item.net, "BRL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Exposição mensal em USD" description="Sensibilidade do caixa à taxa USD/BRL.">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>USD líquido</th>
                <th>Spot</th>
                <th>+10%</th>
              </tr>
            </thead>
            <tbody>
              {report.exposureMonthly.map((item) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{formatCurrency(item.netUsd, "USD")}</td>
                  <td>{formatCurrency(item.brlAtSpot, "BRL")}</td>
                  <td>{formatCurrency(item.brlPlus10, "BRL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </section>
    </div>
  );
}