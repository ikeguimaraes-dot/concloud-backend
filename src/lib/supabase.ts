import { createBrowserClient } from "@supabase/ssr";
export function browserAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("O acesso ao painel ainda não está configurado.");
  return createBrowserClient(url, key, {
    cookieOptions: { name: "concloud-office-auth", sameSite: "lax" },
  });
}
