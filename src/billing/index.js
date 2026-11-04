/**
 * Settings > Usage billing interface.
 *
 * getWeeklyUsage() -> { percent, used, limit, resetsAt, resetsInDays, source }
 * getSubscription() -> { plan, planId, priceLabel, period, renewsAt, status, placeholder, source }
 */
export {
  getWeeklyUsage,
  getSubscription,
  getUsageManagePrefs,
  setSoftLimitEnabled,
  setAlertPercent,
  DEFAULT_WEEKLY_LIMIT,
} from './billingService';
