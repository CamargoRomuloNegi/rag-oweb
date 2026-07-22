# ⚖️ Plataforma RAG RTC — IBS/CBS (Next.js · Vercel)

Reescrita da plataforma como aplicativo web (Next.js 14, App Router, TypeScript,
Tailwind) para deploy na **Vercel**, preservando integralmente a arquitetura e as
regras de negócio do MVP original em Streamlit — parser hierárquico com cinco
defesas, roteador determinístico + busca híbrida (RRF) + enriquecimento por
grafo, integridade de citação por hash SHA-256, portão humano de aprovação e
independência de provedor de IA. Veja `docs/DECISOES.md` (ADR-001 a 007) e
`docs/ADR-008-nextjs-vercel.md` para o que mudou e por quê.

Duas áreas, iguais ao MVP:
- **🔎 Consulta** (todos os papéis): chat consultivo com citação verificada.
- **🗂️ Curadoria** (admin/curador): ingestão de PDF, auditoria estrutural,
  publicação, versões e configurações — sem valores hard-coded.

---

## 🚀 Implantação passo a passo

### Passo 1 — Banco de dados (Supabase)

Igual ao MVP original:
1. Crie um projeto em [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor → New query**, cole `sql/001_schema.sql` inteiro e execute.
3. Confira que a última consulta lista as tabelas (`documentos`, `dispositivos`,
   `remissoes`, `embeddings`, `perfis`, `config` etc.).

### Passo 2 — Primeiro usuário e papel

1. **Authentication → Users → Add user** (marque *Auto Confirm User*).
2. Copie o UUID do usuário criado.
3. No **SQL Editor**:
   ```sql
   INSERT INTO perfis (user_id, email, papel)
   VALUES ('UUID-COPIADO-AQUI', 'seu@email.com', 'admin');
   ```
   Papéis: `admin` (tudo), `curador` (ingestão e versões), `consultor` (só Consulta).

### Passo 3 — Chave do Gemini

[aistudio.google.com](https://aistudio.google.com) → **Get API key**.

### Passo 4 — Repositório no GitHub

1. Crie um repositório novo (ex.: `rag-rtc-web`).
2. Suba **todo o conteúdo desta pasta** (o `.gitignore` já protege `.env*`).

### Passo 5 — Import na Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   selecione o repositório.
2. Framework preset: **Next.js** (detectado automaticamente). Root directory:
   a raiz do repo (onde está este `package.json`).
3. Em **Environment Variables**, adicione (ver `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase →
     Settings → API (chave `anon public`).
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — mesma tela, chave `service_role`
     (nunca marque como pública — some as *Sensitive* na Vercel).
   - `GEMINI_API_KEY` — do Passo 3.
4. **Deploy**. A Vercel builda e publica em um domínio `*.vercel.app`.

### Passo 6 — Primeira ingestão

1. Entre com o usuário do Passo 2 na URL publicada.
2. **Curadoria → Ingestão**: envie o PDF, preencha número, sigla e data, clique
   **Analisar**, revise o relatório de auditoria e **Aprovar e publicar**.
3. **Consulta** já responde. Teste: *"O que diz o art. 186?"* e *"Como funciona
   o split payment?"*.

---

## 🧱 Arquitetura em uma tela

```
src/
├── middleware.ts                 Sessão Supabase + guarda de rotas por papel
├── app/
│   ├── login/                    Formulário de autenticação
│   ├── (app)/                    Shell autenticado (sidebar + navegação)
│   │   ├── consulta/             Chat RAG · citação verificada por hash
│   │   └── curadoria/            Ingestão · Versões · Configurações (abas)
│   └── api/                      Route Handlers: ponte HTTP ↔ nucleo/
│       ├── consulta/  ingestao/analisar/  ingestao/publicar/  versoes/  config/
├── components/                   Sidebar, ícones, cartões de métrica
└── lib/
    ├── supabase/                 Clientes browser · server (service role) · Server Component
    └── nucleo/                   Núcleo de negócio — porta 1:1 do nucleo/ Python
        ├── parser/resolucaoCgibs.ts   5 defesas + auditoria estrutural
        ├── retrieval.ts               Roteador → híbrida (RRF) → grafo
        ├── geracao.ts                 Template versionado (prompts/) + histórico
        ├── citacao.ts                 Verificação SHA-256 na exibição
        ├── provedores/                Gemini · OpenAI-compatible · BGE-M3 (stub)
        ├── ingestao.ts                Pipeline preparar()/publicar()
        └── config.ts                 Parâmetros na tabela config (zero hardcode)
```

**Independência de provedor**, como no MVP: troque `provedor_embedding` /
`provedor_llm` / `modelo_llm` em Curadoria → Configurações. `openai_compat`
cobre OpenAI, Maritaca (Sabiá), Ollama etc. — preencha
`OPENAI_COMPAT_BASE_URL`/`OPENAI_COMPAT_API_KEY` na Vercel. O adaptador BGE-M3
local permanece apenas como stub explicativo: exige um runtime com o modelo
carregado, incompatível com funções serverless (ver ADR-008).

## ⚠️ Diferenças de plataforma (leia antes de publicar documentos grandes)

- **Duração de função**: a vetorização respeita `pausa_lote_segundos` da
  config (rate limit do free tier do Gemini) e pode ultrapassar o limite de
  execução do plano Hobby da Vercel (10s) em documentos com centenas de
  artigos. A rota de publicação já pede `maxDuration = 300`, disponível nos
  planos Pro/Enterprise. No plano Hobby, reduza `pausa_lote_segundos` e/ou
  aumente `tamanho_lote_vetorizacao` em Configurações antes de ingerir
  documentos grandes.
- **Barra de progresso**: implementada via streaming HTTP (o navegador lê o
  progresso em tempo real durante a publicação) — mesma experiência do
  `st.progress` original.

## 📚 Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/PRD_v2.md` | Visão de produto, princípios, escopo |
| `docs/SPEC_v2.md` | Especificação técnica completa (arquitetura original) |
| `docs/DECISOES.md` | ADRs 001–007 do MVP Streamlit |
| `docs/ADR-008-nextjs-vercel.md` | Decisão de portar para Next.js/Vercel |
| `docs/GUIA_OPERACAO.md` | Operação do dia a dia (usuários, ingestão, golden set) |

## ⚠️ Aviso

As respostas da plataforma fundamentam-se exclusivamente nas normas publicadas
no corpus e **não substituem parecer profissional** de advogado ou contador.
