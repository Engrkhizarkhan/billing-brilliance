import { create } from 'zustand';

interface OrgSecurityStore {
  sourceIp: string;
  setSourceIp: (sourceIp: string) => void;
  reset: () => void;
}

const STORAGE_KEY = 'org-payment-security-context';
const DEFAULT_SOURCE_IP = '';

const readStoredState = () => {
  if (typeof window === 'undefined') {
    return {
      sourceIp: DEFAULT_SOURCE_IP,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        sourceIp: DEFAULT_SOURCE_IP,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Pick<OrgSecurityStore, 'sourceIp'>>;
    return {
      sourceIp: parsed.sourceIp || DEFAULT_SOURCE_IP,
    };
  } catch {
    return {
      sourceIp: DEFAULT_SOURCE_IP,
    };
  }
};

const persistState = (sourceIp: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sourceIp }));
};

const initial = readStoredState();
persistState(initial.sourceIp);

export const useOrgSecurityStore = create<OrgSecurityStore>((set) => ({
  sourceIp: initial.sourceIp,
  setSourceIp: (sourceIp) => {
    const normalized = sourceIp.trim();
    set({ sourceIp: normalized });
    persistState(normalized);
  },
  reset: () => {
    set({ sourceIp: DEFAULT_SOURCE_IP });
    persistState(DEFAULT_SOURCE_IP);
  },
}));
