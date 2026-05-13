"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createReceivable, listAccounts, listEmployees, listFornecedores, listMeiosPagamento, listPasseios } from "../lib/api-client";
import { FornecedorCreateModal } from "@/components/fornecedor-create-modal";
import { SaleItemRow } from "@/components/sale-item-row";
import { BRANCHES, type BranchCode } from "@/lib/branches";
import type { Account, Currency, InstallmentInput, LookupOption, PasseioOption, Receivable, SaleItem } from "@/lib/types";

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
    amountOverride: "",
    meioPagamentoId: "",
    meioPagamentoNome: "",
    meioPagamentoTipo: "",
    accountId: "",
    accountName: "",
    cashReceiverId: "",
    cashReceiverName: "",
  };
}

/**
 * Computes per-installment amounts.
 * If an installment has a manual override, it is locked.
 * The balance after the last override is split evenly across subsequent installments,
 * with the final installment absorbing any rounding cent.
 */
function computeInstallmentAmounts(total: number, count: number, overrides: (string | undefined)[]): number[] {
  if (count <= 0) return [];

  let lastOverrideIdx = -1;
  for (let i = 0; i < count; i++) {
    if (overrides[i] !== undefined && overrides[i] !== "") lastOverrideIdx = i;
  }

  const amounts: number[] = new Array(count).fill(0);
  let sumOverridden = 0;

  for (let i = 0; i <= lastOverrideIdx; i++) {
    const val = Number(overrides[i] ?? 0) || 0;
    amounts[i] = val;
    sumOverridden += val;
  }

  const remaining = Math.max(0, Math.round((total - sumOverridden) * 100) / 100);
  const remainingCount = count - (lastOverrideIdx + 1);

  if (remainingCount <= 0) return amounts;

  const base = Math.floor((remaining / remainingCount) * 100) / 100;
  const last = Math.round((remaining - base * (remainingCount - 1)) * 100) / 100;

  for (let i = lastOverrideIdx + 1; i < count; i++) {
    amounts[i] = i === count - 1 ? last : base;
  }

  return amounts;
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [branchCode, setBranchCode] = useState<BranchCode>("CANCUN");
  const [sellers, setSellers] = useState<LookupOption[]>([]);
  const [passeios, setPasseios] = useState<PasseioOption[]>([]);
  const [fornecedores, setFornecedores] = useState<LookupOption[]>([]);
const [meiosPagamento, setMeiosPagamento] = useState<MeioPagamento[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [items, setItems] = useState<SaleItem[]>([emptyItem("USD")]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFornecedorModalOpen, setIsFornecedorModalOpen] = useState(false);
  const [fornecedorTargetIndex, setFornecedorTargetIndex] = useState<number | null>(null);
  const [activeFornecedorIndex, setActiveFornecedorIndex] = useState(0);
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [discountPercentInput, setDiscountPercentInput] = useState("");

  // Estado global de pagamento (usado apenas quando installmentsCount === 1)
  const [globalMeioId, setGlobalMeioId] = useState("");
  const [globalMeioTipo, setGlobalMeioTipo] = useState("");
  const [globalAccountId, setGlobalAccountId] = useState("");

  // Estado por parcela (usado quando installmentsCount > 1)
  const [installmentInputs, setInstallmentInputs] = useState<InstallmentInput[]>([emptyInstallmentInput()]);

  useEffect(() => {
    let active = true;
    Promise.all([listEmployees(), listFornecedores(), listMeiosPagamento(), listAccounts()])
      .then(([emps, forn, meios, accs]) => {
        if (!active) return;
        setSellers(emps);
        setFornecedores(forn);
        setMeiosPagamento(meios as MeioPagamento[]);
        setAccounts(accs);
        setLoadingOptions(false);
      })
      .catch(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);

    listPasseios(branchCode)
      .then((items) => {
        if (!active) return;
        setPasseios(items as PasseioOption[]);
        setItems((current) =>
          current.map((item) => ({
            ...item,
            passeioId: "",
            passeioNome: "",
            fornecedorId: "",
            fornecedorNome: "",
            custoUnitarioAdulto: 0,
            custoUnitarioCrianca: 0,
            totalItem: 0
          }))
        );
        setLoadingOptions(false);
      })
      .catch(() => {
        if (active) {
          setPasseios([]);
          setLoadingOptions(false);
        }
      });

    return () => {
      active = false;
    };
  }, [branchCode]);

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

  const totalVendaBruta = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.totalItem, 0) * 100) / 100,
    [items]
  );

  const descontoPercentual = useMemo(() => {
    const normalized = discountPercentInput.trim().replace(",", ".");
    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return Math.min(parsed, 100);
  }, [discountPercentInput]);

  const valorDesconto = useMemo(
    () => Math.round(totalVendaBruta * (descontoPercentual / 100) * 100) / 100,
    [totalVendaBruta, descontoPercentual]
  );

  const totalVenda = useMemo(
    () => Math.max(0, Math.round((totalVendaBruta - valorDesconto) * 100) / 100),
    [totalVendaBruta, valorDesconto]
  );

  const installmentAmounts = useMemo(
    () => computeInstallmentAmounts(
      totalVenda,
      installmentsCount,
      installmentInputs.map((inp) => inp.amountOverride)
    ),
    [totalVenda, installmentsCount, installmentInputs]
  );

  function updateInstallmentInput(index: number, patch: Partial<InstallmentInput>) {
    setInstallmentInputs((cur) =>
      cur.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function handleItemChange(index: number, value: SaleItem) {
    setItems((cur) => cur.map((item, i) => (i === index ? value : item)));
    setSubmitAttempted(false);
  }

  function handleItemRemove(index: number) {
    setItems((cur) => cur.filter((_, i) => i !== index));
    setActiveFornecedorIndex((current) => {
      if (current === index) {
        return Math.max(0, current - 1);
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
  }

  function addItem() {
    setItems((cur) => [...cur, emptyItem(currency)]);
  }

  function hasConfiguredItems() {
    return items.some(
      (item) =>
        !!item.passeioId ||
        !!item.fornecedorId ||
        item.adultos > 0 ||
        item.criancas > 0 ||
        item.custoUnitarioAdulto > 0 ||
        item.custoUnitarioCrianca > 0 ||
        item.totalItem > 0
    );
  }

  function handleBranchChange(nextBranchCode: BranchCode) {
    if (nextBranchCode === branchCode) {
      return;
    }

    if (hasConfiguredItems()) {
      const confirmed = window.confirm(
        "Trocar a filial vai limpar os passeios e valores já selecionados nesta venda. Deseja continuar?"
      );

      if (!confirmed) {
        return;
      }
    }

    setBranchCode(nextBranchCode);
  }

  function openFornecedorModal() {
    const targetIndex = Math.max(0, Math.min(activeFornecedorIndex, items.length - 1));
    setFornecedorTargetIndex(targetIndex);
    setIsFornecedorModalOpen(true);
  }

  function handleFornecedorCreated(created: LookupOption) {
    setFornecedores((current) => {
      const next = [...current.filter((item) => item.id !== created.id), created];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });

    if (fornecedorTargetIndex !== null) {
      setItems((current) =>
        current.map((item, index) =>
          index === fornecedorTargetIndex
            ? { ...item, fornecedorId: created.id, fornecedorNome: created.name }
            : item
        )
      );
    }

    setIsFornecedorModalOpen(false);
    setFornecedorTargetIndex(null);
  }

  function closeFornecedorModal() {
    setIsFornecedorModalOpen(false);
    setFornecedorTargetIndex(null);
  }

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setCurrency("USD");
    setBranchCode("CANCUN");
    setDiscountPercentInput("");
    setInstallmentsCount(1);
    setInstallmentInputs([emptyInstallmentInput()]);
    setGlobalMeioId("");
    setGlobalMeioTipo("");
    setGlobalAccountId("");
    setItems([emptyItem("USD")]);
    setSubmitAttempted(false);
    setIsOpen(false);
    setIsFornecedorModalOpen(false);
    setFornecedorTargetIndex(null);
    setActiveFornecedorIndex(0);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
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
        const selectedBranchCode = String(formData.get("branchCode") ?? "").trim() as BranchCode;

        if (selectedBranchCode !== "CANCUN" && selectedBranchCode !== "PUNTA_CANA") {
          throw new Error("Selecione a filial da venda.");
        }

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
            branchCode: selectedBranchCode,
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
            installmentAmounts: [totalVenda],
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
            branchCode: selectedBranchCode,
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
            installmentAmounts,
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
            <label htmlFor="rec-branch">Filial</label>
            <select
              id="rec-branch"
              name="branchCode"
              value={branchCode}
              onChange={(e) => handleBranchChange(e.target.value as BranchCode)}
              required
            >
              {BRANCHES.map((branch) => (
                <option key={branch.code} value={branch.code}>
                  {branch.label}
                </option>
              ))}
            </select>
            <span className="subtle" style={{ fontSize: "0.78rem" }}>
              Os passeios são carregados conforme a filial selecionada.
            </span>
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
            {submitAttempted && items.some((item) => !item.passeioId || !item.fornecedorId) ? (
              <p className="form-error" style={{ marginTop: 0, marginBottom: 8 }}>
                Existem itens sem passeio e/ou fornecedor. Complete os campos destacados.
              </p>
            ) : null}

            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: submitAttempted && (!item.passeioId || !item.fornecedorId) ? "1px solid #d1495b" : "1px solid transparent",
                  borderRadius: 8,
                  padding: 6,
                  marginBottom: 6,
                }}
              >
                <SaleItemRow
                  index={idx}
                  passeios={passeios}
                  fornecedores={fornecedores}
                  currency={currency}
                  value={item}
                  onChange={handleItemChange}
                  onRemove={handleItemRemove}
                  onFornecedorFocus={setActiveFornecedorIndex}
                  onAddFornecedor={openFornecedorModal}
                  showAddFornecedorButton={idx === 0}
                  showRemove={items.length > 1}
                />

                {submitAttempted && (!item.passeioId || !item.fornecedorId) ? (
                  <span className="form-error" style={{ fontSize: "0.78rem", marginLeft: 4 }}>
                    {!item.passeioId && !item.fornecedorId
                      ? "Selecione passeio e fornecedor."
                      : !item.passeioId
                        ? "Selecione o passeio."
                        : "Selecione o fornecedor."}
                  </span>
                ) : null}
              </div>
            ))}
            <div className="field" style={{ marginTop: 8, maxWidth: 280 }}>
              <label htmlFor="rec-discount-percent">Desconto (%)</label>
              <input
                id="rec-discount-percent"
                name="discountPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercentInput}
                onChange={(e) => setDiscountPercentInput(e.target.value)}
                placeholder="0"
              />
              <span className="subtle" style={{ fontSize: "0.78rem" }}>
                Se vazio, o desconto considerado sera 0%.
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                <span className="subtle" style={{ fontSize: "0.86rem" }}>
                  Total bruto: {currency} {totalVendaBruta.toFixed(2)}
                </span>
                <span className="subtle" style={{ fontSize: "0.86rem" }}>
                  Desconto ({descontoPercentual.toFixed(2)}%): - {currency} {valorDesconto.toFixed(2)}
                </span>
                <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  Total final: {currency} {totalVenda.toFixed(2)}
                </span>
              </div>
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

              <div className="field">
                <label htmlFor="rec-amount-1">Valor da parcela ({currency})</label>
                <input
                  id="rec-amount-1"
                  type="number"
                  min="0.01"
                  step="0.01"
                  readOnly
                  value={totalVenda > 0 ? totalVenda.toFixed(2) : ""}
                  placeholder={totalVenda > 0 ? totalVenda.toFixed(2) : "Calculado automaticamente"}
                  style={{ background: "rgba(15,43,69,0.04)", cursor: "default" }}
                />
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

                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`rec-amount-${idx + 1}`}>
                      Valor ({currency})
                      {!inp.amountOverride && (
                        <span className="subtle" style={{ fontSize: "0.78rem", marginLeft: 6 }}>opcional</span>
                      )}
                    </label>
                    <input
                      id={`rec-amount-${idx + 1}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={installmentAmounts[idx]?.toFixed(2) ?? ""}
                      value={inp.amountOverride ?? ""}
                      onChange={(e) => updateInstallmentInput(idx, { amountOverride: e.target.value })}
                    />
                    <span className="subtle" style={{ fontSize: "0.78rem" }}>
                      Calculado: {currency} {(installmentAmounts[idx] ?? 0).toFixed(2)}
                    </span>
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

      {isFornecedorModalOpen ? (
        <FornecedorCreateModal onClose={closeFornecedorModal} onCreated={handleFornecedorCreated} />
      ) : null}

      {feedback ? <p className="subtle">{feedback}</p> : null}
    </>
  );
}
