import { useEffect, useState } from 'react';
import Dialogo from './Dialogo.jsx';
import EscolhaDeHorario from './EscolhaDeHorario.jsx';
import { useAvisos } from './Avisos.jsx';
import { api, ErroApi } from '../lib/api.js';
import { moeda, telefone as formatarTelefone } from '../lib/formatar.js';
import { hojeSaoPaulo } from '../lib/hoje.js';

export default function NovoAgendamento({ dataInicial, horaInicial, servicos, onClose, onCriado }) {
  const avisar = useAvisos();

  // Cliente
  const [busca, setBusca] = useState('');
  const [encontrados, setEncontrados] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [novoCliente, setNovoCliente] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  // Serviço, data e horário
  const [servicoId, setServicoId] = useState(() => servicos.find((s) => s.nome === 'Corte')?.id ?? '');
  const [data, setData] = useState(dataInicial);
  const [horarios, setHorarios] = useState(null);
  const [fechado, setFechado] = useState(null);
  const [hora, setHora] = useState(horaInicial ?? '');

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Busca clientes enquanto digita (espera 250 ms parado para não chamar a cada tecla).
  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(() => {
      api
        .clientes(busca.trim())
        .then((l) => !cancelado && setEncontrados(l.slice(0, 6)))
        .catch(() => !cancelado && setEncontrados([]));
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [busca]);

  // Horários livres para o serviço e a data escolhidos.
  useEffect(() => {
    if (!servicoId || !data) return;
    let cancelado = false;
    setHorarios(null);
    api
      .disponibilidade(data, servicoId)
      .then((r) => {
        if (cancelado) return;
        setFechado(r.fechado?.mensagem ?? null);
        setHorarios(r.horarios);
        setHora((atual) => (r.horarios.includes(atual) ? atual : ''));
      })
      .catch((e) => {
        if (cancelado) return;
        setHorarios([]);
        setErro(e instanceof ErroApi ? e.textoParaTela : 'Não foi possível buscar os horários.');
      });
    return () => {
      cancelado = true;
    };
  }, [data, servicoId]);

  const clienteOk = novoCliente ? nome.trim().length >= 2 && telefone.trim() !== '' : Boolean(clienteId);
  const podeEnviar = clienteOk && servicoId && data && hora && !enviando;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      let idCliente = clienteId;
      if (novoCliente) {
        const criado = await api.criarCliente({ nome: nome.trim(), telefone });
        idCliente = criado.id;
        // Se o agendamento falhar logo abaixo, o cliente já existe: reaproveita em vez de cadastrar de novo.
        setClienteId(criado.id);
        setNovoCliente(false);
        setBusca(criado.nome);
      }
      await api.criarAgendamento({ clienteId: idCliente, servicoId, data, horaInicio: hora });
      avisar('Agendamento criado.');
      onCriado(data);
      onClose();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.textoParaTela : 'Não foi possível agendar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Novo agendamento" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-6" noValidate>
        <fieldset>
          <legend className="rotulo">Cliente</legend>
          {!novoCliente ? (
            <>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone"
                aria-label="Buscar cliente por nome ou telefone"
                className="campo"
              />
              <div role="radiogroup" aria-label="Clientes encontrados" className="mt-2 divide-y divide-traco rounded-md border border-traco">
                {encontrados.length === 0 && <p className="px-3 py-3 text-sm text-suave">Nenhum cliente encontrado.</p>}
                {encontrados.map((c) => (
                  <label key={c.id} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="cliente"
                      value={c.id}
                      checked={clienteId === c.id}
                      onChange={() => setClienteId(c.id)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 peer-checked:bg-ouro/15 peer-checked:text-ouro-claro peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-ouro-claro">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-sm text-suave">{formatarTelefone(c.telefone)}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setNovoCliente(true);
                  setClienteId('');
                }}
                className="mt-2 min-h-11 text-sm font-semibold text-ouro-claro underline-offset-4 hover:underline"
              >
                Cadastrar cliente novo
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="nome-cliente" className="rotulo">
                  Nome completo
                </label>
                <input id="nome-cliente" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" className="campo" />
              </div>
              <div>
                <label htmlFor="tel-cliente" className="rotulo">
                  Telefone ou WhatsApp, com DDD
                </label>
                <input
                  id="tel-cliente"
                  type="tel"
                  inputMode="tel"
                  placeholder="(31) 99999-8888"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  autoComplete="off"
                  className="campo"
                />
              </div>
              <button
                type="button"
                onClick={() => setNovoCliente(false)}
                className="min-h-11 text-sm font-semibold text-ouro-claro underline-offset-4 hover:underline"
              >
                Escolher cliente já cadastrado
              </button>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="rotulo">Serviço</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            {servicos.map((s) => (
              <label key={s.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="servico"
                  value={s.id}
                  checked={servicoId === s.id}
                  onChange={() => setServicoId(s.id)}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 flex-col justify-center rounded-md border border-traco px-3 py-2 transition-colors hover:border-ouro peer-checked:border-ouro peer-checked:bg-ouro/15 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ouro-claro">
                  <span className="font-semibold">{s.nome}</span>
                  <span className="text-sm text-suave">
                    {s.duracaoMin} min · {moeda(s.preco)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="data-novo" className="rotulo">
            Dia
          </label>
          <input
            id="data-novo"
            type="date"
            value={data}
            min={hojeSaoPaulo()}
            onChange={(e) => e.target.value && setData(e.target.value)}
            className="campo sm:max-w-56"
          />
        </div>

        <fieldset>
          <legend className="rotulo">Horário</legend>
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
          <button type="button" onClick={onClose} className="btn btn-linha">
            Fechar
          </button>
          <button type="submit" disabled={!podeEnviar} className="btn btn-ouro">
            {enviando ? 'Agendando...' : 'Agendar'}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
