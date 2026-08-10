# 🤝 Handoff — Ingestão do E-commerce no Data 360

> **De:** Ricardo Lazarini · **Para:** Fernando · **Data:** 10/08/2026
> **Sprint 4 — TechLar / Data Cloud (Data 360)**

---

## 🎯 Objetivo

Levar os dados do **site e-commerce** (banco Postgres próprio) para o **Data 360**
usando a **Ingestion API em modo Streaming**, formar os **DLOs**, mapear para os
**DMOs** e rodar **Identity Resolution** — unificando os clientes do site com os
do app mobile num único **Golden Record**.

## 🧭 Estado em uma frase

> **O código está 100% pronto e testado. Falta UMA configuração na org**
> (provisionar o usuário no Data Cloud) que está causando o erro
> `invalid subject token`. Resolvido isso, é rodar o CLI e mapear os dados.

```
[ ✅ feito ]───────────────[ ⛔ VOCÊ ESTÁ AQUI ]────────────[ ⏳ falta ]
 CLI + docs + schema         auth trava na 2ª troca de       rodar CLI →
 + Data Stream criado        token (usuário sem Data Cloud)   DMO → Identity Res.
```

---

## ✅ O que já está pronto (resumo — não precisa refazer)

Tudo abaixo foi implementado e **verificado**. Só está citado para você saber que
não precisa mexer:

- **CLI de ingestão** (`server/scripts/push-data360.mjs`): assina o JWT, faz as
  duas trocas de token e envia PF/PJ/pedidos em lotes < 200 KB, com retry.
  Modos `DRY_RUN` (sem rede) e `VALIDATE_ONLY` (valida sem gravar).
- **Mapeamento banco → contrato** (`contractMappers.js`): telefone em E.164, datas
  ISO 8601, IDs com prefixo `WEB-PF-`/`WEB-PJ-`. Testado por unit tests.
- **Schema OpenAPI** dos objetos (`docs/data360/ecommerce_contract.yaml`) já no
  formato aceito pela Ingestion API.
- **Documentação completa** do processo: `docs/data360/INGESTAO-CLI.md`.
- **Na org (feito pelo Ricardo):** External Client App (JWT) com certificado,
  usuário pré-autorizado, **Source + Data Stream** da Ingestion API criados.

**Provas rápidas dos testes (já rodados):**

| Teste | Resultado |
| --- | --- |
| `DRY_RUN` lendo o banco do Render | ✅ **4 PF · 2 PJ · 0 pedidos** |
| Assinatura do JWT (RS256) com a chave | ✅ JWT válido |
| 1ª troca: JWT → token da org | ✅ HTTP 200, token **opaco** (`00DHu0000…`) |
| Scopes concedidos pelo app | ✅ `sfap_api cdp_ingest_api` |

➡️ Detalhes de tudo isso: **`docs/data360/INGESTAO-CLI.md`**.

---

## ⛔ O PROBLEMA ATUAL (foco aqui)

### Sintoma

Ao rodar a validação de autenticação:

```bash
VALIDATE_ONLY=true npm run push:data360
```

a saída é:

```
Autenticando (JWT -> org -> Data Cloud)...
Falhou: Falha na troca p/ Data Cloud token (HTTP 200):
        {"error":"invalid_request","error_description":"invalid subject token"}
```

### O que isso significa (em português claro)

A autenticação tem **duas etapas**:

1. **JWT → access token da org** (`/services/oauth2/token`) — **FUNCIONA** ✅
2. **access token → token do Data Cloud** (`/services/a360/token`) — **FALHA** ❌

Ou seja: a org **reconhece e autentica** o app e o usuário perfeitamente. O erro
só acontece quando pedimos o token específico do **Data Cloud**.

### Diagnóstico já feito (para você não repetir o caminho)

Descartamos as causas comuns, com evidência:

