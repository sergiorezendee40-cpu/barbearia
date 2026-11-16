// Casos de uso de agendamento: juntam as regras puras (src/regras) com o repository.
// As rotas ficam finas e chamam estas funções.

import { ErroNegocio } from '../erros.js';
import {
  validarAgendamento,
  listarHorariosDisponiveis,
  verificarPrazoCancelamento,
  motivoDiaFechado,
} from '../regras/agenda.js';
import { diffMinutos } from '../regras/tempo.js';
import { gerarLinkWhatsapp, montarMensagem } from '../regras/whatsapp.js';

const naoEncontrado = (codigo, mensagem) => new ErroNegocio(codigo, mensagem, 404);

export function criarCasosDeUso({ repos, relogio }) {
  async function obterOuFalhar(id) {
    const ag = await repos.agendamentos.buscarPorId(id);
    if (!ag) throw naoEncontrado('AGENDAMENTO_NAO_ENCONTRADO', 'Agendamento não encontrado.');
    return ag;
  }

  async function obterServicoOuFalhar(id) {
    const servico = await repos.servicos.buscarPorId(id);
    if (!servico) throw naoEncontrado('SERVICO_NAO_ENCONTRADO', 'Serviço não encontrado.');
    return servico;
  }

  function falharSeInvalido(resultado) {
    if (!resultado.ok) {
      throw new ErroNegocio(resultado.codigo, resultado.mensagem, resultado.codigo === 'CONFLITO' ? 409 : 422);
    }
  }

  /** Anexa cliente e serviço resumidos a cada agendamento. */
  async function enriquecer(lista) {
    // TODO(DB): trocar por um JOIN em vez de buscar clientes e serviços separadamente.
    const clientes = await repos.clientes.buscarVarios([...new Set(lista.map((a) => a.clienteId))]);
    const servicos = await repos.servicos.buscarVarios([...new Set(lista.map((a) => a.servicoId))]);
    return lista.map((a) => {
      const c = clientes.find((x) => x.id === a.clienteId);
      const s = servicos.find((x) => x.id === a.servicoId);
      return {
        ...a,
        cliente: c ? { id: c.id, nome: c.nome, telefone: c.telefone } : null,
        servico: s ? { id: s.id, nome: s.nome, duracaoMin: s.duracaoMin, preco: s.preco } : null,
      };
    });
  }

  async function listar({ data, inicio, fim, status }) {
    const de = inicio ?? data ?? relogio().data;
    const ate = fim ?? data ?? de;
    let lista = await repos.agendamentos.listarPorPeriodo(de, ate);
    if (status) lista = lista.filter((a) => a.status === status);
    return enriquecer(lista);
  }

  async function obter(id) {
    const [ag] = await enriquecer([await obterOuFalhar(id)]);
    return ag;
  }

  async function criar({ clienteId, servicoId, data, horaInicio, observacoes }) {
    const config = await repos.configuracao.obter();
    const cliente = await repos.clientes.buscarPorId(clienteId);
    if (!cliente) throw naoEncontrado('CLIENTE_NAO_ENCONTRADO', 'Cliente não encontrado.');
    const servico = await obterServicoOuFalhar(servicoId);
    if (!servico.ativo) throw new ErroNegocio('SERVICO_INATIVO', 'Esse serviço está desativado.', 422);

    const doDia = await repos.agendamentos.listarPorData(data);
    const r = validarAgendamento({ data, horaInicio, servico, agendamentos: doDia, config, agora: relogio() });
    falharSeInvalido(r);

    const criado = await repos.agendamentos.criar({
      clienteId,
      servicoId,
      data,
      horaInicio,
      horaFim: r.horaFim,
      slotsOcupados: r.slotsOcupados,
      status: 'confirmado',
      observacoes,
    });
    return obter(criado.id);
  }

  async function cancelar(id, { motivo, confirmarForaDoPrazo = false }) {
    const ag = await obterOuFalhar(id);
    if (ag.status !== 'confirmado') {
      throw new ErroNegocio('STATUS_INVALIDO', 'Só é possível cancelar agendamentos confirmados.', 409);
    }

    const config = await repos.configuracao.obter();
    const prazo = verificarPrazoCancelamento({ data: ag.data, horaInicio: ag.horaInicio, config, agora: relogio() });
    if (prazo.foraDoPrazo && !confirmarForaDoPrazo) {
      const mensagem =
        prazo.minutosAteInicio <= 0
          ? 'Esse horário já começou ou passou. Confirme para cancelar mesmo assim.'
          : `Faltam apenas ${prazo.minutosAteInicio} minutos para o horário (o recomendado é cancelar com ${config.antecedenciaCancelarMin} minutos de antecedência). Confirme para cancelar mesmo assim.`;
      throw new ErroNegocio('CONFIRMACAO_NECESSARIA', mensagem, 409, {
        aviso: true,
        minutosAteInicio: prazo.minutosAteInicio,
      });
    }

    await repos.agendamentos.atualizar(id, { status: 'cancelado', motivoCancelamento: motivo });
    return obter(id);
  }

  async function reagendar(id, { data, horaInicio, servicoId }) {
    const ag = await obterOuFalhar(id);
    if (ag.status !== 'confirmado') {
      throw new ErroNegocio('STATUS_INVALIDO', 'Só é possível reagendar agendamentos confirmados.', 409);
    }

    const servico = await obterServicoOuFalhar(servicoId ?? ag.servicoId);
    if (servicoId && servicoId !== ag.servicoId && !servico.ativo) {
      throw new ErroNegocio('SERVICO_INATIVO', 'Esse serviço está desativado.', 422);
    }
    if (data === ag.data && horaInicio === ag.horaInicio && servico.id === ag.servicoId) {
      throw new ErroNegocio('MESMO_HORARIO', 'O novo horário é igual ao atual.', 422);
    }

    const config = await repos.configuracao.obter();
    const doDia = await repos.agendamentos.listarPorData(data);
    const r = validarAgendamento({
      data,
      horaInicio,
      servico,
      agendamentos: doDia,
      config,
      agora: relogio(),
      ignorarId: ag.id,
    });
    falharSeInvalido(r);

    // Só altera algo depois de validar tudo: se falhar, o original continua confirmado.
    const novo = await repos.agendamentos.criar({
      clienteId: ag.clienteId,
      servicoId: servico.id,
      data,
      horaInicio,
      horaFim: r.horaFim,
      slotsOcupados: r.slotsOcupados,
      status: 'confirmado',
      observacoes: ag.observacoes,
      agendamentoOriginalId: ag.id,
    });
    await repos.agendamentos.atualizar(ag.id, { status: 'reagendado' });

    return { original: await obter(ag.id), novo: await obter(novo.id) };
  }

  async function concluir(id) {
    const ag = await obterOuFalhar(id);
    if (ag.status !== 'confirmado') {
      throw new ErroNegocio('STATUS_INVALIDO', 'Só é possível concluir agendamentos confirmados.', 409);
    }
    const { data, hora } = relogio();
    if (diffMinutos(data, hora, ag.data, ag.horaInicio) > 0) {
      throw new ErroNegocio('AINDA_NAO_OCORREU', 'Esse atendimento ainda não começou.', 409);
    }
    await repos.agendamentos.atualizar(id, { status: 'concluido' });
    return obter(id);
  }

  async function disponibilidade({ data, servicoId }) {
    const config = await repos.configuracao.obter();
    const servico = await obterServicoOuFalhar(servicoId);
    const doDia = await repos.agendamentos.listarPorData(data);
    return {
      data,
      servicoId,
      fechado: motivoDiaFechado(data, config),
      horarios: listarHorariosDisponiveis({ data, servico, agendamentos: doDia, config, agora: relogio() }),
    };
  }

  async function historicoDoCliente(clienteId) {
    const cliente = await repos.clientes.buscarPorId(clienteId);
    if (!cliente) throw naoEncontrado('CLIENTE_NAO_ENCONTRADO', 'Cliente não encontrado.');
    const lista = (await repos.agendamentos.listarPorCliente(clienteId)).reverse();
    const conta = (status) => lista.filter((a) => a.status === status).length;
    return {
      cliente,
      // O histórico de cancelamentos é só para consulta: não gera bloqueio.
      resumo: {
        total: lista.length,
        confirmados: conta('confirmado'),
        concluidos: conta('concluido'),
        cancelados: conta('cancelado'),
        reagendados: conta('reagendado'),
      },
      agendamentos: await enriquecer(lista),
    };
  }

  async function mensagemWhatsapp(id, tipo) {
    const ag = await obterOuFalhar(id);
    const cliente = await repos.clientes.buscarPorId(ag.clienteId);
    const servico = await repos.servicos.buscarPorId(ag.servicoId);
    const config = await repos.configuracao.obter();
    const mensagem = montarMensagem(tipo, {
      nomeCliente: cliente.nome.split(' ')[0],
      nomeBarbearia: config.nomeBarbearia,
      data: ag.data,
      hora: ag.horaInicio,
      servico: servico.nome,
    });
    return { tipo, mensagem, link: gerarLinkWhatsapp(cliente.telefone, mensagem) };
  }

  return { listar, obter, criar, cancelar, reagendar, concluir, disponibilidade, historicoDoCliente, mensagemWhatsapp };
}
