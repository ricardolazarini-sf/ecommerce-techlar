// Especificação OpenAPI do coletor, montada A PARTIR do contrato em
// collect/contract.js. Nada de lista de campos digitada à mão aqui: campo novo no
// contrato aparece sozinho no Swagger, e campo removido desaparece. Documentação
// que se escreve à parte envelhece em uma semana.

import { config } from '../config/index.js';
import { EVENT_TYPES, TEXT_PROPS, NUMBER_PROPS } from '../collect/contract.js';

// O que cada campo significa para quem está testando. O que não estiver aqui
// ainda aparece no Swagger (vem do contrato), só sem explicação.
const FIELD_NOTES = {
  phone: 'Telefone em E.164, quando conhecido.',
  document: 'CPF ou CNPJ, quando conhecido.',
  reason: 'Motivo do evento: `login`, `cadastro`…',
  product_id: 'Id do produto no catálogo.',
  sku: 'SKU do produto.',
  product_name: 'Nome do produto. Aceita o apelido `nome`.',
  category: 'Slug da categoria. Aceita o apelido `categoria`.',
  action: 'Variação do clique: `on`/`off`, `add`/`remove`, `PF`/`PJ`, `montar`/`vitrine`.',
  order_number: 'Número do pedido (`TL-AAAAMMDD-XXXXXX`).',
  status: 'Status do pedido no momento do evento.',
  items_json: 'Itens do pedido em JSON. Aceita o apelido `items` (array), serializado aqui.',
  search_term: 'Termo buscado. Aceita o apelido `term`.',
  surface: 'De onde partiu o clique: `home`, `catalogo`, `busca`, `pdp`, `barra-fixa`, `wishlist`, `combo`, `rodape`, `navbar`.',
  page_path: 'Rota da SPA no momento do clique. O `track.js` preenche sozinho.',
  combo_id: 'Slug do combo. Aceita o apelido `combo_slug`.',
  price: 'Preço unitário do produto.',
  item_count: 'Quantidade de linhas do carrinho ou do pedido.',
  subtotal: 'Subtotal, antes de desconto e garantia.',
  total: 'Total do evento (do pedido, do combo ou da garantia).',
  qty: 'Quantidade da linha.',
  discount: 'Desconto em reais — ou o percentual, em `combo_clicked`.',
};

function propsSchema() {
  const properties = {};
  for (const key of TEXT_PROPS) {
    properties[key] = { type: 'string', maxLength: key === 'items_json' ? 4000 : 500, description: FIELD_NOTES[key] };
  }
  for (const key of NUMBER_PROPS) {
    properties[key] = { type: 'number', description: FIELD_NOTES[key] };
  }
  // Apelidos que o site usa e o coletor traduz. Ficam documentados para quem
  // testar não achar que foram descartados por engano.
  properties.nome = { type: 'string', description: 'Apelido de `product_name`.' };
  properties.categoria = { type: 'string', description: 'Apelido de `category`.' };
  properties.preco = { type: 'number', description: 'Apelido de `price`.' };
  properties.combo_slug = { type: 'string', description: 'Apelido de `combo_id`.' };
  properties.items = {
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Apelido de `items_json`: o array é serializado pelo coletor.',
  };
  return {
    type: 'object',
    description:
      'Só os campos do contrato passam; qualquer outra chave é **descartada em silêncio** ' +
      '(schema fechado, sem campo surpresa virando coluna na Data 360). `email` e `customer_id` ' +
      'mandados aqui são ignorados: identidade vem do token.',
    properties,
    additionalProperties: false,
  };
}

const exemplo = (event_type, props) => ({ device_id: 'c-swagger-1', events: [{ event_type, props }] });