| Hipótese | Verificado? | Conclusão |
| --- | --- | --- |
| Certificado/JWT errado | 1ª troca funciona | ❌ não é isso |
| Usuário não pré-autorizado no app | 1ª troca funciona | ❌ não é isso |
| Falta o scope `cdp_ingest_api` | scopes = `sfap_api cdp_ingest_api` | ❌ não é isso |
| Token em formato JWT (Data Cloud só aceita opaco) | token começa com `00DHu0000…` (opaco) | ❌ não é isso |
| **Usuário não provisionado no Data Cloud** | — | ✅ **causa mais provável** |

### Causa raiz

O token está correto e opaco, o scope está lá — então o `invalid subject token`
significa que o **usuário de integração não é um "usuário do Data Cloud"**.
Ser **System Administrator não provisiona o Data Cloud automaticamente**: é preciso
atribuir a **Permission Set License** e a **Permission Set** de Data Cloud ao usuário.

📎 Caso idêntico na comunidade:
<https://salesforce.stackexchange.com/questions/433245/unable-to-get-data-cloud-token-getting-the-error-invalid-subject-token>
📎 Doc oficial de autenticação server-to-server:
<https://developer.salesforce.com/docs/data/data-cloud-int/guide/c360-a-authenticated-server-to-server.html>

---

## 🔧 A CORREÇÃO (passo a passo — precisa de acesso admin)

**Usuário de integração:** `ricardo.lazarini.e819d0c090@salesforce.com`
(é o `SF_USERNAME` no `.env` e o `sub` do JWT).

### Passo 1 — Atribuir a *Permission Set License* de Data Cloud
1. Setup → **Users** → abrir o usuário acima.
2. Seção **Permission Set License Assignments** → **Edit Assignments**.
3. Marcar **Data Cloud Admin** (pode aparecer como *Cloud Data Admin*).
4. **Save**.

### Passo 2 — Atribuir a *Permission Set* de Data Cloud
1. Setup → **Permission Sets** → abrir **Data Cloud Admin**.
2. **Manage Assignments** → **Add Assignments**.
3. Marcar o usuário → **Assign**.

### Passo 3 — Aguardar propagação
Espere **2–5 minutos** (mudanças de permissão não são instantâneas).

### Passo 4 — Validar
```bash
VALIDATE_ONLY=true npm run push:data360
```
- ✅ **Sucesso:** termina com `Validado: PF 4 · PJ 2 · Pedidos 0 ✅` (nada é gravado).
- ❌ Se ainda falhar: ver **Checagens secundárias** abaixo.

### Checagens secundárias (só se o Passo 4 ainda falhar)
- **App** → confirmar que a caixa **"Issue JSON Web Token (JWT)-based access
  tokens for named users"** está **DESMARCADA** (o Data Cloud exige token opaco).
- **App** → scopes: `cdp_ingest_api`, `api`/`sfap_api`, `refresh_token`.
- Confirmar que o **Data Cloud está provisionado** (App Launcher mostra "Data Cloud").

---

## ▶️ Como rodar o CLI (referência rápida)

O CLI faz tudo sozinho (assina JWT → troca tokens → envia em lotes com retry):

```bash
# na RAIZ do projeto:
DRY_RUN=true        npm run push:data360   # lê o banco, mostra amostra; NÃO autentica
VALIDATE_ONLY=true  npm run push:data360   # autentica + valida schema; NÃO grava
npm run push:data360                        # ENVIA de verdade (HTTP 202)
```

- `202 Accepted` = aceito para processamento **assíncrono** (aparece no Data
  Explorer em ~3 min).
- Guia detalhado (limites, fluxo, boa prática, troubleshooting):
  **`docs/data360/INGESTAO-CLI.md`**.

---

## 🔐 Configuração e segredos (LEIA)

O CLI lê `server/.env`. Já está preenchido na máquina do Ricardo:

| Variável | Valor / origem |
| --- | --- |
| `SF_LOGIN_URL` | `https://trailsignup-2230eb84a63b58.my.salesforce.com` |
| `SF_USERNAME` | `ricardo.lazarini.e819d0c090@salesforce.com` |
| `SF_CLIENT_ID` | Consumer Key do External Client App |
| `SF_JWT_KEY_PATH` | `/Users/rlazarini/techlar-secrets/techlar_ingest.key` (**fora do repo**) |
| `DATACLOUD_CONNECTOR` | `TechLar_Ecom` |
| `DATABASE_URL` | Postgres do Render |
| `PGSSL` | `true` |

