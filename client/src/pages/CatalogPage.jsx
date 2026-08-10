import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { categoryLabel } from '../lib/format.js';

const countLabel = (n) => `${n} ${n === 1 ? 'produto' : 'produtos'}`;

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const categoria = params.get('categoria') || '';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getCategories()
      .then((d) => active && setCategories(d.categories))
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, [attempt]);

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
  }, [q, categoria, attempt]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const showAll = () => setParams(new URLSearchParams());

  const total = categories.reduce((sum, c) => sum + (Number(c.count) || 0), 0);

  const mode = q ? 'Busca' : categoria ? 'Categoria' : 'Catálogo';
  const title = q
    ? `Resultados para “${q}”`
    : categoria
      ? categoryLabel(categoria)
      : 'Todos os produtos';

  // A barra de controles some por completo quando não há nada para controlar,
  // para não deixar uma régua solta acima da grade.
  const hasTools = Boolean(q) || Boolean(categoria) || categories.length > 0;

  const empty = q
    ? {
        title: `Nenhum produto corresponde a “${q}”`,
        help: 'Revise a escrita ou procure por outro termo. Você também pode navegar por categoria.',
      }
    : categoria
      ? {
          title: `Nenhum produto em ${categoryLabel(categoria)}`,
          help: 'Escolha outra categoria ou veja o catálogo completo.',
        }
      : {
          title: 'O catálogo ainda está vazio',
          help: 'Nenhum produto foi publicado até agora. Volte em breve.',
        };

  return (
    <>
      <header className="cat-head">
        <p className="eyebrow cat-eyebrow">{mode}</p>
        <div className="cat-head-row">
          <h2 className="cat-title">{title}</h2>
          {!loading && !error && <p className="cat-count">{countLabel(products.length)}</p>}
        </div>
      </header>

      {hasTools && (
        <div className="cat-tools">
          {(categories.length > 0 || categoria) && (
            <div className="cat-filters" role="group" aria-label="Filtrar por categoria">
              <button
                type="button"
                className={`cat-filter ${categoria ? '' : 'cat-filter-on'}`}
                aria-pressed={!categoria}
                onClick={() => setParam('categoria', '')}
              >
                Todas
                {total > 0 && <span className="cat-filter-count">{total}</span>}
              </button>
              {categories.map((c) => (
                <button
                  key={c.categoria}
                  type="button"
                  className={`cat-filter ${categoria === c.categoria ? 'cat-filter-on' : ''}`}
                  aria-pressed={categoria === c.categoria}
                  onClick={() => setParam('categoria', c.categoria)}
                >
                  {categoryLabel(c.categoria)}
                  <span className="cat-filter-count">{c.count}</span>
                </button>
              ))}
            </div>
          )}

          {q && (
            <button
              type="button"
              className="btn btn-ghost cat-clear"
              onClick={() => setParam('q', '')}
            >
              <Icon name="close" size={16} />
              Limpar busca
            </button>
          )}
        </div>
      )}

      {loading && <Loader label="Carregando produtos" />}

      {!loading && error && (
        <div className="alert alert-error cat-error" role="alert">
          <p className="cat-error-title">Não foi possível carregar o catálogo.</p>
          <p className="cat-error-help">
            O servidor não respondeu como esperado. Tente de novo em instantes.
          </p>
          <p className="cat-error-detail">{error}</p>
          <button
            type="button"
            className="btn btn-outline cat-error-action"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="empty-state">
          <div className="big">
            <Icon name="search" size={24} />
          </div>
          <h3>{empty.title}</h3>
          <p>{empty.help}</p>
          <div className="cat-empty-actions">
            {q && (
              <button type="button" className="btn btn-outline" onClick={() => setParam('q', '')}>
                Limpar busca
              </button>
            )}
            {(q || categoria) && (
              <button type="button" className="btn btn-primary" onClick={showAll}>
                Ver todos os produtos
              </button>
            )}
            {!q && !categoria && (
              <Link to="/" className="btn btn-primary">
                Voltar para a home
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
