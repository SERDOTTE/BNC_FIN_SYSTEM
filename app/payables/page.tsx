import { PayableCreateForm } from "@/components/payable-create-form";
import { PageHeader } from "@/components/page-header";
import { PayablesTable } from "@/components/payables-table";
import { SectionCard } from "@/components/section-card";
import { listAccountsServer, listPayablesServer } from "@/lib/server/loaders";

export default async function PayablesPage() {
  const [payables, accounts] = await Promise.all([listPayablesServer(), listAccountsServer()]);
  const defaultAccountId = accounts[0]?.id ?? "";

  return (
    <div className="page">
      <PageHeader title="Contas a Pagar" description="Saídas futuras, compromissos vencidos e controle do reflexo cambial nas liquidações." />

      <SectionCard title="Cadastrar Pagamento" description="Formulário para registrar um novo compromisso.">
        <PayableCreateForm />
      </SectionCard>

      <section className="two-col">
        <SectionCard title="Compromissos" description="Pagamentos pendentes e já liquidados.">
          <PayablesTable initialPayables={payables} defaultAccountId={defaultAccountId} />
        </SectionCard>        
      </section>
    </div>
  );
}