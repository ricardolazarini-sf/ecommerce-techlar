import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import Icon from '../components/Icon.jsx';
import { track } from '../lib/track.js';
import { formatPrice } from '../lib/format.js';

// A faixa de combos: os anúncios entre o hero e as categorias, um por vez, num
// carrossel que anda para o lado.
//
// A assinatura da seção é a trilha dentro do slide — ela liga os produtos do
// combo e o percentual mora no nó da junção, onde os dois se encontram. A régua
// de controle embaixo é a mesma trilha em outro papel: um trecho por promoção,
// nó no começo de cada um, e o trecho da promoção em cartaz se preenche de latão
// enquanto ela está em cartaz. Assim a régua diz duas coisas de uma vez — onde
// você está e quanto falta para virar — em vez de três bolinhas decorativas.
//
// O slide é largo (arte de 3:2 ao lado do texto) contra o palco quadrado do
// cartão de produto: anúncio se distingue de mercadoria à primeira vista, sem
// precisar de etiqueta "publicidade".

// Quanto cada promoção fica em cartaz. Tempo de ler título, descrição e preço
// sem correr; abaixo disso o carrossel decide pelo leitor.
const CARTAZ = 7000;

function useMovimentoReduzido() {
  const consulta = '(prefers-reduced-motion: reduce)';
  const [reduz, setReduz] = useState(() => window.matchMedia?.(consulta).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return undefined;
    const ouvir = () => setReduz(mq.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, []);
  return reduz;
}

function ComboSlide({ combo, rotulo }) {
  const { addItem } = useCart();
  const [state, setState] = useState('idle');

  // O clique no anúncio é a razão de a faixa existir: é a ponta do funil
  // clique -> combo_qualified -> order_placed.
  const clicked = (action) =>
    track('combo_clicked', {
      combo_id: combo.slug,
      discount: combo.percent,
      total: combo.from_discounted,
      action,
      surface: 'home',
    });

  const build = async () => {
    clicked('montar');
    setState('working');
    try {
      for (const produto of combo.produtos) {
        // Em série: o carrinho é um recurso só, e duas escritas simultâneas na
        // mesma linha disputariam a mesma quantidade.
        await addItem(produto.id, 1, { surface: 'combo' });
      }
      setState('done');
    } catch {
      setState('error');
    }
  };

  const label = {
    idle: 'Montar combo',
    working: 'Montando',
    done: 'Combo no carrinho',
    error: 'Tentar de novo',
  }[state];

  return (
    <article className="home-combo" role="group" aria-roledescription="promoção" aria-label={rotulo}>
      <div className="home-combo-stage">
        {/* A cena traz as fotos reais dos produtos do combo (geradas por
            brand/combos/build-art.py), mas segue decorativa: os nomes estão no
            texto ao lado, e leitor de tela que anunciasse a imagem repetiria a
            mesma lista duas vezes. */}
        <img
          className="home-combo-art"
          src={combo.imagem_url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width="900"
          height="600"
        />
      </div>

      <div className="home-combo-body">
        <h3 className="home-combo-title">{combo.nome}</h3>
        <p className="home-combo-rule">{combo.regra}</p>
        {combo.descricao && <p className="home-combo-desc">{combo.descricao}</p>}

        {/* A trilha: sai do primeiro produto, corre a 90° e chega no último; o
            percentual fica no nó da junção. */}
        <div className="home-combo-link" style={{ '--combo-n': combo.produtos.length }}>
          <span className="home-combo-bridge" aria-hidden="true">
            {combo.produtos.slice(1, -1).map((produto, i) => (
              <span
                className="home-combo-stem"
                key={produto.id}
                style={{ '--combo-i': i + 1 }}
              />
            ))}
            <span className="home-combo-percent">{combo.percent}%</span>
          </span>
          <span className="home-combo-parts">
            {combo.produtos.map((produto) => (
              <span className="home-combo-part" key={produto.id}>
                {produto.nome}
              </span>
            ))}
          </span>
        </div>

        <p className="home-combo-from">
          <span className="home-combo-from-label">a partir de</span>
          <span className="price home-combo-price">{formatPrice(combo.from_discounted)}</span>
          <span className="home-combo-was">{formatPrice(combo.from)}</span>
        </p>

        <div className="home-combo-acts">
          <button
            type="button"
            className="btn btn-primary home-combo-add"
            onClick={build}
            disabled={state === 'working'}
          >
            <Icon name={state === 'done' ? 'check' : 'cart'} size={18} />
            {label}
          </button>
          {state === 'done' ? (
            <Link to="/carrinho" className="home-combo-see">
              Ver carrinho
              <Icon name="arrowRight" size={16} />
            </Link>
          ) : (
            <Link
              to={`/produtos?combo=${combo.slug}`}
              className="home-combo-see"
              onClick={() => clicked('vitrine')}
            >
              Escolher os produtos
              <Icon name="arrowRight" size={16} />
            </Link>
          )}
        </div>
        {state === 'error' && (
          <p className="home-combo-note" role="alert">
            O combo não entrou no carrinho: a conexão com a TechLar falhou.
          </p>
        )}
      </div>
    </article>
  );
}

function ComboCarousel({ combos }) {
  const trilho = useRef(null);
  const pendente = useRef(false);
  const [atual, setAtual] = useState(0);
  const [seguraMouse, setSeguraMouse] = useState(false);
  const [naTela, setNaTela] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState(true);
  const reduz = useMovimentoReduzido();

  // Rolagem nativa com scroll-snap em vez de um trilho movido por transform: o
  // arrasto no telefone, a inércia e o teclado vêm de graça, e o navegador
  // resolve o que fazer quando o foco cai num slide que está fora da vista.
  const irPara = useCallback(
    (i, suave = true) => {
      const t = trilho.current;
      const alvo = t?.children?.[i];
      if (!t || !alvo) return;
      const salto = alvo.getBoundingClientRect().left - t.getBoundingClientRect().left;
      t.scrollTo({ left: t.scrollLeft + salto, behavior: suave && !reduz ? 'smooth' : 'auto' });
    },
    [reduz],
  );

  // Quem manda no indicador é a posição real da rolagem, não um contador
  // paralelo: arrastar com o dedo também tem de acender o trecho certo.
  const aoRolar = () => {
    if (pendente.current) return;
    pendente.current = true;
    requestAnimationFrame(() => {
      pendente.current = false;
      const t = trilho.current;
      if (!t) return;
      const base = t.getBoundingClientRect().left;
      let perto = 0;
      let menor = Infinity;
      [...t.children].forEach((slide, i) => {
        const dist = Math.abs(slide.getBoundingClientRect().left - base);
        if (dist < menor) {
          menor = dist;
          perto = i;
        }
      });
      setAtual(perto);
    });
  };

  const andando = combos.length > 1 && !reduz && !seguraMouse && naTela && abaAtiva;

  // O relógio é reiniciado por `atual`: navegar à mão (seta, trecho da régua ou
  // dedo) dá o tempo cheio de leitura no slide novo em vez de virar na sobra do
  // anterior.
  useEffect(() => {
    if (!andando) return undefined;
    const id = setTimeout(() => irPara((atual + 1) % combos.length), CARTAZ);
    return () => clearTimeout(id);
  }, [andando, atual, combos.length, irPara]);

  // Fora da vista não anda: quem volta a rolar até a faixa a encontra onde
  // deixou, e não três promoções adiante.
  useEffect(() => {
    const t = trilho.current;
    if (!t || typeof IntersectionObserver === 'undefined') return undefined;
    const olho = new IntersectionObserver(([entrada]) => setNaTela(entrada.isIntersecting), {
      threshold: 0.4,
    });
    olho.observe(t);
    return () => olho.disconnect();
  }, []);

  useEffect(() => {
    const ouvir = () => setAbaAtiva(!document.hidden);
    document.addEventListener('visibilitychange', ouvir);
    return () => document.removeEventListener('visibilitychange', ouvir);
  }, []);

  // Só o mouse segura o carrossel: no toque, `pointerenter` dispara no primeiro
  // toque e nunca solta, e a faixa ficaria parada para sempre depois de um
  // arrasto. Quem arrasta já mexeu em `atual`, o que reinicia o relógio.
  const talvezSegurar = (e, segura) => {
    if (e.pointerType === 'mouse') setSeguraMouse(segura);
  };

  return (
    <div
      className="home-carousel"
      role="group"
      aria-roledescription="carrossel"
      aria-label="Combos com desconto"
      onPointerEnter={(e) => talvezSegurar(e, true)}
      onPointerLeave={(e) => talvezSegurar(e, false)}
      onFocusCapture={() => setSeguraMouse(true)}
      onBlurCapture={() => setSeguraMouse(false)}
    >
      <div className="home-carousel-track" ref={trilho} onScroll={aoRolar}>
        {combos.map((combo, i) => (
          <ComboSlide
            key={combo.slug}
            combo={combo}
            rotulo={`${i + 1} de ${combos.length}: ${combo.nome}`}
          />
        ))}
      </div>

      {combos.length > 1 && (
        <div className="home-carousel-bar">
          <button
            type="button"
            className="home-carousel-arrow"
            onClick={() => irPara((atual - 1 + combos.length) % combos.length)}
            aria-label="Promoção anterior"
          >
            <Icon name="chevronLeft" size={18} />
          </button>

          <div className="home-carousel-rail">
            {combos.map((combo, i) => (
              <button
                type="button"
                key={combo.slug}
                className={`home-carousel-tick${i === atual ? ' is-atual' : ''}`}
                onClick={() => irPara(i)}
                aria-label={combo.nome}
                aria-current={i === atual ? 'true' : undefined}
              >
                <span className="home-carousel-tick-line" aria-hidden="true">
                  {i === atual && (
                    <span
                      // A chave reinicia a animação a cada virada; sem ela o
                      // preenchimento continuaria de onde parou no trecho anterior.
                      key={atual}
                      className="home-carousel-tick-fill"
                      style={{
                        animationDuration: `${CARTAZ}ms`,
                        animationPlayState: andando ? 'running' : 'paused',
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="home-carousel-arrow"
            onClick={() => irPara((atual + 1) % combos.length)}
            aria-label="Próxima promoção"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ComboBand({ combos = [] }) {
  if (!combos.length) return null;

  return (
    <section className="home-section">
      <div className="section-head">
        <h2>Combos com desconto</h2>
      </div>
      <p className="home-combo-lead">
        O desconto entra sozinho no carrinho quando o combo se completa — não precisa de cupom.
        Produto em combo já sai com desconto, então ele não recebe garantia estendida.
      </p>
      <ComboCarousel combos={combos} />
    </section>
  );
}
