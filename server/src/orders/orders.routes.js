import { Router } from 'express';
import * as controller from './orders.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, controller.listMyOrders);
router.get('/:orderNumber', requireAuth, controller.getMyOrder);

export default router;
