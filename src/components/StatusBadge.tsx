interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label?: string }> = {
  active:    { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  paid:      { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  completed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  pending:   { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  partial:   { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  overdue:   { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  failed:    { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  suspended: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  banned:    { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  expired:   { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  inactive:  { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  deactivated: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status] || { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize tracking-wide ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
};
