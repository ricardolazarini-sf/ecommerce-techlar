// Conjunto único de ícones do site. Traço de 1.5px em currentColor, grade de 24px.
// Emoji não é ícone: use sempre <Icon name="..." />. Ver styles/DESIGN.md.

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" /></>,
  cart: (
    <>
      <path d="M3 4h2l2.4 10.5a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </>
  ),
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /></>,
  heart: <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
  arrowRight: <path d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  shield: <><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  tool: <path d="M14.5 3.5a4.5 4.5 0 0 0 5.7 5.9L21 8.6 15.4 3l-.9.5zM13 8L4 17v3h3l9-9" />,
  truck: <><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></>,
  home: <path d="M4 11l8-6.5 8 6.5M6.5 9.8V20h11V9.8" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plug: <path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21" />,
  package: <><path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z" /><path d="M4 7.2l8 4.3 8-4.3M12 11.5V21" /></>,
  eye: (
    <>
      <path d="M12 5.5c5 0 8.8 4.4 9.8 6.5-1 2.1-4.8 6.5-9.8 6.5S3.2 14.1 2.2 12C3.2 9.9 7 5.5 12 5.5z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M12 5.5c5 0 8.8 4.4 9.8 6.5-1 2.1-4.8 6.5-9.8 6.5S3.2 14.1 2.2 12C3.2 9.9 7 5.5 12 5.5z" />
      <path d="M4.5 4.5l15 15" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = '' }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
