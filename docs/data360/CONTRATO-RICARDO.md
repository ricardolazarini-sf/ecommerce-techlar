# Customer Data Integration (Ricardo) — Conformidade com o Contrato de Dados

> Como o e-commerce e o CSV do app entregam dados **conformes ao Contrato de
> Dados da Sprint IV** (Andreza). Cobre os schemas (seção 4), o checklist (seção
> 7), o mapeamento DLO → DMO e como rodar os exports.

## 1. O que mudou no site para atender ao contrato

- **B2C e B2B:** o cadastro agora distingue **PF (CPF)** e **PJ (CNPJ)**. Nova
  coluna `tipo` em `customers` + `razao_social` e `cnpj` para PJ.
- **Endereço:** cadastro coleta `address_line1`, `city`, `state (UF)`,
  `postal_code (CEP)`, `country` (alimenta ContactPointAddress).
- **`updated_at`:** timestamp de última alteração (event time field).
- **Validação forte:** CPF e CNPJ validados por dígitos verificadores (client +
  server); telefone só dígitos (DDD + número). A **formatação** é normalizada no
  export; a **variância** de identidade fica nos valores entre fontes.

Migração: `server/src/db/migrations/002_b2b_and_address.sql` (aditiva).

## 2. Entregáveis (seção 4 do contrato)

| Fonte | Objeto/DLO | Colunas | Como gerar |
| --- | --- | --- | --- |
| E-commerce PF | `ecommerce_customers_pf` | §4.1.a | `npm run export:data360` |
| E-commerce PJ | `ecommerce_customers_pj` | §4.1.b | `npm run export:data360` |
| E-commerce Pedidos | `ecommerce_orders` | §4.1.c | `npm run export:data360` |
| App PF | `app_clientes_pf.csv` | §4.2.a | `npm run gen:app-csv` |
| App PJ | `app_clientes_pj.csv` | §4.2 (PJ) | `npm run gen:app-csv` |
| App Pedidos | `app_pedidos.csv` | §4.2.b | `npm run gen:app-csv` |

- Schema OpenAPI para upload no Data Cloud: [`ecommerce_contract.yaml`](ecommerce_contract.yaml).
- Export do banco → `exports/*.csv`. Precisa de `DATABASE_URL` (o Postgres do site).
- App CSV → `exports/app/*.csv` (dados simulados, sem banco).
- Transformações no [`contractMappers.js`](../../server/src/integration/data360/contractMappers.js):
  `customer_id` prefixado (`WEB-PF-`/`WEB-PJ-`), CPF/CNPJ só dígitos, telefone
  **E.164** (`+55…`), datas **ISO 8601**, `id_type`/`id_name` = `'CPF'`, nome
  dividido em first/last.

### Obrigatório x opcional na prática

- **E-mail é obrigatório** e o site garante: coluna `NOT NULL`, formato validado
  no cadastro e no servidor. Linha sem e-mail nem sai no envio — o CLI avisa
  quantas ficaram de fora em vez de subir o campo em branco.
- **Telefone é opcional** — no cadastro do site e no `required` do schema.
- **Mas toda chave vai em todo registro:** o Data Stream recusa o registro que
  não traz um dos campos do schema, mesmo os de fora do `required` (400 `required
  key [phone] not found`; o mesmo acontece com `city`). `null` também é recusado.
  Então campo opcional sem valor viaja como **string vazia** — testado no
  `/actions/test`. Se um contato em branco não deve virar Contact Point, o filtro
  precisa ficar na **transformação da Data 360**, não no envio.

## 3. Mapeamento DLO → DMO (harmonização)

**PF (`ecommerce_customers_pf`)**
| Coluna DLO | DMO destino | Campo |
| --- | --- | --- |
| `customer_id` | Individual | Individual Id (PK / cola) |
| `first_name`, `last_name` | Individual | First/Last Name |
| `updated_at` | Individual | Last Modified Date |
| `cpf` + `id_type` + `id_name` | PartyIdentification | Number + Type + Name (match CPF) |
| `email` | ContactPointEmail | Email Address |
| `phone` | ContactPointPhone | Formatted E164 |
| `address_line1`, `city`, `country` | ContactPointAddress | AddressLine1 / City / Country |

**PJ (`ecommerce_customers_pj`)**
| Coluna DLO | DMO destino | Campo |
| --- | --- | --- |
| `customer_id` | Account | Account Id |
| `account_name` | Account | Account Name |
| `cnpj` | Account | `CNPJ__c` (custom, match direto) |
| `email`/`phone`/endereço | ContactPoint* | idem PF |

**Pedidos (`ecommerce_orders`)** → SalesOrder: `sales_order_id`→Id,
`customer_id`→Sold To Customer Id, `total_amount`→Total Amount, `order_date`→Order Date Time.

## 4. Checklist (seção 7) — status

- [x] Colunas obrigatórias presentes — garantidas no mapper/YAML.
- [x] IDs/CPF/CNPJ/CEP/phone como **Text**.
- [x] Datas em **ISO 8601** com hora.
- [x] `customer_id` único por linha (PK do banco / IDs do app).
- [x] **PF e PJ separados** (streams/arquivos distintos).
- [x] `id_type`/`id_name` = `'CPF'` no stream PF (vazio só quando CPF ausente).
- [x] `cnpj` sem formatação (14 dígitos).
- [x] Phone em **E.164** (`+55` + DDD + número).
- [ ] CRM: `Account.CNPJ__c` criado/populado — **lado org** (não é do Ricardo).

## 5. Sobreposição para Identity Resolution (por que o app usa as mesmas personas)

O app (`app_clientes_pf.csv`) reusa as **mesmas personas** do seed do e-commerce
(`server/src/db/personas.js`), então a mesma pessoa aparece nos dois silos:
- **Com CPF** (maioria): casa pela **Match Rule 1 (CPF)** — email pode divergir.
- **Sem CPF** (1 em 4): mantém o **email original** → casa pela **Match Rule 2 (email)**.
- **PJ:** mesmo **CNPJ** entre app e e-commerce → casa pela regra de CNPJ.

É isso que dá o que unificar ao ruleset da Andreza, exercitando as duas regras.
