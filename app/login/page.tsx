"use client";

import { FormEvent, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(String(body.error ?? "Credenciais inválidas."));
        }

        const nextPath = searchParams.get("next") || "/";
        window.location.assign(nextPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao autenticar.");
      }
    });
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <h1>Acesso ao sistema</h1>
        <p className="subtle">Informe email e senha para entrar no BNC Fin System.</p>

        <form className="form-grid" onSubmit={onSubmit}>
          <div className="field full">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="field full">
            <label htmlFor="login-password">Senha</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {error ? <p className="subtle" style={{ color: "#c0392b" }}>{error}</p> : null}

          <div className="cta-row">
            <button className="btn primary" type="submit" disabled={isPending}>
              {isPending ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
