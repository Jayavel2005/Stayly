import { create } from 'zustand';
import { AuthUser } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const STORAGE_KEY_ACCESS = 'stayora_admin_access_token';
const STORAGE_KEY_REFRESH = 'stayora_admin_refresh_token';
const STORAGE_KEY_USER = 'stayora_admin_user';

// Initialize from localStorage safely
const storedAccess = localStorage.getItem(STORAGE_KEY_ACCESS);
const storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
let storedUser: AuthUser | null = null;
try {
  const userJson = localStorage.getItem(STORAGE_KEY_USER);
  if (userJson) storedUser = JSON.parse(userJson);
} catch {
  storedUser = null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: storedAccess,
  refreshToken: storedRefresh,
  user: storedUser,
  isAuthenticated: Boolean(storedAccess && storedUser),

  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to write auth tokens to localStorage', e);
    }

    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch (e) {
      console.error('Failed to clear auth from localStorage', e);
    }

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  updateUser: (partial: Partial<AuthUser>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update stored user in localStorage', e);
    }
    set({ user: updated });
  },
}));
