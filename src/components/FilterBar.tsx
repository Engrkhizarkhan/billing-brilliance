import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface FilterBarProps {
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  onFilterChange?: (key: string, value: string) => void;
  children?: React.ReactNode;
}

export const FilterBar = ({ searchPlaceholder = 'Search...', onSearch, filters, onFilterChange, children }: FilterBarProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder={searchPlaceholder}
        className="pl-10 h-10 rounded-xl bg-card border-border"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
    {filters?.map((f) => (
      <Select key={f.key} onValueChange={(v) => onFilterChange?.(f.key, v)}>
        <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl bg-card">
          <SelectValue placeholder={f.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {f.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    ))}
    {children}
  </div>
);
