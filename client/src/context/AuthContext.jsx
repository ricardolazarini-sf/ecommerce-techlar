import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';
import { track } from '../lib/track.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken());
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Hydrate the customer profile from a persisted token on first load.
  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    api
      .me()
      .then((data) => {
        if (active) setCustomer(data.customer);
      })
      .catch(() => {
        // Token invalid/expired — drop it.
        setToken(null);
        if (active) {
          setTok(null);
          setCustomer(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // `identify` é a ponte entre o visitante anônimo e o perfil unificado: é o
  // evento que amarra o device_id (que já vinha nos cliques) a um e-mail. Fica
  // aqui, e não nas telas, porque o cadastro também nasce dentro do checkout.
  //
  // O e-mail vai no evento por conta do próprio coletor, que o lê do token — o
  // que mandamos é só o motivo e o tipo de cliente.
  const login = useCallback(async (credentials) => {
    const data = await api.login(credentials);
    setToken(data.token);
    setTok(data.token);
    setCustomer(data.customer);
    track('identify', { reason: 'login', action: data.customer?.tipo || '' });
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    setToken(data.token);
    setTok(data.token);
    setCustomer(data.customer);
    track('identify', { reason: 'cadastro', action: data.customer?.tipo || '' });
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setCustomer(null);
  }, []);

  const value = {
    token,
    customer,
    loading,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
    setCustomer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
