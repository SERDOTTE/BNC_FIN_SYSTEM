import { PageHeader } from "@/components/page-header";
import { FornecedoresSection } from "@/components/fornecedores-section";
import { listFornecedoresServer } from "@/lib/server/loaders";
import type { Supplier } from "@/lib/types";

async function loadSuppliers(): Promise<Supplier[]> {
  return listFornecedoresServer();
}

export default async function FornecedoresPage() {
  const suppliers = await loadSuppliers();

  return (
    <div className="page">
      <PageHeader
        title="Fornecedores"
        description="Cadastre e gerencie os fornecedores utilizados em pagamentos e passeios."
      />
      <FornecedoresSection initialSuppliers={suppliers} />
    </div>
  );
}
