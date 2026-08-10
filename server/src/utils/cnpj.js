// Validação de CNPJ (dígitos verificadores) no servidor — autoridade final.
// 14 dígitos. Mesma lógica do client, mas nunca confie só no front.

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
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // rejeita 000..., 111..., etc.

  const d1 = checkDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(cnpj[12], 10)) return false;

  const d2 = checkDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d2 !== parseInt(cnpj[13], 10)) return false;

  return true;
}

export default { onlyDigits, isValidCNPJ };
