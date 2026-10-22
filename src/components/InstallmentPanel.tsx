import { useEffect, useState } from 'react';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPKR } from '@/lib/formatters';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

type Part = { amount: string; dueDate: string; lateFee: string };
export function InstallmentPanel({invoice,onClose,onCreated}:{invoice:Invoice|null;onClose:()=>void;onCreated:()=>void}) {
  const user=useAuthStore(state=>state.impersonatedUser || state.user);
  const canManage=user?.role==='admin' || user?.schoolAccessRole==='admin';
  const {data:policy,error,refetch}=useApiQuery(()=>api.fetchBillingPolicy(),[]);
  const [parts,setParts]=useState<Part[]>([]);
  const [count,setCount]=useState(2);
  const [busy,setBusy]=useState(false);
  const divide=(bill:Invoice,n:number)=>{
    const cents=Math.round(Number(bill.amount)*100),regular=Math.floor(cents/n);
    const fee=Math.round(Number(bill.lateFee||0)*100),regularFee=Math.floor(fee/n);
    return Array.from({length:n},(_,i)=>{
      const date=new Date(`${bill.dueDate}T00:00:00Z`);const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+i);const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,lastDay));
      return {amount:((i===n-1?cents-regular*(n-1):regular)/100).toFixed(2),dueDate:date.toISOString().slice(0,10),lateFee:((i===n-1?fee-regularFee*(n-1):regularFee)/100).toFixed(2)};
    });
  };
  useEffect(()=>{if(invoice){setParts(divide(invoice,2));setCount(2);}},[invoice]);
  const total=parts.reduce((sum,p)=>sum+Math.round(Number(p.amount||0)*100),0);
  const save=async()=>{
    if(!invoice)return;
    if(total!==Math.round(Number(invoice.amount)*100)||parts.some(p=>Number(p.amount)<=0||!p.dueDate))return toast.error('Enter valid installments that total the original bill exactly.');
    setBusy(true);
    try{await api.splitInvoice(invoice.id,parts.map(p=>({amount:Number(p.amount),dueDate:p.dueDate,lateFee:Number(p.lateFee||0)})));toast.success('Installment bills created. Use the new consumer numbers shown on each invoice.');onClose();onCreated();await refetch();}
    catch(e){toast.error(e instanceof Error?e.message:'Unable to create installments');}finally{setBusy(false);}
  };
  return <>
    <section className="rounded-xl border bg-card p-4 space-y-2" aria-label="Installment settings">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Installment plans</h2><p className="text-sm text-muted-foreground">Optional for schools and universities. Each installment has its own bill number and due date.</p></div>
      {canManage && policy?.billingMode==='invoice'&&<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{await api.setInstallmentsEnabled(!policy.installmentsEnabled);await refetch();}catch(e){toast.error(e instanceof Error?e.message:'Unable to update settings');}finally{setBusy(false);}}}>{policy.installmentsEnabled?'Disable new installment plans':'Enable installments'}</Button>}</div>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {policy&&<p className={`text-xs ${policy.capacityWarning?'text-destructive':'text-muted-foreground'}`}>{policy.remaining.toLocaleString()} of {policy.capacity.toLocaleString()} consumer numbers remain. Numbers are never reused.{policy.capacityWarning?' Capacity is running low; contact the administrator.':''}</p>}
      {policy?.billingMode==='invoice'&&<p className="text-xs text-muted-foreground">{policy.installmentsEnabled?'Choose “Split into installments” beside an unpaid bill.':'Installments are off. Bills can still be issued and paid normally. Existing installment bills remain valid.'}</p>}
      {policy?.billingMode==='legacy'&&<p className="text-xs text-muted-foreground">This institution still uses historical student numbers. Bill-specific numbering must be enabled before creating installments.</p>}
    </section>
    <Dialog open={Boolean(invoice)} onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Split fee into installments</DialogTitle><DialogDescription>{invoice?.studentName} · {invoice?.invoiceNumber} · {formatPKR(invoice?.amount||0)}. Saving retires the original bill number and creates a new number for each installment.</DialogDescription></DialogHeader>
      <Label htmlFor="installment-count">Number of installments</Label><Input id="installment-count" type="number" min={2} max={60} value={count} onChange={e=>{const n=Number(e.target.value);setCount(n);if(invoice&&n>=2&&n<=60)setParts(divide(invoice,n));}}/>
      <p className="text-xs text-muted-foreground">Edit amounts and dates below. The original late fee is distributed between installments; you can adjust each fee. Only the installment paid is settled. The remaining installments stay outstanding.</p>
      {parts.map((part,i)=><div key={i} className="grid grid-cols-3 gap-2 border-t pt-3"><div><Label htmlFor={`part-amount-${i}`}>Amount {i+1} (PKR)</Label><Input id={`part-amount-${i}`} type="number" min="0.01" step="0.01" value={part.amount} onChange={e=>setParts(parts.map((p,j)=>j===i?{...p,amount:e.target.value}:p))}/></div><div><Label htmlFor={`part-date-${i}`}>Due date {i+1}</Label><Input id={`part-date-${i}`} type="date" value={part.dueDate} onChange={e=>setParts(parts.map((p,j)=>j===i?{...p,dueDate:e.target.value}:p))}/></div><div><Label htmlFor={`part-fee-${i}`}>Late fee {i+1}</Label><Input id={`part-fee-${i}`} type="number" min="0" step="0.01" value={part.lateFee} onChange={e=>setParts(parts.map((p,j)=>j===i?{...p,lateFee:e.target.value}:p))}/></div></div>)}
      <p className="font-medium">Installment total: {formatPKR(total/100)}</p>
      <Button onClick={()=>void save()} disabled={busy||!policy?.installmentsEnabled||count!==parts.length||total!==Math.round(Number(invoice?.amount||0)*100)}>{busy?'Creating bills…':'Create installment bills'}</Button>
    </DialogContent></Dialog>
  </>;
}
