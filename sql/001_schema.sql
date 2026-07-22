-- ================================================================
-- PLATAFORMA RAG RTC — Schema completo do banco de dados
-- ================================================================
-- Execute este script UMA VEZ no SQL Editor do Supabase.
-- É seguro re-executar: usa IF NOT EXISTS / OR REPLACE.
--
-- Organização:
--   A. Extensões
--   B. Tabelas de corpus e versionamento
--   C. Tabelas de embeddings (multi-provedor)
--   D. Tabelas de operação (perfis, config, logs, golden set)
--   E. Índices de busca (HNSW vetorial + GIN léxico)
--   F. Visões e funções de busca (roteador e híbrida com RRF)
--   G. Sementes de configuração (padrões editáveis pela interface)
-- ================================================================

-- ─── A. EXTENSÕES ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;      -- tipo VECTOR e operadores de distância
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()

-- ─── B. CORPUS E VERSIONAMENTO ──────────────────────────────────

-- Um "documento" é a norma abstrata (ex.: Resolução CGIBS nº 6).
-- Suas publicações/alterações concretas vivem em versoes_documento.
CREATE TABLE IF NOT EXISTS documentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_norma  TEXT NOT NULL,                 -- 'Resolução CGIBS' | 'LC' | 'Nota Técnica' ...
  numero      TEXT NOT NULL,                 -- '6/2026', '214/2025' ...
  orgao       TEXT NOT NULL DEFAULT 'CGIBS',
  titulo      TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_norma, numero)
);

-- Cada versão corresponde a um PDF/arquivo ingerido.
-- O ciclo de vida implementa o "portão humano" (princípio P2 do PRD):
--   rascunho  → aguardando aprovação do curador
--   publicado → visível na área de Consulta
--   substituido → versão anterior, preservada para consulta histórica
CREATE TABLE IF NOT EXISTS versoes_documento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id        UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  sha256_arquivo      TEXT NOT NULL,          -- impede ingestão duplicada do mesmo PDF
  nome_arquivo        TEXT,
  url_fonte           TEXT,
  data_publicacao     DATE,
  vigencia_inicio     DATE,
  vigencia_fim        DATE,                   -- NULL = vigente
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','publicado','substituido','rejeitado')),
  relatorio_auditoria JSONB,                  -- resultado do parser (defesa 5: sumário como gabarito)
  aprovado_por        TEXT,                   -- e-mail do curador que aprovou
  aprovado_em         TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento_id, sha256_arquivo)
);

-- O "dispositivo" é a unidade mínima de citação: um artigo completo
-- (caput + parágrafos + incisos + alíneas + itens), conforme decisão
-- de arquitetura ADR-001 (chunk = artigo íntegro).
CREATE TABLE IF NOT EXISTS dispositivos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id      UUID NOT NULL REFERENCES versoes_documento(id) ON DELETE CASCADE,
  id_canonico    TEXT NOT NULL,               -- ex.: 'RES6-2026-ART186' (estável entre versões)
  numero_artigo  INT  NOT NULL,
  livro          TEXT NOT NULL DEFAULT '',
  titulo         TEXT NOT NULL DEFAULT '',
  capitulo       TEXT NOT NULL DEFAULT '',
  secao          TEXT NOT NULL DEFAULT '',
  subsecao       TEXT NOT NULL DEFAULT '',
  texto          TEXT NOT NULL,               -- texto integral e literal do artigo
  hash_sha256    TEXT NOT NULL,               -- integridade de citação (princípio P1)
  paginas        INT[] NOT NULL DEFAULT '{}',
  -- Coluna gerada para busca léxica em português (BM25-like via ts_rank):
  fts            tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', texto)) STORED,
  UNIQUE (versao_id, id_canonico)
);

