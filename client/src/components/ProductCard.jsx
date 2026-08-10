import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import Icon from './Icon.jsx';
import { formatPrice, categoryLabel } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';

// O rótulo vem partido em verbo e cauda: no cartão estreito de telefone não há
// largura para a frase inteira, e a cauda passa a existir só para quem ouve a
// tela (ver .sr-only-narrow em base.css).
const LABEL = {
  idle: ['Adicionar', ' ao carrinho'],
  loading: ['Adicionando', ''],
  done: ['Adicionado', ''],
  error: ['Adicionar', ' ao carrinho'],
};

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [status, setStatus] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleAdd = async () => {
    clearTimeout(timer.current);
    setStatus('loading');
    try {
      await addItem(product.id, 1);
      setStatus('done');
      timer.current = setTimeout(() => setStatus('idle'), 2400);
    } catch {
      setStatus('error');
    }
  };

  const href = `/produtos/${product.id}`;
  const [action, actionTail] = LABEL[status];

  return (
    <article className="card cat-card">
      {/* O nome, logo abaixo, já leva ao mesmo destino: a imagem sai da ordem de
          tabulação para não duplicar o alvo para teclado e leitor de tela. */}
      <Link to={href} className="cat-card-stage" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.imagem_url} name={product.nome} className="cat-card-shot" />
      </Link>

      <div className="cat-card-body">
        <span className="cat-card-cat">{categoryLabel(product.categoria)}</span>

        <Link to={href} className="cat-card-name" title={product.nome}>
          {product.nome}
        </Link>
      </div>

      <div className="cat-card-foot">
        {/* O preço fica onde antes havia um divisor de ponta a ponta: a régua
            começa nele e corre até a moldura, medindo o valor em vez de cortar o
            cartão em dois. */}
        <div className="cat-card-priceline">
          <span className="price">{formatPrice(product.preco)}</span>
          <span className="cat-card-rule" />
        </div>

        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={handleAdd}
          disabled={status === 'loading'}
        >
          <Icon name={status === 'done' ? 'check' : 'cart'} size={16} />
          <span>
            {action}
            <span className="sr-only-narrow">{actionTail}</span>
          </span>
        </button>

        {status === 'error' && (
          <p className="cat-card-note" role="alert">
            Não foi possível adicionar. Tente de novo.
          </p>
        )}
      </div>
    </article>
  );
}
