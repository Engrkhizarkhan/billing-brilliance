import { create } from 'zustand';

interface EteaSecurityStore {
  apiKey: string;
  sourceIp: string;
  setApiKey: (apiKey: string) => void;
  setSourceIp: (sourceIp: string) => void;
  reset: () => void;
}

const STORAGE_KEY = 'etea-payment-security-context';
const DEFAULT_API_KEY = import.meta.env.VITE_ETEA_API_KEY || 'etea-dev-key';
const DEFAULT_SOURCE_IP = '127.0.0.1';

const readStoredState = () => {
  if (typeof window === 'undefined') {
    return {
      apiKey: DEFAULT_API_KEY,
      sourceIp: DEFAULT_SOURCE_IP,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        apiKey: DEFAULT_API_KEY,
        sourceIp: DEFAULT_SOURCE_IP,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Pick<EteaSecurityStore, 'apiKey' | 'sourceIp'>>;
    return {
      apiKey: parsed.apiKey || DEFAULT_API_KEY,
      sourceIp: parsed.sourceIp || DEFAULT_SOURCE_IP,
    };
  } catch {
    return {
      apiKey: DEFAULT_API_KEY,
      sourceIp: DEFAULT_SOURCE_IP,
    };
  }
};

const persistState = (apiKey: string, sourceIp: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, sourceIp }));
};

const initial = readStoredState();

export const useEteaSecurityStore = create<EteaSecurityStore>((set, get) => ({
  apiKey: initial.apiKey,
  sourceIp: initial.sourceIp,
  setApiKey: (apiKey) => {
    const normalized = apiKey.trim();
    set({ apiKey: normalized });
    persistState(normalized, get().sourceIp);
  },
  setSourceIp: (sourceIp) => {
    const normalized = sourceIp.trim();
    set({ sourceIp: normalized });
    persistState(get().apiKey, normalized);
  },
  reset: () => {
    set({ apiKey: DEFAULT_API_KEY, sourceIp: DEFAULT_SOURCE_IP });
    persistState(DEFAULT_API_KEY, DEFAULT_SOURCE_IP);
  },
}));
