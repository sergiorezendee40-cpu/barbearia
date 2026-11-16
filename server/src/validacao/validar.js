import { ErroValidacao } from '../erros.js';

/**
 * Middleware de validação. Uso: validar({ body: schema, query: schema }).
 * Os dados já validados e normalizados ficam em req.dados.body / req.dados.query.
 */
export const validar = (esquemas) => (req, _res, next) => {
  req.dados = {};
  for (const [onde, schema] of Object.entries(esquemas)) {
    const resultado = schema.safeParse(req[onde] ?? {});
    if (!resultado.success) return next(new ErroValidacao(resultado.error));
    req.dados[onde] = resultado.data;
  }
  next();
};
