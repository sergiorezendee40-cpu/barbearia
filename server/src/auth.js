import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ErroNegocio } from './erros.js';

export const hashSenha = (senha) => bcrypt.hash(senha, 10);
export const conferirSenha = (senha, hash) => bcrypt.compare(senha, hash);

// Quando o e-mail não existe, gastamos o mesmo tempo de uma conferência real.
// Assim ninguém descobre quais e-mails existem medindo o tempo de resposta.
let hashFalso;
export async function conferirSenhaFalsa(senha) {
  hashFalso ??= await bcrypt.hash('senha-falsa-para-igualar-tempo', 10);
  await bcrypt.compare(senha, hashFalso);
}

export function criarAuth({ segredo, expiraEm = '8h' }) {
  if (!segredo || segredo.length < 16) {
    throw new Error('JWT_SECRET precisa ter pelo menos 16 caracteres.');
  }

  return {
    gerarToken(usuario) {
      return jwt.sign({ sub: usuario.id, email: usuario.email }, segredo, { algorithm: 'HS256', expiresIn: expiraEm });
    },

    /** Middleware: exige "Authorization: Bearer <token>" válido. */
    autenticar(req, _res, next) {
      const [tipo, token] = (req.headers.authorization ?? '').split(' ');
      if (tipo !== 'Bearer' || !token) {
        return next(new ErroNegocio('NAO_AUTENTICADO', 'Faça login para continuar.', 401));
      }
      try {
        req.usuario = jwt.verify(token, segredo, { algorithms: ['HS256'] });
        next();
      } catch {
        next(new ErroNegocio('TOKEN_INVALIDO', 'Sessão inválida ou expirada. Faça login novamente.', 401));
      }
    },
  };
}