export function buildSpec() {
  const dryRun = config.flush.dryRun;

  return {
    openapi: '3.0.3',
    info: {
      title: 'TechLar — Coletor de engajamento',
      version: '1.0.0',
      description: [
        'Recebe **cliques do site** e os leva para a Data 360 (Ingestion API).',
        '',
        'É um serviço separado do da loja, de propósito: clique é volumoso, chega em rajada e',
        'pode ser descartado na margem; pedido é raro e não pode ser perdido. Cada um tem seu',
        'processo, seu banco e seu connector.',
        '',
        '### Como testar aqui',
        '',
        '1. `GET /health` — mostra a fila, o modo do flusher e o que falta de configuração da org.',
        '2. `POST /collect` — escolha um exemplo no seletor do corpo e execute. A resposta `202`',
        '   diz quantos eventos entraram na fila (`accepted`), quantos eram repetidos',
        '   (`duplicates`) e quantos foram recusados (`rejected`).',
        '3. Para ver o e-mail sendo anexado, clique em **Authorize** e cole um token JWT do site',
        '   (o mesmo `techlar_token` do `localStorage`). Sem token o clique entra anônimo, só com',
        '   `device_id` — e isso é comportamento esperado, não erro.',
        '',
        '### O que esperar',
        '',
        '- `202` é aceite na **fila**, não ingestão. Quem fala com a Data 360 é o flusher, depois,',
        '  em lote. Acompanhe com `npm run queue` ou pelo `/health`.',
        `- O flusher está em modo **${dryRun ? 'dry-run' : config.flush.validateOnly ? 'validate-only' : 'ingest'}**.`,
        dryRun
          ? '  Em dry-run nada é enviado para a org: o evento é gravado, logado e marcado como enviado.'
          : '  Os eventos aceitos vão para a org de verdade.',
        '- Evento fora dos 14 tipos conhecidos é recusado sem derrubar o resto do lote.',
        '- `event_id` repetido não vira linha nova: a deduplicação é por essa chave.',
      ].join('\n'),
    },
    servers: [
      { url: '/', description: 'Este serviço' },
      { url: 'http://localhost:3002', description: 'Local' },
      { url: 'http://localhost:5173', description: 'Local via proxy do Vite (mesma origem do site)' },
    ],
    tags: [
      { name: 'Coleta', description: 'Recebimento dos cliques' },
      { name: 'Operação', description: 'Saúde do serviço e estado da fila' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Token do site (mesmo `JWT_SECRET`). É o que autoriza anexar e-mail ao clique. ' +
            'Token vencido ou inválido não derruba o POST: o evento entra anônimo.',
        },
      },
      schemas: {
        Event: {
          type: 'object',
          required: ['event_type'],
          properties: {
            event_type: {
              type: 'string',
              enum: EVENT_TYPES,
              description: 'Um dos 14 cliques do contrato. Fora da lista, o evento é recusado.',
            },
            event_id: {
              type: 'string',
              format: 'uuid',
              description:
                'Chave de deduplicação. Se faltar (ou não for um UUID), o coletor gera uma — ' +
                'reenvio do navegador não vira linha dobrada.',
            },
            occurred_at: {
              type: 'string',
              format: 'date-time',
              description:
                'Hora do clique no navegador. Relógio adiantado ou evento velho demais ' +
                '(mais de 2 dias) é corrigido para agora, para não sujar a série temporal.',
            },
            device_id: {
              type: 'string',
              description: 'Sobrepõe o `device_id` do lote, se este evento vier de outro dispositivo.',
            },
            props: propsSchema(),
          },
        },
        Batch: {
          type: 'object',
          required: ['events'],
          properties: {
            device_id: {
              type: 'string',
              description: 'Identificador anônimo do navegador — o mesmo do carrinho. Vale para todo o lote.',
            },
            events: {
              type: 'array',
              minItems: 1,
              maxItems: config.collect.maxEventsPerRequest,
              items: { $ref: '#/components/schemas/Event' },
            },
            auth: {
              type: 'string',
              description:
                'Token JWT no corpo. Existe só para o `navigator.sendBeacon`, que entrega o último ' +
                'clique de quem fechou a aba mas não permite header. Preferir o header `Authorization`.',
            },
          },
        },
        Accepted: {
          type: 'object',
          properties: {
            accepted: { type: 'integer', description: 'Eventos que entraram na fila.' },
            duplicates: { type: 'integer', description: 'Eventos com `event_id` já conhecido.' },
            rejected: { type: 'integer', description: 'Eventos recusados (tipo desconhecido, por exemplo).' },
          },
        },
        Rejected: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            rejected: {
              type: 'array',
              items: {
                type: 'object',
                properties: { index: { type: 'integer' }, reason: { type: 'string' } },
              },
            },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            service: { type: 'string' },
            mode: { type: 'string', enum: ['dry-run', 'validate', 'ingest'] },
            db_configured: { type: 'boolean' },
            datacloud_missing: {
              type: 'array',
              items: { type: 'string' },
              description: 'Variáveis que faltam para o flusher falar com a org. Vazio = pronto para ingerir.',
            },
            contract: {
              type: 'object',
              properties: {
                object: { type: 'string' },
                keys: { type: 'integer' },
                event_types: { type: 'integer' },
              },
            },
            queue: {
              type: 'object',
              properties: {
                pending: { type: 'integer' },
                sent: { type: 'integer' },
                rejected: { type: 'integer' },
                oldest_pending: { type: 'string', nullable: true },
                oldest_pending_ms: { type: 'integer' },
                last_sent: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Operação'],
          summary: 'Saúde do serviço e estado da fila',
          description:
            'Processo vivo não quer dizer clique saindo. O sintoma que interessa é fila pendente ' +
            'crescendo com `last_sent` parado — por isso a fila entra na resposta. Sem banco, ' +
            'responde `503 degraded`: sem banco o coletor não aceita clique.',
          responses: {
            200: { description: 'Serviço saudável', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } },
            503: { description: 'Banco da fila inacessível', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } },
          },
        },
      },
      '/collect': {
        post: {
          tags: ['Coleta'],
          summary: 'Enfileira um lote de cliques',
          description:
            'Valida, grava na fila e responde `202` — o navegador não espera a Data 360. ' +
            'O lote inteiro é recusado com `400` só quando o corpo não faz sentido (vazio, sem ' +
            '`events`, acima do teto); evento ruim no meio de lote bom é recusado individualmente ' +
            'e o resto passa.',
          security: [{ bearerAuth: [] }, {}],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Batch' },
                examples: {
                  combo: {
                    summary: 'Clique no anúncio de combo',
                    value: exemplo('combo_clicked', {
                      combo_id: 'casa-inteira',
                      discount: 12,
                      total: 21215.04,
                      action: 'montar',
                      surface: 'home',
                      page_path: '/',
                    }),
                  },
                  produto: {
                    summary: 'Produto visto, com a vitrine de origem',
                    value: exemplo('product_viewed', {
                      product_id: '10',
                      sku: 'MacBookM4Air',
                      nome: 'MacBook Air M4',
                      categoria: 'notebooks',
                      preco: 10000,
                      surface: 'busca',
                      page_path: '/produtos/10',
                    }),
                  },
                  carrinho: {
                    summary: 'Item adicionado ao carrinho',
                    value: exemplo('cart_item_added', {
                      product_id: '8',
                      sku: 'GSGH2J23213',
                      nome: 'iPhone 17',
                      categoria: 'smartphones',
                      preco: 8608,
                      qty: 1,
                      surface: 'pdp',
                    }),
                  },
                  garantia: {
                    summary: 'Garantia considerada e recusada (o clique que costuma se perder)',
                    value: exemplo('warranty_toggled', { action: 'off', subtotal: 18608, total: 0 }),
                  },
                  pedido: {
                    summary: 'Pedido pago, com itens em array (serializados pelo coletor)',
                    value: exemplo('order_placed', {
                      order_number: 'TL-20260811-L3AWZ4',
                      status: 'confirmed',
                      subtotal: 28608,
                      total: 26319.36,
                      discount: 2288.64,
                      combo_id: 'mesa-de-trabalho',
                      item_count: 2,
                      action: 'com-garantia',
                      items: [
                        { product_id: 10, qty: 1, unit_price: 10000 },
                        { product_id: 8, qty: 1, unit_price: 8608 },
                      ],
                    }),
                  },
                  lote: {
                    summary: 'Lote com vários cliques (é assim que o site manda)',
                    value: {
                      device_id: 'c-swagger-1',
                      events: [
                        { event_type: 'search_performed', props: { search_term: 'MacBook', surface: 'navbar' } },
                        { event_type: 'category_filtered', props: { category: 'notebooks', surface: 'catalogo' } },
                        { event_type: 'product_viewed', props: { product_id: '11', sku: 'MacBookM5Air', surface: 'catalogo' } },
                      ],
                    },
                  },
                  recusado: {
                    summary: 'Tipo desconhecido: recusado sem derrubar o lote',
                    value: {
                      device_id: 'c-swagger-1',
                      events: [
                        { event_type: 'search_performed', props: { search_term: 'teste' } },
                        { event_type: 'tecla_apertada', props: { key: 'Enter' } },
                      ],
                    },
                  },
                  identidade: {
                    summary: 'Identify — amarra o device_id a um e-mail (precisa de token)',
                    value: exemplo('identify', { reason: 'login', action: 'PF' }),
                  },
                },
              },
            },
          },
          responses: {
            202: {
              description: 'Aceito e na fila',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Accepted' },
                  example: { accepted: 1, duplicates: 0, rejected: 0 },
                },
              },
            },
            400: {
              description: 'Corpo inválido: sem `events`, lote vazio ou acima do teto',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rejected' },
                  example: { error: 'Nenhum evento no lote.', rejected: [] },
                },
              },
            },
            413: { description: 'Corpo acima de `EVENTS_MAX_BODY_BYTES`' },
            429: {
              description:
                'Rate limit por IP e por device. `Retry-After` diz quando voltar, e `reason` diz ' +
                'qual teto estourou: `requests` ou `events`.',
            },
            503: { description: 'Fila indisponível — o clique não foi gravado' },
          },
        },
      },
    },
  };
}

export default buildSpec;
