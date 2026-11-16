/** Poste de barbeiro em miniatura + nome. O nome vem das configurações (nomeBarbearia). */
export function Poste({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2.5 shrink-0 rounded-full border border-ouro/70 ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(-45deg, var(--color-ouro) 0 5px, var(--color-marfim) 5px 10px)',
      }}
    />
  );
}

export default function Marca({ nome }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Poste className="h-7" />
      <span className="font-display text-2xl font-semibold leading-none">{nome}</span>
    </span>
  );
}
