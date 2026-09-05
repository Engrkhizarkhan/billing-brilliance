import { create } from 'zustand';
import { User } from '@/types';
import { api } from '@/lib/api';
import { setTokens, clearTokens, getAccessToken } from '@/lib/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  impersonating: boolean;
  impersonatedUser: User | null;
  _adminToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  startImpersonation: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  impersonating: false,
  impersonatedUser: null,
  _adminToken: null,
  login: async (email: string, password: string) => {
    const response = await api.login(email, password);
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
    set({ user: null, isAuthenticated: false, impersonating: false, impersonatedUser: null, _adminToken: null });
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
  startImpersonation: async (userId: string) => {
    const adminToken = getAccessToken();
    const response = await api.impersonateUser(userId);
    if (response.data) {
      // Stash admin token so we can restore it on exit
      setTokens(response.data.token, '');
      set({
        _adminToken: adminToken,
        impersonating: true,
        impersonatedUser: response.data.user,
        user: response.data.user,
      });
    }
  },
  exitImpersonation: () => {
    const { _adminToken } = get();
    if (_adminToken) {
      setTokens(_adminToken, '');
    }
    // Restore admin profile from server
    api.getProfile().then((r) => {
      if (r.data) set({ user: r.data });
    });
    set({ impersonating: false, impersonatedUser: null, _adminToken: null });
  },
}));
