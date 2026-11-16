import { useId } from 'react';

/**
 * Lista de horários livres como botões de rádio (teclado: setas e Tab funcionam).
 * `horarios === null` significa "carregando".
 */
export default function EscolhaDeHorario({ horarios, valor, onChange, vazio = 'Nenhum horário livre neste dia.' }) {
  const nome = useId();

  if (horarios === null) return <p className="text-sm text-suave">Buscando horários...</p>;
  if (horarios.length === 0) return <p className="text-sm text-suave">{vazio}</p>;

  return (
    <div role="radiogroup" aria-label="Horários livres" className="flex flex-wrap gap-2">
      {horarios.map((h) => (
        <label key={h} className="cursor-pointer">
          <input
            type="radio"
            name={nome}
            value={h}
            checked={valor === h}
            onChange={() => onChange(h)}
            className="peer sr-only"
          />
          <span className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-traco px-3 font-display text-xl font-semibold transition-colors hover:border-ouro peer-checked:border-ouro peer-checked:bg-ouro peer-checked:text-carvao peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ouro-claro">
            {h}
          </span>
        </label>
      ))}
    </div>
  );
}
