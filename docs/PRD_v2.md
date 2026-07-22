# PRD v2 — Plataforma RAG Normativa: Reforma Tributária do Consumo (IBS/CBS)

**Versão:** 2.0 · **Data:** 2026-07-03 · **Status:** Rascunho para aprovação
**Autores:** Rômulo Negi Camargo (product owner e especialista de domínio) · Claude (arquitetura e engenharia)
**Substitui:** PRD v1 (projeto acadêmico em três artefatos — Notebooks 1/2 + Streamlit)

---

## 1. Visão

Uma plataforma web unificada de consulta jurídico-tributária sobre o corpus normativo da Reforma Tributária do Consumo, construída sobre RAG com integridade de citação verificada. A plataforma substitui os três artefatos do projeto acadêmico por um único produto com duas áreas: **Curadoria** (ingestão, auditoria e versionamento do corpus, acesso restrito) e **Consulta** (chat RAG multiusuário com citação literal e navegação pelo grafo normativo).

O diferencial não é "um chatbot que leu a lei": é a garantia de que todo dispositivo citado é exibido íntegro, verbatim, direto do banco (verificado por hash), com seu endereço hierárquico completo e suas remissões navegáveis — enquanto o LLM se limita a interpretar e contextualizar.

## 2. O problema

A Resolução CGIBS nº 6/2026 tem 617 artigos em 252 páginas de PDF, com hierarquia de oito níveis (Livro → Título → Capítulo → Seção → Subseção → Artigo → Parágrafo/Inciso → Alínea/Item), cinco anexos tabulares e mais de 1.200 remissões cruzadas (560 externas à LC 214/2025, LC 227/2026 e CF; 716 internas). O corpus crescerá continuamente durante a transição 2026–2033, com normas que alteram normas. Busca por palavra-chave perde a amarração jurídica; LLMs sem grounding alucinam dispositivos; e ferramentas genéricas de RAG fragmentam artigos em pontos arbitrários, destruindo o significado normativo.

Profissionais (contadores, advogados, consultores, desenvolvedores de ERP fiscal) precisam de respostas rastreáveis até o dispositivo exato, na versão vigente na data relevante.

## 3. Princípios de produto (inegociáveis)

**P1 — Integridade de citação.** O texto legal exibido nunca é gerado pelo LLM: é renderizado do banco por ID de dispositivo, com verificação de hash. O LLM interpreta; a fonte é literal.

**P2 — Humano no portão de publicação.** Nenhum documento entra no índice de consulta sem que o relatório de auditoria estrutural (sequência de artigos, conferência contra o sumário, segregação de anexos) seja aprovado por um curador.

**P3 — Independência de provedor.** Nenhum modelo de embedding ou LLM é hard-coded. Provedores são adaptadores selecionados por configuração; embeddings carregam a identidade do modelo que os gerou; a troca de provedor dispara re-vetorização assíncrona, sem parada.

**P4 — Custo mínimo por padrão.** A configuração default opera a custo marginal zero em embeddings (modelo local BGE-M3, CPU) e free tier na geração, escalando para provedores pagos apenas por decisão explícita de configuração.

**P5 — Versionamento e multivigência.** Toda consulta é respondida contra versões publicadas do corpus; versões substituídas permanecem consultáveis para reprodução histórica ("qual a redação vigente em 2027?").

## 4. Perfis e permissões

| Papel | Área | Capacidades |
|---|---|---|
| Administrador | Curadoria + Consulta | Gestão de usuários, configuração de provedores e parâmetros, tudo do curador |
| Curador | Curadoria + Consulta | Upload de documentos, execução do parser, revisão da auditoria, aprovação/rejeição de publicação, gestão de versões |
| Consultor | Consulta | Chat RAG, navegação pelo grafo, exportação de evidências com referências |

Poucos usuários nos dois primeiros papéis; multiusuário irrestrito (dentro da organização) no terceiro — conforme requisito do product owner.

## 5. Casos de uso principais

Consulta semântica em linguagem natural com resposta fundamentada e dispositivos íntegros anexados; consulta determinística por endereço ("o que diz o art. 156?") roteada direto ao dispositivo, sem passar pelo vetor; consulta reversa pelo grafo ("quais artigos da Resolução 6 regulamentam o art. 156 da LC 214/2025?"); enriquecimento automático de contexto (dispositivo recuperado traz consigo os que ele referencia); ingestão de nova norma com auditoria e diff estrutural contra a versão anterior; consulta histórica pinada em data de vigência.

## 6. Escopo do MVP (Fase 1) e o que fica fora

**Dentro:** as duas áreas funcionais; corpus inicial = Resolução CGIBS nº 6/2026 (já parseada e auditada com 100% de conferência estrutural); parser hierárquico endurecido com as cinco defesas validadas; busca híbrida (léxica pt-BR + vetorial) com roteador determinístico de artigos; grafo de remissões em tabela relacional com enriquecimento de retrieval; citação verificada por hash; RBAC com três papéis; golden set de avaliação como teste de regressão.

**Fora (fases seguintes):** ingestão da LC 214/2025 e LC 227/2026 via fontes estruturadas (LexML); parser tabular dos Anexos (NCM); re-ranker cross-encoder; visualização gráfica interativa do grafo; diff de vigência dispositivo a dispositivo; API pública; Neo4j (somente se travessias multi-salto o justificarem).

## 7. Critérios de sucesso mensuráveis

Integridade de citação: 100% dos dispositivos exibidos idênticos ao banco (verificação automática por hash em toda resposta). Retrieval: recall@4 ≥ 90% no golden set (perguntas com dispositivo-resposta conhecido); consultas por endereço ("art. N") com precisão 100% via roteador determinístico. Ingestão: relatório de auditoria com zero divergências estruturais como pré-condição de publicação. Operação: custo marginal de embedding = R$ 0; latência de consulta ponta a ponta ≤ 6s no p95.

## 8. Premissas e restrições

O sistema responde exclusivamente com base no corpus publicado e não substitui parecer profissional (disclaimer permanente na interface). Dados do corpus são públicos; dados de usuários e histórico de consultas seguem LGPD — embeddings processados localmente por padrão. As demonstrações acadêmicas existentes (Notebooks + Streamlit) permanecem intocadas e independentes desta plataforma.
