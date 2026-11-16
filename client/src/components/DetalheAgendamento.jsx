import { useEffect, useState } from 'react';
import Dialogo from './Dialogo.jsx';
import EscolhaDeHorario from './EscolhaDeHorario.jsx';
import { useAvisos } from './Avisos.jsx';
import { api, ErroApi } from '../lib/api.js';
import { moeda, telefone as formatarTelefone } from '../lib/formatar.js';
import { dataCurta, nomeDiaSemana } from '../lib/tempo.js';
import { hojeSaoPaulo } from '../lib/hoje.js';

const ROTULO_STATUS = {
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  reagendado: 'Reagendado',
};
const COR_STATUS = {
  confirmado: 'text-ouro-claro',
  concluido: 'text-ok',
  cancelado: 'text-perigo',
  reagendado: 'text-suave',
};

// Mensagens de WhatsApp que fazem sentido para cada situação.
function tiposDeMensagem(ag) {
  if (ag.status === 'confirmado') {
    return ag.agendamentoOriginalId
      ? [['reagendamento', 'Avisar reagendamento'], ['lembrete', 'Enviar lembrete']]
      : [['confirmacao', 'Confirmar pelo WhatsApp'], ['lembrete', 'Enviar lembrete']];
  }
  if (ag.status === 'cancelado') return [['cancelamento', 'Avisar cancelamento']];
  return [];
}

/**
 * Os links wa.me vêm prontos do servidor (com a mensagem escrita). São links comuns, abertos
 * pelo barbeiro: nada é enviado sozinho. Ficam como <a> para o navegador não bloquear a abertura.
 */
function LinksWhatsapp({ ag }) {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    let cancelado = false;
    const tipos = tiposDeMensagem(ag);
    Promise.all(
      tipos.map(([tipo, rotulo]) =>
        api
          .whatsapp(ag.id, tipo)
          .then((r) => ({ tipo, rotulo, link: r.link }))
          .catch(() => null),
      ),
    ).then((lista) => !cancelado && setLinks(lista.filter((x) => x?.link)));
    return () => {
      cancelado = true;
    };
  }, [ag.id, ag.status, ag.agendamentoOriginalId]);

  if (links.length === 0) return null;
  return (
    <>
      {links.map((l) => (
        <a key={l.tipo} href={l.link} target="_blank" rel="noopener noreferrer" className="btn btn-linha">
          {l.rotulo}
        </a>
      ))}
    </>
  );
}

function FormCancelar({ ag, onVoltar, onMudou }) {
  const avisar = useAvisos();
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cancelar(confirmarForaDoPrazo) {
    setErro('');
    setEnviando(true);
    try {
      await api.cancelar(ag.id, { motivo: motivo.trim(), ...(confirmarForaDoPrazo ? { confirmarForaDoPrazo: true } : {}) });
      avisar('Agendamento cancelado.');
      onMudou();
      onVoltar();
    } catch (err) {
      // O servidor pede uma segunda confirmação quando falta pouco para o horário. Não é um erro.
      if (err instanceof ErroApi && err.erro === 'CONFIRMACAO_NECESSARIA') setAviso(err.message);
      else setErro(err instanceof ErroApi ? err.textoParaTela : 'Não foi possível cancelar.');
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        cancelar(false);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="motivo" className="rotulo">
          Motivo do cancelamento
        </label>
        <textarea
          id="motivo"
          rows={3}
          required
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setAviso('');
          }}
          placeholder="Ex.: o cliente avisou que não vai conseguir vir"
          className="campo py-2.5"
        />
      </div>

      {aviso && (
        <p role="alert" className="rounded-md border border-ouro/50 px-3 py-2.5 text-sm text-ouro-claro">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-md border border-perigo/60 px-3 py-2.5 text-sm text-perigo">
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onVoltar} className="btn btn-linha">
          Voltar
        </button>
        {aviso ? (
          <button type="button" disabled={enviando} onClick={() => cancelar(true)} className="btn btn-perigo">
            Cancelar mesmo assim
          </button>
        ) : (
          <button type="submit" disabled={enviando || motivo.trim().length < 3} className="btn btn-perigo">
            {enviando ? 'Cancelando...' : 'Cancelar agendamento'}
          </button>
        )}
      </div>
    </form>
  );
}

