import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuthStore } from '@/store/authStore';
import { Student, Transaction } from '@/types';
import { GraduationCap, CreditCard, Search } from 'lucide-react';

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const [query, setQuery] = useState('');

  // Only fetch data relevant to the user's role
  const { data: studentsData } = useApiQuery(() => open && isSchool ? api.fetchStudents({ pageSize: 500 }) : Promise.resolve({ data: [] }), [open, isSchool]);
  const { data: txnData } = useApiQuery(() => open && isAdmin ? api.fetchTransactions({ pageSize: 500 }) : Promise.resolve({ data: [] }), [open, isAdmin]);

  const studentsList = (studentsData || []) as Student[];
  const transactionsList = (txnData || []) as Transaction[];

  const filteredStudents = useMemo(() => isSchool && query.length > 1 ? studentsList.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.consumerNumber.includes(query)).slice(0, 5) : [], [query, studentsList, isSchool]);
  const filteredTxns = useMemo(() => isAdmin && query.length > 1 ? transactionsList.filter(t => t.transactionId.toLowerCase().includes(query.toLowerCase()) || t.consumerNumber.includes(query)).slice(0, 5) : [], [query, transactionsList, isAdmin]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-xs text-muted-foreground transition-colors">
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden sm:inline text-[10px] font-mono bg-background border px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search students, applicants, transactions…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {filteredStudents.length > 0 && (
            <CommandGroup heading="Students">
              {filteredStudents.map(s => (
                <CommandItem key={s.id} onSelect={() => { navigate('/school/students'); setOpen(false); }}>
                  <GraduationCap className="w-4 h-4 mr-2 text-primary" />
                  <span>{s.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{s.class}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredTxns.length > 0 && (
            <CommandGroup heading="Transactions">
              {filteredTxns.map(t => (
                <CommandItem key={t.id} onSelect={() => { navigate('/admin/transactions'); setOpen(false); }}>
                  <CreditCard className="w-4 h-4 mr-2 text-success" />
                  <span>{t.transactionId}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">₨ {t.amount.toLocaleString()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
