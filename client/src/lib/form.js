// Utilidades compartilhadas pelos formulários de conta.

// Junta os ids de dica e de erro para o aria-describedby do campo. Devolve
// undefined quando não há nenhum, para o atributo não sair vazio no HTML.
export function describedBy(...ids) {
  return ids.filter(Boolean).join(' ') || undefined;
}

// Checagem de forma, não de existência: só evita o erro de digitação óbvio antes
// de gastar uma ida ao servidor. Quem diz se o endereço existe é o e-mail que
// chega — ou não chega.
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

// Unidades federativas, na ordem alfabética da sigla — é assim que se procura
// numa lista de UF.
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE',
  'TO',
];