-- Remissões = arestas do grafo normativo (ADR-003: grafo relacional).
--   'remete_externa' → alvo fora do corpus atual (ex.: LC 214/2025);
--                      alvo_dispositivo_id fica NULL até a norma ser
--                      ingerida (Fase 2), quando será "resolvida".
--   'remete_interna' → alvo é outro artigo do MESMO documento.
CREATE TABLE IF NOT EXISTS remissoes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_dispositivo_id  UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('remete_interna','remete_externa')),
  alvo_dispositivo_id    UUID REFERENCES dispositivos(id) ON DELETE SET NULL,
  alvo_textual           TEXT NOT NULL        -- ex.: 'Art. 105 da LC 214/2025' ou 'Art. 27'
);

-- Anexos segregados pelo parser (defesa 3). O conteúdo tabular
-- estruturado (JSONB) é preenchido pelo parser tabular na Fase 2.
CREATE TABLE IF NOT EXISTS anexos (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id                 UUID NOT NULL REFERENCES versoes_documento(id) ON DELETE CASCADE,
  rotulo                    TEXT NOT NULL,     -- ex.: 'ANEXO I - TAXAS ANUAIS DE DEPRECIAÇÃO...'
  conteudo_bruto            TEXT NOT NULL,
  conteudo_tabular          JSONB
);

-- ─── C. EMBEDDINGS MULTI-PROVEDOR (princípio P3) ────────────────

