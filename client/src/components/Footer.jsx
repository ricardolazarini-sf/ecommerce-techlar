import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { categoryLabel } from '../lib/format.js';

// Categorias que existem no catálogo. Ficam aqui, e não na API, para o rodapé
// continuar navegável mesmo quando o catálogo não responde.
const CATEGORIES = ['smartphones', 'notebooks', 'impressoras-3d', 'perifericos'];

export default function Footer() {
  return (
    <footer className="shell-footer">
      <div className="container shell-foot-grid">
        <div className="shell-foot-brand">
          <img
            className="shell-logo"
            src="/logo.png"
            alt="TechLar"
            width="156"
            height="40"
            loading="lazy"
            decoding="async"
          />
          <p className="eyebrow">O futuro na sua casa</p>
          <p className="shell-foot-about">
            A TechLar vende tecnologia para a casa: smartphones, notebooks, impressoras 3D e
            periféricos, com instalação profissional e garantia estendida.
          </p>
        </div>

        <nav className="shell-foot-col" aria-label="Comprar">
          <p className="eyebrow">Comprar</p>
          <Link className="shell-foot-link" to="/produtos">
            Todos os produtos
          </Link>
          <Link className="shell-foot-link" to="/carrinho">
            Carrinho
          </Link>
        </nav>

        <nav className="shell-foot-col" aria-label="Conta">
          <p className="eyebrow">Conta</p>
          <Link className="shell-foot-link" to="/login">
            Entrar
          </Link>
          <Link className="shell-foot-link" to="/cadastro">
            Criar conta
          </Link>
          <Link className="shell-foot-link" to="/lista-de-desejos">
            Lista de desejos
          </Link>
        </nav>

        <div className="shell-foot-col">
          <p className="eyebrow">Junto com o produto</p>
          <p className="shell-foot-item">
            <Icon name="tool" size={18} className="shell-foot-icon" />
            <span>
              <span className="shell-foot-item-name">Instalação profissional.</span> Um técnico
              configura os aparelhos na sua casa e deixa tudo funcionando.
            </span>
          </p>
          <p className="shell-foot-item">
            <Icon name="shield" size={18} className="shell-foot-icon" />
            <span>
              <span className="shell-foot-item-name">Garantia estendida.</span> Mais 12 meses de
              cobertura contra defeito de fabricação, somados no fechamento.
            </span>
          </p>
        </div>
      </div>

      <div className="container shell-foot-base">
        <p className="shell-foot-legal">
          © {new Date().getFullYear()} TechLar · Preços e estoque sujeitos a alteração.
        </p>
        <nav className="shell-foot-tags" aria-label="Categorias">
          {CATEGORIES.map((slug) => (
            <Link key={slug} className="shell-tag" to={`/produtos?categoria=${slug}`}>
              {categoryLabel(slug)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
