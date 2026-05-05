import { PageHeader } from "@/components/page-header";
import { AccountsSection } from "@/components/accounts-section";
import { listAccountsServer } from "@/lib/server/loaders";
import type { Account } from "@/lib/types";

async function loadAccounts(): Promise<Account[]> {
  return listAccountsServer();
}

export default async function AccountsPage() {
  const accounts = await loadAccounts();

  return (
    <div className="page">
      <PageHeader title="Contas financeiras" description="Base de liquidação do caixa, segregada por moeda e tipo operacional." />
      <AccountsSection initialAccounts={accounts} />
    </div>
  );
}