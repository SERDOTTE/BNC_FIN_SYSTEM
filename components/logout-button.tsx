"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onLogout() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) {
          throw new Error("Falha ao sair da sessão.");
        }

        router.push("/login");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao sair da sessão.");
      }
    });
  }

  return (
    <div className="logout-area">
      <button className="btn secondary" type="button" disabled={isPending} onClick={onLogout}>
        {isPending ? "Saindo..." : "Logout"}
      </button>
      {error ? <span className="subtle">{error}</span> : null}
    </div>
  );
}
