import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="empty-state py-20">
    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
      <Icon className="w-7 h-7 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} className="mt-5 rounded-xl">
        {actionLabel}
      </Button>
    )}
  </div>
);
