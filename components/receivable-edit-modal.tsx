"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { listAccounts, listEmployees, listMeiosPagamento, listPasseios, updateReceivable } from "../lib/api-client";
import { BRANCHES, type BranchCode } from "@/lib/branches";
import type { Account, Currency, InstallmentInput, Installment, LookupOption, PasseioOption, Receivable, SaleItem } from "@/lib/types";

type MeioPagamento = LookupOption & { tipo: string };

type Props = {
  receivable: Receivable;
  installments: Installment[];
  onClose: () => void;
  onUpdated: (updated: Receivable) => void;
};

function emptyInstallmentInput(): InstallmentInput {
  return {
    dueDate: "",
    meioPagamentoId: "",
    meioPagamentoNome: "",
    meioPagamentoTipo: "",
    accountId: "",
    accountName: "",
    cashReceiverId: "",
    cashReceiverName: "",
  };
}

function installmentFromExisting(installment: Installment): InstallmentInput {
  return {
    dueDate: installment.dueDate,
    meioPagamentoId: "",
    meioPagamentoNome: "",
    meioPagamentoTipo: "",
    accountId: "",
    accountName: "",
    cashReceiverId: "",
    cashReceiverName: "",
  };
}

export function ReceivableEditModal({ receivable, installments, onClose, onUpdated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Options
  const [sellers, setSellers] = useState<LookupOption[]>([]);
  const [meiosPagamento, setMeiosPagamento] = useState<MeioPagamento[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Basic fields
  const [customerName, setCustomerName] = useState(receivable.customerName);
  const [sellerId, setSellerId] = useState(receivable.sellerId ?? "");
  const [sellerName, setSellerName] = useState(receivable.sellerName ?? "");
  const [saleDate, setSaleDate] = useState(receivable.saleDate);
  const [description, setDescription] = useState(receivable.description ?? "");
  const [currency, setCurrency] = useState<Currency>(receivable.currency);
  const [branchCode, setBranchCode] = useState<BranchCode>(receivable.branchCode);
  const [totalAmount, setTotalAmount] = useState(String(receivable.totalAmount));
  const [fxRateUsdBrl, setFxRateUsdBrl] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState(receivable.installmentsCount);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [passeios, setPasseios] = useState<PasseioOption[]>([]);

  // Per-installment inputs – pre-fill from existing installments
  const sortedInstallments = useMemo(
    () => [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber),
    [installments]
  );

  const [installmentInputs, setInstallmentInputs] = useState<InstallmentInput[]>(() =>
    Array.from({ length: receivable.installmentsCount }, (_, i) =>
      sortedInstallments[i] ? installmentFromExisting(sortedInstallments[i]) : emptyInstallmentInput()
    )
  );

  // Sync installmentInputs length when count changes
  useEffect(() => {
    setInstallmentInputs((cur) =>
      Array.from({ length: installmentsCount }, (_, i) => cur[i] ?? emptyInstallmentInput())
    );
  }, [installmentsCount]);

  useEffect(() => {
    let active = true;
    Promise.all([listEmployees(), listMeiosPagamento(), listAccounts(), listPasseios(branchCode)])
      .then(([emps, meios, accs, pass]) => {
        if (!active) return;
        setSellers(emps);
        setMeiosPagamento(meios as MeioPagamento[]);
        setAccounts(accs);
        setPasseios(pass as PasseioOption[]);
        setLoadingOptions(false);
      })
      .catch(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [branchCode]);

  useEffect(() => {
    let active = true;

    fetch(`/api/receivables/${receivable.id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Falha ao carregar passeios da venda.");
        }

        const data = (await response.json()) as { saleItems?: SaleItem[] };
        if (!active) return;
        setSaleItems((data.saleItems ?? []).map((item) => ({ ...item, currency: (item.currency as Currency) ?? receivable.currency })));
      })
      .catch(() => {
        if (active) {
          setSaleItems([]);
        }
      });

    return () => {
      active = false;
    };
  }, [receivable.id, receivable.currency]);

  function updateSaleItem(index: number, patch: Partial<SaleItem>) {
    setSaleItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
    setSubmitAttempted(false);
  }

  function handleBranchChange(nextBranchCode: BranchCode) {
    if (nextBranchCode === branchCode) {
      return;
    }

    if (saleItems.length > 0) {
      const confirmed = window.confirm(
        "Trocar a filial também exige revisar os passeios desta venda. Deseja continuar?"
      );

      if (!confirmed) {
        return;
      }
    }

    setBranchCode(nextBranchCode);
    setSaleItems((current) =>
      current.map((item) => ({
        ...item,
        passeioId: "",
        passeioNome: "",
      }))
    );
  }

  function updateInstallmentInput(index: number, patch: Partial<InstallmentInput>) {
    setInstallmentInputs((cur) => cur.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const perInstallmentAmount = useMemo(() => {
    const total = Number(totalAmount) || 0;
    return installmentsCount > 0 ? (total / installmentsCount).toFixed(2) : "0.00";
  }, [totalAmount, installmentsCount]);

  function handleSave() {
    setSubmitAttempted(true);
    setError(null);

    if (!customerName.trim()) { setError("Informe o nome do cliente."); return; }
    if (!saleDate) { setError("Informe a data da venda."); return; }
    if (!totalAmount || Number(totalAmount) <= 0) { setError("Informe um valor total válido."); return; }
    if (installmentInputs.some((inp) => !inp.dueDate)) {
      setError("Informe a data de recebimento para todas as parcelas.");
      return;
    }
    if (saleItems.some((item) => !item.passeioId)) {
      setError("Selecione um passeio válido em todos os itens da venda.");
      return;
    }

    const seller = sellers.find((s) => s.id === sellerId);

    startTransition(async () => {
      try {
        const updated = await updateReceivable(receivable.id, {
          customerName: customerName.trim(),
          saleDate,
          description: description.trim() || undefined,
          totalAmount: Number(totalAmount),
          currency,
          branchCode,
          saleItems,
          sellerId: sellerId || undefined,
          sellerName: (seller?.name ?? sellerName) || undefined,
          fxRateUsdBrl: fxRateUsdBrl ? Number(fxRateUsdBrl) : undefined,
          installmentsCount,
          installmentInputs,
        });
        onUpdated(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            Editar Venda {receivable.saleCode ? `· ${receivable.saleCode}` : ""}
          </h3>
          <button className="btn secondary small" type="button" onClick={onClose}>✕</button>
        </div>

        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

        {/* ── Dados da venda ── */}
        <div className="form-section-label">Dados da venda</div>
        <div className="form-grid" style={{ gap: 12 }}>

          <div className="field">
            <label>Cliente</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>

          <div className="field">
            <label>Vendedor</label>
            <select
              value={sellerId}
              onChange={(e) => {
                setSellerId(e.target.value);
                setSellerName(sellers.find((s) => s.id === e.target.value)?.name ?? "");
              }}
            >
              <option value="">{loadingOptions ? "Carregando..." : "Selecione o vendedor"}</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Moeda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>

          <div className="field">
            <label>Cotação USD/BRL na data da venda</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              placeholder="5.3000"
              value={fxRateUsdBrl}
              onChange={(e) => setFxRateUsdBrl(e.target.value)}
              disabled={currency !== "USD"}
            />
          </div>

          <div className="field">
            <label>Filial</label>
            <select value={branchCode} onChange={(e) => handleBranchChange(e.target.value as BranchCode)}>
              {BRANCHES.map((branch) => (
                <option key={branch.code} value={branch.code}>{branch.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Data da venda</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>

          <div className="field">
            <label>Total da venda ({currency})</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div className="field full">
            <label>Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>
        </div>

        <div className="form-section-label" style={{ marginTop: 16 }}>Passeios da venda</div>
        {submitAttempted && saleItems.some((item) => !item.passeioId) ? (
          <p className="form-error" style={{ marginTop: 0, marginBottom: 10 }}>
            Existem itens sem passeio selecionado. Corrija antes de salvar.
          </p>
        ) : null}
        <div style={{ display: "grid", gap: 10 }}>
          {saleItems.length === 0 ? (
            <p className="subtle" style={{ margin: 0 }}>Sem passeios vinculados nesta venda.</p>
          ) : (
            saleItems.map((item, idx) => (
              <div
                key={`edit-sale-item-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: !item.passeioId && submitAttempted ? "1px solid #d1495b" : "1px solid var(--line, #e8e8e8)",
                  background: "rgba(15,43,69,0.03)",
                }}
              >
                <div className="field" style={{ margin: 0 }}>
                  <label>Passeio</label>
                  <select
                    value={item.passeioId}
                    onChange={(e) => {
                      const passeio = passeios.find((p) => p.id === e.target.value);
                      updateSaleItem(idx, {
                        passeioId: e.target.value,
                        passeioNome: passeio?.name ?? "",
                      });
                    }}
                  >
                    <option value="">Selecione...</option>
                    {passeios.map((passeio) => (
                      <option key={passeio.id} value={passeio.id}>{passeio.name}</option>
                    ))}
                  </select>
                  {!item.passeioId && submitAttempted ? (
                    <span className="form-error" style={{ fontSize: "0.78rem", marginTop: 4, display: "inline-block" }}>
                      Selecione um passeio para este item.
                    </span>
                  ) : null}
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Valor item ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.totalItem}
                    onChange={(e) => updateSaleItem(idx, { totalItem: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Parcelamento ── */}
        <div className="form-section-label" style={{ marginTop: 16 }}>Parcelamento</div>
        <div className="form-grid" style={{ gap: 12 }}>
          <div className="field">
            <label>Número de parcelas</label>
            <input
              type="number"
              min="1"
              max="120"
              value={installmentsCount}
              onChange={(e) => {
                const v = Math.max(1, Math.min(120, Math.trunc(Number(e.target.value)) || 1));
                setInstallmentsCount(v);
              }}
            />
          </div>

          {installmentsCount > 1 && (
            <div className="field" style={{ alignSelf: "end" }}>
              <label>Valor por parcela (estimado)</label>
              <input type="text" readOnly value={`${currency} ${perInstallmentAmount}`} style={{ background: "var(--surface-alt, #f5f5f5)" }} />
            </div>
          )}
        </div>

        {/* ── Parcelas ── */}
        <div style={{ marginTop: 8 }}>
          {installmentInputs.map((inp, idx) => (
            <div
              key={`edit-inst-${idx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
                padding: 12,
                borderRadius: 8,
                background: "rgba(15,43,69,0.03)",
                marginBottom: 8,
                border: "1px solid var(--line, #e8e8e8)",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <strong style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                  Parcela {idx + 1}{installmentsCount === 1 ? "" : ` de ${installmentsCount}`}
                </strong>
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label>Data de recebimento</label>
                <input
                  type="date"
                  value={inp.dueDate}
                  onChange={(e) => updateInstallmentInput(idx, { dueDate: e.target.value })}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label>Meio de pagamento</label>
                <select
                  value={inp.meioPagamentoId}
                  onChange={(e) => {
                    const meio = meiosPagamento.find((m) => m.id === e.target.value);
                    updateInstallmentInput(idx, {
                      meioPagamentoId: e.target.value,
                      meioPagamentoNome: meio?.name ?? "",
                      meioPagamentoTipo: meio?.tipo?.toUpperCase() ?? "",
                      cashReceiverId: "",
                      cashReceiverName: "",
                    });
                  }}
                >
                  <option value="">{loadingOptions ? "Carregando..." : "Selecione"}</option>
                  {meiosPagamento.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label>Conta de recebimento</label>
                <select
                  value={inp.accountId}
                  onChange={(e) => {
                    const account = accounts.find((a) => a.id === e.target.value);
                    updateInstallmentInput(idx, {
                      accountId: e.target.value,
                      accountName: account?.name ?? "",
                    });
                  }}
                >
                  <option value="">{loadingOptions ? "Carregando..." : "Selecione"}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.baseCurrency})</option>
                  ))}
                </select>
              </div>

              {inp.meioPagamentoTipo === "AO FUNCIONARIO" && (
                <div className="field" style={{ margin: 0 }}>
                  <label>Funcionário que receberá</label>
                  <select
                    value={inp.cashReceiverId}
                    onChange={(e) => {
                      const func = sellers.find((s) => s.id === e.target.value);
                      updateInstallmentInput(idx, {
                        cashReceiverId: e.target.value,
                        cashReceiverName: func?.name ?? "",
                      });
                    }}
                  >
                    <option value="" disabled>Selecione o funcionário</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Ações ── */}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn primary" type="button" disabled={isPending} onClick={handleSave}>
            {isPending ? "Salvando..." : "Salvar alterações"}
          </button>
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
