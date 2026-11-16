import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, ErroApi } from '../lib/api.js';
import { moeda, plural } from '../lib/formatar.js';
import { agoraSaoPaulo, dataPorExtenso, dataValida, nomeDiaSemana, somarDias } from '../lib/tempo.js';
import {
  montarLinhaDoTempo,
  motivoFechado,
  proximoDiaAberto,
  proximosAtendimentos,
  resumirDia,
} from '../lib/linhaDoTempo.js';
import Marca from '../components/Marca.jsx';
import LinhaDoTempo from '../components/LinhaDoTempo.jsx';
import NovoAgendamento from '../components/NovoAgendamento.jsx';
import DetalheAgendamento from '../components/DetalheAgendamento.jsx';

const ROTULO_STATUS = { cancelado: 'Cancelado', reagendado: 'Reagendado' };

function useAgora() {
  const [agora, setAgora] = useState(() => agoraSaoPaulo());
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraSaoPaulo()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

export default function Agenda() {
  const { usuario, sair } = useAuth();
  const [params, setParams] = useSearchParams();
  const agora = useAgora();

  const dataParam = params.get('data');
  const data = dataValida(dataParam) ? dataParam : agora.data;
  const irPara = useCallback((d) => setParams(d === agoraSaoPaulo().data ? {} : { data: d }), [setParams]);

  // Dados que quase não mudam: configurações e serviços ativos
  const [base, setBase] = useState(null);
  const [erroBase, setErroBase] = useState('');
  useEffect(() => {
    Promise.all([api.configuracoes(), api.servicos()])
      .then(([config, servicos]) => setBase({ config, servicos }))
      .catch((e) => setErroBase(e instanceof ErroApi ? e.textoParaTela : 'Não foi possível carregar a agenda.'));
  }, []);

  // Agendamentos do dia (recarrega ao trocar de dia ou depois de qualquer alteração)
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const [carregado, setCarregado] = useState({ data: null, itens: [] });
  const [erroDia, setErroDia] = useState('');
  useEffect(() => {
    let cancelado = false;
    setErroDia('');
    api
      .agendamentos(data)
      .then((itens) => !cancelado && setCarregado({ data, itens }))
      .catch((e) => !cancelado && setErroDia(e instanceof ErroApi ? e.textoParaTela : 'Não foi possível carregar o dia.'));
    return () => {
      cancelado = true;
    };
  }, [data, versao]);
  const carregando = carregado.data !== data;
  const itens = carregando ? [] : carregado.itens;

  const [novo, setNovo] = useState(null); // { hora? } enquanto o diálogo de novo agendamento está aberto
  const [selecionadoId, setSelecionadoId] = useState(null);
  const selecionado = itens.find((a) => a.id === selecionadoId) ?? null;

  const fechado = base ? motivoFechado(data, base.config) : null;
  const linha = useMemo(
    () => (base && !fechado ? montarLinhaDoTempo({ data, config: base.config, agendamentos: itens, agora }) : null),
    [base, fechado, data, itens, agora],
  );
  const resumo = useMemo(() => resumirDia(itens), [itens]);
  const proximos = useMemo(() => proximosAtendimentos(itens, agora), [itens, agora]);
  const outros = itens.filter((a) => a.status === 'cancelado' || a.status === 'reagendado');
  const ehHoje = data === agora.data;

  if (erroBase) {
    return (
      <main className="mx-auto max-w-md px-6 py-20">
        <p role="alert" className="rounded-md border border-perigo/60 px-4 py-3 text-perigo">
          {erroBase}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-linha mt-4">
          Tentar de novo
        </button>
      </main>
    );
  }
  if (!base) return <p className="px-6 py-20 text-center text-suave">Carregando a agenda...</p>;

  return (
    <div className="min-h-dvh pb-28 lg:pb-10">
      <header className="border-b border-traco">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Marca nome={base.config.nomeBarbearia} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-suave sm:inline">{usuario?.nome}</span>
            <button type="button" onClick={sair} className="min-h-11 px-2 text-sm font-semibold text-suave hover:text-marfim">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {/* Dia e navegação */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-5xl font-semibold leading-none sm:text-6xl">
              {nomeDiaSemana(data).replace(/^./, (c) => c.toUpperCase())}
            </h1>
            <p className="mt-2 text-suave">
              {dataPorExtenso(data)}
              {ehHoje && <span className="ml-2 font-semibold text-ouro-claro">hoje</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => irPara(somarDias(data, -1))}
              aria-label="Dia anterior"
              className="btn btn-linha !px-0 w-11"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
            <label className="sr-only" htmlFor="ir-para-data">
              Ir para o dia
            </label>
            <input
              id="ir-para-data"
              type="date"
              value={data}
              onChange={(e) => e.target.value && irPara(e.target.value)}
              className="campo w-auto"
            />
            <button
              type="button"
              onClick={() => irPara(somarDias(data, 1))}
              aria-label="Próximo dia"
              className="btn btn-linha !px-0 w-11"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>
            {!ehHoje && (
              <button type="button" onClick={() => irPara(agora.data)} className="btn btn-linha">
                Hoje
              </button>
            )}
            <button
              type="button"
              onClick={() => setNovo({})}
              className="btn btn-ouro ml-2 hidden lg:inline-flex"
            >
              Novo agendamento
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Painel: resumo e próximos (no celular fica acima da agenda) */}
          <aside className="order-first space-y-6 lg:order-last lg:sticky lg:top-6 lg:self-start">
            <section aria-labelledby="titulo-resumo">
              <h2 id="titulo-resumo" className="font-display text-2xl font-semibold">
                Resumo do dia
              </h2>
              {carregando ? (
                <p className="mt-2 text-suave">Carregando...</p>
              ) : (
                <div className="mt-2 space-y-1 text-[0.95rem]">
                  <p>
                    {plural(resumo.atendimentos, 'atendimento')}
                    {resumo.concluidos > 0 && <span className="text-suave">, {plural(resumo.concluidos, 'concluído')}</span>}
                  </p>
                  <p>
                    <span className="font-semibold text-ouro-claro">{moeda(resumo.previstoCentavos)}</span>{' '}
                    <span className="text-suave">previstos</span>
                  </p>
                  {(resumo.cancelados > 0 || resumo.reagendados > 0) && (
                    <p className="text-suave">
                      {[
                        resumo.cancelados > 0 && plural(resumo.cancelados, 'cancelado'),
                        resumo.reagendados > 0 && plural(resumo.reagendados, 'reagendado'),
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              )}
            </section>

            {ehHoje && !carregando && !fechado && (
              <section aria-labelledby="titulo-proximos">
                <h2 id="titulo-proximos" className="font-display text-2xl font-semibold">
                  A seguir
                </h2>
                {proximos.length === 0 ? (
                  <p className="mt-2 text-[0.95rem] text-suave">Nenhum atendimento pela frente hoje.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-traco border-y border-traco">
                    {proximos.slice(0, 4).map((a, i) => (
                      <li key={a.id} className={i > 0 ? 'hidden lg:block' : ''}>
                        <button
                          type="button"
                          onClick={() => setSelecionadoId(a.id)}
                          className="flex min-h-11 w-full items-baseline gap-3 py-2.5 text-left hover:text-ouro-claro"
                        >
                          <span className="font-display text-xl font-semibold text-ouro-claro">{a.horaInicio}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{a.cliente?.nome}</span>
                          <span className="shrink-0 text-sm text-suave">{a.servico?.nome}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {outros.length > 0 && (
              <section aria-labelledby="titulo-outros">
                <h2 id="titulo-outros" className="font-display text-2xl font-semibold">
                  Cancelados e reagendados
                </h2>
                <ul className="mt-2 divide-y divide-traco border-y border-traco">
                  {outros.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelecionadoId(a.id)}
                        className="flex min-h-11 w-full items-baseline gap-3 py-2.5 text-left text-suave hover:text-marfim"
                      >
                        <span className="font-display text-lg font-semibold">{a.horaInicio}</span>
                        <span className="min-w-0 flex-1 truncate">{a.cliente?.nome}</span>
                        <span className="shrink-0 text-sm">{ROTULO_STATUS[a.status]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          {/* Agenda do dia */}
          <section aria-label={`Agenda de ${dataPorExtenso(data)}`}>
            {erroDia && (
              <p role="alert" className="mb-4 rounded-md border border-perigo/60 px-4 py-3 text-perigo">
                {erroDia}
              </p>
            )}

            {fechado ? (
              <div className="overflow-hidden rounded-lg border border-traco">
                <div aria-hidden="true" className="poste-forte h-4" />
                <div className="px-6 py-14 text-center">
                  <p className="font-display text-4xl font-semibold">Fechado</p>
                  <p className="mt-2 text-suave">{fechado}</p>
                  <button
                    type="button"
                    onClick={() => irPara(proximoDiaAberto(data, base.config, 1))}
                    className="btn btn-linha mt-6"
                  >
                    Ir para o próximo dia aberto
                  </button>
                </div>
              </div>
            ) : carregando ? (
              <p className="py-16 text-center text-suave">Carregando o dia...</p>
            ) : (
              linha && (
                <>
                  <p className="mb-3 text-sm text-suave">
                    {itens.some((a) => a.status === 'confirmado' || a.status === 'concluido')
                      ? 'Toque em um atendimento para ver detalhes ou em um horário livre para agendar.'
                      : 'Nenhum atendimento neste dia. Toque em um horário livre para agendar.'}
                  </p>
                  <LinhaDoTempo
                    linha={linha}
                    onLivre={(hora) => setNovo({ hora })}
                    onAbrir={(id) => setSelecionadoId(id)}
                  />
                </>
              )
            )}
          </section>
        </div>
      </main>

      {/* Botão fixo no celular */}
      <button
        type="button"
        onClick={() => setNovo({})}
        className="btn btn-ouro fixed bottom-5 right-4 z-30 min-h-12 px-5 shadow-xl lg:hidden"
      >
        Novo agendamento
      </button>

      {novo && (
        <NovoAgendamento
          dataInicial={fechado ? proximoDiaAberto(data, base.config, 1) : data < agora.data ? agora.data : data}
          horaInicial={novo.hora}
          servicos={base.servicos}
          onClose={() => setNovo(null)}
          onCriado={(dataCriada) => {
            if (dataCriada !== data) irPara(dataCriada);
            recarregar();
          }}
        />
      )}

      {selecionado && (
        <DetalheAgendamento
          key={selecionado.id}
          agendamento={selecionado}
          agora={agora}
          onClose={() => setSelecionadoId(null)}
          onMudou={recarregar}
          onReagendado={(criado) => {
            // O novo horário pode estar em outro dia: vai para lá e abre o agendamento novo.
            setSelecionadoId(criado.id);
            if (criado.data !== data) irPara(criado.data);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
