// Lógica da tela de agenda, sem React: dado o dia, a configuração e os agendamentos,
// descobre o que desenhar em cada linha de 30 minutos. Por ser função pura, é fácil de testar.

import { diaDaSemana, horaParaMin, minParaHora, somarDias } from './tempo.js';

/** Só estes status ocupam horário (cancelado e reagendado liberam). */
export const STATUS_ATIVOS = ['confirmado', 'concluido'];

/** Se a barbearia não abre na data, devolve o motivo em texto; senão null. */
export function motivoFechado(data, config) {
  const dia = diaDaSemana(data);
  if (!config.diasFuncionamento.includes(dia)) {
    return dia === 0 ? 'Domingo é folga.' : 'Não abrimos neste dia da semana.';
  }
  if (config.feriadosNacionais?.includes(data) || config.feriadosExtras?.includes(data)) {
    return 'Feriado: a barbearia não abre.';
  }
  return null;
}

/** Próxima (passo 1) ou anterior (passo -1) data em que a barbearia abre. */
export function proximoDiaAberto(data, config, passo = 1) {
  let d = somarDias(data, passo);
  for (let i = 0; i < 60 && motivoFechado(d, config); i += 1) d = somarDias(d, passo);
  return d;
}

/**
 * Monta a grade do dia.
 *  - slots: uma entrada por linha de 30 min, com estado
 *      'livre' (dá para agendar), 'ocupado', 'almoco' ou 'indisponivel' (já passou ou falta pouca antecedência)
 *  - blocos: onde desenhar cada agendamento ativo (linha inicial e quantas linhas ocupa)
 *  - almoco: faixa do almoço em linhas, ou null
 *  - linhaAgora: posição (em linhas, pode ser fracionada) da hora atual, só quando o dia é hoje
 */
export function montarLinhaDoTempo({ data, config, agendamentos, agora }) {
  const passo = config.tamanhoSlotMin;
  const abertura = horaParaMin(config.horaAbertura);
  const fechamento = horaParaMin(config.horaFechamento);
  const almocoIni = config.almocoInicio ? horaParaMin(config.almocoInicio) : null;
  const almocoFim = config.almocoFim ? horaParaMin(config.almocoFim) : null;
  const agoraMin = horaParaMin(agora.hora);
  const ehHoje = data === agora.data;
  const ativos = agendamentos.filter((a) => STATUS_ATIVOS.includes(a.status));

  const slots = [];
  for (let min = abertura; min < fechamento; min += passo) {
    const emAlmoco = almocoIni !== null && min < almocoFim && min + passo > almocoIni;
    const ocupado = ativos.some((a) => {
      const ini = horaParaMin(a.horaInicio);
      return min >= ini && min < ini + a.slotsOcupados * passo;
    });

    let estado = 'livre';
    if (ocupado) estado = 'ocupado';
    else if (emAlmoco) estado = 'almoco';
    else if (data < agora.data || (ehHoje && min < agoraMin + config.antecedenciaAgendarMin)) estado = 'indisponivel';

    slots.push({ hora: minParaHora(min), min, estado });
  }

  const blocos = ativos
    .map((agendamento) => ({
      agendamento,
      linhaInicial: (horaParaMin(agendamento.horaInicio) - abertura) / passo,
      linhas: agendamento.slotsOcupados,
    }))
    .sort((a, b) => a.linhaInicial - b.linhaInicial);

  const linhasAlmoco = slots.map((s, i) => (s.estado === 'almoco' ? i : -1)).filter((i) => i >= 0);
  const almoco = linhasAlmoco.length
    ? { linhaInicial: linhasAlmoco[0], linhas: linhasAlmoco.length, inicio: config.almocoInicio, fim: config.almocoFim }
    : null;

  const linhaAgora =
    ehHoje && agoraMin >= abertura && agoraMin < fechamento ? (agoraMin - abertura) / passo : null;

  return { slots, blocos, almoco, linhaAgora, totalLinhas: slots.length };
}

/** Números do cabeçalho do dia. Dinheiro em centavos (soma o que está confirmado ou concluído). */
export function resumirDia(agendamentos) {
  const ativos = agendamentos.filter((a) => STATUS_ATIVOS.includes(a.status));
  return {
    atendimentos: ativos.length,
    concluidos: agendamentos.filter((a) => a.status === 'concluido').length,
    cancelados: agendamentos.filter((a) => a.status === 'cancelado').length,
    reagendados: agendamentos.filter((a) => a.status === 'reagendado').length,
    previstoCentavos: ativos.reduce((soma, a) => soma + (a.servico?.preco ?? 0), 0),
  };
}

/** Confirmados de hoje que ainda não começaram (a partir de agora), em ordem. */
export function proximosAtendimentos(agendamentos, agora) {
  return agendamentos
    .filter((a) => a.status === 'confirmado' && a.data === agora.data && a.horaInicio >= agora.hora)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}
