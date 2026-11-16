// Valores iniciais. Tudo aqui pode ser alterado depois pela tela de configurações.

export const configPadrao = {
  nomeBarbearia: 'Luciano',
  horaAbertura: '08:00',
  horaFechamento: '20:00',
  diasFuncionamento: [1, 2, 3, 4, 5, 6], // segunda a sábado (0 = domingo)
  tamanhoSlotMin: 30,
  almocoInicio: '12:00',
  almocoFim: '13:00',
  feriadosExtras: [], // datas "YYYY-MM-DD" além dos feriados nacionais (calculados pelo sistema)
  antecedenciaAgendarMin: 60,
  antecedenciaCancelarMin: 120, // só gera aviso, nunca bloqueia
};

// Preços em centavos.
export const servicosPadrao = [
  { nome: 'Corte', duracaoMin: 30, preco: 4000, ativo: true },
  { nome: 'Barba', duracaoMin: 20, preco: 2000, ativo: true },
  { nome: 'Corte + barba', duracaoMin: 50, preco: 6000, ativo: true },
];
