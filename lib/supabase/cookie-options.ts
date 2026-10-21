import type { CookieOptionsWithName } from "@supabase/ssr";

export const SUPABASE_COOKIE_OPTIONS = {
  httpOnly: false,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} satisfies CookieOptionsWithName;

