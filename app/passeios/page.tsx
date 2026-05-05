import { PageHeader } from "@/components/page-header";
import { PasseiosSection } from "@/components/passeios-section";
import { listPasseiosServer } from "@/lib/server/loaders";
import type { LookupOption } from "@/lib/types";

async function loadPasseios(): Promise<LookupOption[]> {
  return listPasseiosServer();
}

export default async function PasseiosPage() {
  const passeios = await loadPasseios();

  return (
    <div className="page">
      <PageHeader
        title="Passeios"
        description="Cadastre e visualize os passeios usados no lançamento de vendas."
      />
      <PasseiosSection initialPasseios={passeios} />
    </div>
  );
}
