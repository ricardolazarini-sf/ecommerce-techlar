import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import { DrawnFrame, DrawnRule } from '../components/Drawn.jsx';
import { describedBy, looksLikeEmail } from '../lib/form.js';

// Mensagem de 4xx vem do servidor em português; 5xx e falha de rede não têm
// texto útil para quem está na tela, então recebem texto próprio.
function errorText(err) {
  if (err?.status === 401) {
    return 'E-mail ou senha incorretos. Confira os dois campos ou crie uma conta.';
  }
  if (err?.status >= 400 && err.status < 500) return err.message;
  return 'Não foi possível entrar: o serviço de contas não respondeu. Tente de novo em alguns instantes.';
}

// A conta que a loja semeia para quem está avaliando o site.
const DEMO = { email: 'demo@techlar.com', password: 'techlar123' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/perfil';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputs = useRef({});
  const bind = (name) => (el) => {
    inputs.current[name] = el;
  };

  const errorFor = (field) => errors[field] || '';

  const fillDemo = () => {
    setEmail(DEMO.email);
    setPassword(DEMO.password);
    setErrors({});
    setError('');
    inputs.current.password?.focus();
  };

  // Só o que é possível saber antes de perguntar ao servidor: campo vazio e
  // e-mail malformado. Se as credenciais estão erradas, quem diz é o 401.
  const validate = () => {
    const found = {};
    if (!email.trim()) found.email = 'Informe o e-mail da conta.';
    else if (!looksLikeEmail(email)) {
      found.email = 'E-mail inválido. Confira o endereço e digite de novo.';
    }
    if (!password) found.password = 'Informe a senha da conta.';
    return found;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const found = validate();
    setErrors(found);
    const first = ['email', 'password'].find((field) => found[field]);
    if (first) {
      inputs.current[first]?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card">
      <DrawnFrame />

      <div className="acc-auth-head">
        <span className="acc-auth-mark">
          <Icon name="lock" />
        </span>
        <div>
          <h1 className="acc-auth-title">Entrar</h1>
          <p className="acc-auth-lead">
            Sua conta reúne os pedidos, as garantias estendidas e os serviços contratados.
          </p>
        </div>
      </div>
      <DrawnRule className="acc-auth-rule acc-auth-rule-head" />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="form-grid acc-auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            ref={bind('email')}
            type="email"
            required
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={errorFor('email') ? 'true' : undefined}
            aria-describedby={describedBy(errorFor('email') && 'email-erro')}
          />
          {errorFor('email') && (
            <span className="acc-field-error" id="email-erro" role="alert">
              {errorFor('email')}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Senha</label>
          <div className="acc-pass">
            <input
              id="password"
              ref={bind('password')}
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={errorFor('password') ? 'true' : undefined}
              aria-describedby={describedBy(errorFor('password') && 'password-erro')}
            />
            <button
              type="button"
              className="acc-pass-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
          {errorFor('password') && (
            <span className="acc-field-error" id="password-erro" role="alert">
              {errorFor('password')}
            </span>
          )}
        </div>

        <button className="btn btn-primary btn-block btn-lg" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="acc-demo">
        <p className="acc-demo-text">Conta de demonstração</p>
        <button type="button" className="btn btn-outline btn-sm acc-demo-fill" onClick={fillDemo}>
          Preencher os campos
        </button>
      </div>

      <DrawnRule className="acc-auth-rule acc-auth-rule-foot" />
      <div className="acc-auth-foot">
        <span className="acc-auth-foot-label">Ainda não tem conta?</span>
        <Link to="/cadastro" state={{ from }} className="acc-auth-link">
          Criar conta
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
