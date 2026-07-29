---
name: create-feature
description: Step-by-step workflow for creating a client feature with service, context, page, and route
---

# Client Feature Development

## Development Workflow

1. Create the API service (`client/src/Services/[feature]Service.ts`)
2. Create the context if needed (`client/src/Contexts/[Feature]Provider.tsx`, `[feature]Context.ts`, `use[Feature].ts`)
3. Create the page component (`client/src/Pages/[Feature]Page/[Feature]Page.tsx`)
4. Write tests for the page (`client/src/Pages/[Feature]Page/[Feature]Page.test.tsx`)
5. Add the route to `client/src/Routes/AppRoutes.tsx`
6. Verify: `make test-client && make lint-client`

## Reference Implementations

Study these existing files before creating a new feature:

- **Service**: `client/src/Services/authService.ts` — typed API calls using `apiClient`
- **Context**: `client/src/Contexts/AuthProvider.tsx` + `authContext.ts` + `useAuth.ts` — full context pattern
- **Page**: `client/src/Pages/LoginPage/LoginPage.tsx` — form handling, error state, navigation
- **Route**: `client/src/Routes/AppRoutes.tsx` — route registration with protected routes
- **Test**: `client/src/Pages/LoginPage/LoginPage.test.tsx` — component testing with React Testing Library

## File Organization

```
client/src/
├── Services/
│   └── [feature]Service.ts        # API calls (typed request/response)
├── Contexts/
│   ├── [Feature]Provider.tsx      # Provider component with state logic
│   ├── [feature]Context.ts        # Context + types (no logic)
│   └── use[Feature].ts            # Custom hook (useContext wrapper)
├── Pages/
│   └── [Feature]Page/
│       ├── [Feature]Page.tsx       # Page component
│       └── [Feature]Page.test.tsx  # Tests
└── Routes/
    └── AppRoutes.tsx              # Add route here
```

## Service Pattern

```typescript
import apiClient from './apiClient';

export interface Feature {
  id: string;
  name: string;
}

export async function getFeatures(): Promise<Feature[]> {
  const response = await apiClient.get<Feature[]>('/v1/features');
  return response.data;
}

export async function createFeature(params: { name: string }): Promise<Feature> {
  const response = await apiClient.post<Feature>('/v1/features', params);
  return response.data;
}
```

The `apiClient` (in `Services/apiClient.ts`) automatically attaches the JWT token from localStorage via an interceptor.

## Context Pattern

Only create a context when state needs to be shared across multiple components. For simple pages that fetch data once, use local state instead.

### Context file (`[feature]Context.ts`)

```typescript
import { createContext } from 'react';

export interface FeatureContextValue {
  items: Feature[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export const FeatureContext = createContext<FeatureContextValue | null>(null);
```

### Hook file (`use[Feature].ts`)

```typescript
import { useContext } from 'react';
import { FeatureContext, FeatureContextValue } from './[feature]Context';

export function useFeature(): FeatureContextValue {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeature must be used within a FeatureProvider');
  }
  return context;
}
```

### Provider file (`[Feature]Provider.tsx`)

```typescript
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import * as featureService from "../Services/[feature]Service";
import { FeatureContext } from "./[feature]Context";

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await featureService.getFeatures();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ items, loading, refresh }), [items, loading, refresh]);

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}
```

## Page Pattern

```typescript
import { useAuth } from "../../Contexts/useAuth";

export default function FeaturePage() {
  // Local state for simple data fetching, or useFeature() for shared context
  return (
    <div>
      <h2>Feature</h2>
      {/* ... */}
    </div>
  );
}
```

## Testing Pattern

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../../test/testHelpers";
import FeaturePage from "./FeaturePage";

describe("FeaturePage", () => {
  it("renders the page heading", () => {
    renderWithProviders(<FeaturePage />);
    expect(screen.getByRole("heading", { name: /feature/i })).toBeInTheDocument();
  });
});
```

Use `renderWithProviders` from `test/testHelpers.tsx` when the component needs AuthContext or Router context.

## Route Registration

In `client/src/Routes/AppRoutes.tsx`:

```typescript
import FeaturePage from "../Pages/FeaturePage/FeaturePage";

// Add to the children array in the router:
{
  path: "feature",
  element: (
    <ProtectedRoute>
      <FeaturePage />
    </ProtectedRoute>
  ),
},
```

Use `<ProtectedRoute>` for authenticated pages. Public pages don't need it.

## Quality Gates

- [ ] Service functions are typed (request params and response)
- [ ] Page renders without errors
- [ ] Tests written and passing
- [ ] Route registered in AppRoutes.tsx
- [ ] `make test-client` passes
- [ ] `make lint-client` passes
- [ ] `make prettier-client` passes
