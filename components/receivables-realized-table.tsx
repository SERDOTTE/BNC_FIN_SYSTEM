"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { deleteReceivable, markReceivableAsReceived } from "../lib/api-client";
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
    return { label: "Paga", className: "tooltip-status-paid" };
  }

  if (isOverdueInstallment(installment)) {
    return { label: "Vencida", className: "tooltip-status-overdue" };
  }

  return { label: "A receber", className: "tooltip-status-pending" };
}

export function ReceivablesRealizedTable({ receivables, installments }: ReceivablesRealizedTableProps) {
  const [receivablesState, setReceivablesState] = useState<Receivable[]>(receivables);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setReceivablesState(receivables);
  }, [receivables]);

  const monthOptions = useMemo<MonthOption[]>(() => {
    const keys = Array.from(new Set(receivablesState.map((item) => getMonthKey(item.saleDate))));
    return keys
      .sort((left, right) => (left < right ? 1 : -1))
      .map((value) => ({ value, label: formatMonthLabel(value) }));
  }, [receivablesState]);

  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0]?.value ?? "");

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

  const installmentsByReceivable = useMemo(() => {
    const grouped = new Map<string, Installment[]>();

    for (const installment of installments) {
      const list = grouped.get(installment.receivableId) ?? [];
      list.push(installment);
      grouped.set(installment.receivableId, list);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => left.installmentNumber - right.installmentNumber);
    }

    return grouped;
  }, [installments]);

  const filteredReceivables = useMemo(() => {
    if (!selectedMonth) {
      return receivablesState;
    }

    return receivablesState.filter((item) => getMonthKey(item.saleDate) === selectedMonth);
  }, [receivablesState, selectedMonth]);

  function getStatusLabel(status: Receivable["status"]) {
    if (status === "PAID") {
      return "RECEBIDO";
    }

    return status;
  }

  function handleMarkAsReceived(receivableId: string) {
    startTransition(async () => {
      try {
        const updated = await markReceivableAsReceived(receivableId);
        setReceivablesState((current) =>
          current.map((item) => (item.id === receivableId ? { ...item, status: updated.status } : item))
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

      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Código</th>
            <th>Venda</th>
            <th>Total</th>
            <th>Status</th>
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
                  <div className="subtle">
                    {receivable.sellerName ?? "Sem vendedor"} · {receivable.installmentsCount} parcelas
                  </div>
                </td>
                <td>
                  <strong>{receivable.saleCode ?? "--"}</strong>
                  <div className="subtle">Venda #{receivable.saleNumber ?? "--"}</div>
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
                  {receivable.status === "OPEN" ? (
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={isPending}
                      onClick={() => handleMarkAsReceived(receivable.id)}
                    >
                      Receber
                    </button>
                  ) : (
                    <span className={`chip ${receivable.status === "PAID" ? "positive" : "warning"}`}>
                      {getStatusLabel(receivable.status)}
                    </span>
                  )}
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
  );
}
