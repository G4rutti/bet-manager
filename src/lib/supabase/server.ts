import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "local@user.com",
};

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your_supabase_anon_key_here"
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : "placeholder-anon-key";

  const client = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const mockAuth = {
    getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
    getSession: async () => ({ data: { session: { user: MOCK_USER } }, error: null }),
    signOut: async () => ({ error: null }),
  };

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "auth") {
        return mockAuth;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as any;
}
