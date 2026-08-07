import * as repo from './customers.repository.js';
import * as cartRepo from '../cart/cart.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './auth.js';
import { events } from '../events/index.js';
import { isValidCPF } from '../utils/cpf.js';
import { isValidPhone } from '../utils/phone.js';

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
  if (!nome || !nome.trim()) {
    const err = new Error('Informe o nome completo.');
    err.status = 400;
    throw err;
  }
  if (!email || !EMAIL_RE.test(email)) {
    const err = new Error('Informe um email válido.');
    err.status = 400;
    throw err;
  }
  // CPF é obrigatório: é a chave forte para o casamento de identidade (golden record).
  if (!documento || !isValidCPF(documento)) {
    const err = new Error('Informe um CPF válido.');
    err.status = 400;
    throw err;
  }
  // Telefone é opcional, mas se informado precisa ser um número válido (DDD + número).
  if (telefone && String(telefone).trim() && !isValidPhone(telefone)) {
    const err = new Error('Telefone inválido. Use DDD + número, apenas dígitos.');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 6) {
    const err = new Error('A senha deve ter no mínimo 6 caracteres.');
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
    const err = new Error('Informe email e senha.');
    err.status = 400;
    throw err;
  }
  const row = await repo.findByEmailForLogin(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    const err = new Error('Email ou senha incorretos.');
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
    const err = new Error('Cliente não encontrado.');
    err.status = 404;
    throw err;
  }
  return customer;
}

export async function updateProfile(customerId, fields) {
  if (fields.documento && !isValidCPF(fields.documento)) {
    const err = new Error('Informe um CPF válido.');
    err.status = 400;
    throw err;
  }
  if (fields.telefone && String(fields.telefone).trim() && !isValidPhone(fields.telefone)) {
    const err = new Error('Telefone inválido. Use DDD + número, apenas dígitos.');
    err.status = 400;
    throw err;
  }
  const updated = await repo.updateProfile(customerId, fields);
  if (!updated) {
    const err = new Error('Cliente não encontrado.');
    err.status = 404;
    throw err;
  }
  return updated;
}

export default { register, login, getProfile, updateProfile };
