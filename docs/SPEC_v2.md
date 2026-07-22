# SPEC v2 — Especificação Técnica da Plataforma RAG Normativa (IBS/CBS)

**Versão:** 2.0 · **Data:** 2026-07-03 · **Companion do:** PRD v2

---

## 1. Arquitetura geral

Monólito modular em Python com fronteiras internas explícitas (portas e adaptadores), preparado para extração futura de serviços sem reescrita.

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, SPA)                                    │
│  Aba Curadoria (admin/curador)   │   Aba Consulta (todos)        │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ REST/JSON (OpenAPI)          │
┌───────────────▼──────────────────────────────▼───────────────────┐
│  BACKEND FastAPI                                                 │
│  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ ingestao/  │ │ retrieval/│ │ geracao/ │ │ auth/ (RBAC)     │  │
│  │ parser v2  │ │ híbrido + │ │ prompt   │ │ Supabase Auth JWT│  │
│  │ auditoria  │ │ grafo     │ │ template │ └──────────────────┘  │
│  └────────────┘ └───────────┘ └──────────┘                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ providers/ — portas: EmbeddingProvider · LLMProvider       │  │
│  │ adaptadores: bge-m3 (local) · gemini · openai-compat*      │  │
│  │ (*cobre OpenAI, Anthropic via gateway, Ollama, Maritaca)   │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  POSTGRES (Supabase) — relacional + pgvector + tsvector          │
│  documentos · versoes · dispositivos · remissoes · anexos ·      │
│  embeddings · config · usuarios/papeis · auditoria · golden_set  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Modelo de dados (núcleo)

```sql
documentos           (id, tipo_norma, numero, orgao, titulo)
versoes_documento    (id, documento_id, sha256_pdf, url_fonte, data_publicacao,
                      vigencia_inicio, vigencia_fim, status: rascunho|publicado|substituido,
                      relatorio_auditoria JSONB, aprovado_por, aprovado_em)
dispositivos         (id, versao_id, numero_artigo, id_canonico,        -- ex.: RES6-2026-ART186
                      livro, titulo, capitulo, secao, subsecao,
                      texto TEXT, hash_sha256, paginas INT[],
                      fts tsvector GENERATED (config 'portuguese'))
remissoes            (id, origem_dispositivo_id, tipo: regulamenta|remete_interna|remete_externa,
                      alvo_dispositivo_id NULL,           -- resolvível quando o alvo está no corpus
                      alvo_textual TEXT)                  -- ex.: "Art. 105 da LC 214/2025"
anexos               (id, versao_id, rotulo, dispositivo_vinculado_id, conteudo_bruto,
                      conteudo_tabular JSONB NULL)        -- parser tabular: fase 2
embeddings           (dispositivo_id, modelo_id, vetor halfvec, PRIMARY KEY (dispositivo_id, modelo_id))
modelos_embedding    (id, provedor, nome_modelo, dimensoes, normalizado BOOL, ativo BOOL)
config               (chave, valor JSONB, atualizado_por, atualizado_em)   -- parâmetros sem hardcode
consultas_log        (id, usuario_id, pergunta, dispositivos_recuperados, resposta, criado_em)
```

Decisões embutidas: **dimensionalidade padrão 1024** (BGE-M3 nativo; indexável por HNSW — o limite de ~2.000 dims do pgvector deixa de existir como risco); coluna `halfvec` para economia de 50% de armazenamento; embeddings em tabela separada chaveada por `(dispositivo, modelo)` — coexistência de múltiplos modelos e re-vetorização sem destruir o índice anterior; `fts` gerado automaticamente pela configuração `portuguese` do Postgres.

## 3. Camada de provedores (P3 do PRD)

```python
class EmbeddingProvider(Protocol):
    id_modelo: str; dimensoes: int
    def embed_documentos(self, textos: list[str]) -> list[list[float]]: ...
    def embed_consulta(self, texto: str) -> list[float]: ...   # assimétrico quando suportado

class LLMProvider(Protocol):
    def gerar(self, prompt: str, contexto: str, historico: list[Msg]) -> str: ...
```

Seleção por configuração (`config` no banco + env para segredos): `EMBEDDING_PROVIDER=bge_m3`, `LLM_PROVIDER=gemini_flash`. Adaptadores do MVP: `bge_m3_local` (sentence-transformers, CPU, default), `gemini` (embedding e geração, free tier), `openai_compat` (base_url configurável — cobre OpenAI, Ollama/vLLM local, Maritaca/Sabiá e gateways Anthropic). Troca de modelo de embedding: registra novo `modelos_embedding`, job assíncrono re-vetoriza em lotes, flag `ativo` alterna atomicamente ao concluir.

Prompt de geração em template versionado (`prompts/` no repo, referenciado por nome+versão na `config`), nunca inline no código.

## 4. Pipeline de ingestão (área de Curadoria)

