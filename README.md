# BNC Fin System

Frontend inicial em Next.js para controle de fluxo financeiro, alinhado ao schema PostgreSQL e ao contrato OpenAPI presentes em `docs/`.

## O que já existe

- Dashboard de caixa realizado e projetado
- Páginas de contas, recebíveis, parcelas, pagáveis e relatórios
- Rotas internas em Next.js integradas ao Supabase

## Como rodar

1. Instale dependências:

```bash
npm install
```

2. Copie o ambiente:

```bash
copy .env.example .env.local
```

3. Suba o frontend:

```bash
npm run dev
```

## Integração com Supabase

- Configure `NEXT_PUBLIC_SUPABASE_URL`
- Configure `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Configure `SUPABASE_SERVICE_ROLE_KEY`
- Configure `SUPABASE_COMPANY_ID` se quiser fixar a empresa usada pelas consultas

## Estrutura

- `app/`: rotas e layout do App Router
- `components/`: blocos visuais reutilizáveis
- `lib/`: tipos, formatadores, cliente de API e helpers do Supabase
- `docs/`: schema, arquitetura backend e contrato da API