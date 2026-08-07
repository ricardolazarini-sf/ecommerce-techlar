import { Router } from 'express';
import * as controller from './wishlist.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', controller.add);
router.delete('/:productId', controller.remove);

export default router;
