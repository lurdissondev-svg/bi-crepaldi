/**
 * Utilitário para cálculo de dias úteis
 * Considera apenas dias de semana e exclui feriados de Cuiabá/MT
 */

/**
 * Retorna os feriados fixos (dia/mês)
 */
const FERIADOS_FIXOS = [
  { dia: 1, mes: 1, nome: 'Confraternização Universal' },
  { dia: 8, mes: 4, nome: 'Aniversário de Cuiabá' },
  { dia: 21, mes: 4, nome: 'Tiradentes' },
  { dia: 1, mes: 5, nome: 'Dia do Trabalho' },
  { dia: 7, mes: 9, nome: 'Independência do Brasil' },
  { dia: 12, mes: 10, nome: 'Nossa Senhora Aparecida' },
  { dia: 2, mes: 11, nome: 'Finados' },
  { dia: 15, mes: 11, nome: 'Proclamação da República' },
  { dia: 20, mes: 11, nome: 'Consciência Negra (MT)' },
  { dia: 25, mes: 12, nome: 'Natal' },
];

/**
 * Calcula a data da Páscoa usando o algoritmo de Meeus/Jones/Butcher
 */
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/**
 * Retorna os feriados móveis para um ano específico
 */
function getFeriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano);

  // Carnaval: 47 dias antes da Páscoa (terça-feira)
  const carnaval = new Date(pascoa);
  carnaval.setDate(pascoa.getDate() - 47);

  // Segunda-feira de Carnaval (dia anterior)
  const segundaCarnaval = new Date(carnaval);
  segundaCarnaval.setDate(carnaval.getDate() - 1);

  // Quarta-feira de Cinzas (dia seguinte, ponto facultativo)
  const quartaCinzas = new Date(carnaval);
  quartaCinzas.setDate(carnaval.getDate() + 1);

  // Sexta-feira Santa: 2 dias antes da Páscoa
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(pascoa.getDate() - 2);

  // Corpus Christi: 60 dias após a Páscoa
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);

  return [
    { data: segundaCarnaval, nome: 'Segunda de Carnaval' },
    { data: carnaval, nome: 'Terça de Carnaval' },
    { data: quartaCinzas, nome: 'Quarta de Cinzas' },
    { data: sextaSanta, nome: 'Sexta-feira Santa' },
    { data: corpusChristi, nome: 'Corpus Christi' },
  ];
}

/**
 * Retorna todos os feriados de um ano no formato Set de strings 'YYYY-MM-DD'
 */
function getFeriadosDoAno(ano) {
  const feriados = new Set();

  // Adiciona feriados fixos
  FERIADOS_FIXOS.forEach(({ dia, mes }) => {
    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    feriados.add(dataStr);
  });

  // Adiciona feriados móveis
  getFeriadosMoveis(ano).forEach(({ data }) => {
    const dataStr = data.toISOString().split('T')[0];
    feriados.add(dataStr);
  });

  return feriados;
}

/**
 * Verifica se uma data é dia útil (não é fim de semana nem feriado)
 */
function isDiaUtil(data, feriadosSet) {
  const diaSemana = data.getDay();
  // 0 = Domingo, 6 = Sábado
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }

  const dataStr = data.toISOString().split('T')[0];
  return !feriadosSet.has(dataStr);
}

/**
 * Conta os dias úteis em um período
 * @param {Date|string} inicio - Data inicial
 * @param {Date|string} fim - Data final
 * @returns {number} Número de dias úteis no período
 */
export function contarDiasUteis(inicio, fim) {
  // Handle string dates - if already contains 'T', parse as-is; otherwise add T12:00:00
  const parseDate = (d) => {
    if (typeof d !== 'string') return new Date(d);
    return d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00');
  };
  const dataInicio = parseDate(inicio);
  const dataFim = parseDate(fim);

  // Obter feriados dos anos envolvidos
  const anoInicio = dataInicio.getFullYear();
  const anoFim = dataFim.getFullYear();
  const feriados = new Set();

  for (let ano = anoInicio; ano <= anoFim; ano++) {
    getFeriadosDoAno(ano).forEach(f => feriados.add(f));
  }

  let diasUteis = 0;
  const dataAtual = new Date(dataInicio);

  while (dataAtual <= dataFim) {
    if (isDiaUtil(dataAtual, feriados)) {
      diasUteis++;
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  return diasUteis;
}

/**
 * Conta os dias úteis passados desde o início até hoje (ou até a data fim se hoje > fim)
 * @param {Date|string} inicio - Data inicial do período
 * @param {Date|string} fim - Data final do período
 * @returns {number} Número de dias úteis passados
 */
export function contarDiasUteisPassados(inicio, fim) {
  // Handle string dates - if already contains 'T', parse as-is; otherwise add T12:00:00
  const parseDate = (d) => {
    if (typeof d !== 'string') return new Date(d);
    return d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00');
  };
  const dataInicio = parseDate(inicio);
  const dataFim = parseDate(fim);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  // Se hoje está antes do início, 0 dias passados
  if (hoje < dataInicio) {
    return 0;
  }

  // A data limite é o menor entre hoje e a data fim
  const dataLimite = hoje <= dataFim ? hoje : dataFim;

  return contarDiasUteis(dataInicio, dataLimite);
}

/**
 * Conta os dias úteis restantes de hoje até o fim do período
 * @param {Date|string} fim - Data final do período
 * @returns {number} Número de dias úteis restantes
 */
export function contarDiasUteisRestantes(fim) {
  const dataFim = typeof fim === 'string' ? new Date(fim + 'T12:00:00') : new Date(fim);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  // Se hoje está depois do fim, 0 dias restantes
  if (hoje > dataFim) {
    return 0;
  }

  // Começa contando a partir de amanhã
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  return contarDiasUteis(amanha, dataFim);
}

/**
 * Retorna informações completas sobre dias úteis para um período
 * @param {string} dataInicio - Data inicial (YYYY-MM-DD)
 * @param {string} dataFim - Data final (YYYY-MM-DD)
 * @returns {Object} { totalDiasUteis, diasUteisPassados, diasUteisRestantes }
 */
export function getInfoDiasUteis(dataInicio, dataFim) {
  const totalDiasUteis = contarDiasUteis(dataInicio, dataFim);
  const diasUteisPassados = contarDiasUteisPassados(dataInicio, dataFim);
  const diasUteisRestantes = contarDiasUteisRestantes(dataFim);

  return {
    totalDiasUteis,
    diasUteisPassados,
    diasUteisRestantes,
  };
}

export default {
  contarDiasUteis,
  contarDiasUteisPassados,
  contarDiasUteisRestantes,
  getInfoDiasUteis,
};
