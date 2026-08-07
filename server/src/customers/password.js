import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Password hashing using Node's built-in scrypt — no native/3rd-party deps.
// Stored format: `scrypt$<saltHex>$<hashHex>`.

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(String(password), salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) {
    return false;
  }
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(String(password), salt, KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export default { hashPassword, verifyPassword };
