// Validação e máscara de CNPJ (client-side, para UX). A validação de verdade
// também roda no servidor.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// Ambiente mock: valida só o FORMATO do CNPJ (14 dígitos), sem dígitos
// verificadores da Receita Federal.
export function isValidCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // rejeita 000..., 111..., etc.
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
