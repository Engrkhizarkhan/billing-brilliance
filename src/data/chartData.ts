/**
 * Static chart / display-only data used by dashboard and report pages.
 * These values are presentation placeholders; future iterations can pull
 * them from the backend report endpoints.
 */

export const revenueData = [
  { month: 'Oct', revenue: 980000 },
  { month: 'Nov', revenue: 1120000 },
  { month: 'Dec', revenue: 1050000 },
  { month: 'Jan', revenue: 1250000 },
  { month: 'Feb', revenue: 1180000 },
  { month: 'Mar', revenue: 1350000 },
];

export const paymentSuccessData = [
  { month: 'Oct', success: 85, failed: 15 },
  { month: 'Nov', success: 88, failed: 12 },
  { month: 'Dec', success: 82, failed: 18 },
  { month: 'Jan', success: 91, failed: 9 },
  { month: 'Feb', success: 87, failed: 13 },
  { month: 'Mar', success: 93, failed: 7 },
];

export const transactionVolumeData = [
  { month: 'Oct', volume: 450 },
  { month: 'Nov', volume: 520 },
  { month: 'Dec', volume: 480 },
  { month: 'Jan', volume: 610 },
  { month: 'Feb', volume: 570 },
  { month: 'Mar', volume: 680 },
];

export const feeCollectionByHead = [
  { name: 'Tuition', value: 2500000 },
  { name: 'Transport', value: 750000 },
  { name: 'Exam', value: 450000 },
  { name: 'Library', value: 250000 },
  { name: 'Lab', value: 400000 },
];

export const monthlyCollectionTarget = [
  { month: 'Oct', collected: 720000, target: 900000 },
  { month: 'Nov', collected: 810000, target: 900000 },
  { month: 'Dec', collected: 690000, target: 900000 },
  { month: 'Jan', collected: 880000, target: 900000 },
  { month: 'Feb', collected: 850000, target: 900000 },
  { month: 'Mar', collected: 920000, target: 900000 },
];
