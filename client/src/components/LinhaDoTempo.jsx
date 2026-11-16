import { moeda } from '../lib/formatar.js';

// Altura de cada linha de 30 min. Um atendimento de 2 linhas (combo) ocupa o dobro,
// então o tamanho na tela mostra o tamanho do serviço.
const ALTURA = 60;
const LARGURA_HORA = '4rem';

function Bloco({ item, onAbrir }) {
  const { agendamento: a, linhaInicial, linhas } = item;
  const concluido = a.status === 'concluido';
  const nome = a.cliente?.nome ?? 'Cliente removido';

  return (
    <button
      type="button"
      onClick={() => onAbrir(a.id)}
      style={{ top: linhaInicial * ALTURA + 2, height: linhas * ALTURA - 4 }}
      className={`absolute inset-x-0 flex flex-col justify-center gap-0.5 overflow-hidden rounded-md border-l-4 px-3 text-left transition-colors ${
        concluido
          ? 'border-ok bg-grafite/70 hover:bg-grafite-2'
          : 'border-ouro bg-grafite hover:bg-grafite-2'
      }`}
      aria-label={`${a.horaInicio}, ${nome}, ${a.servico?.nome ?? ''}${concluido ? ', concluído' : ''}. Abrir detalhes`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={`font-display text-lg font-semibold leading-none ${concluido ? 'text-suave' : 'text-ouro-claro'}`}>
          {a.horaInicio} às {a.horaFim}
        </span>
        {concluido && <span className="shrink-0 text-xs font-semibold text-ok">Concluído</span>}
      </span>
      <span className="truncate font-semibold">{nome}</span>
      {linhas > 1 && (
        <span className="truncate text-sm text-suave">
          {a.servico?.nome} · {moeda(a.servico?.preco ?? 0)}
        </span>
      )}
      {linhas === 1 && <span className="sr-only">{a.servico?.nome}</span>}
    </button>
  );
}

export default function LinhaDoTempo({ linha, onLivre, onAbrir }) {
  const { slots, blocos, almoco, linhaAgora, totalLinhas } = linha;

  return (
    <div className="relative" style={{ height: totalLinhas * ALTURA }}>
      {slots.map((s, i) => {
        const horaCheia = s.hora.endsWith(':00');
        return (
          <div key={s.hora} className="absolute inset-x-0 flex" style={{ top: i * ALTURA, height: ALTURA }}>
            <div
              className={`shrink-0 pr-3 pt-1.5 text-right font-display text-lg leading-none ${
                horaCheia ? 'font-semibold text-marfim' : 'font-medium text-suave'
              }`}
              style={{ width: LARGURA_HORA }}
            >
              {s.hora}
            </div>
            <div className={`relative flex-1 border-t ${horaCheia ? 'border-traco' : 'border-traco/50'}`}>
              {s.estado === 'livre' && (
                <button
                  type="button"
                  onClick={() => onLivre(s.hora)}
                  aria-label={`Agendar às ${s.hora}`}
                  className="group absolute inset-0 flex items-center px-3 text-left text-sm font-medium text-transparent transition-colors hover:bg-ouro/10 hover:text-ouro-claro focus-visible:text-ouro-claro"
                >
                  <span aria-hidden="true">+ Agendar às {s.hora}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Almoço: faixa de poste */}
      {almoco && (
        <div
          className="poste pointer-events-none absolute right-0 flex items-center justify-center rounded-md border border-ouro/30"
          style={{
            left: LARGURA_HORA,
            top: almoco.linhaInicial * ALTURA + 2,
            height: almoco.linhas * ALTURA - 4,
          }}
        >
          <span className="rounded-md bg-carvao px-3 py-1.5 text-sm font-medium text-ouro-claro">
            Almoço, {almoco.inicio} às {almoco.fim}
          </span>
        </div>
      )}

      {/* Atendimentos */}
      <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LARGURA_HORA }}>
        {blocos.map((b) => (
          <div key={b.agendamento.id} className="pointer-events-auto">
            <Bloco item={b} onAbrir={onAbrir} />
          </div>
        ))}
      </div>

      {/* Agora */}
      {linhaAgora !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 z-10 flex items-center"
          style={{ left: `calc(${LARGURA_HORA} - 0.4rem)`, top: linhaAgora * ALTURA }}
        >
          <span className="size-2.5 rounded-full bg-perigo" />
          <span className="h-px flex-1 bg-perigo" />
        </div>
      )}
    </div>
  );
}
