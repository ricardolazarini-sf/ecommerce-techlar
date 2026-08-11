import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import { DrawnFrame, DrawnRule } from '../components/Drawn.jsx';
import CustomerFields, { useCustomerForm } from '../components/CustomerForm.jsx';

// Mensagem de 4xx vem do servidor em português; 5xx e falha de rede não têm
// texto útil para quem está na tela, então recebem texto próprio.
function errorText(err) {
  if (err?.status >= 400 && err.status < 500) return err.message;
  return 'Não foi possível criar a conta: o serviço de contas não respondeu. Tente de novo em alguns instantes.';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/perfil';

  const account = useCustomerForm();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!account.check()) return;

    setSubmitting(true);
    try {
      await register(account.payload());
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card acc-auth-wide">
      <DrawnFrame />

      <div className="acc-auth-head">
        <span className="acc-auth-mark">
          <Icon name="user" />
        </span>
        <div>
          <h1 className="acc-auth-title">Criar conta</h1>
          <p className="acc-auth-lead">
            Com a conta, você acompanha os pedidos e mantém as garantias estendidas no seu nome.
          </p>
        </div>
      </div>
      <DrawnRule className="acc-auth-rule acc-auth-rule-head" />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="acc-auth-form" onSubmit={submit} noValidate>
        <CustomerFields state={account} />

        <button className="btn btn-primary btn-block btn-lg acc-submit" disabled={submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <DrawnRule className="acc-auth-rule acc-auth-rule-foot" />
      <div className="acc-auth-foot">
        <span className="acc-auth-foot-label">Já tem conta?</span>
        <Link to="/login" state={{ from }} className="acc-auth-link">
          Entrar
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
