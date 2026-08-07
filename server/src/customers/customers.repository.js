import { query } from '../db/index.js';

const PUBLIC_COLUMNS = 'id, nome, email, telefone, documento, device_id, created_at';

export function toPublic(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

export async function create({ nome, email, telefone, documento, deviceId, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO customers (nome, email, telefone, documento, device_id, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC_COLUMNS}, password_hash`,
    [nome, email, telefone || null, documento || null, deviceId || null, passwordHash || null],
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

export async function updateProfile(id, { nome, telefone, documento }) {
  const { rows } = await query(
    `UPDATE customers
        SET nome = COALESCE($2, nome),
            telefone = COALESCE($3, telefone),
            documento = COALESCE($4, documento)
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [id, nome ?? null, telefone ?? null, documento ?? null],
  );
  return rows[0] || null;
}

export default { toPublic, create, findByEmailForLogin, findById, updateProfile };
