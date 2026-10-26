import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { allowedRoute } from "@/lib/api-routes.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (status: number, code: string, message: string) =>
    Response.json({ error: { code, message } }, { status, headers });
  const { path } = await context.params;
  if (!allowedRoute(request.method, path))
    return fail(404, "NOT_FOUND", "Recurso não encontrado.");
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return fail(403, "ORIGIN", "Origem não autorizada.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    origin = process.env.CONCLOUD_API_ORIGIN;
  if (!url || !key || !origin)
    return fail(503, "CONFIG", "O serviço ainda não está configurado.");
  try {
    const upstreamOrigin = new URL(origin);
    if (
      upstreamOrigin.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(upstreamOrigin.hostname)
      )
    )
      return fail(503, "CONFIG", "Endereço do serviço inválido.");
    const jar = await cookies();
    const auth = createServerClient(url, key, {
      cookieOptions: { name: "concloud-office-auth", sameSite: "lax" },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          ),
      },
    });
    const { data: user, error } = await auth.auth.getUser();
    if (error || !user.user)
      return fail(401, "UNAUTHORIZED", "Entre para acessar o painel.");
    const {
      data: { session },
    } = await auth.auth.getSession();
    if (!session) return fail(401, "UNAUTHORIZED", "Sua sessão expirou.");
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 8192)
      return fail(413, "SIZE", "Solicitação muito grande.");
    const target = new URL(
      `/api/internal/v1/${path.map(encodeURIComponent).join("/")}`,
      upstreamOrigin.origin,
    );
    target.search = new URL(request.url).search;
    const response = await fetch(target, {
      method: request.method,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      return fail(
        503,
        "UNAVAILABLE",
        "O serviço está temporariamente indisponível.",
      );
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return fail(
      503,
      "UNAVAILABLE",
      "Não foi possível conectar ao serviço. Tente novamente.",
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH };
