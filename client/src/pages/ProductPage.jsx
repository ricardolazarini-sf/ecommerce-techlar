import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { track } from '../lib/track.js';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, categoryLabel, WARRANTY_RATE } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const WARRANTY_PCT = Math.round(WARRANTY_RATE * 100);

// Uma especificação mais longa que isto é frase, não dado: some da ficha e
// continua no texto corrido.
const SPEC_MAX = 44;

// A descrição do catálogo abre com uma frase de especificações separadas por
// vírgula ("IPS 27\" 4K UHD, 99% sRGB, USB-C com 90W de carga."). Quando ela
// tem esse formato, cada item vira uma linha da ficha técnica e o restante
// segue como texto. Quando não tem, nada é perdido: tudo vira texto.
function splitDescription(descricao) {
  const text = (descricao || '').trim();
  if (!text) return { specs: [], prose: '' };

  const cut = text.indexOf('. ');
  const head = cut === -1 ? text : text.slice(0, cut + 1);
  const tail = cut === -1 ? '' : text.slice(cut + 2).trim();

  const specs = head
    .replace(/\.$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (specs.length < 2 || specs.some((s) => s.length > SPEC_MAX)) {
    return { specs: [], prose: text };
  }
  return { specs, prose: tail };
}

export default function ProductPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  // De qual vitrine a pessoa veio. O cartão manda no state da rota; quem chegou
  // por link direto ou colando a URL entra como 'direto'.
  const surface = state?.surface || 'direto';

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [wished, setWished] = useState(false);
  const [buyOutOfSight, setBuyOutOfSight] = useState(false);
  const buyButton = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A barra fixa do telefone aparece quando o botão do painel já passou por cima
  // da tela — e não sempre que ele está fora dela. Antes do painel, o painel é o
  // próximo passo da rolagem e a barra estaria adiantando a decisão; depois dele,
  // não há mais como comprar sem voltar.
  //
  // Medido na rolagem, e não com IntersectionObserver: o observador só avisa
  // quando a fração visível cruza um limite, e num salto (voltar ao topo de uma
  // vez, restaurar posição ao voltar de página) o botão vai de "acima da tela"
  // para "abaixo da tela" sem cruzar nada — a barra ficava plantada com o painel
  // inteiro logo abaixo dela. O evento de rolagem já chega uma vez por quadro, e
  // ler o retângulo não suja o layout.
  useEffect(() => {
    const node = buyButton.current;
    if (!node) return;
    const check = () => setBuyOutOfSight(node.getBoundingClientRect().bottom < 0);
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [product?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getProduct(id)
      .then((d) => {
        if (!active) return;
        setProduct(d.product);
        // Emitido na resposta, não na montagem: só é visualização de produto se o
        // produto existir de verdade.
        track('product_viewed', {
          product_id: d.product.id,
          sku: d.product.sku,
          nome: d.product.nome,
          categoria: d.product.categoria,
          preco: d.product.preco,
          surface,
        });
      })
      .catch((e) => active && setError({ message: e.message, status: e.status }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getWishlist()
      .then((d) => setWished(d.items.some((i) => String(i.product_id) === String(id))))
      .catch(() => {});
  }, [id, isAuthenticated]);

  const announce = (tone, text) => {
    clearTimeout(timer.current);
    setFeedback({ tone, text });
    timer.current = setTimeout(() => setFeedback(null), 6000);
  };

  // `from` separa o botão do painel da barra fixa do telefone: são duas
  // decisões diferentes de comprar, e vale saber qual converte.
  const handleAdd = async (from = 'pdp') => {
    setAdding(true);
    try {
      await addItem(product.id, qty, { surface: from });
      announce('success', 'Adicionado ao carrinho.');
    } catch {
      announce('error', 'Não foi possível adicionar ao carrinho. Tente de novo em instantes.');
    } finally {
      setAdding(false);
    }
  };

  const toggleWish = async () => {
    try {
      if (wished) {
        await api.removeWishlist(product.id);
        setWished(false);
      } else {
        await api.addWishlist(product.id);
        setWished(true);
      }
      track('wishlist_toggled', {
        action: wished ? 'remove' : 'add',
        product_id: product.id,
        sku: product.sku,
        nome: product.nome,
        categoria: product.categoria,
        preco: product.preco,
        surface: 'pdp',
      });
    } catch {
      announce('error', 'Não foi possível atualizar a lista de desejos. Tente de novo.');
    }
  };

  if (loading) return <Loader label="Carregando produto" />;

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className="alert alert-error pdp-state" role="alert">
        <p className="pdp-state-title">
          {notFound ? 'Este produto não está mais no catálogo.' : 'Não foi possível abrir o produto.'}
        </p>
        <p className="pdp-state-help">
          {notFound
            ? 'O endereço pode ter mudado. Procure o produto no catálogo.'
            : 'O servidor não respondeu como esperado. Tente de novo em instantes.'}
        </p>
        {!notFound && <p className="pdp-state-detail">{error.message}</p>}
        <div className="pdp-state-actions">
          {!notFound && (
            <button type="button" className="btn btn-outline" onClick={() => setAttempt((n) => n + 1)}>
              Tentar de novo
            </button>
          )}
          <Link to="/produtos" className="btn btn-outline">
            Ver o catálogo
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const unitPrice = Number(product.preco) || 0;
  const total = unitPrice * qty;
  const { specs, prose } = splitDescription(product.descricao);
  const totalNote = `${formatPrice(unitPrice)} × ${qty}`;

  // Quando a compra sai da barra, o aviso do painel está fora da tela: a
  // confirmação vira o próprio botão que foi tocado, como no cartão do catálogo.
  const added = feedback?.tone === 'success';

  return (
    <>
      <nav className="breadcrumb pdp-crumbs" aria-label="Trilha de navegação">
        <Link to="/" className="pdp-crumb-link">
          Home
        </Link>
        <Icon name="chevronRight" size={14} className="pdp-crumb-sep" />
        <Link to={`/produtos?categoria=${product.categoria}`} className="pdp-crumb-link">
          {categoryLabel(product.categoria)}
        </Link>
        <Icon name="chevronRight" size={14} className="pdp-crumb-sep" />
        <span className="pdp-crumb-now" aria-current="page">
          {product.nome}
        </span>
      </nav>

      <header className="pdp-head">
        <h1 className="pdp-title">{product.nome}</h1>
        <p className="pdp-meta">
          <span className="pdp-sku">SKU {product.sku}</span>
          <span className="pdp-stock">Disponível para compra</span>
        </p>
      </header>

      <div className="pdp-grid">
        <div className="pdp-media">
          <ProductImage src={product.imagem_url} name={product.nome} className="pdp-shot" />
        </div>

        <div className="panel pdp-buy">
          <div className="pdp-price-row">
            <span className="price pdp-price">{formatPrice(unitPrice)}</span>
            {isAuthenticated && (
              <button
                type="button"
                className={`heart ${wished ? 'on' : ''}`}
                onClick={toggleWish}
                aria-pressed={wished}
                aria-label={wished ? 'Remover da lista de desejos' : 'Salvar na lista de desejos'}
              >
                <Icon name="heart" size={18} />
              </button>
            )}
          </div>

          {/* A garantia é da compra inteira, escolhida uma vez no carrinho: aqui
              ela só se apresenta, sem controle que dê a entender outra coisa. */}
          <div className="pdp-warranty">
            <span className="pdp-warranty-head">
              <Icon name="shield" size={18} className="pdp-warranty-icon" />
              <span className="pdp-warranty-title">Garantia estendida por 12 meses</span>
            </span>
            <span className="pdp-warranty-note">
              Cobre defeito de fabricação depois que a garantia do fabricante termina. Custa{' '}
              {WARRANTY_PCT}% da compra e você escolhe no carrinho, uma vez para o pedido todo.
            </span>
          </div>

          <div className="pdp-line">
            <span className="pdp-line-label">Quantidade</span>
            <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} />
          </div>

          <div className="pdp-line pdp-line-total">
            <span className="pdp-line-label">Total</span>
            <span className="pdp-total-value">
              <span className="price pdp-total">{formatPrice(total)}</span>
              {qty > 1 && <span className="pdp-total-note">{totalNote}</span>}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={() => handleAdd('pdp')}
            disabled={adding}
            ref={buyButton}
          >
            <Icon name="cart" size={18} />
            {adding ? 'Adicionando' : 'Adicionar ao carrinho'}
          </button>

          {feedback && (
            <div
              className={`alert ${feedback.tone === 'error' ? 'alert-error' : 'alert-success'} pdp-feedback`}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
            >
              <span>{feedback.text}</span>
              {feedback.tone === 'success' && (
                <Link to="/carrinho" className="pdp-feedback-link">
                  Ver carrinho
                  <Icon name="arrowRight" size={16} />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="pdp-info">
          {specs.length > 0 && (
            <div className="pdp-sheet">
              <p className="eyebrow">Ficha técnica</p>
              <ul className="pdp-specs">
                {specs.map((spec, i) => (
                  <li className="pdp-spec" key={`${i}-${spec}`}>
                    {spec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prose && <p className="pdp-desc">{prose}</p>}

          <div className="pdp-services">
            <p className="eyebrow">Serviços TechLar</p>
            <div className="pdp-service-pair">
              <div className="pdp-service">
                <Icon name="shield" size={20} className="pdp-service-icon" />
                <span className="pdp-service-title">Garantia estendida</span>
                <span className="pdp-service-note">
                  Mais 12 meses de cobertura por {WARRANTY_PCT}% da compra, escolhida uma vez no
                  carrinho. Produto em promoção fica fora.
                </span>
              </div>

              <div className="pdp-service">
                <Icon name="tool" size={20} className="pdp-service-icon" />
                <span className="pdp-service-title">Instalação profissional</span>
                <span className="pdp-service-note">
                  A equipe da TechLar entrega, instala e configura o produto na sua casa. Você
                  escolhe a instalação ao fechar o pedido.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {buyOutOfSight && (
        <>
          <div className="pdp-bar">
            {feedback?.tone === 'error' && (
              <p className="pdp-bar-note" aria-hidden="true">
                Não foi possível adicionar. Tente de novo.
              </p>
            )}
            <div className="pdp-bar-row">
              <span className="pdp-bar-sum">
                <span className="pdp-bar-label">Total</span>
                <span className="price pdp-bar-total">{formatPrice(total)}</span>
              </span>
              <button
                type="button"
                className="btn btn-primary btn-lg pdp-bar-add"
                onClick={() => handleAdd('barra-fixa')}
                disabled={adding}
              >
                <Icon name={added ? 'check' : 'cart'} size={18} />
                <span>
                  {added ? 'Adicionado' : adding ? 'Adicionando' : 'Adicionar'}
                  {!added && !adding && <span className="sr-only-narrow"> ao carrinho</span>}
                </span>
              </button>
            </div>
          </div>
          <div className="pdp-bar-space" aria-hidden="true" />
        </>
      )}
    </>
  );
}
