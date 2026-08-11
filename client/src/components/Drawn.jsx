import { useEffect, useRef, useState } from 'react';

// Linhas que se desenham, com a mesma técnica da assinatura do hero: caminho com
// pathLength normalizado em 1, escondido pelo dasharray e revelado animando o
// offset até zero. Aqui em registro quieto — hairline em --rule, sem latão e sem
// nós. Tempo e ordem ficam no CSS de quem usa (ver account.css).

// Cada traço vem embrulhado num div, e é o div que recebe posição e sangria. O
// <svg> é elemento substituído: `inset` sozinho não o estica, e o Chrome
// descarta `calc()` com porcentagem na largura dele. O div não tem esses
// problemas, e o svg só precisa de 100% dentro dele.

// O caminho é montado em pixels reais, medidos do próprio svg. Esticar um
// viewBox transformaria os cantos do contorno em elipses, e o tracejado que
// revela o traço só é previsível quando 1 unidade de usuário é 1 pixel — com
// `vector-effect: non-scaling-stroke` o dasharray é recalculado em outro espaço
// e a linha sai picada.
function useBox() {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, box];
}

// Retângulo de cantos arredondados. O recuo de 0,5px centra o traço de 1px na
// aresta, no lugar exato onde a borda de CSS ficava.
function framePath(w, h, radius) {
  const width = w - 1;
  const height = h - 1;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = 0.5 + width;
  const bottom = 0.5 + height;
  return [
    `M${0.5 + r} 0.5`,
    `H${right - r}`,
    `A${r} ${r} 0 0 1 ${right} ${0.5 + r}`,
    `V${bottom - r}`,
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H${0.5 + r}`,
    `A${r} ${r} 0 0 1 0.5 ${bottom - r}`,
    `V${0.5 + r}`,
    `A${r} ${r} 0 0 1 ${0.5 + r} 0.5`,
  ].join(' ');
}

// Contorno do cartão, sobreposto ao elemento (que precisa de position relative).
// Substitui a borda de CSS: quem usa deixa a borda transparente para o traço não
// duplicar a linha.
export function DrawnFrame({ radius = 8 }) {
  const [ref, box] = useBox();
  const measured = box.w > 1 && box.h > 1;

  return (
    <div className="drawn-frame" aria-hidden="true">
      <svg ref={ref} className="drawn-svg" focusable="false">
        {measured && (
          <path className="drawn-path" pathLength="1" d={framePath(box.w, box.h, radius)} />
        )}
      </svg>
    </div>
  );
}

// Régua horizontal: divide seções dentro do cartão.
export function DrawnRule({ className = '' }) {
  const [ref, box] = useBox();

  return (
    <div className={`drawn-rule ${className}`.trim()} aria-hidden="true">
      <svg ref={ref} className="drawn-svg" focusable="false">
        {box.w > 1 && <path className="drawn-path" pathLength="1" d={`M0 0.5H${box.w}`} />}
      </svg>
    </div>
  );
}
