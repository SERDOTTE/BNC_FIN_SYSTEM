"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { deleteReceivable, updateInstallmentStatus } from "../lib/api-client";
import { ReceivableEditModal } from "@/components/receivable-edit-modal";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Installment, Receivable } from "@/lib/types";

type ReceivablesRealizedTableProps = {
  receivables: Receivable[];
  installments: Installment[];
};

type MonthOption = {
  value: string;
  label: string;
};

type ReceivablesViewTab = "sales" | "receipts-flow";

const monthLabels = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

function getMonthKey(dateValue: string) {
  const [year, month] = dateValue.split("-");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const monthIndex = Number.parseInt(month, 10) - 1;
  const monthName = monthLabels[monthIndex] ?? month;
  return `${monthName} / ${year}`;
}

function isOverdueInstallment(installment: Installment) {
  if (installment.status === "PAID") {
    return false;
  }

  if (installment.status === "OVERDUE") {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${installment.dueDate}T00:00:00`);
  return dueDate.getTime() < today.getTime();
}

function installmentStatusMeta(installment: Installment) {
  if (installment.status === "PAID") {
    return { label: "Recebido", className: "tooltip-status-paid" };
  }

  if (isOverdueInstallment(installment)) {
    return { label: "Vencido", className: "tooltip-status-overdue" };
  }

  return { label: "A receber", className: "tooltip-status-pending" };
}

const flowStatusCycle: Array<"PENDING" | "OVERDUE" | "PAID"> = ["PENDING", "OVERDUE", "PAID"];
type FlowInstallmentStatus = "PENDING" | "OVERDUE" | "PAID";

export function ReceivablesRealizedTable({ receivables, installments }: ReceivablesRealizedTableProps) {
  const [receivablesState, setReceivablesState] = useState<Receivable[]>(receivables);
  const [installmentsState, setInstallmentsState] = useState<Installment[]>(installments);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<ReceivablesViewTab>("sales");

  useEffect(() => {
    setReceivablesState(receivables);
  }, [receivables]);

  useEffect(() => {
    setInstallmentsState(installments);
  }, [installments]);

  const monthOptions = useMemo<MonthOption[]>(() => {
    const keys = Array.from(new Set(receivablesState.map((item) => getMonthKey(item.saleDate))));
    return keys
      .sort((left, right) => (left < right ? 1 : -1))
      .map((value) => ({ value, label: formatMonthLabel(value) }));
  }, [receivablesState]);

  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0]?.value ?? "");

  const receiptMonthOptions = useMemo<MonthOption[]>(() => {
    const keys = Array.from(new Set(installmentsState.map((item) => getMonthKey(item.dueDate))));
    return keys
      .sort((left, right) => (left < right ? 1 : -1))
      .map((value) => ({ value, label: formatMonthLabel(value) }));
  }, [installmentsState]);

  const [selectedReceiptMonth, setSelectedReceiptMonth] = useState<string>(receiptMonthOptions[0]?.value ?? "");

  useEffect(() => {
    if (!monthOptions.length) {
      setSelectedMonth("");
      return;
    }

    setSelectedMonth((current) => {
      if (current && monthOptions.some((option) => option.value === current)) {
        return current;
      }

      return monthOptions[0].value;
    });
  }, [monthOptions]);

  useEffect(() => {
    if (!receiptMonthOptions.length) {
      setSelectedReceiptMonth("");
      return;
    }

    setSelectedReceiptMonth((current) => {
      if (current && receiptMonthOptions.some((option) => option.value === current)) {
        return current;
      }

      return receiptMonthOptions[0].value;
    });
  }, [receiptMonthOptions]);

  const installmentsByReceivable = useMemo(() => {
    const grouped = new Map<string, Installment[]>();

    for (const installment of installmentsState) {
      const list = grouped.get(installment.receivableId) ?? [];
      list.push(installment);
      grouped.set(installment.receivableId, list);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => left.installmentNumber - right.installmentNumber);
    }

    return grouped;
  }, [installmentsState]);

  const filteredReceivables = useMemo(() => {
    if (!selectedMonth) {
      return receivablesState;
    }

    return receivablesState.filter((item) => getMonthKey(item.saleDate) === selectedMonth);
  }, [receivablesState, selectedMonth]);

  const filteredInstallmentsByReceiptMonth = useMemo(() => {
    return installmentsState
      .filter((installment) => {
        if (!selectedReceiptMonth) {
          return true;
        }

        return getMonthKey(installment.dueDate) === selectedReceiptMonth;
      })
      .sort((left, right) => {
        if (left.dueDate === right.dueDate) {
          return left.installmentNumber - right.installmentNumber;
        }

        return left.dueDate.localeCompare(right.dueDate);
      });
  }, [installmentsState, selectedReceiptMonth]);

  const receiptMonthSummary = useMemo(() => {
    const totalInstallments = filteredInstallmentsByReceiptMonth.length;
    const totalBrl = filteredInstallmentsByReceiptMonth.reduce(
      (sum, installment) => sum + installment.projectedAmountBrlBase,
      0
    );

    return {
      totalInstallments,
      totalBrl
    };
  }, [filteredInstallmentsByReceiptMonth]);

  function getStatusLabel(status: FlowInstallmentStatus) {
    if (status === "PAID") return "Recebido";
    if (status === "OVERDUE") return "Atraso";
    if (status === "PENDING") return "Receber";
    return status;
  }

  function nextFlowStatus(status: FlowInstallmentStatus): FlowInstallmentStatus {
    const currentIndex = flowStatusCycle.indexOf(status);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    return flowStatusCycle[(safeIndex + 1) % flowStatusCycle.length];
  }

  function handleCycleFlowStatus(installmentId: string, currentStatus: FlowInstallmentStatus) {
    const targetStatus = nextFlowStatus(currentStatus);

    startTransition(async () => {
      try {
        const updated = await updateInstallmentStatus(installmentId, targetStatus);
        setInstallmentsState((current) =>
          current.map((item) => (item.id === installmentId ? { ...item, status: updated.status } : item))
        );
      } catch {
        // Keep existing UI state on failed update.
      }
    });
  }

  const [editTarget, setEditTarget] = useState<Receivable | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openEdit(receivable: Receivable) {
    setEditTarget(receivable);
    setActionError(null);
  }

  function closeEdit() {
    setEditTarget(null);
    setActionError(null);
  }

  function handleUpdated(updated: Receivable) {
    setReceivablesState((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    setEditTarget(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteReceivable(id);
        setReceivablesState((current) => current.filter((item) => item.id !== id));
        setDeleteConfirmId(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao excluir");
        setDeleteConfirmId(null);
      }
    });
  }


  return (
    <div className="receivables-realized-table">
      {editTarget && (
        <ReceivableEditModal
          receivable={editTarget}
          installments={installmentsByReceivable.get(editTarget.id) ?? []}
          onClose={closeEdit}
          onUpdated={handleUpdated}
        />
      )}
      {actionError && !editTarget && <p className="form-error">{actionError}</p>}
      <div className="receivables-view-layout">
        <aside className="receivables-side-tabs" aria-label="Navegação de visão">
          <button
            type="button"
            className={`side-tab ${activeTab === "sales" ? "active" : ""}`}
            onClick={() => setActiveTab("sales")}
          >
            Vendas Realizadas
          </button>
          <button
            type="button"
            className={`side-tab ${activeTab === "receipts-flow" ? "active" : ""}`}
            onClick={() => setActiveTab("receipts-flow")}
          >
            Fluxo de Recebimentos
          </button>
        </aside>

        <div className="receivables-view-content">
          {activeTab === "sales" ? (
            <>
              <div className="receivables-realized-toolbar">
                <div className="field">
                  <label htmlFor="receivable-month-filter">Mês da venda</label>
                  <select
                    id="receivable-month-filter"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="subtle">
                  {filteredReceivables.length} venda(s) no período selecionado
                </span>
              </div>

              <div className="receivables-table-scroll">
              <table className="receivables-sales-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Código</th>
                    <th>Venda</th>
                    <th>Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivables.map((receivable) => {
                    const receivableInstallments = installmentsByReceivable.get(receivable.id) ?? [];

                    return (
                      <tr key={receivable.id}>
                        <td>
                          <strong>{receivable.customerName}</strong>
                          <span className="subtle inline-subtle">
                            {receivable.sellerName ?? "Sem vendedor"} · {receivable.installmentsCount} parcelas
                          </span>
                        </td>
                        <td>
                          <strong>{receivable.saleCode ?? "--"}</strong>
                          <span className="subtle inline-subtle">Venda #{receivable.saleNumber ?? "--"}</span>
                        </td>
                        <td>{formatDate(receivable.saleDate)}</td>
                        <td>
                          <div className="sale-total-hover">
                            <strong className="sale-total-value">{formatCurrency(receivable.totalAmount, receivable.currency)}</strong>
                            <div className="sale-total-tooltip">
                              <strong>Venda em {receivable.installmentsCount}x</strong>
                              <div className="subtle">Datas de recebimento das parcelas</div>
                              {receivableInstallments.length ? (
                                <div className="sale-installments-list">
                                  {receivableInstallments.map((installment) => {
                                    const status = installmentStatusMeta(installment);

                                    return (
                                      <div className="sale-installment-item" key={installment.id}>
                                        <span>
                                          {installment.installmentCode ?? `Parcela ${installment.installmentNumber}`} · {formatDate(installment.dueDate)} · {formatCurrency(installment.amountContract, installment.currencyContract)}
                                        </span>
                                        <strong className={status.className}>{status.label}</strong>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="subtle">Sem parcelas associadas.</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="btn secondary small"
                              type="button"
                              disabled={isPending}
                              onClick={() => openEdit(receivable)}
                            >
                              Editar
                            </button>
                            {deleteConfirmId === receivable.id ? (
                              <>
                                <button
                                  className="btn danger small"
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDelete(receivable.id)}
                                >
                                  Confirmar
                                </button>
                                <button
                                  className="btn secondary small"
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn danger small"
                                type="button"
                                disabled={isPending}
                                onClick={() => { setDeleteConfirmId(receivable.id); setActionError(null); }}
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <div className="receivables-receipt-month-panel">
              <div className="receivables-flow-toolbar">
                <div className="field">
                  <label htmlFor="receivable-receipt-month-filter">Mês de recebimento</label>
                  <select
                    id="receivable-receipt-month-filter"
                    value={selectedReceiptMonth}
                    onChange={(event) => setSelectedReceiptMonth(event.target.value)}
                  >
                    {receiptMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="subtle">
                  {receiptMonthSummary.totalInstallments} parcela(s) no mês selecionado
                </span>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor da parcela (BRL)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallmentsByReceiptMonth.length ? (
                    filteredInstallmentsByReceiptMonth.map((installment) => {
                      const currentStatus: FlowInstallmentStatus =
                        installment.status === "PAID"
                          ? "PAID"
                          : installment.status === "OVERDUE" || isOverdueInstallment(installment)
                            ? "OVERDUE"
                            : "PENDING";

                      return (
                        <tr key={installment.id}>
                          <td>{installment.customerName || "Cliente sem nome"}</td>
                          <td>{installment.installmentCode ?? `Parcela ${installment.installmentNumber}`}</td>
                          <td>{formatDate(installment.dueDate)}</td>
                          <td>{formatCurrency(installment.projectedAmountBrlBase, "BRL")}</td>
                          <td>
                            <button
                              className={`chip ${currentStatus === "PAID" ? "positive" : currentStatus === "OVERDUE" ? "danger" : "warning"}`}
                              type="button"
                              disabled={isPending || installment.status === "CANCELED"}
                              onClick={() => handleCycleFlowStatus(installment.id, currentStatus)}
                            >
                              {getStatusLabel(currentStatus)}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="subtle">Sem parcelas para o mês de recebimento selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="receivables-receipt-month-summary">
                <span>
                  Total de parcelas do mês: <strong>{receiptMonthSummary.totalInstallments}</strong>
                </span>
                <span>
                  Soma total em BRL: <strong>{formatCurrency(receiptMonthSummary.totalBrl, "BRL")}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
