import * as service from './customers.service.js';
import * as ordersService from '../orders/orders.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getDeviceId } from '../http/context.js';

export const register = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const result = await service.register({
    tipo: b.tipo,
    nome: b.nome,
    email: b.email,
    telefone: b.telefone,
    documento: b.documento,
    razaoSocial: b.razaoSocial,
    cnpj: b.cnpj,
    addressLine1: b.addressLine1,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
    password: b.password,
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
  const b = req.body || {};
  const customer = await service.updateProfile(req.user.id, {
    nome: b.nome,
    telefone: b.telefone,
    documento: b.documento,
    razaoSocial: b.razaoSocial,
    cnpj: b.cnpj,
    addressLine1: b.addressLine1,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
  });
  res.json({ customer });
});

export default { register, login, me, updateProfile };
