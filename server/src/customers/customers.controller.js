import * as service from './customers.service.js';
import * as ordersService from '../orders/orders.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getDeviceId } from '../http/context.js';

export const register = asyncHandler(async (req, res) => {
  const { nome, email, telefone, documento, password } = req.body || {};
  const result = await service.register({
    nome,
    email,
    telefone,
    documento,
    password,
    deviceId: getDeviceId(req),
  });
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const result = await service.login({ email, password, deviceId: getDeviceId(req) });
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const [customer, orders] = await Promise.all([
    service.getProfile(req.user.id),
    ordersService.getOrderHistory(req.user.id),
  ]);
  res.json({ customer, orders });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { nome, telefone, documento } = req.body || {};
  const customer = await service.updateProfile(req.user.id, { nome, telefone, documento });
  res.json({ customer });
});

export default { register, login, me, updateProfile };
