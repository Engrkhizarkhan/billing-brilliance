import { Button } from '@/components/ui/button';
export const QueryError = ({ message }: { message: string }) => (
  <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-6">
    <h2 className="font-semibold">Unable to load this view</h2>
    <p className="text-sm text-muted-foreground">{message}</p>
    <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
  </div>
);
