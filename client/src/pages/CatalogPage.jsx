import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import Loader from '../components/Loader.jsx';
import { categoryLabel } from '../lib/format.js';

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const categoria = params.get('categoria') || '';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCategories()
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .getProducts({ q: q || undefined, categoria: categoria || undefined })
      .then((d) => active && setProducts(d.products))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, categoria]);

  const selectCategory = (cat) => {
    const next = new URLSearchParams(params);
    if (cat) next.set('categoria', cat);
    else next.delete('categoria');
    setParams(next);
  };

  const title = q
    ? `Resultados para “${q}”`
    : categoria
      ? categoryLabel(categoria)
      : 'Todos os produtos';

  return (
    <>
      <div className="section-head">
        <h2>{title}</h2>
        {!loading && <span className="muted">{products.length} produto(s)</span>}
      </div>

      <div className="filters">
        <button
          className={`filter-chip ${!categoria ? 'active' : ''}`}
          onClick={() => selectCategory('')}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.categoria}
            className={`filter-chip ${categoria === c.categoria ? 'active' : ''}`}
            onClick={() => selectCategory(c.categoria)}
          >
            {categoryLabel(c.categoria)}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Loader />
      ) : products.length ? (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="big">🔍</div>
          <h3>Nenhum produto encontrado</h3>
          <p>Tente outra busca ou categoria.</p>
        </div>
      )}
    </>
  );
}
