import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { track } from '../lib/track.js';
import { formatPrice, categoryLabel } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    let active = true;
    api
      .getWishlist()
      .then((d) => active && setItems(d.items))
      .catch(() => {
        if (active) {
          setError(
            'Não foi possível carregar sua lista agora. Atualize a página em alguns instantes.',
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const remove = async (productId) => {
    setError('');
    setRemoving(productId);
    const item = items.find((i) => String(i.product_id) === String(productId));
    try {
      const d = await api.removeWishlist(productId);
      setItems(d.items);
      track('wishlist_toggled', {
        action: 'remove',
        product_id: productId,
        sku: item?.sku,
        nome: item?.nome,
        categoria: item?.categoria,
        preco: item?.preco,
        surface: 'wishlist',
      });
    } catch {
      setError('Não foi possível remover o produto agora. Tente de novo em alguns instantes.');
    } finally {
      setRemoving(null);
    }
  };

  const add = async (productId) => {
    setError('');
    setAdding(productId);
    try {
      await addItem(productId, 1, { surface: 'wishlist' });
    } catch {
      setError('Não foi possível adicionar ao carrinho agora. Tente de novo em alguns instantes.');
    } finally {
      setAdding(null);
    }
  };

  if (loading) return <Loader label="Carregando sua lista..." />;

  if (error && !items.length) {
    return (
      <>
        <div className="acc-page-head">
          <h1 className="acc-page-title">Lista de desejos</h1>
        </div>
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      </>
    );
  }

  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="big">
          <Icon name="heart" size={24} />
        </div>
        <h1 className="acc-empty-title">Nada salvo por aqui ainda</h1>
        <p className="acc-empty-text">
          Guarde os produtos que você está comparando. A lista mostra o preço atual de cada um e leva
          direto ao carrinho quando você decidir.
        </p>
        <div className="acc-empty-actions">
          <Link to="/produtos" className="btn btn-primary btn-lg">
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="acc-page-head">
        <h1 className="acc-page-title">Lista de desejos</h1>
        <p className="acc-page-lead">
          {items.length === 1
            ? '1 produto guardado para comparar e decidir.'
            : `${items.length} produtos guardados para comparar e decidir.`}
        </p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="panel">
        <ul className="acc-list">
          {items.map((p) => (
            <li className="acc-wish-row" key={p.product_id}>
              {/* A miniatura repete o link do nome: fica fora da ordem de
                  tabulação para não anunciar o mesmo destino duas vezes. */}
              <Link
                to={`/produtos/${p.product_id}`}
                className="acc-wish-thumb-link"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ProductImage src={p.imagem_url} name={p.nome} className="acc-wish-thumb" />
              </Link>
              <div className="acc-wish-body">
                <span className="chip">{categoryLabel(p.categoria)}</span>
                <Link to={`/produtos/${p.product_id}`} className="acc-wish-name">
                  {p.nome}
                </Link>
              </div>
              <div className="acc-wish-side">
                <span className="price">{formatPrice(p.preco)}</span>
                <div className="acc-wish-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => add(p.product_id)}
                    disabled={adding === p.product_id}
                  >
                    {adding === p.product_id ? 'Adicionando...' : 'Adicionar ao carrinho'}
                  </button>
                  <Link to={`/produtos/${p.product_id}`} className="btn btn-outline">
                    Ver produto
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost acc-wish-remove"
                    onClick={() => remove(p.product_id)}
                    disabled={removing === p.product_id}
                    aria-label={`Remover ${p.nome} da lista`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
