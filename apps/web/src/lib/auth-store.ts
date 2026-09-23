import { create } from 'zustand';
import type { PublicUser } from '@ino/shared';

interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  /** chưa thử khôi phục phiên đăng nhập xong thì chưa vẽ giao diện */
  ready: boolean;
  setSession: (accessToken: string, user: PublicUser) => void;
  clear: () => void;
  setReady: (ready: boolean) => void;
}

/**
 * Access token chỉ nằm trong bộ nhớ, KHÔNG lưu localStorage.
 * Phiên đăng nhập được khôi phục bằng refresh token trong cookie httpOnly.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
  setReady: (ready) => set({ ready }),
}));
