

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type AuthState, type User } from '../../types/auth';

const storedUser = localStorage.getItem('auth_user');
const storedToken = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('access_token');
const storedRefreshToken = localStorage.getItem('refreshToken');

const initialState: AuthState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedUser && !!storedToken,
  token: storedToken || null,
  refreshToken: storedRefreshToken || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ id: string; email: string; name: string; role: 'ADMIN' | 'USER'; token?: string; accessToken?: string; refreshToken?: string; user?: User }>) => {
      const resolvedUser: User = action.payload.user ?? {
        id: action.payload.id,
        name: action.payload.name,
        email: action.payload.email,
        role: action.payload.role,
      };
      const resolvedToken = action.payload.token ?? action.payload.accessToken ?? null;
      const resolvedRefreshToken = action.payload.refreshToken ?? null;

      state.user = resolvedUser;
      state.isAuthenticated = true;
      state.token = resolvedToken;
      state.refreshToken = resolvedRefreshToken;
      localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      if (resolvedToken) {
        localStorage.setItem('accessToken', resolvedToken);
        localStorage.setItem('token', resolvedToken);
      }
      if (resolvedRefreshToken) {
        localStorage.setItem('refreshToken', resolvedRefreshToken);
      }
    },
    updateToken: (state, action: PayloadAction<{ token: string; refreshToken?: string }>) => {
      state.token = action.payload.token;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      localStorage.setItem('accessToken', action.payload.token);
      localStorage.setItem('token', action.payload.token);
      if (action.payload.refreshToken) {
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      }
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
      localStorage.removeItem('auth_user');
      localStorage.removeItem('mock_user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refreshToken');
    },
  },
});

export const { login, logout, updateToken } = authSlice.actions;
export default authSlice.reducer;
