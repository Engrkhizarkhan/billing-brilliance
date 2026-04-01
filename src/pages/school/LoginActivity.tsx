import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { Shield } from 'lucide-react';

interface LoginEvent {
  id: string;
  user: string;
  email: string;
  role: 'admin' | 'finance' | 'staff' | 'viewer';
  timestamp: string;
  ip: string;
  device: string;
}

const mockLogins: LoginEvent[] = [
  { id: 'e1', user: 'Ayesha Khan', email: 'admin@school.edu', role: 'admin', timestamp: '2025-04-01 09:15', ip: '10.1.10.12', device: 'Chrome · Windows' },
  { id: 'e2', user: 'Bilal Ahmed', email: 'finance@school.edu', role: 'finance', timestamp: '2025-04-01 08:55', ip: '192.168.1.44', device: 'Safari · iOS' },
  { id: 'e3', user: 'Sara Ali', email: 'staff@school.edu', role: 'staff', timestamp: '2025-04-01 08:02', ip: '10.1.10.21', device: 'Edge · Windows' },
  { id: 'e4', user: 'Hamza Tariq', email: 'viewer@school.edu', role: 'viewer', timestamp: '2025-03-31 20:14', ip: '203.99.20.10', device: 'Firefox · macOS' },
  { id: 'e5', user: 'Bilal Ahmed', email: 'finance@school.edu', role: 'finance', timestamp: '2025-03-31 09:10', ip: '10.1.10.44', device: 'Chrome · Windows' },
];

const LoginActivity = () => {
  const [roleFilter, setRoleFilter] = useState<'all' | LoginEvent['role']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return mockLogins.filter((evt) => {
      const matchesSearch =
        evt.user.toLowerCase().includes(query) ||
        evt.email.toLowerCase().includes(query) ||
        evt.device.toLowerCase().includes(query) ||
        evt.ip.includes(search);
      const matchesRole = roleFilter === 'all' || evt.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Login Activity</h1>
          <p className="page-description">Track user sign-ins, failures, IPs, and devices.</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Shield className="w-3.5 h-3.5" /> Audit Trail (mock)
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
              {paginated.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell className="font-medium">{evt.user}</TableCell>
                  <TableCell>{evt.email}</TableCell>
                  <TableCell className="capitalize">{evt.role}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{evt.timestamp}</TableCell>
                  <TableCell className="font-mono text-xs">{evt.ip}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{evt.device}</TableCell>
                </TableRow>
              ))}
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
