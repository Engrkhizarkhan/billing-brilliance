import { applicants } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';

const ApplicantList = () => {
  const [search, setSearch] = useState('');

  const filtered = applicants.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.cnic.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Applicants</h1>
        <p className="page-description">Track applicant payments</p>
      </div>
      <FilterBar searchPlaceholder="Search by name or CNIC..." onSearch={setSearch} />
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>CNIC</TableHead>
              <TableHead>Consumer Number</TableHead>
              <TableHead>Payment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="font-mono">{a.cnic}</TableCell>
                <TableCell className="font-mono text-xs">{a.consumerNumber}</TableCell>
                <TableCell><StatusBadge status={a.paymentStatus} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ApplicantList;
