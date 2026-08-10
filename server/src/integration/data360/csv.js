// Gerador de CSV mínimo e sem dependências, com escaping correto (RFC 4180):
// campos com vírgula, aspas ou quebra de linha são envoltos em aspas e as aspas
// internas são duplicadas. Valores null/undefined viram string vazia.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: array de objetos; columns: ordem/whitelist das colunas a exportar.
export function toCSV(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(','));
  return [header, ...lines].join('\n') + '\n';
}

export default { toCSV };
