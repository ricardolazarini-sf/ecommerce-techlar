// Validação e máscara de CNPJ (client-side, para UX). A validação de verdade
// também roda no servidor.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function checkDigit(base, weights) {
  const sum = base
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const d1 = checkDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(cnpj[12], 10)) return false;
  const d2 = checkDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d2 !== parseInt(cnpj[13], 10)) return false;
  return true;
}

// Máscara 00.000.000/0000-00 conforme digita.
export function formatCNPJ(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// CEP 00000-000
export function formatCEP(value) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}
