import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Props = { paymentId: string; receiptNumber: string; onSuccess: () => void | Promise<void> };

export const ReversePaymentDialog = ({ paymentId, receiptNumber, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (confirmation !== receiptNumber || reason.trim().length < 5) return;
    setSaving(true);
    try {
      const result = await api.reverseManualPayment(paymentId, confirmation, reason.trim());
      toast.success(`Payment reversed — ${result.data.receiptNumber}`);
      setOpen(false);
      setReason('');
      setConfirmation('');
      await onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reverse payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <AlertDialogTrigger asChild><Button size="sm" variant="ghost" title="Reverse manual payment"><RotateCcw className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reverse manual payment?</AlertDialogTitle>
          <AlertDialogDescription>This creates a compensating financial entry and reopens the bill. The original payment and audit history remain immutable. 1LINK payments cannot be reversed here.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Reason (required)</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          <div className="space-y-2"><Label>Type receipt <strong>{receiptNumber}</strong></Label><Input className="font-mono" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving || reason.trim().length < 5 || confirmation !== receiptNumber} onClick={(event) => { event.preventDefault(); void submit(); }}>Create reversal</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
