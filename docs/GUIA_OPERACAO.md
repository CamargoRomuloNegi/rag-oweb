# Guia de Operação — Plataforma RAG RTC

Manual do dia a dia para administradores e curadores. Pressupõe a implantação concluída (README, passos 1–5).

---

## 1. Gestão de usuários e papéis

O MVP usa o painel do Supabase como "porta de entrada" de usuários (decisão deliberada: evita reimplementar cadastro/recuperação de senha no primeiro ciclo).

**Criar usuário:** Supabase → **Authentication → Users → Add user** (marque *Auto Confirm User*). Depois, atribua o papel no **SQL Editor**:

```sql
INSERT INTO perfis (user_id, email, papel)
VALUES ('UUID-DO-USUARIO', 'email@dominio.com', 'consultor');
```

**Trocar papel:** `UPDATE perfis SET papel = 'curador' WHERE email = 'email@dominio.com';`

**Revogar acesso:** remova a linha de `perfis` (o login passa a ser bloqueado pela plataforma) e, se desejar, exclua o usuário no painel Auth.

| Papel | Consulta | Ingestão/Versões | Configurações |
|---|---|---|---|
| consultor | ✅ | — | — |
| curador | ✅ | ✅ | somente leitura |
| admin | ✅ | ✅ | ✅ |

## 2. Fluxo de ingestão (o portão humano)

1. **Curadoria → Ingestão**: envie o PDF e preencha os metadados. A **sigla** define os IDs canônicos (`RES6-2026` → `RES6-2026-ART186`) — mantenha o padrão `TIPO+NÚMERO-ANO`, pois os IDs são estáveis entre versões e usados no golden set.
2. Clique **Analisar**. O parser roda as cinco defesas e a auditoria estrutural.
3. **Interprete o relatório:**
   - *Sequência completa = Sim* → todos os artigos de 1 a N extraídos, sem lacunas/duplicatas.
   - *Headings não encontrados no corpo = []* → o sumário (gabarito) conferiu 100%.
   - *Avisos de monotonicidade* → linhas iniciando com "Art. N" fora de sequência, tratadas como texto corrido. Zero é o esperado; poucos avisos merecem inspeção manual das páginas indicadas; muitos avisos indicam formato de PDF que o parser ainda não domina.
4. A publicação **só habilita com auditoria limpa** (`aprovavel = true`). Auditoria reprovada = não publique; registre o caso e ajuste o parser (loop de melhoria contínua acordado em projeto).
5. **Aprovar e publicar** vetoriza (barra de progresso) e disponibiliza na Consulta. A versão publicada anterior do mesmo documento passa automaticamente a *substituído* — preservada para histórico.

**Ingestão duplicada** é bloqueada por SHA-256 do arquivo.

## 3. Configurações (aba restrita ao admin)

Valores em JSON (strings entre aspas: `"gemini"`; números puros: `4`).

| Chave | Efeito prático |
|---|---|
| `provedor_embedding` | `"gemini"` (padrão nuvem) · `"bge_m3"` (self-host) · `"openai_compat"` |
| `provedor_llm` / `modelo_llm` | Quem gera a resposta consultiva |
| `top_k` | Dispositivos recuperados por consulta (subir melhora recall, alonga o prompt) |
| `rrf_k` / `candidatos_por_ranking` | Ajuste fino da fusão híbrida |
| `limite_enriquecimento` | Quantos artigos referenciados o grafo anexa |
| `historico_maximo` | Memória conversacional enviada ao LLM |
| `tamanho_lote_vetorizacao` / `pausa_lote_segundos` | Ritmo da ingestão vs. rate limit |
| `prompt_consulta` | Template ativo em `prompts/` (versione: crie `consulta_v2.md` e aponte) |

## 4. Trocando de provedor de embeddings (procedimento completo)

A troca de **LLM** é imediata (só gera texto). A troca de **embeddings** exige re-vetorização, pois vetores de modelos diferentes não são comparáveis:

1. Registre/ative o modelo novo e desative o antigo:
   ```sql
   UPDATE modelos_embedding SET ativo = false WHERE ativo = true;
   UPDATE modelos_embedding SET ativo = true  WHERE id = 'bge-m3@1024';
   ```
2. Ajuste `provedor_embedding` na aba Configurações.
3. Re-ingira os documentos publicados (mesmo fluxo da seção 2 — o parser é determinístico e os IDs canônicos se mantêm). Os vetores do modelo antigo permanecem no banco (chaveados por `modelo_id`) e podem ser removidos depois: `DELETE FROM embeddings WHERE modelo_id = 'antigo';`

*(A re-vetorização in-place sem re-ingestão está no roadmap da Fase 2.)*

## 5. Golden set — o juiz da qualidade

O arquivo `golden_set/golden_set.csv` traz 12 perguntas-semente **verificadas contra o corpus real** (formato: `pergunta;ids_esperados;categoria`, IDs separados por `|`). O trabalho do especialista de domínio é expandi-lo para 50–100 perguntas representativas do uso real.

Carga no banco (SQL Editor), exemplo:
```sql
INSERT INTO golden_set (pergunta, ids_esperados, categoria) VALUES
('Como funciona o split payment no recolhimento do IBS?',
 ARRAY['RES6-2026-ART028','RES6-2026-ART029','RES6-2026-ART030','RES6-2026-ART031'],
 'split_payment');
```
Uso: após qualquer mudança em parser, provedor ou parâmetros, rode as perguntas na Consulta e confira se os `ids_esperados` aparecem entre os recuperados (o rodapé de cada resposta lista a rota; o expansor lista os IDs). A automação dessa medição (recall@k em CI) está no roadmap.

## 6. Trilha de auditoria

Toda consulta fica em `consultas_log` (usuário, pergunta, rota, IDs recuperados, resposta). Consultas úteis:

```sql
-- Perguntas sem resultado (candidatas a lacuna de corpus ou de retrieval):
SELECT pergunta, criado_em FROM consultas_log WHERE rota = 'sem_resultado' ORDER BY criado_em DESC;

-- Dispositivos mais citados:
SELECT unnest(dispositivos_recuperados) AS id, count(*) FROM consultas_log GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

## 7. Problemas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| "Usuário sem papel atribuído" no login | Falta a linha em `perfis` | Seção 1 |
| Consulta não encontra nada | Nenhuma versão `publicado` OU modelo de embedding ativo sem vetores | Verifique a aba Versões e a seção 4 |
| Erro 429 na vetorização | Rate limit do free tier | Aumente `pausa_lote_segundos` / reduza `tamanho_lote_vetorizacao` |
| Auditoria reprovada em documento novo | Formato de PDF diferente do padrão CGIBS | Não publique; abra issue com o relatório JSON para evolução do parser |
| "FALHA DE INTEGRIDADE" num dispositivo | Texto alterado no banco após a ingestão | Investigue imediatamente — nunca edite `dispositivos.texto` à mão |
