import { GoogleOAuthProvider } from '@react-oauth/google';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../Contexts/AuthProvider';
import { routeChildren } from './routeChildren';

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
    children: routeChildren,
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
