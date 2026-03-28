import { create } from 'zustand';
import { UserRole, User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
}

const mockUsers: Record<string, { name: string; role: UserRole }> = {
  'admin@example.com': { name: 'Admin User', role: 'admin' },
  'school@example.com': { name: 'School Admin', role: 'school' },
  'eta@example.com': { name: 'ETA Manager', role: 'eta' },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email: string, password: string, role: UserRole) => {
    await new Promise((r) => setTimeout(r, 800));
    const mockUser = mockUsers[email];
    if (mockUser && password === '123456' && mockUser.role === role) {
      set({
        user: { id: '1', email, name: mockUser.name, role, status: 'active' },
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}));
