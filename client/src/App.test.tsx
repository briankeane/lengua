import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AuthProvider } from './Contexts/AuthProvider';

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<App />}>
            <Route index element={<div>home</div>} />
            <Route path="dashboard" element={<div>dash</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App chrome', () => {
  it('hides the global navbar on full-bleed marketing routes', () => {
    const { container } = renderAppAt('/');
    expect(container.querySelector('.navbar')).toBeNull();
  });

  it('renders the global navbar on app routes', () => {
    const { container } = renderAppAt('/dashboard');
    expect(container.querySelector('.navbar')).not.toBeNull();
  });
});
