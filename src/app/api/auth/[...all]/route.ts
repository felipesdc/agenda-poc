import { toNextJsHandler } from "better-auth/next-js";
import { getPasswordAuth, isPasswordAuthConfigured } from "@/lib/password-auth";

export const runtime = "nodejs";

async function handle(request: Request) {
  if (!isPasswordAuthConfigured()) return Response.json({ message: "Login indisponível. Contate o administrador." }, { status: 503 });
  const handlers = toNextJsHandler(getPasswordAuth());
  const response = await (request.method === "GET" ? handlers.GET(request) : handlers.POST(request));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
