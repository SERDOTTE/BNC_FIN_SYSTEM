import { PageHeader } from "@/components/page-header";
import { DashboardSellerSales } from "@/components/dashboard-seller-sales";
import { formatCurrency } from "@/lib/formatters";
import { buildDashboardData, buildDashboardMonthlyBreakdown } from "@/lib/server/loaders";

export default async function HomePage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [dashboard, monthlyBreakdown] = await Promise.all([
    buildDashboardData(),
    buildDashboardMonthlyBreakdown(month, year)
  ]);

  const baseToReceive = dashboard.monthReceived + dashboard.monthToReceive + dashboard.monthOverdue;
  const receiptRate = baseToReceive > 0 ? (dashboard.monthReceived / baseToReceive) * 100 : 0;
  return (
    <div className="page">
      <section className="hero">
        <div>
          <PageHeader
            title="Controle Financeiro"
            description="Visão consolidada do caixa atual, entradas futuras, saídas previstas e exposição em USD para apoiar decisão operacional diária."
          />
        </div>
      </section>

      <section className="trip-kpi-grid">
        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Vendas Totais</h3>
            <span className="trip-kpi-badge">Ticket</span>
          </div>
          <strong>{monthlyBreakdown.salesCount}</strong>
          <p className="trip-positive">+12% vs. Mês Anterior</p>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Receita Vendida (Bruta)</h3>
            <span className="trip-kpi-badge">Venda</span>
          </div>
          <strong>{formatCurrency(monthlyBreakdown.totalSalesMonthBrl, "BRL")}</strong>
          <p className="trip-positive">+18% vs. Mês Anterior</p>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Receita em Caixa (Líquida)</h3>
            <span className="trip-kpi-badge">Banco</span>
          </div>
          <strong>{formatCurrency(dashboard.monthReceived, "BRL")}</strong>
          <p className="trip-positive">+5% vs. Mês Anterior</p>
        </article>

        <article className="trip-kpi-card">
          <div className="trip-kpi-head">
            <h3>Taxa de Recebimento</h3>
            <span className="trip-kpi-badge">%</span>
          </div>
          <strong>{receiptRate.toFixed(1)}%</strong>
          <p className="trip-negative">-3% vs. Mês Anterior</p>
        </article>
      </section>

      <DashboardSellerSales
        initialMonth={month}
        initialYear={year}
        initialData={monthlyBreakdown}
      />
    </div>
  );
}