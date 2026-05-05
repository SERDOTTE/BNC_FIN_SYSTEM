import type { Metadata } from "next";

import "./globals.css";

import { AppChrome } from "@/components/app-chrome";

export const metadata: Metadata = {
  title: "BNC Fin System",
  description: "Controle de fluxo financeiro do caixa: realizado, projeções, recebíveis, pagáveis e exposição cambial."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}