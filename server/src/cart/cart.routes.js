import { Router } from 'express';
import * as controller from './cart.controller.js';

const router = Router();

router.get('/', controller.getCart);
router.post('/items', controller.addItem);
router.patch('/items/:productId', controller.updateItem);
router.delete('/items/:productId', controller.removeItem);

export default router;
