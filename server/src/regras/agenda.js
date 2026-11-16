// Regras de agenda: funções puras, sem acesso a banco, relógio ou rede.
// Quem chama informa a "agora" ({ data, hora }), o que torna tudo fácil de testar.

import {
  horaParaMin,
  minParaHora,
  diaDaSemana,
  diffMinutos,
  dataValida,
  horaValida,
  somarDias,
} from './tempo.js';
import { ehFeriado } from './feriados.js';

/** Status que ocupam o horário. Cancelado e reagendado liberam. */
export const STATUS_QUE_OCUPAM = ['confirmado', 'concluido'];

function falha(codigo, mensagem) {
  return { ok: false, codigo, mensagem };
}

/** Quantos slots de grade um serviço ocupa (arredonda para cima). */
export function slotsOcupados(duracaoMin, tamanhoSlotMin = 30) {
  return Math.ceil(duracaoMin / tamanhoSlotMin);
}

/** Se a barbearia não abre na data (folga semanal ou feriado), devolve { codigo, mensagem }; senão null. */
export function motivoDiaFechado(data, config) {
  const dia = diaDaSemana(data);
  if (!config.diasFuncionamento.includes(dia)) {
    return dia === 0
      ? { codigo: 'DOMINGO', mensagem: 'A barbearia está de folga aos domingos.' }
      : { codigo: 'DIA_FECHADO', mensagem: 'A barbearia não abre neste dia da semana.' };
  }
  if (ehFeriado(data, config)) {
    return { codigo: 'FERIADO', mensagem: 'A barbearia não abre em feriados.' };
  }
  return null;
}

/** Próximo dia em que a barbearia abre, depois de `data` (passo -1 procura para trás). */
export function proximoDiaAberto(data, config, passo = 1) {
  let d = somarDias(data, passo);
  while (motivoDiaFechado(d, config)) d = somarDias(d, passo);
  return d;
}

/**
 * Valida um novo agendamento (ou o destino de um reagendamento).
 * Retorna { ok: true, horaFim, slotsOcupados } ou { ok: false, codigo, mensagem }.
 * `ignorarId` serve para reagendar sem conflitar com o próprio agendamento.
 */
export function validarAgendamento({ data, horaInicio, servico, agendamentos = [], config, agora, ignorarId }) {
  if (!dataValida(data)) return falha('DATA_INVALIDA', 'Data inválida.');
  if (!horaValida(horaInicio)) return falha('HORA_INVALIDA', 'Horário inválido.');

  const slot = config.tamanhoSlotMin;
  const abertura = horaParaMin(config.horaAbertura);
  const fechamento = horaParaMin(config.horaFechamento);
  const inicio = horaParaMin(horaInicio);

  const fechado = motivoDiaFechado(data, config);
  if (fechado) return { ok: false, ...fechado };

  if ((inicio - abertura) % slot !== 0) {
    return falha('FORA_DA_GRADE', `Os horários seguem a grade de ${slot} minutos.`);
  }

  const slots = slotsOcupados(servico.duracaoMin, slot);
  const fimOcupado = inicio + slots * slot;

  if (inicio < abertura || fimOcupado > fechamento) {
    return falha(
      'FORA_DO_HORARIO',
      `O atendimento precisa começar e terminar entre ${config.horaAbertura} e ${config.horaFechamento}.`,
    );
  }

  if (config.almocoInicio && config.almocoFim) {
    const almocoIni = horaParaMin(config.almocoInicio);
    const almocoFim = horaParaMin(config.almocoFim);
    if (inicio < almocoFim && fimOcupado > almocoIni) {
      return falha('ALMOCO', `Horário bloqueado para o almoço (${config.almocoInicio} às ${config.almocoFim}).`);
    }
  }

  const minutosAteInicio = diffMinutos(agora.data, agora.hora, data, horaInicio);
  if (minutosAteInicio < 0) {
    return falha('HORARIO_PASSADO', 'Esse horário já passou.');
  }
  if (minutosAteInicio < config.antecedenciaAgendarMin) {
    return falha(
      'ANTECEDENCIA_MINIMA',
      `É preciso agendar com pelo menos ${config.antecedenciaAgendarMin} minutos de antecedência.`,
    );
  }

  const conflita = agendamentos.some((a) => {
    if (a.id === ignorarId) return false;
    if (a.data !== data) return false;
    if (!STATUS_QUE_OCUPAM.includes(a.status)) return false;
    const aIni = horaParaMin(a.horaInicio);
    const aFim = aIni + (a.slotsOcupados ?? 1) * slot;
    return aIni < fimOcupado && inicio < aFim;
  });
  if (conflita) return falha('CONFLITO', 'Já existe um agendamento nesse horário.');

  return { ok: true, horaFim: minParaHora(inicio + servico.duracaoMin), slotsOcupados: slots };
}

/** Horários de início ("HH:mm") em que o serviço pode ser agendado no dia. */
export function listarHorariosDisponiveis({ data, servico, agendamentos = [], config, agora }) {
  const abertura = horaParaMin(config.horaAbertura);
  const fechamento = horaParaMin(config.horaFechamento);
  const horarios = [];
  for (let min = abertura; min < fechamento; min += config.tamanhoSlotMin) {
    const horaInicio = minParaHora(min);
    const r = validarAgendamento({ data, horaInicio, servico, agendamentos, config, agora });
    if (r.ok) horarios.push(horaInicio);
  }
  return horarios;
}

/**
 * Cancelamento nunca é bloqueado: se faltar menos que a antecedência configurada,
 * a API pede uma confirmação extra (aviso).
 */
export function verificarPrazoCancelamento({ data, horaInicio, config, agora }) {
  const minutosAteInicio = diffMinutos(agora.data, agora.hora, data, horaInicio);
  return { foraDoPrazo: minutosAteInicio < config.antecedenciaCancelarMin, minutosAteInicio };
}
