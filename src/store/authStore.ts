import { create } from 'zustand';
import { UserRole, User } from '@/types';
import { mockApi } from '@/lib/mockApi';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email: string, password: string, role: UserRole) => {
    const response = await mockApi.login(email, password, role);
    if (response.data) {
      set({
        user: response.data.user,
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}));
