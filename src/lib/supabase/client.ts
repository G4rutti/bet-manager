import { createBrowserClient } from "@supabase/ssr";

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "local@user.com",
};

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your_supabase_anon_key_here"
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : "placeholder-anon-key";

  const client = createBrowserClient(url, key);

  const mockAuth = {
    getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
    getSession: async () => ({ data: { session: { user: MOCK_USER } }, error: null }),
    onAuthStateChange: (callback: any) => {
      // Execute callback with initial SIGNED_IN event
      callback("SIGNED_IN", { user: MOCK_USER });
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
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
