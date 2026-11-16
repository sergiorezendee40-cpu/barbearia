import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErroApi } from '../lib/api.js';

export default function Login() {
  const { usuario, verificando, entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!verificando && usuario) return <Navigate to="/" replace />;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.textoParaTela : 'Não foi possível entrar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-[6rem_minmax(0,1fr)] lg:grid-cols-[9rem_minmax(0,1fr)]">
      {/* O poste: uma faixa estreita na lateral (no celular, no topo) */}
      <div aria-hidden="true" className="poste-forte hidden md:block" />
      <div className="poste-forte h-3 md:hidden" aria-hidden="true" />

      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16 lg:px-24">
        <h1 className="font-display text-6xl font-semibold leading-[0.9] sm:text-7xl">Agenda da barbearia</h1>
        <p className="mt-4 max-w-[34ch] text-suave">Entre para ver os horários do dia e marcar clientes.</p>

        <form onSubmit={enviar} className="mt-10 max-w-sm space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="rotulo">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="senha" className="rotulo">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="campo"
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-md border border-perigo/60 px-3 py-2.5 text-sm text-perigo">
              {erro}
            </p>
          )}

          <button type="submit" disabled={enviando || !email || !senha} className="btn btn-ouro w-full">
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