```
Upload PDF → sha256 → versao(rascunho) → Parser v2 → Auditoria estrutural
   → Relatório na UI (sequência, sumário×corpo, anexos, remissões, diffs vs. versão anterior)
   → Aprovação do curador → vetorização (provider ativo) → materialização de remissões
   → status=publicado (e anterior → substituido)
```

O Parser v2 é o já validado empiricamente contra a Resolução CGIBS nº 6/2026 (617/617 artigos, 231/231 headings do sumário conferidos, 2.426 linhas de anexos segregadas, zero divergências), com as cinco defesas: guarda de monotonicidade de artigos; junção de headings quebrados (corpo e sumário); corte e segregação de anexos; padrões case-sensitive onde a capitalização é significativa; validação estrutural contra o sumário como pré-condição de publicação. Perfis de parser por tipo documental (Resolução CGIBS, LC via LexML/XML na fase 2, Notas Técnicas) são módulos registrados, seguindo a arquitetura federada acordada.

## 5. Pipeline de consulta

```
Pergunta → [Roteador determinístico]: regex "art(igo)?\.? N (da LC 214)?"
              → match: fetch direto por id_canonico (precisão 1.0, sem vetor)
          → [Busca híbrida]: BM25/tsquery(portuguese) ∥ pgvector cosine (provider ativo)
              → fusão RRF → top-k (config, default 4)
          → [Enriquecimento por grafo]: para cada dispositivo, resolve remissoes
              internas (anexa dispositivos-alvo) e externas (anota referência)
          → [Geração]: LLMProvider ativo, template versionado, com histórico da sessão
          → [Verificação de citação]: dispositivos exibidos renderizados do banco por ID,
              hash conferido; resposta do LLM separada visualmente do texto legal
```

Threshold de similaridade calibrado empiricamente contra o golden set (o valor herdado de 0.3 é inerte e será substituído por corte medido); `top_k`, threshold, pesos da fusão RRF e limite de enriquecimento são chaves em `config`, editáveis pelo administrador na UI.

## 6. Avaliação e regressão

Tabela `golden_set` (pergunta, ids de dispositivos-resposta esperados, categoria). Métricas: recall@k e MRR do retrieval; precisão do roteador determinístico; verificação de hash nas citações. Executado em CI a cada mudança de parser, retrieval ou provedores — regressão bloqueia merge. Meta inicial: 50–100 perguntas curadas pelo especialista de domínio.

## 7. Infraestrutura e custo

| Componente | Escolha MVP | Custo |
|---|---|---|
| Banco + Auth | Supabase free tier (Postgres puro → migração self-host planejada, não improvisada) | R$ 0 |
| Backend + BGE-M3 | VPS pequeno (4 GB RAM) ou Oracle Cloud Always Free (ARM 24 GB) | R$ 0–50/mês |
| Frontend | Build estático (Vercel/Cloudflare Pages free) | R$ 0 |
| Embeddings | BGE-M3 local, CPU | R$ 0 marginal |
| Geração | Gemini Flash free tier (default) · Maritaca/OpenAI por config | ~R$ 0 no MVP |

## 8. Padrões de trabalho

Monorepo (`backend/`, `frontend/`, `docs/adr/`, `prompts/`, `golden_set/`); migrations Alembic (schema como código); `ruff` + `pytest` + golden set no CI (GitHub Actions); conventional commits; ADRs de uma página por decisão arquitetural (ADR-001 a 006 já decorrentes deste alinhamento: chunk=artigo com small-to-big adiado até medição, parser supervisionado com portão humano, grafo relacional antes de Neo4j, dimensionalidade 1024, provedores por configuração, Supabase com rota de saída); segredos exclusivamente em variáveis de ambiente; `secrets.toml`/`.env` no `.gitignore` desde o commit inicial.

## 9. Roadmap

**Fase 1 (MVP):** tudo da seção "Escopo" do PRD — estimativa de 4–6 semanas de construção incremental.
**Fase 2:** LC 214/2025 + LC 227/2026 via LexML (resolvendo `alvo_dispositivo_id` das 560 remissões externas — o grafo cross-documento se completa); parser tabular dos Anexos; re-ranker.
**Fase 3:** diff de vigência por dispositivo; visualização interativa do grafo; small-to-big retrieval se as métricas indicarem diluição semântica em artigos longos (p95 = 3.718 chars, máx = 10.101); API pública.

---

## Adendo (2026-07-03) — Empacotamento do MVP

Por decisão registrada no **ADR-007** (docs/DECISOES.md), o MVP é empacotado como aplicativo Streamlit multipágina para deploy no Streamlit Community Cloud, preservando integralmente a arquitetura interna desta SPEC (núcleo `nucleo/` com parser, ingestão, retrieval, geração, citação e camada de provedores). O provedor de embeddings padrão no deploy em nuvem é o Gemini free tier truncado para 1024 dimensões com renormalização L2; o adaptador BGE-M3 local acompanha o código para o cenário self-hosted. A evolução para FastAPI + React (§1) reutiliza o núcleo sem alterações.
