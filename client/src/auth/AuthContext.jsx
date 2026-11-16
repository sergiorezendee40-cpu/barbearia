import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, definirAoExpirar, guardarToken, temToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(temToken());

  const sair = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  // Se o servidor responder 401 em qualquer chamada, o login venceu: volta para a tela de entrada.
  useEffect(() => {
    definirAoExpirar(sair);
  }, [sair]);

  // Ao abrir a página com um token guardado, confere se ele ainda vale.
  useEffect(() => {
    if (!temToken()) return;
    let cancelado = false;
    api
      .eu()
      .then((u) => !cancelado && setUsuario(u))
      .catch(() => !cancelado && sair())
      .finally(() => !cancelado && setVerificando(false));
    return () => {
      cancelado = true;
    };
  }, [sair]);

  const entrar = useCallback(async (email, senha) => {
    const { token, usuario: u } = await api.login(email, senha);
    guardarToken(token);
    setUsuario(u);
  }, []);

  const valor = useMemo(() => ({ usuario, verificando, entrar, sair }), [usuario, verificando, entrar, sair]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
