import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../Contexts/AuthProvider';
import DashboardPage from '../Pages/DashboardPage/DashboardPage';
import LoginPage from '../Pages/LoginPage/LoginPage';
import SignupPage from '../Pages/SignupPage/SignupPage';
import ProtectedRoute from './ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'signup',
        element: <SignupPage />,
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
