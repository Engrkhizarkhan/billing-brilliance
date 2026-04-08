import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { Shield, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { AuditLog, SchoolAccessRole } from '@/types';

type LoginEventRole = 'admin' | SchoolAccessRole;

interface LoginEvent {
  id: string;
  user: string;
  email: string;
  role: LoginEventRole;
  timestamp: string;
  ip: string;
  device: string;
}

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const resolveLoginRole = (log: AuditLog): LoginEventRole => {
  if (log.userRole === 'admin') return 'admin';
  if (log.schoolAccessRole) return log.schoolAccessRole;
  return 'staff';
};

const LoginActivity = () => {
  const [roleFilter, setRoleFilter] = useState<'all' | LoginEventRole>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, loading } = useApiQuery(() => api.fetchAuditLogs({ action: 'login', pageSize: 500 }), []);

  const events = useMemo(() => {
    const logs = (data || []) as AuditLog[];
    return logs.map((log) => ({
      id: log.id,
      user: log.userName,
      email: log.userEmail || 'Unknown',
      role: resolveLoginRole(log),
      timestamp: formatTimestamp(log.createdAt),
      ip: log.ipAddress || '-',
      device: log.userAgent || 'Unknown device',
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return events.filter((evt) => {
      const matchesSearch =
        evt.user.toLowerCase().includes(query) ||
        evt.email.toLowerCase().includes(query) ||
        evt.device.toLowerCase().includes(query) ||
        evt.ip.includes(search);
      const matchesRole = roleFilter === 'all' || evt.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [events, roleFilter, search]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Login Activity</h1>
          <p className="page-description">Track user sign-ins, failures, IPs, and devices.</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Shield className="w-3.5 h-3.5" /> Live Audit Trail
        </Badge>
      </div>

      <FilterBar
        searchPlaceholder="Search by user, email, IP, or device..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'role',
            label: 'Role',
            options: [
              { value: 'admin', label: 'Admin' },
              { value: 'finance', label: 'Finance' },
              { value: 'staff', label: 'Staff' },
              { value: 'viewer', label: 'Viewer' },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'role') setRoleFilter((value as LoginEvent['role']) ?? 'all');
          setPage(1);
        }}
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading login activity...</span>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No login events match the current filters.</TableCell>
                </TableRow>
              ) : (
                paginated.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-medium">{evt.user}</TableCell>
                    <TableCell>{evt.email}</TableCell>
                    <TableCell className="capitalize">{evt.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{evt.timestamp}</TableCell>
                    <TableCell className="font-mono text-xs">{evt.ip}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{evt.device}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="px-4 py-3">
            <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginActivity;
