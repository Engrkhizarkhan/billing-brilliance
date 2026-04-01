import { create } from 'zustand';

interface PaymentStore {
  version: number;
  bump: () => void;
}

export const usePaymentStore = create<PaymentStore>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

export const notifyPaymentUpdate = () => {
  usePaymentStore.setState((state) => ({ version: state.version + 1 }));
};
