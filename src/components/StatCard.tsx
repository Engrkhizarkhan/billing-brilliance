import { ReactNode } from 'react';
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
  <div className={`dashboard-card flex items-start justify-between ${className}`}>
    <div>
      <p className="stat-label">{title}</p>
      <p className="stat-value mt-1">{value}</p>
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trendUp ? 'text-success' : 'text-destructive'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
  </div>
);
