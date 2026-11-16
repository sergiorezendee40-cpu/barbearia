import { useEffect, useId, useRef } from 'react';

/**
 * Janela de diálogo usando o <dialog> nativo do navegador: ele já prende o foco dentro,
 * fecha com Esc e deixa o resto da página inerte para leitores de tela.
 * Clicar fora (no fundo escuro) também fecha.
 */
export default function Dialogo({ titulo, subtitulo, onClose, children }) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-lg border border-traco p-0 shadow-2xl"
    >
      <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={idTitulo} className="font-display text-3xl font-semibold leading-none">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-1.5 text-sm text-suave">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-md text-suave hover:text-marfim"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
