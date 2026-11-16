import express from 'express';
import cors from 'cors';
import { criarAuth } from './auth.js';
import { criarCasosDeUso } from './casosDeUso/agendamentos.js';
import { ErroNegocio, tratarErros } from './erros.js';
import { agoraSaoPaulo } from './regras/tempo.js';
import { rotasAuth } from './rotas/auth.js';
import { rotasClientes } from './rotas/clientes.js';
import { rotasServicos } from './rotas/servicos.js';
import { rotasAgendamentos } from './rotas/agendamentos.js';
import { rotasConfiguracoes } from './rotas/configuracoes.js';
import { carregarAmbiente } from './ambiente.js';
import { criarRepositorios } from './repository/index.js';

/**
 * Monta a API. Tudo que muda entre ambientes entra por parâmetro:
 * - repos: acesso aos dados (JSON hoje, banco amanhã)
 * - relogio: devolve { data, hora } de agora; nos testes é um relógio fixo
 * - limiteLogin: false desliga o limitador (testes) ou { limit, windowMs }
 */
export function criarApp({
  repos,
  segredoJwt,
  relogio = () => agoraSaoPaulo(),
  limiteLogin,
  origensCors = ['http://localhost:5173'],
  trustProxy = false,
}) {
  const app = express();
  const auth = criarAuth({ segredo: segredoJwt });
  const casos = criarCasosDeUso({ repos, relogio });

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({ origin: origensCors }));
  app.use(express.json({ limit: '100kb' }));

  // Rotas públicas
  app.get('/saude', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', rotasAuth({ repos, auth, limiteLogin }));

  // Tudo daqui para baixo exige login
  app.use(auth.autenticar);
  app.use('/clientes', rotasClientes({ repos, casos }));
  app.use('/servicos', rotasServicos({ repos }));
  app.use('/configuracoes', rotasConfiguracoes({ repos, relogio }));
  app.use('/', rotasAgendamentos({ casos }));

  app.use((_req, _res, next) => next(new ErroNegocio('ROTA_NAO_ENCONTRADA', 'Rota não encontrada.', 404)));
  app.use(tratarErros);

  return app;
}

let appVercel;

export default function handler(req, res) {
  if (!appVercel) {
    const { arquivoDados, segredoJwt, origensCors } = carregarAmbiente();
    appVercel = criarApp({
      repos: criarRepositorios({ arquivo: arquivoDados }),
      segredoJwt,
      origensCors,
      trustProxy: 1,
    });
  }

  return appVercel(req, res);
}
