import * as repo from './customers.repository.js';
import * as cartRepo from '../cart/cart.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './auth.js';
import { events } from '../events/index.js';
import { isValidCPF } from '../utils/cpf.js';
import { isValidCNPJ } from '../utils/cnpj.js';
import { isValidPhone } from '../utils/phone.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function refFor(customer, deviceId) {
  return {
    email: customer.email,
    phone: customer.telefone,
    document: customer.documento,
    device_id: deviceId || customer.device_id || null,
  };
}

export async function register(input) {
  const {
    email,
    telefone,
    password,
    deviceId,
    razaoSocial,
    cnpj,
    addressLine1,
    city,
    state,
    postalCode,
    country,
  } = input;
  const tipo = input.tipo === 'PJ' ? 'PJ' : 'PF';
  let { nome, documento } = input;

  if (!email || !EMAIL_RE.test(email)) throw badRequest('Informe um email válido.');

  if (tipo === 'PJ') {
    // B2B: chave forte é o CNPJ; nome do cadastro = razão social.
    if (!razaoSocial || !razaoSocial.trim()) throw badRequest('Informe a razão social.');
    if (!cnpj || !isValidCNPJ(cnpj)) throw badRequest('Informe um CNPJ válido.');
    nome = razaoSocial;
    documento = null;
  } else {
    // B2C: CPF é a chave forte de identidade (golden record).
    if (!nome || !nome.trim()) throw badRequest('Informe o nome completo.');
    if (!documento || !isValidCPF(documento)) throw badRequest('Informe um CPF válido.');
  }

  // Telefone é opcional, mas se informado precisa ser válido (DDD + número).
  if (telefone && String(telefone).trim() && !isValidPhone(telefone)) {
    throw badRequest('Telefone inválido. Use DDD + número, apenas dígitos.');
  }
  // Endereço obrigatório (alimenta ContactPointAddress no Data 360).
  if (!addressLine1 || !addressLine1.trim()) throw badRequest('Informe o endereço.');
  if (!city || !city.trim()) throw badRequest('Informe a cidade.');
  if (!password || String(password).length < 6) {
    throw badRequest('A senha deve ter no mínimo 6 caracteres.');
  }

  const created = await repo.create({
    nome,
    email,
    telefone,
    documento,
    deviceId,
    passwordHash: hashPassword(password),
    tipo,
    razaoSocial,
    cnpj,
    addressLine1,
    city,
    state,
    postalCode,
    country: country || 'Brasil',
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
  if (fields.documento && !isValidCPF(fields.documento)) throw badRequest('Informe um CPF válido.');
  if (fields.cnpj && !isValidCNPJ(fields.cnpj)) throw badRequest('Informe um CNPJ válido.');
  if (fields.telefone && String(fields.telefone).trim() && !isValidPhone(fields.telefone)) {
    throw badRequest('Telefone inválido. Use DDD + número, apenas dígitos.');
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
