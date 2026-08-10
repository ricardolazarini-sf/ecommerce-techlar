// Validação e máscara de CPF (client-side, para UX). A validação de verdade
// também é feita no servidor — nunca confie só no front.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// Ambiente mock: valida só o FORMATO do CPF (11 dígitos), sem dígitos
// verificadores da Receita Federal.
export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // rejeita 000..., 111..., etc.
  return true;
}

// Aplica a máscara 000.000.000-00 conforme o usuário digita.
export function formatCPF(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
