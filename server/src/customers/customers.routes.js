import { Router } from 'express';
import * as controller from './customers.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

// Auth endpoints (register/login) are mounted at /api/auth.
export const authRouter = Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);

// Customer profile endpoints are mounted at /api/customers.
export const customersRouter = Router();
customersRouter.get('/me', requireAuth, controller.me);
customersRouter.patch('/me', requireAuth, controller.updateProfile);

export default { authRouter, customersRouter };
