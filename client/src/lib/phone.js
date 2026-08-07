// Validação e máscara de telefone brasileiro (DDD + número, apenas dígitos).
// Formatos aceitos: (11) 91234-5678 (celular, 11 dígitos) e (11) 1234-5678
// (fixo, 10 dígitos). Sem código de país.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// 10 dígitos (fixo) ou 11 dígitos (celular). DDD entre 11 e 99.
export function isValidPhone(value) {
  const d = onlyDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false; // DDD válido começa em 11
  if (d.length === 11 && d[2] !== '9') return false; // celular começa com 9
  return true;
}

// Aplica a máscara conforme digita: (11) 91234-5678 / (11) 1234-5678.
export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}
