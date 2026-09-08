import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { YearProvider } from './context/YearContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './components/Confirm';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/primitives';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';

const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Expenses = lazy(() => import('./pages/Expenses').then((m) => ({ default: m.Expenses })));
const Portfolio = lazy(() => import('./pages/Portfolio').then((m) => ({ default: m.Portfolio })));
const Growth = lazy(() => import('./pages/Growth').then((m) => ({ default: m.Growth })));

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <YearProvider>
          <ToastProvider>
            <ConfirmProvider>
              <BrowserRouter>
                <DeepLinkRestore />
                <Routes>
                  <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                  <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Lazy><Analytics /></Lazy>} />
                    <Route path="expenses" element={<Lazy><Expenses /></Lazy>} />
                    <Route path="portfolio" element={<Lazy><Portfolio /></Lazy>} />
                    <Route path="growth" element={<Lazy><Growth /></Lazy>} />
                    {/* v1 URLs, with and without the .html the host may strip */}
                    {['dashboard', 'dashboard.html'].map((p) => (
                      <Route key={p} path={p} element={<Navigate to="/" replace />} />
                    ))}
                    {['analytics.html', 'expenses.html', 'portfolio.html'].map((p) => (
                      <Route key={p} path={p} element={<Navigate to={`/${p.replace('.html', '')}`} replace />} />
                    ))}
                    {['knight-os', 'knight-os.html'].map((p) => (
                      <Route key={p} path={p} element={<Navigate to="/growth" replace />} />
                    ))}
                    {['knight-os-mindmap', 'knight-os-mindmap.html'].map((p) => (
                      <Route key={p} path={p} element={<Navigate to="/growth?view=map" replace />} />
                    ))}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ConfirmProvider>
          </ToastProvider>
        </YearProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** public/404.html parks the requested path here for hosts without rewrites. */
function DeepLinkRestore() {
  const navigate = useNavigate();
  useEffect(() => {
    const target = sessionStorage.getItem('batman.redirect');
    if (!target) return;
    sessionStorage.removeItem('batman.redirect');
    if (target.startsWith('/') && !target.startsWith('//')) navigate(target, { replace: true });
  }, [navigate]);
  return null;
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner large />}>{children}</Suspense>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <BootScreen />;
  // Signing in returns you to the page that bounced you here.
  const from = (location.state as { from?: string } | null)?.from;
  if (user) return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  return <>{children}</>;
}

function BootScreen() {
  return (
    <div className="auth">
      <Spinner large label="Loading your workspace" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="center-pad">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="text-muted">That page doesn’t exist in BatMan.</p>
        <a className="btn btn--primary" href="/">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
