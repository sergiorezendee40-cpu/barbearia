// Validação de toda entrada da API (corpo e query) com Zod.
// O front também valida, mas o servidor nunca confia nele.

import { z } from 'zod';
import { dataValida, horaValida, diffMinutos } from '../regras/tempo.js';
import { normalizarTelefone, TIPOS_MENSAGEM } from '../regras/whatsapp.js';

const vazioParaUndefined = (v) => (v === '' || v === null ? undefined : v);

const texto = (nome, min, max) =>
  z
    .string({ error: `${nome} é obrigatório.` })
    .trim()
    .min(min, `${nome} deve ter ao menos ${min} caracteres.`)
    .max(max, `${nome} deve ter no máximo ${max} caracteres.`);

const data = z
  .string({ error: 'Data obrigatória (AAAA-MM-DD).' })
  .refine(dataValida, 'Data inválida (use AAAA-MM-DD).');

const hora = z
  .string({ error: 'Horário obrigatório (HH:mm).' })
  .refine(horaValida, 'Horário inválido (use HH:mm).');

const id = z.string({ error: 'Identificador obrigatório.' }).min(1).max(64);

const telefone = z
  .string({ error: 'Telefone é obrigatório.' })
  .refine((v) => normalizarTelefone(v) !== null, 'Telefone inválido. Use DDD + número, ex.: (31) 99999-8888.')
  .transform((v) => normalizarTelefone(v));

const observacoes = z.preprocess(vazioParaUndefined, z.string().trim().max(500).optional());

// ---- Login ----
export const loginBody = z.object({
  email: z.string({ error: 'E-mail obrigatório.' }).trim().min(1).max(200),
  senha: z.string({ error: 'Senha obrigatória.' }).min(1).max(200),
});

// ---- Clientes ----
export const clienteCriarBody = z.strictObject({
  nome: texto('Nome', 2, 100),
  telefone,
  email: z.preprocess(vazioParaUndefined, z.email({ error: 'E-mail inválido.' }).max(150).optional()),
  dataNascimento: z.preprocess(
    vazioParaUndefined,
    data.refine((d) => d >= '1900-01-01', 'Data de nascimento inválida.').optional(),
  ),
  observacoes,
});
export const clienteAtualizarBody = clienteCriarBody.partial();

export const clientesQuery = z.object({
  busca: z.string().trim().max(100).optional(),
});

// ---- Serviços ----
const servicoBase = z.strictObject({
  nome: texto('Nome', 2, 60),
  duracaoMin: z.number({ error: 'Duração obrigatória (minutos).' }).int().min(5).max(480),
  preco: z.number({ error: 'Preço obrigatório (em centavos).' }).int().min(0).max(1_000_000),
  ativo: z.boolean().optional(),
});
export const servicoCriarBody = servicoBase;
export const servicoAtualizarBody = servicoBase.partial();

export const servicosQuery = z.object({
  ativos: z.enum(['true', 'false']).optional(),
});

// ---- Agendamentos ----
export const agendamentoCriarBody = z.strictObject({
  clienteId: id,
  servicoId: id,
  data,
  horaInicio: hora,
  observacoes,
});

export const agendamentoCancelarBody = z.strictObject({
  motivo: texto('Motivo do cancelamento', 3, 300),
  confirmarForaDoPrazo: z.boolean().optional(),
});

export const agendamentoReagendarBody = z.strictObject({
  data,
  horaInicio: hora,
  servicoId: id.optional(),
});

export const agendamentosQuery = z
  .object({
    data: data.optional(),
    inicio: data.optional(),
    fim: data.optional(),
    status: z.enum(['confirmado', 'cancelado', 'concluido', 'reagendado']).optional(),
  })
  .refine((q) => Boolean(q.inicio) === Boolean(q.fim), { message: 'Informe inicio e fim juntos.', path: ['fim'] })
  .refine((q) => !(q.data && q.inicio), { message: 'Use "data" ou "inicio" e "fim", não os dois.', path: ['data'] })
  .refine((q) => !(q.inicio && q.fim) || q.fim >= q.inicio, { message: 'O fim não pode ser antes do início.', path: ['fim'] })
  .refine((q) => !(q.inicio && q.fim) || diffMinutos(q.inicio, '00:00', q.fim, '00:00') <= 62 * 1440, {
    message: 'O período máximo é de 62 dias.',
    path: ['fim'],
  });

export const disponibilidadeQuery = z.object({ data, servicoId: id });

export const whatsappQuery = z.object({
  tipo: z.enum(TIPOS_MENSAGEM, { error: `Tipo inválido. Use: ${TIPOS_MENSAGEM.join(', ')}.` }),
});

// ---- Configurações ----
// O tamanho do slot (30 min) não pode ser alterado por aqui: agendamentos antigos dependem dele.
export const configuracaoAtualizarBody = z
  .strictObject({
    nomeBarbearia: texto('Nome da barbearia', 1, 80),
    horaAbertura: hora,
    horaFechamento: hora,
    diasFuncionamento: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'Informe ao menos um dia de funcionamento.')
      .max(7)
      .refine((a) => new Set(a).size === a.length, 'Dias repetidos.'),
    almocoInicio: hora.nullable(),
    almocoFim: hora.nullable(),
    feriadosExtras: z.array(data).max(400),
    antecedenciaAgendarMin: z.number().int().min(0).max(10080),
    antecedenciaCancelarMin: z.number().int().min(0).max(10080),
  })
  .partial();
