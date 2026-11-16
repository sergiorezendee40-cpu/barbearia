import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler, ErroNegocio } from '../erros.js';
import { validar } from '../validacao/validar.js';
import { loginBody } from '../validacao/schemas.js';
import { conferirSenha, conferirSenhaFalsa } from '../auth.js';

export function rotasAuth({ repos, auth, limiteLogin }) {
  const router = Router();

  // Freia tentativas de adivinhar a senha: só as tentativas que falham contam.
  const limitador =
    limiteLogin === false
      ? (_req, _res, next) => next()
      : rateLimit({
          windowMs: limiteLogin?.windowMs ?? 15 * 60 * 1000,
          limit: limiteLogin?.limit ?? 10,
          skipSuccessfulRequests: true,
          standardHeaders: 'draft-7',
          legacyHeaders: false,
          handler: (_req, res) =>
            res.status(429).json({ erro: 'MUITAS_TENTATIVAS', mensagem: 'Muitas tentativas de login. Aguarde alguns minutos.' }),
        });

  router.post(
    '/login',
    limitador,
    validar({ body: loginBody }),
    asyncHandler(async (req, res) => {
      const { email, senha } = req.dados.body;
      const usuario = await repos.usuarios.buscarPorEmail(email);

      // Mesma resposta para e-mail inexistente e senha errada.
      const credenciaisInvalidas = new ErroNegocio('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.', 401);
      if (!usuario) {
        await conferirSenhaFalsa(senha);
        throw credenciaisInvalidas;
      }
      if (!(await conferirSenha(senha, usuario.senhaHash))) throw credenciaisInvalidas;

      res.json({ token: auth.gerarToken(usuario), usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
    }),
  );

  router.get(
    '/eu',
    auth.autenticar,
    asyncHandler(async (req, res) => {
      const usuario = await repos.usuarios.buscarPorEmail(req.usuario.email);
      if (!usuario) throw new ErroNegocio('TOKEN_INVALIDO', 'Usuário não existe mais.', 401);
      res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
    }),
  );

  return router;
}