function FormReagendar({ ag, onVoltar, onReagendado }) {
  const avisar = useAvisos();
  const [data, setData] = useState(ag.data);
  const [horarios, setHorarios] = useState(null);
  const [fechado, setFechado] = useState(null);
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setHorarios(null);
    setHora('');
    api
      .disponibilidade(data, ag.servicoId)
      .then((r) => {
        if (cancelado) return;
        setFechado(r.fechado?.mensagem ?? null);
        setHorarios(r.horarios);
      })
      .catch((e) => {
        if (cancelado) return;
        setHorarios([]);
        setErro(e instanceof ErroApi ? e.textoParaTela : 'Não foi possível buscar os horários.');
      });
    return () => {
      cancelado = true;
    };
  }, [data, ag.servicoId]);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { novo } = await api.reagendar(ag.id, { data, horaInicio: hora });
      avisar('Agendamento reagendado.');
      onReagendado(novo);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.textoParaTela : 'Não foi possível reagendar.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div>
        <label htmlFor="data-reagendar" className="rotulo">
          Novo dia
        </label>
        <input
          id="data-reagendar"
          type="date"
          value={data}
          min={hojeSaoPaulo()}
          onChange={(e) => e.target.value && setData(e.target.value)}
          className="campo sm:max-w-56"
        />
      </div>

      <fieldset>
        <legend className="rotulo">Novo horário</legend>
        {fechado ? (
          <p className="rounded-md border border-ouro/40 px-3 py-2.5 text-sm text-ouro-claro">{fechado}</p>
        ) : (
          <EscolhaDeHorario horarios={horarios} valor={hora} onChange={setHora} />
        )}
      </fieldset>

      {erro && (
        <p role="alert" className="rounded-md border border-perigo/60 px-3 py-2.5 text-sm text-perigo">
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onVoltar} className="btn btn-linha">
          Voltar
        </button>
        <button type="submit" disabled={!hora || enviando} className="btn btn-ouro">
          {enviando ? 'Reagendando...' : 'Reagendar'}
        </button>
      </div>
    </form>
  );
}

export default function DetalheAgendamento({ agendamento: ag, agora, onClose, onMudou, onReagendado }) {
  const avisar = useAvisos();
  const [modo, setModo] = useState('detalhe'); // 'detalhe' | 'cancelar' | 'reagendar'
  const [concluindo, setConcluindo] = useState(false);
  const [erro, setErro] = useState('');

  const confirmado = ag.status === 'confirmado';
  // O servidor só deixa concluir depois do início; o botão acompanha a mesma regra.
  const jaComecou = ag.data < agora.data || (ag.data === agora.data && ag.horaInicio <= agora.hora);

  async function concluir() {
    setErro('');
    setConcluindo(true);
    try {
      await api.concluir(ag.id);
      avisar('Atendimento concluído.');
      onMudou();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.textoParaTela : 'Não foi possível concluir.');
    } finally {
      setConcluindo(false);
    }
  }

  const titulos = { detalhe: ag.cliente?.nome ?? 'Agendamento', cancelar: 'Cancelar agendamento', reagendar: 'Reagendar' };

  return (
    <Dialogo
      titulo={titulos[modo]}
      subtitulo={
        modo === 'detalhe'
          ? undefined
          : `${ag.cliente?.nome}, ${ag.servico?.nome}, ${nomeDiaSemana(ag.data)} ${dataCurta(ag.data)} às ${ag.horaInicio}`
      }
      onClose={onClose}
    >
      {modo === 'cancelar' && <FormCancelar ag={ag} onVoltar={() => setModo('detalhe')} onMudou={onMudou} />}
      {modo === 'reagendar' && (
        <FormReagendar ag={ag} onVoltar={() => setModo('detalhe')} onReagendado={onReagendado} />
      )}

      {modo === 'detalhe' && (
        <div className="space-y-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[0.95rem]">
            <dt className="text-suave">Situação</dt>
            <dd className={`font-semibold ${COR_STATUS[ag.status]}`}>{ROTULO_STATUS[ag.status]}</dd>

            <dt className="text-suave">Horário</dt>
            <dd>
              {nomeDiaSemana(ag.data)}, {dataCurta(ag.data)}, das {ag.horaInicio} às {ag.horaFim}
            </dd>

            <dt className="text-suave">Serviço</dt>
            <dd>
              {ag.servico?.nome}, {moeda(ag.servico?.preco ?? 0)}
            </dd>

            <dt className="text-suave">Telefone</dt>
            <dd>{formatarTelefone(ag.cliente?.telefone)}</dd>

            {ag.agendamentoOriginalId && (
              <>
                <dt className="text-suave">Origem</dt>
                <dd>Reagendado de outro horário</dd>
              </>
            )}
            {ag.motivoCancelamento && (
              <>
                <dt className="text-suave">Motivo</dt>
                <dd>{ag.motivoCancelamento}</dd>
              </>
            )}
            {ag.observacoes && (
              <>
                <dt className="text-suave">Observações</dt>
                <dd>{ag.observacoes}</dd>
              </>
            )}
          </dl>

          {erro && (
            <p role="alert" className="rounded-md border border-perigo/60 px-3 py-2.5 text-sm text-perigo">
              {erro}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {confirmado && (
              <button
                type="button"
                onClick={concluir}
                disabled={!jaComecou || concluindo}
                title={jaComecou ? undefined : 'Disponível a partir do horário do atendimento'}
                className="btn btn-ouro"
              >
                {concluindo ? 'Concluindo...' : 'Concluir atendimento'}
              </button>
            )}
            <LinksWhatsapp ag={ag} />
            {confirmado && (
              <>
                <button type="button" onClick={() => setModo('reagendar')} className="btn btn-linha">
                  Reagendar
                </button>
                <button type="button" onClick={() => setModo('cancelar')} className="btn btn-perigo">
                  Cancelar
                </button>
              </>
            )}
          </div>
          {confirmado && !jaComecou && (
            <p className="-mt-3 text-sm text-suave">Dá para concluir a partir das {ag.horaInicio}.</p>
          )}
        </div>
      )}
    </Dialogo>
  );
}
