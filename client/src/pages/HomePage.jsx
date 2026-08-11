import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { categoryLabel } from '../lib/format.js';

// Os dois diferenciais da TechLar — o que ela faz que um marketplace não faz.
// Entrega e rastreio ficam de fora de propósito: são o mínimo de qualquer loja e
// diluiriam justamente o argumento que esta faixa existe para fazer.
const PROMISES = [
  {
    icon: 'tool',
    title: 'Instalação profissional',
    text: 'Um técnico vai até você, configura os aparelhos e só encerra quando tudo está funcionando.',
  },
  {
    icon: 'shield',
    title: 'Garantia estendida',
    text: 'Some 12 meses de cobertura contra defeito de fabricação ao fechar a compra.',
  },
];

// A assinatura do site: a casa da marca sendo energizada. A energia entra pela
// borda de cima, os dados pela borda da direita, as duas trilhas se encontram
// no núcleo e a casa acende. A base da casa é a hairline da faixa de baixo —
// o desenho se apoia na estrutura da própria página. Animação em home.css.
function HouseCircuit() {
  return (
    <div className="home-figure" aria-hidden="true">
      <svg className="home-figure-svg" viewBox="0 0 480 400" focusable="false">
        <path className="home-house" pathLength="1" d="M100 400 V240 L240 100 L380 240 V400" />

        <path className="home-detail" pathLength="1" d="M100 320 H380" />
        <path className="home-detail" pathLength="1" d="M240 320 V400" />
        <path className="home-detail" pathLength="1" d="M305 400 V350 H350 V400" />
        <path className="home-detail" pathLength="1" d="M135 258 H185 V298 H135 V258" />

        <path
          className="home-trace home-trace-power"
          pathLength="1"
          d="M50 0 V160 L115 225 V370 H240 V280"
        />
        <path
          className="home-trace home-trace-data"
          pathLength="1"
          d="M480 150 H380 L335 195 V280 H240"
        />
        <path className="home-trace home-trace-branch" pathLength="1" d="M240 280 V185" />
        <path className="home-trace home-trace-branch" pathLength="1" d="M240 370 H290" />

        <circle className="home-node" cx="115" cy="225" r="2.5" style={{ '--home-i': '0' }} />
        <circle className="home-node" cx="335" cy="195" r="2.5" style={{ '--home-i': '1' }} />
        <circle className="home-node" cx="160" cy="370" r="2.5" style={{ '--home-i': '2' }} />
        <circle className="home-node" cx="240" cy="370" r="2.5" style={{ '--home-i': '3' }} />
        <circle className="home-node" cx="240" cy="185" r="2.5" style={{ '--home-i': '9' }} />
        <circle className="home-node" cx="290" cy="370" r="2.5" style={{ '--home-i': '10' }} />

        <circle
          className="home-node home-node-core"
          cx="240"
          cy="280"
          r="3"
          style={{ '--home-i': '11' }}
        />
        <circle className="home-node-ring" cx="240" cy="280" r="3" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
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
  }, [attempt]);

  const ready = !loading && !error;

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-main">
          <div className="home-hero-copy">
            <p className="eyebrow">Loja de tecnologia para a casa</p>
            <h1 className="home-hero-title">Entregamos, instalamos e garantimos.</h1>
            <p className="home-hero-lead">
              Smartphones, notebooks, impressoras 3D e periféricos — com instalação profissional e
              garantia estendida no mesmo pedido.
            </p>
            <div className="home-hero-cta">
              <Link to="/produtos" className="btn btn-primary btn-lg">
                Ver o catálogo
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/produtos?categoria=smartphones" className="btn btn-outline btn-lg">
                Ver smartphones
              </Link>
            </div>
          </div>

          <HouseCircuit />
        </div>

        <ul className="home-promises" role="list">
          {PROMISES.map((p) => (
            <li className="home-promise" key={p.icon}>
              <span className="home-promise-icon">
                <Icon name={p.icon} size={18} />
              </span>
              <span className="home-promise-body">
                <span className="home-promise-title">{p.title}</span>
                <span className="home-promise-text">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {ready && categories.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2>Categorias</h2>
          </div>
          <div className="home-cats">
            {categories.map((c) => (
              <Link
                key={c.categoria}
                to={`/produtos?categoria=${c.categoria}`}
                className="home-cat"
              >
                <span className="home-cat-body">
                  <span className="home-cat-name">{categoryLabel(c.categoria)}</span>
                  <span className="home-cat-count">
                    {c.count} {Number(c.count) === 1 ? 'produto' : 'produtos'}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="home-cat-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-head">
          <h2>Destaques</h2>
          {ready && featured.length > 0 && (
            <Link to="/produtos" className="home-more">
              Ver todo o catálogo
              <Icon name="arrowRight" size={18} />
            </Link>
          )}
        </div>

        {loading && <Loader label="Carregando o catálogo..." />}

        {!loading && error && (
          <div className="alert alert-error home-error" role="alert">
            <p className="home-error-title">
              O catálogo não respondeu. Tente de novo em alguns instantes.
            </p>
            <p className="home-error-detail">Resposta do servidor: {error}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              Tentar de novo
            </button>
          </div>
        )}

        {ready && featured.length === 0 && (
          <div className="empty-state">
            <div className="big">
              <Icon name="package" size={24} />
            </div>
            <h3>Nenhum produto em destaque agora</h3>
            <p>O catálogo completo continua aberto para você navegar.</p>
            <Link to="/produtos" className="btn btn-primary">
              Ver todo o catálogo
            </Link>
          </div>
        )}

        {ready && featured.length > 0 && (
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
