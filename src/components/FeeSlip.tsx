import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPKR } from '@/lib/formatters';
import { Copy, Printer } from 'lucide-react';

interface FeeSlipProps {
  studentName: string;
  fatherName?: string;
  className?: string;
  section?: string;
  consumerNumber: string;
  billId?: string;
  amount: number;
  dueDate: string;
  status: string;
  invoiceNumber?: string;
  qrPayload: string;
}

export const FeeSlip = ({
  studentName,
  fatherName,
  className,
  section,
  consumerNumber,
  billId,
  amount,
  dueDate,
  status,
  invoiceNumber,
  qrPayload,
}: FeeSlipProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const slipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(qrPayload, { width: 240, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrPayload]);

  const copyPayload = () => {
    navigator.clipboard.writeText(qrPayload).catch(() => {});
  };

  const printSlip = () => {
    if (!slipRef.current) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    const { document: doc } = printWindow;
    doc.write('<html><head><title>Fee Slip</title>');
    document
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((node) => { doc.write(node.outerHTML); });
    doc.write('</head><body>');
    doc.write(slipRef.current.outerHTML);
    doc.write('</body></html>');
    doc.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <Card ref={slipRef} className="border-primary/20 shadow-md">
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Fee Slip</h3>
            <Badge variant="secondary" className="capitalize">{status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Present this QR in JazzCash / Easypaisa / bank app to pay via 1BILL.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Student</p><p className="font-medium">{studentName}</p></div>
            <div><p className="text-xs text-muted-foreground">Father</p><p className="font-medium">{fatherName || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Class / Section</p><p className="font-medium">{className} {section}</p></div>
            <div><p className="text-xs text-muted-foreground">Consumer #</p><p className="font-mono text-xs">{consumerNumber}</p></div>
            <div><p className="text-xs text-muted-foreground">Bill ID</p><p className="font-mono text-xs">{billId || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Invoice #</p><p className="font-mono text-xs">{invoiceNumber || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-semibold">{formatPKR(amount)}</p></div>
            <div><p className="text-xs text-muted-foreground">Due Date</p><p className="font-medium">{dueDate}</p></div>
          </div>
          <div className="flex gap-2 print-hidden">
            <Button size="sm" variant="outline" onClick={copyPayload} className="rounded-lg">
              <Copy className="w-4 h-4 mr-2" /> Copy payload
            </Button>
            <Button size="sm" onClick={printSlip} className="rounded-lg">
              <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Fee slip QR" className="w-48 h-48 rounded-xl border border-border bg-white p-2" />
          ) : (
            <div className="w-48 h-48 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
              QR unavailable
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FeeSlip;
