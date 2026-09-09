import { and, asc, count, eq, sql } from 'drizzle-orm';

import { db } from '../../db';
import { sales } from '../../db/schema';
import type { LocationScope } from '../shared/locationAccess';

const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 19_800_000;
const HISTORY_LOOKBACK_DAYS = 365;
const FORECAST_LOOKBACK_DAYS = 84;

export type DashboardForecastPoint = {
  date: string;
  forecastAmount: number;
  forecastSaleCount: number;
};

export type DashboardForecastWindow = {
  averageDailyAmount: number;
  changeFromLastPeriod: number | null;
  days: number;
  forecastAmount: number;
  forecastSaleCount: number;
  points: DashboardForecastPoint[];
  reason?: string;
  unavailable: boolean;
};

export type DashboardForecastAccuracy = {
  accuracy: number | null;
  evaluationWindows: number;
  forecastAmount: number;
  horizonDays: number;
  reason?: string;
  unavailable: boolean;
  actualAmount: number;
  weightedAbsolutePercentageError: number | null;
};

export type DashboardForecastSeasonality = {
  annualPatternAvailable: boolean;
  coverageDays: number;
  quietestMonth: DashboardSeasonalMonth | null;
  quietestDay: DashboardSeasonalDay | null;
  reason?: string;
  strongestMonth: DashboardSeasonalMonth | null;
  strongestDay: DashboardSeasonalDay | null;
  weekdays: DashboardSeasonalDay[];
};

export type DashboardSeasonalDay = {
  averageAmount: number;
  averageSaleCount: number;
  dayIndex: number;
  dayName: string;
  factor: number;
};

export type DashboardSeasonalMonth = {
  averageAmount: number;
  factor: number;
  monthIndex: number;
  monthName: string;
};

export type DashboardForecastRecommendation = {
  action: string;
  id: string;
  message: string;
  severity: 'info' | 'opportunity' | 'positive' | 'warning';
  title: string;
};

export type DashboardForecast = {
  confidence: 'high' | 'limited' | 'medium';
  dataThrough: string;
  details: {
    accuracy: {
      thirtyDay: DashboardForecastAccuracy;
      sevenDay: DashboardForecastAccuracy;
    };
    recommendations: DashboardForecastRecommendation[];
    seasonality: DashboardForecastSeasonality;
    thirtyDay: DashboardForecastWindow;
  } | null;
  historyDays: number;
  sevenDay: DashboardForecastWindow;
};

type DailySales = {
  saleCount: number;
  totalAmount: number;
};

type ForecastModel = {
  points: DashboardForecastPoint[];
  totalAmount: number;
  totalSaleCount: number;
  averageDailyAmount: number;
};

const money = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const dateAtUtc = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const addDays = (value: string, days: number) => new Date(dateAtUtc(value) + days * DAY_MS).toISOString().slice(0, 10);
const dayStart = (date: string) => new Date(`${date}T00:00:00.000+05:30`).getTime();
const differenceInDays = (fromDate: string, toDate: string) => Math.floor((dateAtUtc(toDate) - dateAtUtc(fromDate)) / DAY_MS);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
const dayOfWeek = (date: string) => new Date(`${date}T00:00:00.000Z`).getUTCDay();
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const locationFilters = (scope: LocationScope) => (scope === 'all' ? [] : [eq(sales.locationId, scope)]);

const range = (fromDate: string, toDate: string) => Array.from(
  { length: Math.max(differenceInDays(fromDate, toDate) + 1, 0) },
  (_, index) => addDays(fromDate, index),
);
const sumRange = (daily: Map<string, DailySales>, fromDate: string, toDate: string) => range(fromDate, toDate).reduce(
  (total, date) => {
    const row = daily.get(date);
    return {
      saleCount: total.saleCount + (row?.saleCount ?? 0),
      totalAmount: total.totalAmount + (row?.totalAmount ?? 0),
    };
  },
  { saleCount: 0, totalAmount: 0 },
);
const unavailableWindow = (days: number, reason: string): DashboardForecastWindow => ({
  averageDailyAmount: 0,
  changeFromLastPeriod: null,
  days,
  forecastAmount: 0,
  forecastSaleCount: 0,
  points: [],
  reason,
  unavailable: true,
});

