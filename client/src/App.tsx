import { Outlet } from 'react-router-dom';
import './App.css';
import Navbar from './Components/Navbar/Navbar';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
