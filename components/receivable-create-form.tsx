"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createReceivable, listAccounts, listEmployees, listFornecedores, listMeiosPagamento, listPasseios } from "../lib/api-client";
import { SaleItemRow } from "@/components/sale-item-row";
import type { Account, Currency, InstallmentInput, LookupOption, Receivable, SaleItem } from "@/lib/types";

type MeioPagamento = LookupOption & { tipo: string; contaRecebimento?: string };

type ReceivableCreateFormProps = {
  onCreated?: (receivable: Receivable) => void;
};

function emptyItem(currency: Currency): SaleItem {
  return {
    passeioId: "",
    passeioNome: "",
    fornecedorId: "",
    fornecedorNome: "",
    adultos: 0,
    criancas: 0,
    custoUnitarioAdulto: 0,
    custoUnitarioCrianca: 0,
    totalItem: 0,
    currency,
  };
}

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

function addMonthsKeepingDay(isoDate: string, monthsToAdd: number) {
  if (!isoDate) {
    return "";
  }

  const [yearText, monthText, dayText] = isoDate.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!year || !month || !day) {
    return "";
  }

  const baseMonthIndex = month - 1;
  const targetMonthIndex = baseMonthIndex + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  return `${targetYear}-${String(normalizedMonthIndex + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function ReceivableCreateForm({ onCreated }: ReceivableCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [sellers, setSellers] = useState<LookupOption[]>([]);
  const [passeios, setPasseios] = useState<LookupOption[]>([]);
  const [fornecedores, setFornecedores] = useState<LookupOption[]>([]);
const [meiosPagamento, setMeiosPagamento] = useState<MeioPagamento[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [items, setItems] = useState<SaleItem[]>([emptyItem("USD")]);
  const [isOpen, setIsOpen] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(1);

  // Estado global de pagamento (usado apenas quando installmentsCount === 1)
  const [globalMeioId, setGlobalMeioId] = useState("");
  const [globalMeioTipo, setGlobalMeioTipo] = useState("");
  const [globalAccountId, setGlobalAccountId] = useState("");

  // Estado por parcela (usado quando installmentsCount > 1)
  const [installmentInputs, setInstallmentInputs] = useState<InstallmentInput[]>([emptyInstallmentInput()]);

  useEffect(() => {
    let active = true;
    Promise.all([listEmployees(), listPasseios(), listFornecedores(), listMeiosPagamento(), listAccounts()])
      .then(([emps, pass, forn, meios, accs]) => {
        if (!active) return;
        setSellers(emps);
        setPasseios(pass);
        setFornecedores(forn);
        setMeiosPagamento(meios as MeioPagamento[]);
        setAccounts(accs);
        setLoadingOptions(false);
      })
      .catch(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setInstallmentInputs((cur) =>
      Array.from({ length: installmentsCount }, (_, i) => cur[i] ?? emptyInstallmentInput())
    );
  }, [installmentsCount]);

  // For multiple installments, replicate payment/account data from installment 1
  // and auto-generate due dates month-by-month keeping the same day.
  useEffect(() => {
    if (installmentsCount <= 1) {
      return;
    }

    setInstallmentInputs((cur) => {
      if (!cur.length) {
        return cur;
      }

      const first = cur[0];
      let changed = false;

      const next = cur.map((item, index) => {
        if (index === 0) {
          return item;
        }

        const nextDueDate = addMonthsKeepingDay(first.dueDate, index);
        const nextItem: InstallmentInput = {
          ...item,
          dueDate: nextDueDate,
          meioPagamentoId: first.meioPagamentoId,
          meioPagamentoNome: first.meioPagamentoNome,
          meioPagamentoTipo: first.meioPagamentoTipo,
          accountId: first.accountId,
          accountName: first.accountName,
          cashReceiverId: first.cashReceiverId,
          cashReceiverName: first.cashReceiverName,
        };

        if (
          nextItem.dueDate !== item.dueDate ||
          nextItem.meioPagamentoId !== item.meioPagamentoId ||
          nextItem.meioPagamentoNome !== item.meioPagamentoNome ||
          nextItem.meioPagamentoTipo !== item.meioPagamentoTipo ||
          nextItem.accountId !== item.accountId ||
          nextItem.accountName !== item.accountName ||
          nextItem.cashReceiverId !== item.cashReceiverId ||
          nextItem.cashReceiverName !== item.cashReceiverName
        ) {
          changed = true;
        }

        return nextItem;
      });

      return changed ? next : cur;
    });
  }, [
    installmentsCount,
    installmentInputs[0]?.dueDate,
    installmentInputs[0]?.meioPagamentoId,
    installmentInputs[0]?.meioPagamentoNome,
    installmentInputs[0]?.meioPagamentoTipo,
    installmentInputs[0]?.accountId,
    installmentInputs[0]?.accountName,
    installmentInputs[0]?.cashReceiverId,
    installmentInputs[0]?.cashReceiverName,
  ]);

  // Sincroniza moeda dos itens quando a moeda da venda mudar
  useEffect(() => {
    setItems((cur) => cur.map((item) => ({ ...item, currency })));
  }, [currency]);

  const totalVenda = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.totalItem, 0) * 100) / 100,
    [items]
  );

  function updateInstallmentInput(index: number, patch: Partial<InstallmentInput>) {
    setInstallmentInputs((cur) =>
      cur.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function handleItemChange(index: number, value: SaleItem) {
    setItems((cur) => cur.map((item, i) => (i === index ? value : item)));
  }

  function handleItemRemove(index: number) {
    setItems((cur) => cur.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((cur) => [...cur, emptyItem(currency)]);
  }

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setCurrency("USD");
    setInstallmentsCount(1);
    setInstallmentInputs([emptyInstallmentInput()]);
    setGlobalMeioId("");
    setGlobalMeioTipo("");
    setGlobalAccountId("");
    setItems([emptyItem("USD")]);
    setIsOpen(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const sellerId = String(formData.get("sellerId") ?? "").trim();
        const seller = sellers.find((s) => s.id === sellerId);
        if (!seller) throw new Error("Selecione um vendedor válido.");

        if (items.some((i) => !i.passeioId || !i.fornecedorId)) {
          throw new Error("Selecione passeio e fornecedor em todos os itens.");
        }

        const fxRateRaw = String(formData.get("fxRateUsdBrl") ?? "").trim();
        const fxRateUsdBrl = fxRateRaw ? Number(fxRateRaw) : undefined;
        const saleDate = String(formData.get("saleDate") ?? "").trim();
        const customerName = String(formData.get("customerName") ?? "").trim();

        if (totalVenda <= 0) throw new Error("O total da venda deve ser maior que zero.");

        if (installmentsCount === 1) {
          // Parcela única: campos globais
          const dueDate = String(formData.get("installmentDueDate-1") ?? "").trim();
          if (!dueDate) throw new Error("Informe a data de recebimento.");

          const meio = meiosPagamento.find((m) => m.id === globalMeioId);
          const account = accounts.find((a) => a.id === globalAccountId);
          const cashReceiverId = String(formData.get("cashReceiverId") ?? "").trim();
          const cashReceiver = globalMeioTipo === "AO FUNCIONARIO" ? sellers.find((s) => s.id === cashReceiverId) : undefined;

          const created = await createReceivable({
            customerName,
            sellerId,
            sellerName: seller.name,
            fxRateUsdBrl,
            totalAmount: totalVenda,
            currency,
            saleDate,
            installmentsCount: 1,
            items,
            installmentDueDates: [dueDate],
            meioPagamentoId: meio?.id,
            meioPagamentoNome: meio?.name,
            meioPagamentoTipo: meio?.tipo,
            accountId: account?.id,
            accountName: account?.name,
            cashReceiverId: cashReceiver?.id,
            cashReceiverName: cashReceiver?.name,
          });

          setFeedback(`Venda registrada: ${created.customerName}${created.saleCode ? ` · venda ${created.saleCode}` : ""}`);
          resetForm(form);
          onCreated?.(created);
          router.refresh();
        } else {
          // Múltiplas parcelas
          if (installmentInputs.some((inp) => !inp.dueDate)) {
            throw new Error("Informe a data de recebimento para todas as parcelas.");
          }

          const created = await createReceivable({
            customerName,
            sellerId,
            sellerName: seller.name,
            fxRateUsdBrl,
            totalAmount: totalVenda,
            currency,
            saleDate,
            installmentsCount,
            items,
            installmentDueDates: installmentInputs.map((inp) => inp.dueDate),
            installmentInputs,
          });

          setFeedback(`Venda registrada: ${created.customerName}${created.saleCode ? ` · venda ${created.saleCode}` : ""}`);
          resetForm(form);
          onCreated?.(created);
          router.refresh();
        }
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao criar venda.");
      }
    });
  }

  return (
    <>
      <div className="cta-row" style={{ marginBottom: 12 }}>
        <button className="btn primary" type="button" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? "Fechar cadastro" : "Cadastrar vendas"}
        </button>
      </div>

      {isOpen && (
        <form className="form-grid" onSubmit={onSubmit}>

          {/* â”€â”€ SEÃ‡ÃƒO 1: Dados da venda â”€â”€ */}
          <div className="field full" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6, marginBottom: 2 }}>
            <strong>Dados da venda</strong>
          </div>

          <div className="field">
            <label htmlFor="rec-customer">Cliente</label>
            <input id="rec-customer" name="customerName" placeholder="Nome do cliente" required />
          </div>

          <div className="field">
            <label htmlFor="rec-seller">Vendedor</label>
            <select id="rec-seller" name="sellerId" defaultValue="" required>
              <option value="" disabled>
                {sellers.length ? "Selecione o vendedor" : "Carregando vendedores..."}
              </option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rec-currency">Moeda</label>
            <select
              id="rec-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              required
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="rec-fx">CotaÃ§Ã£o USD/BRL na data da venda</label>
            <input
              id="rec-fx"
              name="fxRateUsdBrl"
              type="number"
              min="0.0001"
              step="0.0001"
              placeholder="5.3000"
              required={currency === "USD"}
              disabled={currency !== "USD"}
            />
          </div>

          <div className="field full">
            <label htmlFor="rec-sale-date">Data da venda</label>
            <input id="rec-sale-date" name="saleDate" type="date" required />
          </div>

          {/* â”€â”€ SEÃ‡ÃƒO 2: Itens de passeio â”€â”€ */}
          <div
            className="field full"
            style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6, marginBottom: 2, marginTop: 10 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <strong>Passeios</strong>
              <button type="button" className="btn secondary" style={{ padding: "3px 14px" }} onClick={addItem}>
                + Adicionar passeio
              </button>
            </div>
          </div>

          <div className="field full">
            {items.map((item, idx) => (
              <SaleItemRow
                key={idx}
                index={idx}
                passeios={passeios}
                fornecedores={fornecedores}
                currency={currency}
                value={item}
                onChange={handleItemChange}
                onRemove={handleItemRemove}
                showRemove={items.length > 1}
              />
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                Total da venda: {currency} {totalVenda.toFixed(2)}
              </span>
            </div>
          </div>

          {/* ── SEÇÃO 3: Parcelamento e Pagamento ── */}
          <div
            className="field full"
            style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6, marginBottom: 2, marginTop: 10 }}
          >
            <strong>Parcelamento</strong>
          </div>

          <div className="field">
            <label htmlFor="rec-installments">Número de parcelas</label>
            <input
              id="rec-installments"
              name="installmentsCount"
              type="number"
              min="1"
              max="120"
              value={installmentsCount}
              onChange={(e) => {
                const v = Math.max(1, Math.min(120, Math.trunc(Number(e.target.value)) || 1));
                setInstallmentsCount(v);
              }}
              required
            />
          </div>

          {/* Parcela única: data + pagamento global */}
          {installmentsCount === 1 && (
            <>
              <div className="field full" style={{ marginTop: 4 }}>
                <strong style={{ fontSize: "0.92rem", color: "var(--muted)" }}>Data e pagamento</strong>
              </div>

              <div className="field">
                <label htmlFor="rec-due-1">Data de recebimento</label>
                <input id="rec-due-1" name="installmentDueDate-1" type="date" required />
              </div>

              <div className="field">
                <label htmlFor="rec-meio-pagamento">Meio de pagamento</label>
                <select
                  id="rec-meio-pagamento"
                  name="meioPagamentoId"
                  value={globalMeioId}
                  onChange={(e) => {
                    const meio = meiosPagamento.find((m) => m.id === e.target.value);
                    setGlobalMeioId(e.target.value);
                    setGlobalMeioTipo(meio?.tipo?.toUpperCase() ?? "");
                  }}
                >
                  <option value="">
                    {loadingOptions ? "Carregando..." : meiosPagamento.length ? "Selecione o meio de pagamento" : "Nenhum cadastrado"}
                  </option>
                  {meiosPagamento.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="rec-account">Conta de recebimento</label>
                <select
                  id="rec-account"
                  name="accountId"
                  value={globalAccountId}
                  onChange={(e) => setGlobalAccountId(e.target.value)}
                >
                  <option value="">
                    {loadingOptions ? "Carregando..." : accounts.length ? "Selecione a conta" : "Nenhuma conta encontrada"}
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.baseCurrency})</option>
                  ))}
                </select>
              </div>

              {globalMeioTipo === "AO FUNCIONARIO" && (
                <div className="field">
                  <label htmlFor="rec-cash-receiver">Funcionário que receberá</label>
                  <select id="rec-cash-receiver" name="cashReceiverId" defaultValue="" required>
                    <option value="" disabled>Selecione o funcionário</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Múltiplas parcelas: linha por parcela com data + meio + conta + (funcionário) */}
          {installmentsCount > 1 && (
            <>
              <div className="field full" style={{ marginTop: 4 }}>
                <strong style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                  Datas e pagamento por parcela ({installmentsCount} parcelas)
                </strong>
              </div>

              {installmentInputs.map((inp, idx) => (
                <div
                  key={`installment-block-${idx}`}
                  className="field full"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(15,43,69,0.03)",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Parcela {idx + 1}</strong>
                  </div>

                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`rec-due-${idx + 1}`}>Data de recebimento</label>
                    <input
                      id={`rec-due-${idx + 1}`}
                      name={`installmentDueDate-${idx + 1}`}
                      type="date"
                      value={inp.dueDate}
                      onChange={(e) => updateInstallmentInput(idx, { dueDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`rec-meio-${idx + 1}`}>Meio de pagamento</label>
                    <select
                      id={`rec-meio-${idx + 1}`}
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
                    <label htmlFor={`rec-acc-${idx + 1}`}>Conta de recebimento</label>
                    <select
                      id={`rec-acc-${idx + 1}`}
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
                      <label htmlFor={`rec-func-${idx + 1}`}>Funcionário que receberá</label>
                      <select
                        id={`rec-func-${idx + 1}`}
                        value={inp.cashReceiverId}
                        onChange={(e) => {
                          const func = sellers.find((s) => s.id === e.target.value);
                          updateInstallmentInput(idx, {
                            cashReceiverId: e.target.value,
                            cashReceiverName: func?.name ?? "",
                          });
                        }}
                        required
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
            </>
          )}

          <div className="field full cta-row" style={{ marginTop: 8 }}>
            <button
              className="btn primary"
              type="submit"
              disabled={isPending || totalVenda <= 0}
            >
              {isPending ? "Salvando..." : "Salvar venda"}
            </button>
          </div>

        </form>
      )}

      {feedback ? <p className="subtle">{feedback}</p> : null}
    </>
  );
}
