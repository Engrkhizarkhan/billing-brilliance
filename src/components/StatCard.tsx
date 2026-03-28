import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export const StatCard = ({ title, value, icon: Icon, trend, trendUp, className = '' }: StatCardProps) => (
  <div className={`dashboard-card ${className}`}>
    <div className="flex items-center justify-between mb-3">
      <p className="stat-label">{title}</p>
      <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </div>
    <p className="stat-value">{value}</p>
    {trend && (
      <p className={`text-[11px] mt-1.5 font-medium ${trendUp ? 'text-success' : 'text-destructive'}`}>
        {trendUp ? '↑' : '↓'} {trend}
      </p>
    )}
  </div>
);
