import { Router } from 'express';
import { asyncHandler, ErroNegocio } from '../erros.js';
import { validar } from '../validacao/validar.js';
import { clienteCriarBody, clienteAtualizarBody, clientesQuery } from '../validacao/schemas.js';

export function rotasClientes({ repos, casos }) {
  const router = Router();

  const naoEncontrado = () => new ErroNegocio('CLIENTE_NAO_ENCONTRADO', 'Cliente não encontrado.', 404);
  const telefoneRepetido = () =>
    new ErroNegocio('TELEFONE_JA_CADASTRADO', 'Já existe um cliente com esse telefone.', 409);

  router.get(
    '/',
    validar({ query: clientesQuery }),
    asyncHandler(async (req, res) => {
      res.json(await repos.clientes.listar({ busca: req.dados.query.busca }));
    }),
  );

  router.post(
    '/',
    validar({ body: clienteCriarBody }),
    asyncHandler(async (req, res) => {
      if (await repos.clientes.buscarPorTelefone(req.dados.body.telefone)) throw telefoneRepetido();
      res.status(201).json(await repos.clientes.criar(req.dados.body));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const cliente = await repos.clientes.buscarPorId(req.params.id);
      if (!cliente) throw naoEncontrado();
      res.json(cliente);
    }),
  );

  router.put(
    '/:id',
    validar({ body: clienteAtualizarBody }),
    asyncHandler(async (req, res) => {
      const { telefone } = req.dados.body;
      if (telefone) {
        const outro = await repos.clientes.buscarPorTelefone(telefone);
        if (outro && outro.id !== req.params.id) throw telefoneRepetido();
      }
      const atualizado = await repos.clientes.atualizar(req.params.id, req.dados.body);
      if (!atualizado) throw naoEncontrado();
      res.json(atualizado);
    }),
  );

  router.get(
    '/:id/agendamentos',
    asyncHandler(async (req, res) => {
      res.json(await casos.historicoDoCliente(req.params.id));
    }),
  );

  return router;
}
