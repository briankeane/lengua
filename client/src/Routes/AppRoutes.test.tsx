import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../Contexts/AuthProvider';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: () => () => {},
}));

// Rebuild the same route children the app mounts, without the live GoogleOAuthProvider/env.
async function renderAt(path: string) {
  const { routeChildren } = await import('./routeChildren');
  const router = createMemoryRouter(routeChildren, { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('routing', () => {
  it('renders the landing page at /', async () => {
    await renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /exactly the words you need/i,
    );
  });

  it('renders the auth page at /login', async () => {
    await renderAt('/login');
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});
