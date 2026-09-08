import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <YearProvider>
          <ToastProvider>
            <ConfirmProvider>
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Routes>
                  <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                  <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
                  <Route element={<AuthedLayout />}>
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

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner large />}>{children}</Suspense>;
}

/**
 * Signed in, this is the app shell. Signed out, the root shows the public
 * landing page and every other route bounces to sign-in.
 */
function AuthedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <BootScreen />;
  if (!user) {
    if (location.pathname === '/') {
      return (
        <Lazy>
          <Landing />
        </Lazy>
      );
    }
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <AppShell />;
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
        <Link className="btn btn--primary" to="/">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
