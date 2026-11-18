import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLogoutMutation } from '../services/authApi';
import { logout } from '../store/slices/authSlice';
import type { AppDispatch, RootState } from '../store';

/**
 * Revokes the refresh token on the server, then clears the local session.
 * The local session is always cleared, even when the server cannot be reached.
 */
export const useLogout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const [logoutRequest] = useLogoutMutation();

  return useCallback(async () => {
    try {
      await logoutRequest({ refreshToken: refreshToken ?? undefined }).unwrap();
    } catch {
      // Offline or already-expired session: fall through and clear the local state.
    }
    dispatch(logout());
  }, [dispatch, logoutRequest, refreshToken]);
};
