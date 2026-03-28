import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  paid: 'bg-success/10 text-success border-success/20',
  completed: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  partial: 'bg-warning/10 text-warning border-warning/20',
  overdue: 'bg-destructive/10 text-destructive border-destructive/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  suspended: 'bg-warning/10 text-warning border-warning/20',
  banned: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-muted text-muted-foreground border-border',
  inactive: 'bg-muted text-muted-foreground border-border',
};

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <Badge variant="outline" className={`capitalize font-medium ${statusStyles[status] || ''}`}>
    {status}
  </Badge>
);
