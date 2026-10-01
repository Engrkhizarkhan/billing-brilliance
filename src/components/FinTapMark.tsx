import markUrl from '../../website/assets/favicon.svg?no-inline';

/** Reuse the marketing site's original mark rather than a separate app logo. */
export function FinTapMark({ className = '' }: { className?: string }) {
  return <img src={markUrl} alt="FinTap" width={40} height={40} className={`shrink-0 ${className}`} />;
}
