import { MotionConfig } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LogoMark } from './components/Logo.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Auth } from './pages/Auth.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Landing } from './pages/Landing.jsx';

const Editor = lazy(() => import('./pages/Editor.jsx').then((module) => ({ default: module.Editor })));

const Splash = () => (
  <div className="splash" role="status" aria-live="polite">
    <LogoMark size={44} />
    <span className="sr-only">Loading</span>
  </div>
);

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

const Public = ({ children }) => {
  const { loading } = useAuth();
  return loading ? <Splash /> : children;
};

const NotFound = () => (
  <div className="notfound">
    <LogoMark size={40} />
    <h1 className="serif">Page not found</h1>
    <p>The page you are looking for does not exist.</p>
    <div className="notfound-actions">
      <Link to="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  </div>
);

export const App = () => (
  <ThemeProvider>
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<Splash />}>
              <Routes>
                <Route path="/" element={<Public><Landing /></Public>} />
                <Route path="/login" element={<Public><Auth mode="login" /></Public>} />
                <Route path="/register" element={<Public><Auth mode="register" /></Public>} />
                <Route path="/app" element={<Protected><Dashboard /></Protected>} />
                <Route path="/app/p/:projectId" element={<Protected><Editor /></Protected>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </MotionConfig>
  </ThemeProvider>
);
