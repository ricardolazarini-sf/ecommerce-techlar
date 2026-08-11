const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatPrice = (value) => BRL.format(Number(value) || 0);

// Garantia estendida do PEDIDO: incide sobre a base garantível que o servidor
// informa (subtotal menos serviços e menos linhas em promoção), não sobre o item.
export const WARRANTY_RATE = Number(import.meta.env.VITE_WARRANTY_RATE ?? 0.03);

export const warrantyFee = (base, rate = WARRANTY_RATE) =>
  Math.round(Number(base || 0) * Number(rate || WARRANTY_RATE) * 100) / 100;

// Serviço não recebe garantia estendida — a mesma regra que o servidor aplica na
// base dos 3%, aqui só para a tela poder explicar.
export const isServiceItem = (item) =>
  item?.categoria === 'servicos' || String(item?.sku || '').toUpperCase().startsWith('SVC-');

export const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
};

// Hora sozinha (comprovante de pagamento) e dia/mês sozinho (previsão de
// entrega): nos dois casos a data completa é informação que ninguém pediu.
export const formatTime = (iso) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '';
  }
};

export const formatDayMonth = (iso) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
};

const CATEGORY_LABELS = {
  smartphones: 'Smartphones',
  notebooks: 'Notebooks',
  'impressoras-3d': 'Impressoras 3D',
  perifericos: 'Periféricos',
  monitores: 'Monitores',
  'casa-inteligente': 'Casa Inteligente',
  redes: 'Redes',
  armazenamento: 'Armazenamento',
  servicos: 'Serviços',
};

export const categoryLabel = (slug) =>
  CATEGORY_LABELS[slug] || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '');
