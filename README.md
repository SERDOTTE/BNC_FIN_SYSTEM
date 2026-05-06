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
- Configure `APP_AUTH_SECRET` para assinar o cookie de sessão em produção
- Configure `SUPABASE_COMPANY_ID` se quiser fixar a empresa usada pelas consultas

## Deploy na Vercel

- Cadastre na Vercel as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `APP_AUTH_SECRET`
- Se `NEXT_PUBLIC_SUPABASE_ANON_KEY` não estiver definida, o backend tentará usar `SUPABASE_SERVICE_ROLE_KEY` para validar o login
- Quando faltar configuração do Supabase no deploy, a rota de login responderá erro `503` em vez de `Credenciais inválidas`

## Estrutura

- `app/`: rotas e layout do App Router
- `components/`: blocos visuais reutilizáveis
- `lib/`: tipos, formatadores, cliente de API e helpers do Supabase
- `docs/`: schema, arquitetura backend e contrato da API