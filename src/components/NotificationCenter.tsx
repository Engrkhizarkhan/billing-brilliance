import { useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Check, CreditCard, UserPlus, AlertTriangle, X, Shield, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { AppNotification } from '@/types';

const iconMap = {
  payment: CreditCard,
  applicant: UserPlus,
  alert: AlertTriangle,
  system: Shield,
};
const colorMap = {
  payment: 'text-success',
  applicant: 'text-primary',
  alert: 'text-warning',
  system: 'text-muted-foreground',
};

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Date(value).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const NotificationCenter = () => {
  const { data, loading, refetch } = useApiQuery(() => api.fetchNotifications(), []);
  const notifications = (data || []) as AppNotification[];
  const unread = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refetch();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [refetch]);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refetch();
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    await refetch();
  };

  const clearAll = async () => {
    await api.clearNotifications();
    await refetch();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
          <Bell className="w-[18px] h-[18px] text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={markAllRead}>
                <Check className="w-3 h-3 mr-1" />Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-destructive" onClick={clearAll}>
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => {
              const Icon = iconMap[n.type];
              return (
                <button key={n.id} onClick={() => void markRead(n.id)} className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${!n.isRead ? 'bg-primary/[0.02]' : ''}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorMap[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
