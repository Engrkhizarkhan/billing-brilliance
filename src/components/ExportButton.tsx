import { encodeCsv } from '@/lib/csv';
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
    const csv = encodeCsv(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} rows to CSV`);
  };

  const exportPDF = async () => {
    if (!data.length) return;
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const document = new jsPDF({ orientation: 'landscape' });
      document.setFontSize(14);
      document.text(filename.replace(/[-_]/g, ' '), 14, 15);
      const headers = Object.keys(data[0]);
      autoTable(document, { head: [headers], body: data.map(row => headers.map(key => String(row[key] ?? ''))),
        startY: 22, styles: { fontSize: 8, overflow: 'linebreak' }, margin: { top: 15, right: 10, bottom: 15, left: 10 } });
      document.save(`${filename}.pdf`);
      toast.success(`Exported ${data.length} rows to PDF`);
    } catch { toast.error('Unable to create PDF. Please retry.'); }
  };

  const exportPrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg">
          <Download className="w-4 h-4 mr-1.5" />Export displayed rows
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />Export displayed rows (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportPDF()}>
          <FileText className="w-4 h-4 mr-2" />Export displayed rows (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPrint}>
          <Printer className="w-4 h-4 mr-2" />Print View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
