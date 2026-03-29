import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
}

export const ExportButton = ({ data, filename }: ExportButtonProps) => {
  const exportCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} rows to CSV`);
  };

  const exportPrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg">
          <Download className="w-4 h-4 mr-1.5" />Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />Export to Excel (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV}>
          <FileText className="w-4 h-4 mr-2" />Export to PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPrint}>
          <Printer className="w-4 h-4 mr-2" />Print View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
