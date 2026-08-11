import { Router } from 'express';
import * as controller from './catalog.controller.js';

const router = Router();

router.get('/products', controller.listProducts);
router.get('/products/featured', controller.listFeatured);
router.get('/products/:id', controller.getProduct);
router.get('/categories', controller.listCategories);
router.get('/combos', controller.listCombos);

export default router;
