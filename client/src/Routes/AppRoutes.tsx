import { GoogleOAuthProvider } from '@react-oauth/google';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../Contexts/AuthProvider';
import AuthPage from '../Pages/AuthPage/AuthPage';
import DashboardPage from '../Pages/DashboardPage/DashboardPage';
import ProtectedRoute from './ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    ),
    children: [
      {
        index: true,
        element: <AuthPage />,
      },
      {
        path: 'login',
        element: <AuthPage />,
      },
      {
        path: 'signup',
        element: <AuthPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
