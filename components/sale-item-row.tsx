"use client";

import { useEffect, useState } from "react";

import { fetchPasseioFornecedorPreco } from "@/lib/api-client";
import type { Currency, LookupOption, PasseioOption, SaleItem } from "@/lib/types";

type Props = {
  index: number;
  passeios: PasseioOption[];
  fornecedores: LookupOption[];
  currency: Currency;
  value: SaleItem;
  onChange: (index: number, value: SaleItem) => void;
  onRemove: (index: number) => void;
  onAddFornecedor: () => void;
  onFornecedorFocus: (index: number) => void;
  showAddFornecedorButton: boolean;
  showRemove: boolean;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.8)",
  width: "100%",
  font: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--muted)",
  display: "block",
  marginBottom: 4,
};

function calcTotal(adultos: number, criancas: number, custoA: number, custoC: number) {
  return Math.round((adultos * custoA + criancas * custoC) * 100) / 100;
}

export function SaleItemRow({
  index,
  passeios,
  fornecedores,
  currency,
  value,
  onChange,
  onRemove,
  onFornecedorFocus,
  onAddFornecedor,
  showAddFornecedorButton,
  showRemove,
}: Props) {
  const [loadingPreco, setLoadingPreco] = useState(false);

  // Busca preços quando passeio + fornecedor estão selecionados
  useEffect(() => {
    if (!value.passeioId || !value.fornecedorId) return;

    let active = true;
    setLoadingPreco(true);

    fetchPasseioFornecedorPreco(value.passeioId, value.fornecedorId).then((preco) => {
      if (!active) return;
      const next: SaleItem = {
        ...value,
        custoUnitarioAdulto: preco.custoAdulto,
        custoUnitarioCrianca: preco.custoCrianca,
        totalItem: calcTotal(value.adultos, value.criancas, preco.custoAdulto, preco.custoCrianca),
      };
      onChange(index, next);
      setLoadingPreco(false);
    });

    return () => { active = false; };
    // só re-busca quando passeio ou fornecedor mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.passeioId, value.fornecedorId]);

  function update(patch: Partial<SaleItem>) {
    const next = { ...value, ...patch };
    next.totalItem = calcTotal(
      next.adultos,
      next.criancas,
      next.custoUnitarioAdulto,
      next.custoUnitarioCrianca
    );
    onChange(index, next);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 72px 72px 130px 130px auto",
        gap: 8,
        alignItems: "end",
        marginBottom: 10,
      }}
    >
      {/* Passeio */}
      <div>
        {index === 0 && <label style={labelStyle}>Passeio</label>}
        <select
          style={inputStyle}
          value={value.passeioId}
          onChange={(e) => {
            const p = passeios.find((x) => x.id === e.target.value);
            update({ passeioId: e.target.value, passeioNome: p?.name ?? "" });
          }}
        >
          <option value="">{passeios.length ? "Selecione..." : "Carregando..."}</option>
          {passeios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Fornecedor */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, minHeight: 20 }}>
          {index === 0 ? <label style={{ ...labelStyle, marginBottom: 0 }}>Fornecedor</label> : <span />}
          {showAddFornecedorButton ? (
            <button
              type="button"
              className="btn secondary"
              style={{ padding: "3px 8px", fontSize: "0.78rem", whiteSpace: "nowrap" }}
              onClick={onAddFornecedor}
            >
              Adicionar fornecedor
            </button>
          ) : (
            <span />
          )}
        </div>
        <select
          style={inputStyle}
          value={value.fornecedorId}
          onFocus={() => onFornecedorFocus(index)}
          onChange={(e) => {
            const f = fornecedores.find((x) => x.id === e.target.value);
            update({ fornecedorId: e.target.value, fornecedorNome: f?.name ?? "" });
          }}
        >
          <option value="">{fornecedores.length ? "Selecione..." : "Carregando..."}</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Adultos */}
      <div>
        {index === 0 && <label style={labelStyle}>Adultos</label>}
        <input
          style={inputStyle}
          type="number"
          min="0"
          value={value.adultos}
          onChange={(e) => update({ adultos: Math.max(0, Number(e.target.value)) })}
        />
      </div>

      {/* Crianças */}
      <div>
        {index === 0 && <label style={labelStyle}>Crianças</label>}
        <input
          style={inputStyle}
          type="number"
          min="0"
          value={value.criancas}
          onChange={(e) => update({ criancas: Math.max(0, Number(e.target.value)) })}
        />
      </div>

      {/* Custo Adulto */}
      <div>
        {index === 0 && <label style={labelStyle}>Custo adulto</label>}
        <input
          style={inputStyle}
          type="number"
          min="0"
          step="0.01"
          value={loadingPreco ? "" : value.custoUnitarioAdulto}
          placeholder={loadingPreco ? "..." : "0.00"}
          onChange={(e) => update({ custoUnitarioAdulto: Number(e.target.value) })}
        />
      </div>

      {/* Custo Criança */}
      <div>
        {index === 0 && <label style={labelStyle}>Custo criança</label>}
        <input
          style={inputStyle}
          type="number"
          min="0"
          step="0.01"
          value={loadingPreco ? "" : value.custoUnitarioCrianca}
          placeholder={loadingPreco ? "..." : "0.00"}
          onChange={(e) => update({ custoUnitarioCrianca: Number(e.target.value) })}
        />
      </div>

      {/* Total + botão remover */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        {index === 0 && <label style={labelStyle}>Total</label>}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.95rem" }}>
            {currency} {value.totalItem.toFixed(2)}
          </span>
          {showRemove && (
            <button
              type="button"
              className="btn secondary"
              style={{ padding: "4px 8px", lineHeight: 1 }}
              onClick={() => onRemove(index)}
              title="Remover item"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
