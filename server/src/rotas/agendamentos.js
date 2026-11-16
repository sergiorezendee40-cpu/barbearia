import { Router } from 'express';
import { asyncHandler } from '../erros.js';
import { validar } from '../validacao/validar.js';
import {
  agendamentoCriarBody,
  agendamentoCancelarBody,
  agendamentoReagendarBody,
  agendamentosQuery,
  disponibilidadeQuery,
  whatsappQuery,
} from '../validacao/schemas.js';

export function rotasAgendamentos({ casos }) {
  const router = Router();

  router.get(
    '/agendamentos',
    validar({ query: agendamentosQuery }),
    asyncHandler(async (req, res) => {
      res.json(await casos.listar(req.dados.query));
    }),
  );

  router.post(
    '/agendamentos',
    validar({ body: agendamentoCriarBody }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await casos.criar(req.dados.body));
    }),
  );

  router.get(
    '/agendamentos/:id',
    asyncHandler(async (req, res) => {
      res.json(await casos.obter(req.params.id));
    }),
  );

  router.post(
    '/agendamentos/:id/cancelar',
    validar({ body: agendamentoCancelarBody }),
    asyncHandler(async (req, res) => {
      res.json(await casos.cancelar(req.params.id, req.dados.body));
    }),
  );

  router.post(
    '/agendamentos/:id/reagendar',
    validar({ body: agendamentoReagendarBody }),
    asyncHandler(async (req, res) => {
      res.json(await casos.reagendar(req.params.id, req.dados.body));
    }),
  );

  router.post(
    '/agendamentos/:id/concluir',
    asyncHandler(async (req, res) => {
      res.json(await casos.concluir(req.params.id));
    }),
  );

  router.get(
    '/agendamentos/:id/whatsapp',
    validar({ query: whatsappQuery }),
    asyncHandler(async (req, res) => {
      res.json(await casos.mensagemWhatsapp(req.params.id, req.dados.query.tipo));
    }),
  );

  router.get(
    '/disponibilidade',
    validar({ query: disponibilidadeQuery }),
    asyncHandler(async (req, res) => {
      res.json(await casos.disponibilidade(req.dados.query));
    }),
  );

  return router;
}
