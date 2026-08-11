import { Router } from 'express';
import { collect } from './collect.controller.js';

const router = Router();

router.post('/', collect);

export default router;