/**
 * A deliberately conservative forecasting model. It uses only completed sales,
 * recent daily averages, a capped recent trend, and weekday demand factors. The
 * calculations stay explainable to operators and work without a paid AI service.
 */
const buildForecast = (
  daily: Map<string, DailySales>,
  firstSaleDate: string | null,
  trainingEndDate: string,
  horizonDays: number,
): DashboardForecastWindow => {
  const minimumHistory = horizonDays === 30 ? 56 : 28;
  const coverageDays = firstSaleDate ? differenceInDays(firstSaleDate, trainingEndDate) + 1 : 0;
  if (!firstSaleDate || coverageDays < minimumHistory) {
    return unavailableWindow(horizonDays, `At least ${minimumHistory} days of completed-sales history are needed.`);
  }

  const trainingDays = Math.min(coverageDays, FORECAST_LOOKBACK_DAYS);
  const trainingStartDate = addDays(trainingEndDate, -(trainingDays - 1));
  const trainingDates = range(trainingStartDate, trainingEndDate);
  const recentDays = Math.min(trainingDays, 28);
  const recentStartDate = addDays(trainingEndDate, -(recentDays - 1));
  const recent = sumRange(daily, recentStartDate, trainingEndDate);
  const recentDailyAmount = recent.totalAmount / recentDays;
  const recentDailySaleCount = recent.saleCount / recentDays;

  const priorDays = Math.min(recentDays, trainingDays - recentDays);
  const prior = priorDays > 0
    ? sumRange(daily, addDays(recentStartDate, -priorDays), addDays(recentStartDate, -1))
    : { saleCount: 0, totalAmount: 0 };
  const priorDailyAmount = priorDays > 0 ? prior.totalAmount / priorDays : 0;
  const priorDailySaleCount = priorDays > 0 ? prior.saleCount / priorDays : 0;
  const amountTrend = priorDailyAmount > 0 ? clamp(recentDailyAmount / priorDailyAmount, 0.85, 1.15) : 1;
  const countTrend = priorDailySaleCount > 0 ? clamp(recentDailySaleCount / priorDailySaleCount, 0.85, 1.15) : 1;

  const weekdayTotals = Array.from({ length: 7 }, () => ({ amount: 0, count: 0, days: 0 }));
  trainingDates.forEach((date) => {
    const row = daily.get(date) ?? { saleCount: 0, totalAmount: 0 };
    const weekday = weekdayTotals[dayOfWeek(date)];
    weekday.amount += row.totalAmount;
    weekday.count += row.saleCount;
    weekday.days += 1;
  });
  const weekdayFactors = weekdayTotals.map((weekday) => (
    trainingDays >= 28 && recentDailyAmount > 0 && weekday.days > 0
      ? clamp((weekday.amount / weekday.days) / recentDailyAmount, 0.65, 1.45)
      : 1
  ));
  const weekdayCountFactors = weekdayTotals.map((weekday) => (
    trainingDays >= 28 && recentDailySaleCount > 0 && weekday.days > 0
      ? clamp((weekday.count / weekday.days) / recentDailySaleCount, 0.65, 1.45)
      : 1
  ));

  const points = Array.from({ length: horizonDays }, (_, index) => {
    const date = addDays(trainingEndDate, index + 1);
    const weekday = dayOfWeek(date);
    return {
      date,
      forecastAmount: money(recentDailyAmount * amountTrend * weekdayFactors[weekday]),
      forecastSaleCount: Number((recentDailySaleCount * countTrend * weekdayCountFactors[weekday]).toFixed(1)),
    };
  });
  const forecastAmount = money(points.reduce((total, point) => total + point.forecastAmount, 0));
  const forecastSaleCount = Number(points.reduce((total, point) => total + point.forecastSaleCount, 0).toFixed(1));
  const previous = sumRange(daily, addDays(trainingEndDate, -(horizonDays - 1)), trainingEndDate);

  return {
    averageDailyAmount: money(forecastAmount / horizonDays),
    changeFromLastPeriod: previous.totalAmount === 0
      ? (forecastAmount === 0 ? 0 : null)
      : Number((((forecastAmount - previous.totalAmount) / previous.totalAmount) * 100).toFixed(1)),
    days: horizonDays,
    forecastAmount,
    forecastSaleCount,
    points,
    unavailable: false,
  };
};

