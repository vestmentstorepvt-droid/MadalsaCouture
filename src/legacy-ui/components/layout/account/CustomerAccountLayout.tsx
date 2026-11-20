import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut } from 'lucide-react';
import LandingNavbar from '../landing/LandingNavbar';
import Footer from '../landing/Footer';
import type { AppDispatch, RootState } from '../../../store';
import { useGetProfileQuery } from '../../../services/profileApi';
import { updateUser } from '../../../store/slices/authSlice';
import { useLogout } from '../../../hooks/useLogout';
import { ACCOUNT_LINKS, Avatar } from '../../features/account/AccountUI';

const isAccountPath = (path: string) => ACCOUNT_LINKS.some((l) => path === l.path || path.startsWith(`${l.path}/`));

export const CustomerAccountLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const performLogout = useLogout();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const showShell = isAccountPath(location.pathname);

  // Keep the header/avatar in sync with the server (older sessions have no photo stored locally).
  const { data: profile } = useGetProfileQuery(undefined, { skip: !isAuthenticated });
  useEffect(() => {
    if (!profile || !user) return;
    const avatar = profile.avatar ?? null;
    if ((user.avatar ?? null) !== avatar || (profile.name && profile.name !== user.name)) {
      dispatch(updateUser({ avatar, name: profile.name || user.name }));
    }
  }, [profile, user, dispatch]);

  const logout = async () => {
    await performLogout();
    navigate('/', { replace: true });
  };

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <LandingNavbar />
      <main>
        {showShell ? (
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-12">
            {/* Greeting */}
            <div className="flex items-center gap-4">
              <Avatar name={user?.name} src={user?.avatar} size={56} />
              <div className="min-w-0">
                <p className="font-display text-2xl font-medium leading-tight sm:text-3xl">Hello, {firstName}</p>
                <p className="truncate text-sm text-mute">{user?.email}</p>
              </div>
            </div>

            {/* Mobile tabs */}
            <nav aria-label="Account" className="-mx-4 mt-6 border-b border-hairline px-4 lg:hidden">
              <ul className="scrollbar-hide flex gap-6 overflow-x-auto">
                {ACCOUNT_LINKS.map(({ label, path }) => (
                  <li key={path} className="shrink-0">
                    <NavLink
                      to={path}
                      className={({ isActive }) =>
                        `relative inline-flex h-11 items-center text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 ${
                          isActive ? 'text-ink after:bg-ink' : 'text-mute after:bg-transparent hover:text-ink'
                        }`
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[232px_minmax(0,1fr)]">
              {/* Desktop sidebar */}
              <aside className="hidden lg:block">
                <nav aria-label="Account" className="sticky top-28">
                  <ul className="space-y-1">
                    {ACCOUNT_LINKS.map(({ label, path, icon: Icon, hint }) => (
                      <li key={path}>
                        <NavLink
                          to={path}
                          className={({ isActive }) =>
                            `group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                              isActive ? 'bg-surface text-ink ring-1 ring-hairline' : 'text-body hover:bg-hairline-soft hover:text-ink'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-accent' : 'text-faint group-hover:text-ink'}`} />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{label}</span>
                                <span className="block text-xs text-mute">{hint}</span>
                              </span>
                            </>
                          )}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="mt-4 flex w-full items-center gap-3 rounded-xl border-t border-hairline px-3 pb-2.5 pt-4 text-sm font-medium text-body transition-colors hover:text-ink"
                  >
                    <LogOut className="h-4 w-4 text-faint" />
                    Log out
                  </button>
                </nav>
              </aside>

              <div className="min-w-0">
                <Outlet />
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-24">
            <Outlet />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CustomerAccountLayout;