-- Registro dos modelos de embedding conhecidos pela plataforma.
-- A troca de provedor registra um novo modelo, re-vetoriza e alterna
-- o campo 'ativo' — sem destruir os vetores do modelo anterior.
CREATE TABLE IF NOT EXISTS modelos_embedding (
  id          TEXT PRIMARY KEY,               -- ex.: 'gemini-embedding-2@1024'
  provedor    TEXT NOT NULL,                  -- 'gemini' | 'bge_m3' | 'openai_compat'
  nome_modelo TEXT NOT NULL,
  dimensoes   INT  NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vetores por (dispositivo, modelo). Dimensionalidade padronizada em
-- 1024 (ADR-004): indexável por HNSW e compatível com BGE-M3 nativo
-- e com Gemini truncado + renormalizado.
CREATE TABLE IF NOT EXISTS embeddings (
  dispositivo_id UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  modelo_id      TEXT NOT NULL REFERENCES modelos_embedding(id) ON DELETE CASCADE,
  vetor          VECTOR(1024) NOT NULL,
  PRIMARY KEY (dispositivo_id, modelo_id)
);

-- ─── D. OPERAÇÃO ────────────────────────────────────────────────

-- Papéis de acesso (RBAC). O usuário é criado no Supabase Auth
-- (Authentication → Users) e recebe papel nesta tabela.
CREATE TABLE IF NOT EXISTS perfis (
  user_id  UUID PRIMARY KEY,                  -- id do usuário no Supabase Auth
  email    TEXT NOT NULL UNIQUE,
  papel    TEXT NOT NULL CHECK (papel IN ('admin','curador','consultor')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parâmetros da plataforma, editáveis pela interface do administrador.
-- Nada de valores operacionais hard-coded no aplicativo (requisito do PO).
CREATE TABLE IF NOT EXISTS config (
  chave          TEXT PRIMARY KEY,
  valor          JSONB NOT NULL,
  descricao      TEXT,
  atualizado_por TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trilha de auditoria das consultas (rastreabilidade e melhoria contínua).
CREATE TABLE IF NOT EXISTS consultas_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email             TEXT,
  pergunta                  TEXT NOT NULL,
  rota                      TEXT NOT NULL,    -- 'deterministica' | 'hibrida'
  dispositivos_recuperados  TEXT[],           -- ids canônicos
  resposta                  TEXT,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Golden set: o "juiz" permanente da qualidade do retrieval.
-- Curado pelo especialista de domínio; usado como teste de regressão.
CREATE TABLE IF NOT EXISTS golden_set (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta            TEXT NOT NULL,
  ids_esperados       TEXT[] NOT NULL,        -- ids canônicos que respondem a pergunta
  categoria           TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── E. ÍNDICES DE BUSCA ────────────────────────────────────────

-- Vetorial: HNSW com distância de cosseno (viável porque dims=1024 ≤ 2000).
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON embeddings USING hnsw (vetor vector_cosine_ops);

-- Léxica: GIN sobre o tsvector em português.
CREATE INDEX IF NOT EXISTS idx_dispositivos_fts
  ON dispositivos USING gin (fts);

CREATE INDEX IF NOT EXISTS idx_dispositivos_numero
  ON dispositivos (numero_artigo);

CREATE INDEX IF NOT EXISTS idx_remissoes_origem
  ON remissoes (origem_dispositivo_id);

-- ─── F. VISÕES E FUNÇÕES DE BUSCA ───────────────────────────────

-- Visão dos dispositivos pertencentes a versões PUBLICADAS.
-- Toda a área de Consulta enxerga o corpus exclusivamente por aqui
-- (princípio P5: consultas pinadas a versões publicadas).
CREATE OR REPLACE VIEW dispositivos_publicados AS
SELECT d.*, v.documento_id, v.data_publicacao, doc.tipo_norma, doc.numero AS numero_documento
FROM dispositivos d
JOIN versoes_documento v ON v.id = d.versao_id AND v.status = 'publicado'
JOIN documentos doc      ON doc.id = v.documento_id;

-- ROTEADOR DETERMINÍSTICO: busca direta por número de artigo.
-- Usada quando a pergunta contém padrão "art. N" — precisão 1.0, sem vetor.
CREATE OR REPLACE FUNCTION buscar_por_artigo(p_numero INT)
RETURNS SETOF dispositivos_publicados
LANGUAGE sql STABLE AS $$
  SELECT * FROM dispositivos_publicados WHERE numero_artigo = p_numero;
$$;

-- BUSCA HÍBRIDA com fusão RRF (Reciprocal Rank Fusion).
-- Combina o ranking léxico (websearch_to_tsquery em português — captura
-- termos técnicos exatos como "split payment") com o ranking vetorial
-- (similaridade de cosseno — captura a semântica da pergunta).
-- Score RRF = Σ 1/(rrf_k + posição_no_ranking). Robusta e sem necessidade
-- de normalizar escalas heterogêneas de score.
CREATE OR REPLACE FUNCTION busca_hibrida (
  p_texto      TEXT,
  p_embedding  VECTOR(1024),
  p_modelo_id  TEXT,
  p_qtd        INT DEFAULT 4,
  p_rrf_k      INT DEFAULT 60,
  p_candidatos INT DEFAULT 20      -- profundidade de cada ranking antes da fusão
)
RETURNS TABLE (
  dispositivo_id UUID,
  id_canonico    TEXT,
  numero_artigo  INT,
  livro TEXT, titulo TEXT, capitulo TEXT, secao TEXT, subsecao TEXT,
  texto TEXT, hash_sha256 TEXT,
  score_rrf      FLOAT,
  similaridade   FLOAT
)
LANGUAGE sql STABLE AS $$
  WITH lexica AS (
    SELECT d.id,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(d.fts, websearch_to_tsquery('portuguese', p_texto)) DESC
           ) AS posicao
    FROM dispositivos_publicados d
    WHERE d.fts @@ websearch_to_tsquery('portuguese', p_texto)
    LIMIT p_candidatos
  ),
  vetorial AS (
    SELECT d.id,
           ROW_NUMBER() OVER (ORDER BY e.vetor <=> p_embedding) AS posicao,
           1 - (e.vetor <=> p_embedding) AS sim
    FROM dispositivos_publicados d
    JOIN embeddings e ON e.dispositivo_id = d.id AND e.modelo_id = p_modelo_id
    ORDER BY e.vetor <=> p_embedding
    LIMIT p_candidatos
  ),
  fusao AS (
    SELECT COALESCE(l.id, v.id) AS id,
           COALESCE(1.0/(p_rrf_k + l.posicao), 0) +
           COALESCE(1.0/(p_rrf_k + v.posicao), 0)  AS score,
           COALESCE(v.sim, 0)                       AS sim
    FROM lexica l
    FULL OUTER JOIN vetorial v ON v.id = l.id
  )
  SELECT d.id, d.id_canonico, d.numero_artigo,
         d.livro, d.titulo, d.capitulo, d.secao, d.subsecao,
         d.texto, d.hash_sha256,
         f.score, f.sim
  FROM fusao f
  JOIN dispositivos_publicados d ON d.id = f.id
  ORDER BY f.score DESC
  LIMIT p_qtd;
$$;

-- ENRIQUECIMENTO POR GRAFO: dado um conjunto de dispositivos recuperados,
-- retorna os dispositivos internos que eles referenciam (1 salto).
CREATE OR REPLACE FUNCTION dispositivos_referenciados (p_ids UUID[])
RETURNS TABLE (
  origem_id_canonico TEXT,
  id_canonico TEXT, numero_artigo INT, texto TEXT, hash_sha256 TEXT
)
LANGUAGE sql STABLE AS $$
  SELECT o.id_canonico, d.id_canonico, d.numero_artigo, d.texto, d.hash_sha256
  FROM remissoes r
  JOIN dispositivos_publicados o ON o.id = r.origem_dispositivo_id
  JOIN dispositivos_publicados d ON d.id = r.alvo_dispositivo_id
  WHERE r.origem_dispositivo_id = ANY(p_ids)
    AND r.tipo = 'remete_interna'
    AND r.alvo_dispositivo_id IS NOT NULL;
$$;

-- ─── G. SEMENTES DE CONFIGURAÇÃO ────────────────────────────────
-- Valores padrão; todos editáveis na aba Curadoria → Configurações.
INSERT INTO config (chave, valor, descricao) VALUES
  ('provedor_embedding', '"gemini"',
   'Provedor de embeddings: gemini | bge_m3 | openai_compat'),
  ('provedor_llm', '"gemini"',
   'Provedor de geração: gemini | openai_compat'),
  ('modelo_llm', '"gemini-2.5-flash"',
   'Nome do modelo de geração no provedor ativo'),
  ('top_k', '4',
   'Quantidade de dispositivos recuperados na busca híbrida'),
  ('rrf_k', '60',
   'Constante da fusão RRF (valores maiores suavizam diferenças de posição)'),
  ('candidatos_por_ranking', '20',
   'Profundidade de cada ranking (léxico e vetorial) antes da fusão'),
  ('limite_enriquecimento', '3',
   'Máximo de dispositivos referenciados anexados por enriquecimento de grafo'),
  ('prompt_consulta', '"consulta_v1"',
   'Template de prompt ativo (arquivo em prompts/)'),
  ('historico_maximo', '6',
   'Mensagens anteriores da sessão enviadas ao LLM para contexto conversacional'),
  ('tamanho_lote_vetorizacao', '20',
   'Dispositivos por chamada à API de embeddings durante a ingestão'),
  ('pausa_lote_segundos', '2',
   'Pausa entre lotes de vetorização (respeita rate limit do free tier)')
ON CONFLICT (chave) DO NOTHING;

-- Modelo de embedding padrão (Gemini truncado para 1024 + renormalizado
-- no adaptador Python). O BGE-M3 é registrado desativado, pronto para
-- o cenário self-hosted.
INSERT INTO modelos_embedding (id, provedor, nome_modelo, dimensoes, ativo) VALUES
  ('gemini-embedding-2@1024', 'gemini', 'gemini-embedding-2', 1024, true),
  ('bge-m3@1024',             'bge_m3', 'BAAI/bge-m3',        1024, false)
ON CONFLICT (id) DO NOTHING;

-- VERIFICAÇÃO FINAL: deve listar as tabelas criadas.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