const calculateAccuracy = (
  daily: Map<string, DailySales>,
  firstSaleDate: string | null,
  dataThrough: string,
  horizonDays: 7 | 30,
): DashboardForecastAccuracy => {
  const minimumHistory = horizonDays === 30 ? 56 : 28;
  const maxWindows = horizonDays === 30 ? 3 : 4;
  const total = { absoluteError: 0, actualAmount: 0, forecastAmount: 0, windows: 0 };

  for (let index = 0; index < maxWindows; index += 1) {
    const actualEndDate = addDays(dataThrough, -(index * horizonDays));
    const actualStartDate = addDays(actualEndDate, -(horizonDays - 1));
    const trainingEndDate = addDays(actualStartDate, -1);
    const coverageDays = firstSaleDate ? differenceInDays(firstSaleDate, trainingEndDate) + 1 : 0;
    if (coverageDays < minimumHistory) continue;

    const forecast = buildForecast(daily, firstSaleDate, trainingEndDate, horizonDays);
    if (forecast.unavailable) continue;
    const actual = sumRange(daily, actualStartDate, actualEndDate);
    if (actual.totalAmount <= 0) continue;

    total.absoluteError += Math.abs(forecast.forecastAmount - actual.totalAmount);
    total.actualAmount += actual.totalAmount;
    total.forecastAmount += forecast.forecastAmount;
    total.windows += 1;
  }

  if (!total.windows || total.actualAmount <= 0) {
    return {
      accuracy: null,
      actualAmount: 0,
      evaluationWindows: 0,
      forecastAmount: 0,
      horizonDays,
      reason: 'More completed-sales history is needed to measure forecast accuracy.',
      unavailable: true,
      weightedAbsolutePercentageError: null,
    };
  }

  const weightedAbsolutePercentageError = Number(((total.absoluteError / total.actualAmount) * 100).toFixed(1));
  return {
    accuracy: Number((100 - clamp(weightedAbsolutePercentageError, 0, 100)).toFixed(1)),
    actualAmount: money(total.actualAmount),
    evaluationWindows: total.windows,
    forecastAmount: money(total.forecastAmount),
    horizonDays,
    unavailable: false,
    weightedAbsolutePercentageError,
  };
};

