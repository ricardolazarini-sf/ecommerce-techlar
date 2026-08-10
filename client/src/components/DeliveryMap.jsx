import { useEffect, useRef, useState } from 'react';
import { formatDayMonth, formatTime } from '../lib/format.js';

// O mapa da entrega é uma placa de circuito, e não um mapa emprestado de outro
// lugar: a linguagem da marca são trilhas de 90°/45° com nós de solda, que é o
// desenho de um traçado de ruas visto de cima. As ruas são hairline, a rota é a
// trilha em latão, o trecho que falta é tracejado, e o destino é a casa do logo —
// o percurso conecta duas coisas com relação real, que é a única licença que
// DESIGN.md dá para trilha.

// Rota do centro de distribuição até a casa. Só curvas de 90° e 45°, como toda
// trilha da marca: os pares de deslocamento iguais (32/32, 24/24) são o que
// garante os 45° exatos.
const ROUTE = 'M34 118 H96 L128 86 H208 L232 62 H296';

// As duas pontas do percurso, na mesma gramática do hero: sem linha de base,
// apoiadas na linha que já existe embaixo delas — o galpão na própria rota, a casa
// na rua em que a rota continua depois do fim do trecho útil. Galpão é caixa de
// teto reto, casa tem telhado a 45° e porta: o contraste entre os dois é o que
// conta a história do percurso.
const DEPOT = 'M14 118 V102 H54 V118';
const HOUSE = 'M300 62 V42 L320 22 L340 42 V62';
const HOUSE_DOOR = 'M315 62 V52 H325 V62';

// Ruas: nenhuma passa por dentro das construções, e as que cruzam a rota cruzam
// como cruzamento de rua mesmo. Sem grade completa de propósito — mapa cheio de
// linha é ruído, e o que precisa ser lido aqui é a rota. As duas últimas são o chão
// do galpão e o da casa: a rota vindo de antes e continuando depois, como rua.
const STREETS = [
  'M0 30 H240',
  'M0 46 H150',
  'M170 100 H356',
  'M0 134 H356',
  'M60 0 V150',
  'M150 0 V70',
  'M150 100 V150',
  'M210 0 V46',
  'M270 76 V150',
  'M240 150 L286 104',
  'M0 92 L32 60',
  'M0 118 H34',
  'M296 62 H356',
];

// Fração da rota já percorrida. Um número só manda no desenho: ele para a trilha
// de latão (via --co-run-rest) e posiciona o nó de "em trânsito", que é medido no
// próprio caminho em vez de ser uma coordenada escrita à mão que sai de lugar a
// cada ajuste da rota.
const PROGRESS = 0.55;

// Prazo simulado: três dias depois da compra.
const ETA_DAYS = 3;

export default function DeliveryMap({ sentAt, city }) {
  const road = useRef(null);
  const [head, setHead] = useState(null);

  useEffect(() => {
    const path = road.current;
    if (!path || typeof path.getTotalLength !== 'function') return;
    const point = path.getPointAtLength(path.getTotalLength() * PROGRESS);
    setHead({ x: point.x, y: point.y });
  }, []);

  // Previsão três dias depois do envio, e nunca no passado: pedido antigo aberto
  // pela URL mostraria uma "previsão" de uma data que já passou.
  const sent = sentAt ? new Date(sentAt) : new Date();
  const eta = new Date(Math.max(sent.getTime() + ETA_DAYS * 864e5, Date.now() + 864e5));

  return (
    <div className="co-map">
      <svg className="co-map-svg" viewBox="0 0 356 150" focusable="false" aria-hidden="true">
        {STREETS.map((d) => (
          <path className="co-map-street" key={d} d={d} />
        ))}

        <path ref={road} className="co-map-road" d={ROUTE} />
        <path className="co-map-run" pathLength="1" d={ROUTE} style={{ '--co-run-rest': 1 - PROGRESS }} />
        <path className="co-map-pulse" pathLength="1" d={ROUTE} />

        <path className="co-map-depot" pathLength="1" d={DEPOT} />
        <path className="co-map-home" pathLength="1" d={HOUSE} />
        <path className="co-map-home co-map-home-door" pathLength="1" d={HOUSE_DOOR} />

        <circle className="co-map-node" cx="34" cy="118" r="3" />
        {head && <circle className="co-map-truck" cx={head.x} cy={head.y} r="5" />}
      </svg>

      {/* O desenho é decorativo; quem carrega a informação é esta lista. */}
      <ol className="co-map-stops">
        <li className="co-map-stop co-map-stop-done">
          <span className="co-map-stop-label">Enviado</span>
          <span className="co-map-stop-detail">Centro TechLar, {formatTime(sent)}</span>
        </li>
        {/* Sem "agora" no texto: o nó em latão é o que diz que esta é a parada de
            agora, e dizer duas vezes é dizer que o desenho não bastou. */}
        <li className="co-map-stop co-map-stop-now" aria-current="step">
          <span className="co-map-stop-label">Em trânsito</span>
          <span className="co-map-stop-detail">Saiu para entrega</span>
        </li>
        <li className="co-map-stop">
          <span className="co-map-stop-label">Sua casa</span>
          <span className="co-map-stop-detail">
            {city ? `${city}, ` : ''}previsão {formatDayMonth(eta)}
          </span>
        </li>
      </ol>
    </div>
  );
}
