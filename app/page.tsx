import { DashboardDailyFlowChart } from "@/components/dashboard-daily-flow-chart";
import { DashboardMonthInsights } from "@/components/dashboard-month-insights";
import { DashboardSellerSales } from "@/components/dashboard-seller-sales";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { buildDailyCashFlow, buildDashboardData, buildDashboardMonthlyBreakdown } from "@/lib/server/loaders";

export default async function HomePage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentMonthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);
  const currentMonthTitle = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1);
  const currentMonthYearTitle = `${currentMonthTitle} ${year}`;

  const [dashboard, dailyFlow, monthlyBreakdown] = await Promise.all([
    buildDashboardData(),
    buildDailyCashFlow(month, year),
    buildDashboardMonthlyBreakdown(month, year)
  ]);
  const attentionItems = dashboard.attentionItems ?? [];
  const scenarios = dashboard.scenarios ?? [];
  const cashTimeline = dashboard.cashTimeline ?? [];

  return (
    <div className="page">
      <section className="hero">
        <div>
          <PageHeader
            title="Controle Financeiro"
            description="Visão consolidada do caixa atual, entradas futuras, saídas previstas e exposição em USD para apoiar decisão operacional diária."
          />
          
        </div>
        <div className="summary-card">
          <DashboardMonthInsights
            initialMonth={month}
            initialYear={year}
            initialData={monthlyBreakdown}
            currentMonthYearTitle={currentMonthYearTitle}
            currentMonthTotalBrl={dashboard.monthReceived + dashboard.monthToReceive + dashboard.monthOverdue}
            branchSummaries={monthlyBreakdown.branchSummaries}
          />
        </div>
      </section>

      <DashboardSellerSales
        initialMonth={month}
        initialYear={year}
        initialData={monthlyBreakdown}
      />

      <SectionCard
        title="Fluxo de caixa do mês"
        description="Selecione o mês/ano para visualizar o comportamento diário das entradas (azul) e saídas (vermelho)."
      >
        <DashboardDailyFlowChart initialData={dailyFlow} initialMonth={month} initialYear={year} />
      </SectionCard>

      <section className="stats-grid">
        <StatCard title="Caixa atual" value={formatCurrency(dashboard.currentCash, "BRL")} tone="positive" caption="Somente transações realizadas" />
        <StatCard title="Fluxo projetado" value={formatCurrency(dashboard.projectedNet, "BRL")} tone={dashboard.projectedNet >= 0 ? "positive" : "danger"} caption="Janela de 30 dias" />
        <StatCard title="Inadimplência" value={`${dashboard.overdueInstallments} parcelas`} tone="warning" caption="Parcela ou payable vencido" />
        <StatCard title="Taxa USD/BRL" value={dashboard.currentUsdRate.toFixed(2)} tone="warning" caption="Referência mais recente" />
      </section>

      <section className="two-col">
        <SectionCard title="Eventos prioritários" description="Fila operacional para o time financeiro atuar hoje.">
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attentionItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <div className="subtle">{item.description}</div>
                  </td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td className={`money ${item.amount >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(Math.abs(item.amount), item.currency)}
                  </td>
                  <td>
                    <span className={`chip ${item.level}`}>{item.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Leitura de cenário" description="Como o câmbio futuro altera o caixa esperado.">
          <div className="kpi-list">
            {scenarios.map((scenario) => (
              <div className="kpi-row" key={scenario.name}>
                <div>
                  <strong>{scenario.name}</strong>
                  <div className="subtle">USD/BRL {scenario.rate.toFixed(2)}</div>
                </div>
                <div className={`money ${scenario.projectedNet >= 0 ? "positive" : "negative"}`}>
                  {formatCurrency(scenario.projectedNet, "BRL")}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Linha do tempo do caixa" description="Eventos de entrada e saída que moldam a posição projetada.">
        <div className="timeline">
          {cashTimeline.map((item) => (
            <div className="timeline-item" key={item.id}>
              <strong>{item.title}</strong>
              <span className="subtle">{formatDate(item.date)} · {item.description}</span>
              <span className={`money ${item.amount >= 0 ? "positive" : "negative"}`}>
                {formatCurrency(item.amount, item.currency)}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}