const calculateSeasonality = (
  daily: Map<string, DailySales>,
  firstSaleDate: string | null,
  dataThrough: string,
): DashboardForecastSeasonality => {
  const coverageDays = firstSaleDate ? differenceInDays(firstSaleDate, dataThrough) + 1 : 0;
  if (!firstSaleDate || coverageDays < 28) {
    return {
      annualPatternAvailable: false,
      coverageDays,
      quietestMonth: null,
      quietestDay: null,
      reason: 'At least four weeks of completed sales are needed for weekday demand patterns.',
      strongestMonth: null,
      strongestDay: null,
      weekdays: [],
    };
  }
  const daysUsed = Math.min(coverageDays, FORECAST_LOOKBACK_DAYS);
  const periodStart = addDays(dataThrough, -(daysUsed - 1));
  const totals = Array.from({ length: 7 }, () => ({ amount: 0, count: 0, days: 0 }));
  range(periodStart, dataThrough).forEach((date) => {
    const row = daily.get(date) ?? { saleCount: 0, totalAmount: 0 };
    const bucket = totals[dayOfWeek(date)];
    bucket.amount += row.totalAmount;
    bucket.count += row.saleCount;
    bucket.days += 1;
  });
  const totalAmount = totals.reduce((sum, bucket) => sum + bucket.amount, 0);
  const averageDailyAmount = totalAmount / daysUsed;
  const weekdays = totals.map((bucket, dayIndex) => ({
    averageAmount: money(bucket.days ? bucket.amount / bucket.days : 0),
    averageSaleCount: Number((bucket.days ? bucket.count / bucket.days : 0).toFixed(1)),
    dayIndex,
    dayName: weekdayNames[dayIndex],
    factor: averageDailyAmount > 0 ? Number(clamp((bucket.days ? bucket.amount / bucket.days : 0) / averageDailyAmount, 0, 9).toFixed(2)) : 0,
  }));
  const ordered = [...weekdays].sort((left, right) => left.averageAmount - right.averageAmount);
  const annualPatternAvailable = coverageDays >= 365;
  const monthlyTotals = Array.from({ length: 12 }, () => ({ amount: 0, days: 0 }));
  if (annualPatternAvailable) {
    const annualStartDate = addDays(dataThrough, -364);
    range(annualStartDate, dataThrough).forEach((date) => {
      const row = daily.get(date) ?? { saleCount: 0, totalAmount: 0 };
      const bucket = monthlyTotals[new Date(`${date}T00:00:00.000Z`).getUTCMonth()];
      bucket.amount += row.totalAmount;
      bucket.days += 1;
    });
  }
  const annualDailyAverage = annualPatternAvailable
    ? monthlyTotals.reduce((total, month) => total + month.amount, 0) / 365
    : 0;
  const monthly = annualPatternAvailable ? monthlyTotals.map((month, monthIndex) => ({
    averageAmount: money(month.days ? month.amount / month.days : 0),
    factor: annualDailyAverage > 0 ? Number(clamp((month.days ? month.amount / month.days : 0) / annualDailyAverage, 0, 9).toFixed(2)) : 0,
    monthIndex,
    monthName: monthNames[monthIndex],
  })) : [];
  const orderedMonths = [...monthly].sort((left, right) => left.averageAmount - right.averageAmount);
  return {
    annualPatternAvailable,
    coverageDays,
    quietestMonth: orderedMonths[0] ?? null,
    quietestDay: ordered[0] ?? null,
    strongestMonth: orderedMonths.at(-1) ?? null,
    strongestDay: ordered.at(-1) ?? null,
    weekdays,
  };
};

const buildRecommendations = (
  sevenDay: DashboardForecastWindow,
  thirtyDay: DashboardForecastWindow,
  seasonality: DashboardForecastSeasonality,
  accuracy: { sevenDay: DashboardForecastAccuracy; thirtyDay: DashboardForecastAccuracy },
): DashboardForecastRecommendation[] => {
  const recommendations: DashboardForecastRecommendation[] = [];

  if (!sevenDay.unavailable && sevenDay.changeFromLastPeriod !== null) {
    if (sevenDay.changeFromLastPeriod <= -10) {
      recommendations.push({
        action: 'Review the sales plan and check fast-moving product availability before the week begins.',
        id: 'forecast-seven-day-decline',
        message: `The next 7 days are forecast ${Math.abs(sevenDay.changeFromLastPeriod).toFixed(1)}% below the previous 7 completed days.`,
        severity: 'warning',
        title: 'Sales outlook has softened',
      });
    } else if (sevenDay.changeFromLastPeriod >= 10) {
      recommendations.push({
        action: 'Prepare staff coverage and verify stock for the strongest-selling categories.',
        id: 'forecast-seven-day-growth',
        message: `The next 7 days are forecast ${sevenDay.changeFromLastPeriod.toFixed(1)}% above the previous 7 completed days.`,
        severity: 'opportunity',
        title: 'Sales opportunity ahead',
      });
    }
  }

  if (!seasonality.reason && seasonality.strongestDay && seasonality.quietestDay
    && seasonality.strongestDay.factor >= 1.15 && seasonality.quietestDay.factor <= 0.85) {
    recommendations.push({
      action: `Plan promotions around ${seasonality.quietestDay.dayName} and ensure coverage for ${seasonality.strongestDay.dayName}.`,
      id: 'forecast-weekday-pattern',
      message: `${seasonality.strongestDay.dayName} averages ${Math.round((seasonality.strongestDay.factor - 1) * 100)}% above the recent daily baseline.`,
      severity: 'opportunity',
      title: 'Use the weekday demand pattern',
    });
  }

  if (seasonality.annualPatternAvailable && seasonality.strongestMonth && seasonality.strongestMonth.factor >= 1.15) {
    recommendations.push({
      action: `Plan stock and campaign activity ahead of ${seasonality.strongestMonth.monthName}, then compare the outcome with the forecast.`,
      id: 'forecast-annual-pattern',
      message: `${seasonality.strongestMonth.monthName} has averaged ${Math.round((seasonality.strongestMonth.factor - 1) * 100)}% above the annual daily baseline.`,
      severity: 'opportunity',
      title: 'Prepare for the annual sales pattern',
    });
  }

  const bestAccuracy = accuracy.sevenDay.unavailable ? accuracy.thirtyDay : accuracy.sevenDay;
  if (!bestAccuracy.unavailable && bestAccuracy.accuracy !== null) {
    if (bestAccuracy.accuracy < 70) {
      recommendations.push({
        action: 'Use the outlook as a guide only and avoid making large stock commitments until more sales history is collected.',
        id: 'forecast-low-accuracy',
        message: `Recent ${bestAccuracy.horizonDays}-day back-tests matched actual sales at ${bestAccuracy.accuracy.toFixed(1)}%.`,
        severity: 'warning',
        title: 'Forecast variation is still high',
      });
    } else if (bestAccuracy.accuracy >= 85) {
      recommendations.push({
        action: 'Use the forecast in weekly planning, while continuing to monitor actual sales each day.',
        id: 'forecast-high-accuracy',
        message: `Recent ${bestAccuracy.horizonDays}-day back-tests matched actual sales at ${bestAccuracy.accuracy.toFixed(1)}%.`,
        severity: 'positive',
        title: 'The sales outlook is tracking well',
      });
    }
  }

  if (recommendations.length === 0 && !thirtyDay.unavailable) {
    recommendations.push({
      action: 'Review this outlook with the sales team and compare actual sales with the forecast each week.',
      id: 'forecast-monitor-outlook',
      message: 'Demand is currently within the recent normal range.',
      severity: 'info',
      title: 'Continue monitoring the sales outlook',
    });
  }

  return recommendations.slice(0, 3);
};

