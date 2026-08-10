import { query } from '../db/index.js';

const PUBLIC_COLUMNS = `id, nome, email, telefone, documento, device_id, tipo,
  razao_social, cnpj, address_line1, city, state, postal_code, country,
  created_at, updated_at`;

export function toPublic(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

export async function create({
  nome,
  email,
  telefone,
  documento,
  deviceId,
  passwordHash,
  tipo = 'PF',
  razaoSocial,
  cnpj,
  addressLine1,
  city,
  state,
  postalCode,
  country,
}) {
  const { rows } = await query(
    `INSERT INTO customers
       (nome, email, telefone, documento, device_id, password_hash,
        tipo, razao_social, cnpj, address_line1, city, state, postal_code, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING ${PUBLIC_COLUMNS}, password_hash`,
    [
      nome,
      email,
      telefone || null,
      documento || null,
      deviceId || null,
      passwordHash || null,
      tipo,
      razaoSocial || null,
      cnpj || null,
      addressLine1 || null,
      city || null,
      state || null,
      postalCode || null,
      country || 'Brasil',
    ],
  );
  return rows[0];
}

// Login lookup is case-insensitive on email and only matches records that have
// a password set (seeded identity-variance rows have none and cannot log in).
export async function findByEmailForLogin(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash
       FROM customers
      WHERE lower(email) = lower($1) AND password_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM customers WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Checagens de duplicidade — só contra CONTAS REAIS (password_hash IS NOT NULL).
// Assim a variância proposital do seed/app/CRM (linhas sem senha) NÃO bloqueia um
// cadastro legítimo; bloqueamos apenas um novo registro sobre outro registro real.
export async function existsRealAccountByEmail(email) {
  const { rows } = await query(
    `SELECT 1 FROM customers
      WHERE lower(email) = lower($1) AND password_hash IS NOT NULL LIMIT 1`,
    [email],
  );
  return rows.length > 0;
}

export async function existsRealAccountByDocumento(digits) {
  if (!digits) return false;
  const { rows } = await query(
    `SELECT 1 FROM customers
      WHERE regexp_replace(coalesce(documento, ''), '\\D', '', 'g') = $1
        AND password_hash IS NOT NULL LIMIT 1`,
    [digits],
  );
  return rows.length > 0;
}

export async function existsRealAccountByCnpj(digits) {
  if (!digits) return false;
  const { rows } = await query(
    `SELECT 1 FROM customers
      WHERE regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = $1
        AND password_hash IS NOT NULL LIMIT 1`,
    [digits],
  );
  return rows.length > 0;
}

export async function updateProfile(id, fields = {}) {
  const {
    nome,
    telefone,
    documento,
    razaoSocial,
    cnpj,
    addressLine1,
    city,
    state,
    postalCode,
    country,
  } = fields;
  const { rows } = await query(
    `UPDATE customers
        SET nome          = COALESCE($2, nome),
            telefone      = COALESCE($3, telefone),
            documento     = COALESCE($4, documento),
            razao_social  = COALESCE($5, razao_social),
            cnpj          = COALESCE($6, cnpj),
            address_line1 = COALESCE($7, address_line1),
            city          = COALESCE($8, city),
            state         = COALESCE($9, state),
            postal_code   = COALESCE($10, postal_code),
            country       = COALESCE($11, country),
            updated_at    = now()
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [
      id,
      nome ?? null,
      telefone ?? null,
      documento ?? null,
      razaoSocial ?? null,
      cnpj ?? null,
      addressLine1 ?? null,
      city ?? null,
      state ?? null,
      postalCode ?? null,
      country ?? null,
    ],
  );
  return rows[0] || null;
}

export default {
  toPublic,
  create,
  findByEmailForLogin,
  findById,
  updateProfile,
  existsRealAccountByEmail,
  existsRealAccountByDocumento,
  existsRealAccountByCnpj,
};
