export type Alert = {
  site_id: number;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
};

export type SiteBadge = 'Safe' | 'Warning' | 'Critical';

export function getSiteBadge(siteId: number, activeAlerts: Alert[]): SiteBadge {
  const siteAlerts = activeAlerts.filter((a) => a.site_id === siteId);

  if (siteAlerts.some((a) => a.severity === 'critical')) return 'Critical';
  if (siteAlerts.some((a) => a.severity === 'warning')) return 'Warning';
  return 'Safe';
}

export function badgeColor(badge: SiteBadge): string {
  if (badge === 'Critical') return '#d32f2f';
  if (badge === 'Warning') return '#f9a825';
  return '#2e7d32';
}

export type ReadingWithThresholds = {
  id: number;
  parameter_id: number;
  parameter_name: string;
  unit: string;
  value: string | number;
  safe_min: number;
  safe_max: number;
  warning_min: number;
  warning_max: number;
  recorded_at: string;
};

export function classifyValue(reading: ReadingWithThresholds): SiteBadge {
  const v = Number(reading.value);
  if (v >= reading.safe_min && v <= reading.safe_max) return 'Safe';
  if (v >= reading.warning_min && v <= reading.warning_max) return 'Warning';
  return 'Critical';
}

export type FilterStatus = 'OK' | 'Due Soon' | 'Overdue';

export function getFilterStatus(lastServicedDate: string, serviceIntervalDays: number): FilterStatus {
  const lastServiced = new Date(lastServicedDate);
  const dueDate = new Date(lastServiced);
  dueDate.setDate(dueDate.getDate() + serviceIntervalDays);

  const now = new Date();
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return 'Overdue';
  if (daysUntilDue <= 7) return 'Due Soon';
  return 'OK';
}

export function filterStatusColor(status: FilterStatus): string {
  if (status === 'Overdue') return '#d32f2f';
  if (status === 'Due Soon') return '#f9a825';
  return '#2e7d32';
}