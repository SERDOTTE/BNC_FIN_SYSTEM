import { PageHeader } from "@/components/page-header";
import { DashboardKpiCards } from "@/components/dashboard-kpi-cards";
import { DashboardSellerSales } from "@/components/dashboard-seller-sales";
import { buildDashboardMonthlyBreakdown } from "@/lib/server/loaders";

export default async function HomePage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const monthlyBreakdown = await buildDashboardMonthlyBreakdown(month, year);
  return (
    <div className="page">
      <section className="hero">
        <div>
          <PageHeader
            title="Controle Financeiro"
            description="Visão consolidada do caixa atual, entradas futuras e vendas por vendedor e filial."
          />
        </div>
      </section>

      <DashboardKpiCards initialMonth={month} initialYear={year} initialData={monthlyBreakdown} />

      <DashboardSellerSales
        initialMonth={month}
        initialYear={year}
        initialData={monthlyBreakdown}
      />
    </div>
  );
}