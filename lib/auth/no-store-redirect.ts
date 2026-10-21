import { NextResponse } from "next/server";

/** Redirect for auth callbacks: never cached, never leaks the code in Referer. */
export function noStoreRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
