const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatPrice = (value) => BRL.format(Number(value) || 0);

export const WARRANTY_RATE = Number(import.meta.env.VITE_WARRANTY_RATE ?? 0.15);

export const warrantyFee = (unitPrice, qty = 1) =>
  Math.round(Number(unitPrice) * WARRANTY_RATE * qty * 100) / 100;

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