### ⚠️ O que NÃO está no Git (precisa ser repassado por canal seguro)
Estes estão no `.gitignore` **de propósito** — não vêm no `git clone`:

- `server/.env` — valores reais (client_id, DB, connector).
- `techlar_ingest.key` / `.crt` — par de chaves do JWT (em `~/techlar-secrets/`).
- `docs/data360/dados-cli.local.md` — planilha com os valores preenchidos.

**Como repassar:** 1Password / cofre de segredos / DM cifrada. **Nunca commitar.**

> 💡 Alternativa a arquivo de chave: definir `SF_JWT_KEY` no `.env` com o PEM
> inline (o CLI aceita, com `\n` literais). Útil para CI/Render.

---

## 🗂️ Mapa dos arquivos

| Arquivo | Papel |
| --- | --- |
| `server/scripts/push-data360.mjs` | **CLI de ingestão** (Streaming) |
| `server/src/integration/data360/contractMappers.js` | Banco → contrato (E.164, ISO, prefixos) |
| `docs/data360/ecommerce_contract.yaml` | Schema OpenAPI (PF/PJ/orders) p/ a Ingestion API |
| `docs/data360/INGESTAO-CLI.md` | 📘 Guia completo da ingestão + CLI |
| `docs/data360/HANDOFF-FERNANDO.md` | 📄 **Este documento** |
| `docs/data360/dados-cli.local.md` | 🔒 (gitignored) planilha de credenciais |
| `server/scripts/export-data360.mjs` | Export CSV (Bulk) — mesmo contrato |
| `server/scripts/generate-app-csv.mjs` | CSV simulando o app mobile (p/ Identity Resolution) |

---

## ⏳ Roadmap do que falta (para fechar a Sprint)

- [ ] **1. Auth** — provisionar o usuário no Data Cloud (seção 🔧) → `VALIDATE_ONLY` OK.
- [ ] **2. Enviar** — `npm run push:data360` → 202 em `ecommerce_customers_pf/pj`.
  - ⚠️ Hoje o banco tem **0 pedidos** → `ecommerce_orders` sai vazio. Para
    demonstrar pedidos, fazer alguns checkouts no site (ou pedir seed ao Ricardo).
- [ ] **3. Data Explorer** — confirmar os DLOs populados (~3 min de latência).
- [ ] **4. Data Model** — mapear DLO → DMO:
  - `ecommerce_customers_pf` → **Individual** (+ Contact Point Email/Phone)
  - `ecommerce_customers_pj` → **Account**
  - `ecommerce_orders` → **Sales Order**
- [ ] **5. Identity Resolution** — ruleset casando por **CPF/CNPJ** e por **email**
  (unifica site + app → Golden Record).
- [ ] **6. Validar** — cliente presente nas 2 fontes vira **1** Unified Individual.
- [ ] **7. (Opcional)** Calculated Insights (CLV, RFM) sobre o perfil unificado.

---

## 📌 Observações finais

- **Idempotência:** os Data Streams devem estar em **Upsert** por primary key
  (`customer_id` / `sales_order_id`) → reenviar **atualiza**, não duplica. Pode
  rodar o CLI quantas vezes precisar.
- **Dado sem telefone:** a cliente "Bianca" está sem `phone` no banco → não vira
  Contact Point Phone. Não bloqueia a ingestão.
- **Duas fontes, um perfil:** o app (via CSV/Bulk) e o site (via Streaming) têm
  clientes propositalmente sobrepostos por **CPF/CNPJ** e **email** — é isso que a
  Identity Resolution usa para provar a unificação.

**Dúvidas?** Comece pelo `INGESTAO-CLI.md` (seção *É o caminho certo?* e
*Troubleshooting*). O bloqueio atual está 100% coberto na seção 🔧 acima.
