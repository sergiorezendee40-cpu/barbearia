import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const AvisosContext = createContext(() => {});

/** Mensagens rápidas ("Agendamento criado."). Somem sozinhas e são lidas por leitores de tela. */
export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const proximoId = useRef(1);

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = proximoId.current++;
    setAvisos((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), 4500);
  }, []);

  const valor = useMemo(() => avisar, [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end lg:px-0"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`pointer-events-auto max-w-md rounded-md border px-4 py-3 text-sm font-medium shadow-lg ${
              a.tipo === 'erro'
                ? 'border-perigo/60 bg-grafite text-perigo'
                : 'border-ouro/60 bg-grafite text-marfim'
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export const useAvisos = () => useContext(AvisosContext);
