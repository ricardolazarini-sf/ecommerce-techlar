import { Router } from 'express';
import * as controller from './checkout.controller.js';

const router = Router();

router.post('/start', controller.start);
router.post('/confirm', controller.confirm);

export default router;
