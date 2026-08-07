// Validação de telefone brasileiro no servidor (DDD + número, só dígitos).
// 10 dígitos (fixo) ou 11 dígitos (celular). Sem código de país.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidPhone(value) {
  const d = onlyDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

export default { onlyDigits, isValidPhone };
