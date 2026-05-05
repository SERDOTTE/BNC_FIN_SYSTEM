import { ReceivablesRealizedTable } from "@/components/receivables-realized-table";
import { ReceivableCreateForm } from "@/components/receivable-create-form";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { listInstallmentsServer, listReceivablesServer } from "@/lib/server/loaders";

export default async function ReceivablesPage() {
  const [receivables, installments] = await Promise.all([listReceivablesServer(), listInstallmentsServer()]);

  return (
    <div className="page">
      <PageHeader title="Vendas a receber" description="Vendas parceladas, status de carteira e composição das entradas futuras." />

      <SectionCard title="Cadastrar Vendas" description="Clique no botão abaixo para registrar uma nova venda.">
          <ReceivableCreateForm />
      </SectionCard>

      <SectionCard title="Vendas Realizadas" description="Total de vendas realizadas no período, incluindo o parcelamento.">
        <ReceivablesRealizedTable receivables={receivables} installments={installments} />
      </SectionCard>
    </div>
  );
}