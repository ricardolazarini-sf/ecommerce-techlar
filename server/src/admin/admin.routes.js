import { Router } from 'express';
import { config } from '../config/index.js';
import * as controller from './admin.controller.js';

// Guard de token compartilhado para as rotas admin. Estas rotas disparam escrita
// no CRM, então NÃO podem ficar abertas. Regra:
//   - ADMIN_TOKEN não configurado -> 404 (rota "não existe"); evita expor um
//     endpoint sensível quando o operador esqueceu de definir o segredo.
//   - header x-admin-token ausente/errado -> 401.
// Comparação simples (não é timing-safe): proporcional a um ambiente de demo.
function requireAdmin(req, res, next) {
  const expected = config.admin.token;
  if (!expected) {
    return res.status(404).json({ error: 'Not found' });
  }
  const provided = req.get('x-admin-token') || '';
  if (provided !== expected) {
    return res.status(401).json({ error: 'Admin token inválido ou ausente.' });
  }
  return next();
}

const router = Router();

router.use(requireAdmin);
router.post('/orders/:orderNumber/status', controller.updateOrderStatus);

export default router;
