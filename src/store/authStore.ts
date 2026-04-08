import { create } from 'zustand';
import { UserRole, User } from '@/types';
import { api } from '@/lib/api';
import { setTokens, clearTokens, getAccessToken } from '@/lib/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email: string, password: string, role: UserRole) => {
    const response = await api.login(email, password, role);
    if (response.data) {
      setTokens(response.data.token, response.data.refreshToken);
      set({
        user: response.data.user,
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  },
  logout: () => {
    api.logout();
    clearTokens();
    set({ user: null, isAuthenticated: false });
  },
  restoreSession: async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const response = await api.getProfile();
      if (response.data) {
        set({ user: response.data, isAuthenticated: true });
      }
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  },
}));
