import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import Loader from '../components/Loader.jsx';
import { categoryLabel } from '../lib/format.js';

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.getFeatured(), api.getCategories()])
      .then(([f, c]) => {
        if (active) {
          setFeatured(f.products);
          setCategories(c.categories);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <div className="tagline">O futuro na sua casa</div>
          <h1>Tecnologia que transforma o seu lar</h1>
          <p>
            Notebooks, monitores, periféricos e dispositivos de casa inteligente — com garantia
            estendida e instalação profissional.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link to="/produtos" className="btn btn-primary">
              Explorar catálogo
            </Link>
            <Link to="/produtos?categoria=casa-inteligente" className="btn btn-outline">
              Casa inteligente
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <span>🏠</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Loader label="Carregando destaques..." />
      ) : (
        <>
          {categories.length > 0 && (
            <div className="filters">
              {categories.map((c) => (
                <Link
                  key={c.categoria}
                  to={`/produtos?categoria=${c.categoria}`}
                  className="filter-chip"
                >
                  {categoryLabel(c.categoria)} <span className="muted">({c.count})</span>
                </Link>
              ))}
            </div>
          )}

          <div className="section-head">
            <h2>Destaques</h2>
            <Link to="/produtos" className="nav-link">
              Ver tudo →
            </Link>
          </div>
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
