import { Router } from 'express';
import { asyncHandler, ErroNegocio } from '../erros.js';
import { validar } from '../validacao/validar.js';
import { configuracaoAtualizarBody } from '../validacao/schemas.js';
import { horaParaMin } from '../regras/tempo.js';
import { feriadosNacionais } from '../regras/feriados.js';

function conferirConsistencia(c) {
  const invalida = (mensagem) => new ErroNegocio('CONFIGURACAO_INVALIDA', mensagem, 400);

  const abertura = horaParaMin(c.horaAbertura);
  const fechamento = horaParaMin(c.horaFechamento);
  if (fechamento - abertura < c.tamanhoSlotMin) {
    throw invalida('O horário de fechamento precisa ser depois da abertura.');
  }
  if ((c.almocoInicio === null) !== (c.almocoFim === null)) {
    throw invalida('Informe o início e o fim do almoço, ou nenhum dos dois.');
  }
  if (c.almocoInicio !== null && horaParaMin(c.almocoInicio) >= horaParaMin(c.almocoFim)) {
    throw invalida('O fim do almoço precisa ser depois do início.');
  }
}

export function rotasConfiguracoes({ repos, relogio }) {
  const router = Router();

  async function resposta() {
    const config = await repos.configuracao.obter();
    const ano = Number(relogio().data.slice(0, 4));
    // Feriados nacionais são calculados; aqui só mostramos os do ano atual e do próximo.
    return { ...config, feriadosNacionais: [...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)] };
  }

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await resposta());
    }),
  );

  router.put(
    '/',
    validar({ body: configuracaoAtualizarBody }),
    asyncHandler(async (req, res) => {
      const atual = await repos.configuracao.obter();
      const nova = { ...atual, ...req.dados.body };
      if (nova.feriadosExtras) nova.feriadosExtras = [...new Set(nova.feriadosExtras)].sort();
      conferirConsistencia(nova);
      await repos.configuracao.salvar(nova);
      res.json(await resposta());
    }),
  );

  return router;
}
