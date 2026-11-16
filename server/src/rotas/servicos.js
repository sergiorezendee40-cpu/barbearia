import { Router } from 'express';
import { asyncHandler, ErroNegocio } from '../erros.js';
import { validar } from '../validacao/validar.js';
import { servicoCriarBody, servicoAtualizarBody, servicosQuery } from '../validacao/schemas.js';

// Serviços não são apagados: para tirar um serviço de uso, desative (ativo: false).
// Assim o histórico de agendamentos continua mostrando o nome certo.
export function rotasServicos({ repos }) {
  const router = Router();

  router.get(
    '/',
    validar({ query: servicosQuery }),
    asyncHandler(async (req, res) => {
      res.json(await repos.servicos.listar({ apenasAtivos: req.dados.query.ativos === 'true' }));
    }),
  );

  router.post(
    '/',
    validar({ body: servicoCriarBody }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await repos.servicos.criar(req.dados.body));
    }),
  );

  router.put(
    '/:id',
    validar({ body: servicoAtualizarBody }),
    asyncHandler(async (req, res) => {
      const atualizado = await repos.servicos.atualizar(req.params.id, req.dados.body);
      if (!atualizado) throw new ErroNegocio('SERVICO_NAO_ENCONTRADO', 'Serviço não encontrado.', 404);
      res.json(atualizado);
    }),
  );

  return router;
}
