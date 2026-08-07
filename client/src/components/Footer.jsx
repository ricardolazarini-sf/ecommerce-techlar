export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="tag">O futuro na sua casa</div>
          <div>© {new Date().getFullYear()} TechLar — Tecnologia para a sua casa.</div>
        </div>
        <div className="muted">
          Notebooks · Periféricos · Monitores · Casa Inteligente · Redes
        </div>
      </div>
    </footer>
  );
}
