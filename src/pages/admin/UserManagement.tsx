import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'banned';
}

const initialUsers: MockUser[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active' },
  { id: '2', name: 'School Admin', email: 'school@example.com', role: 'school', status: 'active' },
  { id: '3', name: 'ETA Manager', email: 'eta@example.com', role: 'eta', status: 'active' },
  { id: '4', name: 'John Doe', email: 'john@school.com', role: 'school', status: 'active' },
  { id: '5', name: 'Jane Smith', email: 'jane@agency.com', role: 'eta', status: 'banned' },
];

const UserManagement = () => {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const banUser = (id: string) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, status: 'banned' as const } : u)));
    toast.error('User has been banned');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">User Management</h1>
        <p className="page-description">Manage platform users</p>
      </div>
      <FilterBar searchPlaceholder="Search users..." onSearch={setSearch} />
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell className="capitalize">{u.role}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell>
                  {u.status !== 'banned' && (
                    <Button variant="ghost" size="sm" onClick={() => banUser(u.id)}>
                      <Ban className="w-4 h-4 text-destructive mr-1" /> Ban
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
