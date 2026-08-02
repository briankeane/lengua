import { RouteObject } from 'react-router-dom';
import AuthPage from '../Pages/AuthPage/AuthPage';
import DashboardPage from '../Pages/DashboardPage/DashboardPage';
import LandingPage from '../Pages/LandingPage/LandingPage';
import LegalPage from '../Pages/LegalPage/LegalPage';
import TranslatePage from '../Pages/TranslatePage/TranslatePage';
import ProtectedRoute from './ProtectedRoute';

export const routeChildren: RouteObject[] = [
  { index: true, element: <LandingPage /> },
  { path: 'login', element: <AuthPage /> },
  { path: 'signup', element: <AuthPage /> },
  { path: 'privacy', element: <LegalPage kind="privacy" /> },
  { path: 'terms', element: <LegalPage kind="terms" /> },
  {
    path: 'dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'translate',
    element: (
      <ProtectedRoute>
        <TranslatePage />
      </ProtectedRoute>
    ),
  },
];
