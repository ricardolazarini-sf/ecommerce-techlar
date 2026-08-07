import * as repo from './customers.repository.js';
import * as cartRepo from '../cart/cart.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './auth.js';
import { events } from '../events/index.js';
import { isValidCPF } from '../utils/cpf.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refFor(customer, deviceId) {
  return {
    email: customer.email,
    phone: customer.telefone,
    document: customer.documento,
    device_id: deviceId || customer.device_id || null,
  };
}

export async function register({ nome, email, telefone, documento, password, deviceId }) {
  if (!nome || !email || !password) {
    const err = new Error('nome, email and password are required');
    err.status = 400;
    throw err;
  }
  if (!EMAIL_RE.test(email)) {
    const err = new Error('Invalid email');
    err.status = 400;
    throw err;
  }
  // CPF é obrigatório: é a chave forte para o casamento de identidade (golden record).
  if (!documento || !isValidCPF(documento)) {
    const err = new Error('CPF inválido ou ausente');
    err.status = 400;
    throw err;
  }
  if (String(password).length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.status = 400;
    throw err;
  }

  const created = await repo.create({
    nome,
    email,
    telefone,
    documento,
    deviceId,
    passwordHash: hashPassword(password),
  });

  // Link any anonymous device cart to the new customer, then emit identify.
  await cartRepo.linkDeviceCartToCustomer(deviceId, created.id);
  events.identify(refFor(created, deviceId), { reason: 'register' }, { customerId: created.id });

  return { token: signToken(created), customer: repo.toPublic(created) };
}

export async function login({ email, password, deviceId }) {
  if (!email || !password) {
    const err = new Error('email and password are required');
    err.status = 400;
    throw err;
  }
  const row = await repo.findByEmailForLogin(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  await cartRepo.linkDeviceCartToCustomer(deviceId, row.id);
  events.identify(refFor(row, deviceId), { reason: 'login' }, { customerId: row.id });

  return { token: signToken(row), customer: repo.toPublic(row) };
}

export async function getProfile(customerId) {
  const customer = await repo.findById(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  return customer;
}

export async function updateProfile(customerId, fields) {
  const updated = await repo.updateProfile(customerId, fields);
  if (!updated) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  return updated;
}

export default { register, login, getProfile, updateProfile };
