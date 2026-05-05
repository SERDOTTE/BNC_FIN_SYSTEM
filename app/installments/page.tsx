import { InstallmentsTable } from "@/components/installments-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { listAccountsServer, listInstallmentsServer } from "@/lib/server/loaders";

export default async function InstallmentsPage() {
  const [installments, accounts] = await Promise.all([listInstallmentsServer(), listAccountsServer()]);
  const defaultAccountId = accounts[0]?.id ?? "";

  return (
    <div className="page">
      <PageHeader title="Parcelas" description="Controle operacional da cobrança, vencimento e baixa idempotente de recebimentos." />

      <SectionCard title="Fila de cobrança" description="Cada parcela é uma previsão de entrada até sua liquidação real.">
        <InstallmentsTable initialInstallments={installments} defaultAccountId={defaultAccountId} />
      </SectionCard>
    </div>
  );
}