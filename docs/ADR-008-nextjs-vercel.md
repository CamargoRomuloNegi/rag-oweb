## ADR-008 — Reescrita do front-end em Next.js, deploy na Vercel

**Contexto:** o MVP (ADR-007) empacotou a plataforma como app Streamlit para o
Streamlit Community Cloud. O produto evoluiu e a identidade visual/qualidade
gráfica precisava de um salto — algo que a superfície de customização do
Streamlit não comporta bem — e o destino de publicação passou a ser a Vercel.

**Decisão:** o `nucleo/` (parser hierárquico de 5 defesas, retrieval
determinístico+híbrido+grafo, geração com template versionado, verificação de
citação por hash, camada de provedores) foi portado 1:1 de Python para
TypeScript, preservando nomes, regras e comportamento — apenas a casca de
interface muda, exatamente como o próprio ADR-007 previa ("a evolução para
FastAPI+React preserva integralmente o `nucleo/`"). Auth e RBAC via Supabase
Auth + tabela `perfis` (inalterados); Postgres/pgvector/schema inalterados
(`sql/001_schema.sql` idêntico). O parser troca `pdfplumber` por `pdfjs-dist`
(extração de texto por página, agrupada em linhas por posição vertical); os
adaptadores Gemini e OpenAI-compatible passam a chamar as APIs REST
diretamente via `fetch` (evita SDKs pesados em função serverless); o adaptador
BGE-M3 local vira um stub explicativo, pois um modelo de ~2GB carregado em
memória não cabe no modelo de execução serverless da Vercel (mesma restrição
de recursos do ADR-007, agora em outra plataforma).

**Consequências:** ganho de liberdade visual total (Tailwind + componentes
próprios substituem os widgets fixos do Streamlit); build e deploy padrão da
Vercel (git push → build → deploy); a vetorização em lote passa a rodar dentro
do limite de duração de função da Vercel — documentado no README como ponto de
atenção para documentos muito grandes em planos com limite de execução baixo;
nenhuma regra de negócio, nenhuma tabela e nenhum princípio do PRD (P1–P5)
foi alterado nesta migração.
