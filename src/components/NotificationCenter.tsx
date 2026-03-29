import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Check, CreditCard, UserPlus, AlertTriangle, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'payment' | 'applicant' | 'alert';
  time: string;
  read: boolean;
}

const initialNotifications: Notification[] = [
  { id: '1', title: 'Payment Received', body: 'Ali Raza paid ₨ 5,000 — Tuition Fee', type: 'payment', time: '2 min ago', read: false },
  { id: '2', title: 'New Applicant', body: 'Tariq Mehmood submitted application for MDCAT 2025', type: 'applicant', time: '15 min ago', read: false },
  { id: '3', title: 'Bill Overdue', body: '3 students have dues older than 30 days', type: 'alert', time: '1 hour ago', read: false },
  { id: '4', title: 'Payment Received', body: 'Sara Ali paid ₨ 15,000 — Monthly Fee', type: 'payment', time: '2 hours ago', read: true },
  { id: '5', title: 'Bulk Import Complete', body: '25 students imported successfully', type: 'applicant', time: '3 hours ago', read: true },
];

const iconMap = { payment: CreditCard, applicant: UserPlus, alert: AlertTriangle };
const colorMap = { payment: 'text-success', applicant: 'text-primary', alert: 'text-warning' };

export const NotificationCenter = () => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);

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
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map(n => {
              const Icon = iconMap[n.type];
              return (
                <button key={n.id} onClick={() => markRead(n.id)} className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${!n.read ? 'bg-primary/[0.02]' : ''}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorMap[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
