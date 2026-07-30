import { Outlet, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './Components/Navbar/Navbar';

// Full-bleed marketing/legal pages own the whole viewport and bring their own
// nav, so they skip the app chrome (global Navbar + content wrapper).
const CHROMELESS_ROUTES = ['/', '/privacy', '/terms'];

export default function App() {
  const { pathname } = useLocation();

  if (CHROMELESS_ROUTES.includes(pathname)) {
    return <Outlet />;
  }

  return (
    <div className="app">
      <Navbar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
