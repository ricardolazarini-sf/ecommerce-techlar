// Validação de CPF no servidor (autoridade final). Ambiente mock: validamos só
// o FORMATO (11 dígitos), sem os dígitos verificadores da Receita Federal.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // rejeita 000..., 111..., etc.
  return true;
}

export default { onlyDigits, isValidCPF };
