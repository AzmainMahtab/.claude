# React Feature Skill

Use this skill when asked to build a new route, form, component, query, or mutation in MTNS Academy frontend.

## Step 1 — Orient

Check what already exists before writing:
- `src/lib/queries.ts` — existing queries and mutations
- `src/lib/api.ts` — axios instance and interceptors
- `src/types/api.ts` — existing API response types
- `src/routes/` — existing route structure
- `src/components/ui/` — available shadcn/ui components

## Step 2 — Define the API Type

Add the response shape to `src/types/api.ts`:

```typescript
export interface ThingResponse {
  id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface CreateThingRequest {
  name: string;
}
```

Backend wraps all responses in `{ data: T }`. Unwrap in the fetcher.

## Step 3 — Add Query / Mutation to queries.ts

```typescript
// src/lib/queries.ts

// Query
export const thingQueryOptions = (thingId: string) =>
  queryOptions({
    queryKey: ["things", thingId],
    queryFn: () =>
      api.get<{ data: ThingResponse }>(`/things/${thingId}`).then(r => r.data.data),
  });

export const thingsListQueryOptions = () =>
  queryOptions({
    queryKey: ["things"],
    queryFn: () =>
      api.get<{ data: ThingResponse[] }>("/things").then(r => r.data.data),
  });

// Mutation
export function useCreateThingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateThingRequest) =>
      api.post<{ data: ThingResponse }>("/things", data).then(r => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things"] });
      toast.success("Thing created");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast.error(err.response?.data?.detail ?? "Something went wrong");
    },
  });
}
```

## Step 4 — Create the Route File

**Auth-gated route** (`src/routes/_authenticated/things.tsx`):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { thingsListQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/things")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(thingsListQueryOptions()),
  component: ThingsPage,
});

function ThingsPage() {
  const { data: things } = useSuspenseQuery(thingsListQueryOptions());
  return (
    <div className="space-y-4">
      {things.map(t => (
        <div key={t.id}>{t.name}</div>
      ))}
    </div>
  );
}
```

**Public route** (`src/routes/things.tsx`) — same pattern but without `_authenticated/` prefix.

After creating any route file:
```bash
npx @tanstack/router-plugin generate
```

## Step 5 — Form Pattern

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateThingMutation } from "@/lib/queries";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});
type FormValues = z.infer<typeof schema>;

export function CreateThingForm() {
  const mutation = useCreateThingMutation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(data => mutation.mutateAsync(data))} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create"}
      </Button>
    </form>
  );
}
```

## Step 6 — Component Patterns

**Loading / Error boundaries** — wrap route components with Suspense in the parent layout:
```tsx
<Suspense fallback={<Skeleton className="h-40 w-full" />}>
  <Outlet />
</Suspense>
```

**Conditional rendering** — prefer early returns:
```tsx
if (!thing) return <EmptyState />;
```

**Class merging** — always use `cn()`:
```tsx
import { cn } from "@/lib/utils";
<div className={cn("base-class", isActive && "text-primary")} />
```

**Icons** — use `@remixicon/react`:
```tsx
import { RiAddLine } from "@remixicon/react";
<RiAddLine className="size-4" />
```

## Step 7 — Quality Gates

```bash
npx tsc --noEmit          # type check
npx eslint src/           # lint
npx vite build            # bundle check (catch missing imports)
```

## Patterns to Avoid

- `useEffect` for data fetching → use TanStack Query
- `useState` for server data → use TanStack Query
- `localStorage` for tokens → `src/lib/tokens.ts` handles storage
- `fetch()` directly → always use the axios instance from `src/lib/api.ts`
- Array index as React key → use stable IDs
- Inline styles → Tailwind utility classes
