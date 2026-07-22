# Registro de Decisões de Arquitetura (ADRs)

Formato curto: contexto → decisão → consequências. Toda decisão futura relevante ganha uma entrada aqui (padrão de trabalho acordado em projeto).

## ADR-001 — Chunk = artigo íntegro
**Contexto:** chunking por token fragmenta dispositivos legais em pontos arbitrários, destruindo o significado normativo (experiência prévia do PO). **Decisão:** a unidade de vetorização e citação é o artigo completo (caput + parágrafos + incisos + alíneas + itens), com a hierarquia (Livro→Subseção) como metadado. **Consequências:** citação sempre íntegra; artigos muito longos (máx. observado: 10.101 chars) podem diluir o sinal semântico — o padrão *small-to-big* fica reservado à Fase 3, se as métricas do golden set indicarem necessidade.

## ADR-002 — Parser supervisionado com portão humano
**Contexto:** publicações oficiais (especialmente CGIBS) saem em PDF sem estrutura, com variações imprevisíveis. **Decisão:** parser hierárquico com cinco defesas + auditoria estrutural usando o sumário como gabarito; publicação condicionada a auditoria limpa e aprovação explícita do curador. **Consequências:** qualidade garantida em produção; cada documento reprovado alimenta a evolução do parser (loop de melhoria contínua).

## ADR-003 — Grafo relacional antes de Neo4j
**Contexto:** o corpus tem >1.200 remissões (560 externas, 716 internas), extraídas automaticamente pelo parser. **Decisão:** arestas na tabela `remissoes` do Postgres; travessia de 1 salto via função SQL. **Consequências:** um banco só, zero custo extra; Neo4j apenas se travessias multi-salto complexas o justificarem (as arestas já normalizadas tornam a migração trivial).

## ADR-004 — Dimensionalidade padrão: 1024
**Contexto:** índices HNSW do pgvector limitam-se a ~2.000 dimensões; o esquema acadêmico usava 3.072 (não indexável). **Decisão:** todo embedding da plataforma tem 1024 dims — nativo do BGE-M3, e obtido no Gemini por truncamento Matryoshka + renormalização L2 (obrigatória, implementada nos adaptadores). **Consequências:** índice HNSW viável desde o dia 1; provedores intercambiáveis sem alterar o schema.

## ADR-005 — Provedores por configuração (zero hardcode)
**Contexto:** requisito explícito do PO de não ficar preso ao Gemini. **Decisão:** interfaces `EmbeddingProvider`/`LLMProvider` com adaptadores (gemini, openai_compat — que cobre OpenAI/Maritaca/Ollama —, bge_m3 local), selecionados pela tabela `config`; embeddings chaveados por `modelo_id`. **Consequências:** troca de fornecedor sem código; múltiplos modelos coexistem no banco durante migrações.

## ADR-006 — Supabase gerenciado com rota de saída
**Contexto:** custo mínimo, PO já domina o fluxo; LGPD pode exigir self-host no futuro. **Decisão:** Supabase free tier (Postgres + pgvector + Auth); todo o SQL é Postgres puro. **Consequências:** implantação em minutos; migração para Postgres self-hosted = restaurar dump + trocar 3 secrets.

## ADR-007 — Deploy MVP no Streamlit Community Cloud
**Contexto:** o PO publica via GitHub → Streamlit; o container gratuito não comporta o BGE-M3 (~2 GB). **Decisão:** app Streamlit multipágina (mesma arquitetura interna da SPEC, empacotamento compatível com o fluxo do PO); embeddings padrão = Gemini free tier @1024; BGE-M3 acompanha o código (requirements-selfhost.txt) para o cenário self-hosted. **Consequências:** custo R$ 0 ponta a ponta no MVP; a evolução para FastAPI+React (SPEC §1) preserva integralmente o `nucleo/` — só a casca de interface muda.
