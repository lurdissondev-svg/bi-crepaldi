import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  parseISO,
  isValid,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachMonthOfInterval,
  getMonth,
  getYear,
  differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale/index.js';
import { utcToZonedTime, format as formatTz } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export const formatDateBR = (date) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
};

export const formatDateTimeBR = (date) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

export const formatPercentage = (value, decimals = 2) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

export const getDateRanges = () => {
  const now = new Date();
  const zonedNow = utcToZonedTime(now, TIMEZONE);

  const formatDate = (date) => formatTz(date, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: TIMEZONE });

  return {
    today: {
      start: formatDate(startOfDay(zonedNow)),
      end: formatDate(endOfDay(zonedNow)),
    },
    thisMonth: {
      start: formatDate(startOfMonth(zonedNow)),
      end: formatDate(endOfMonth(zonedNow)),
    },
    lastMonth: {
      start: formatDate(startOfMonth(subMonths(zonedNow, 1))),
      end: formatDate(endOfMonth(subMonths(zonedNow, 1))),
    },
    thisYear: {
      start: formatDate(startOfYear(zonedNow)),
      end: formatDate(endOfYear(zonedNow)),
    },
    lastYear: {
      start: formatDate(startOfYear(subYears(zonedNow, 1))),
      end: formatDate(endOfYear(subYears(zonedNow, 1))),
    },
  };
};

export const getDaysInRange = (startDate, endDate) => {
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
};

export const getMonthsInRange = (startDate, endDate) => {
  return eachMonthOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
};

export const calculateDaysSince = (date) => {
  if (!date) return 0;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return 0;
  return differenceInDays(new Date(), parsed);
};

export const getDecade = (date) => {
  const day = typeof date === 'string' ? parseISO(date).getDate() : date.getDate();
  if (day <= 10) return 1;
  if (day <= 20) return 2;
  return 3;
};

export default {
  formatDateBR,
  formatDateTimeBR,
  formatCurrency,
  formatPercentage,
  getDateRanges,
  getDaysInRange,
  getMonthsInRange,
  calculateDaysSince,
  getDecade,
};
