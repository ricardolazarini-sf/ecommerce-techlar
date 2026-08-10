// Validação de CNPJ no servidor (autoridade final). Ambiente mock: validamos só
// o FORMATO (14 dígitos), sem os dígitos verificadores da Receita Federal.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // rejeita 000..., 111..., etc.
  return true;
}

export default { onlyDigits, isValidCNPJ };
