/** Erro esperado de regra de negócio. Vira uma resposta HTTP com código e mensagem. */
export class ErroNegocio extends Error {
  constructor(codigo, mensagem, status = 422, extra = {}) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.codigo = codigo;
    this.status = status;
    this.extra = extra;
  }
}

/** Dados de entrada inválidos (falha de validação do Zod). */
export class ErroValidacao extends Error {
  constructor(zodError) {
    super('Dados inválidos.');
    this.name = 'ErroValidacao';
    this.detalhes = zodError.issues.map((i) => ({
      campo: i.path.length ? i.path.join('.') : '(corpo)',
      mensagem: i.message,
    }));
  }
}

/** Permite usar async/await nas rotas repassando erros para o tratador central. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function tratarErros(err, _req, res, _next) {
  if (err instanceof ErroValidacao) {
    return res.status(400).json({ erro: 'DADOS_INVALIDOS', mensagem: err.message, detalhes: err.detalhes });
  }
  if (err instanceof ErroNegocio) {
    return res.status(err.status).json({ erro: err.codigo, mensagem: err.message, ...err.extra });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido.' });
  }
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ erro: 'REQUISICAO_INVALIDA', mensagem: 'Requisição inválida.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'ERRO_INTERNO', mensagem: 'Erro interno. Tente novamente.' });
}