export const getDashboardForecast = async (
  scope: LocationScope,
  today: string,
  includeDetails: boolean,
): Promise<DashboardForecast> => {
  const historyStart = addDays(today, -HISTORY_LOOKBACK_DAYS);
  const dataThrough = addDays(today, -1);
  const dayBucket = sql<number>`floor((${sales.timestamp} + ${COLOMBO_OFFSET_MS}) / ${DAY_MS})`;
  const rows = await db.select({
    bucket: dayBucket,
    saleCount: count(),
    totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
  }).from(sales).where(and(
    eq(sales.status, 'completed'),
    sql`${sales.timestamp} >= ${dayStart(historyStart)}`,
    ...locationFilters(scope),
  )).groupBy(dayBucket).orderBy(asc(dayBucket));

  const daily = new Map(rows.map((row) => [
    new Date(Number(row.bucket) * DAY_MS).toISOString().slice(0, 10),
    { saleCount: Number(row.saleCount), totalAmount: money(row.totalAmount) },
  ]));
  const firstSaleDate = [...daily.keys()].filter((date) => date <= dataThrough).sort()[0] ?? null;
  const historyDays = firstSaleDate ? Math.max(differenceInDays(firstSaleDate, dataThrough) + 1, 0) : 0;
  const sevenDay = buildForecast(daily, firstSaleDate, dataThrough, 7);

  if (!includeDetails) {
    return {
      confidence: historyDays >= 120 ? 'high' : historyDays >= 56 ? 'medium' : 'limited',
      dataThrough,
      details: null,
      historyDays,
      sevenDay,
    };
  }

  const thirtyDay = buildForecast(daily, firstSaleDate, dataThrough, 30);
  const seasonality = calculateSeasonality(daily, firstSaleDate, dataThrough);
  const accuracy = {
    sevenDay: calculateAccuracy(daily, firstSaleDate, dataThrough, 7),
    thirtyDay: calculateAccuracy(daily, firstSaleDate, dataThrough, 30),
  };
  return {
    confidence: historyDays >= 120 ? 'high' : historyDays >= 56 ? 'medium' : 'limited',
    dataThrough,
    details: {
      accuracy,
      recommendations: buildRecommendations(sevenDay, thirtyDay, seasonality, accuracy),
      seasonality,
      thirtyDay,
    },
    historyDays,
    sevenDay,
  };
};
