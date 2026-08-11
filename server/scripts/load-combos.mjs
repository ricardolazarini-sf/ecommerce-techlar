// Carrega os combos de desconto (src/db/combos.js) na tabela `combos`, SEM
// apagar nada além dos combos. Upsert por slug, então é idempotente: edite a
// regra ou o percentual no arquivo e rode de novo.
//
// Uso (precisa de DATABASE_URL apontando para o Postgres do site):
//   npm run load:combos                 (na raiz)  ou
//   node scripts/load-combos.mjs        (dentro de /server)

import { getPool, withTransaction, closePool } from '../src/db/index.js';
import { logger } from '../src/utils/logger.js';
import { COMBOS } from '../src/db/combos.js';

async function run() {
  getPool(); // valida DATABASE_URL cedo (erro claro se faltar)

  return withTransaction(async (client) => {
    for (const c of COMBOS) {
      await client.query(
        `INSERT INTO combos (slug, nome, regra, descricao, percent, categorias, imagem_url, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (slug) DO UPDATE SET
           nome = EXCLUDED.nome,
           regra = EXCLUDED.regra,
           descricao = EXCLUDED.descricao,
           percent = EXCLUDED.percent,
           categorias = EXCLUDED.categorias,
           imagem_url = EXCLUDED.imagem_url,
           ativo = EXCLUDED.ativo`,
        [c.slug, c.nome, c.regra, c.descricao, c.percent, c.categorias, c.imagem_url, c.ativo !== false],
      );
    }
    // Combo que saiu do arquivo é desativado, não apagado: pedidos antigos
    // guardam o slug em orders.combo_slug e precisam continuar explicáveis.
    const { rowCount: deactivated } = await client.query(
      `UPDATE combos SET ativo = false WHERE ativo AND slug <> ALL($1)`,
      [COMBOS.map((c) => c.slug)],
    );
    return { combos: COMBOS.length, deactivated };
  });
}

run()
  .then((summary) => {
    logger.info('load-combos.done', summary);
    console.log(
      `OK — ${summary.combos} combo(s) carregado(s); ${summary.deactivated} desativado(s).`,
    );
    return closePool();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('load-combos.error', { err: err.message });
    console.error('Falhou:', err.message);
    process.exit(1);
  });
