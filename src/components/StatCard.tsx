import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  iconColor?: string;
}

export const StatCard = ({ title, value, icon: Icon, trend, trendUp, className = '', iconColor }: StatCardProps) => (
  <div className={`dashboard-card group ${className}`}>
    <div className="flex items-center justify-between mb-3">
      <p className="stat-label">{title}</p>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${iconColor || 'bg-primary/8 group-hover:bg-primary/12'}`}>
        <Icon className={`w-[18px] h-[18px] ${iconColor ? 'text-current' : 'text-primary'}`} />
      </div>
    </div>
    <p className="stat-value">{value}</p>
    {trend && (
      <div className="mt-2">
        <span className={trendUp ? 'metric-change-up' : 'metric-change-down'}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>
    )}
  </div>
);
