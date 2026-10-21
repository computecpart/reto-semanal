import "client-only";

const EMAIL_KEY = "reto-semanal:verification-email";
const RESEND_AT_KEY = "reto-semanal:verification-resend-at";

export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function rememberVerificationEmail(email: string): void {
  try {
    window.sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Storage can be unavailable in privacy modes; the user can enter it again.
  }
}

export function readVerificationEmail(): string {
  try {
    return window.sessionStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetVerificationEmail(): void {
  try {
    window.sessionStorage.removeItem(EMAIL_KEY);
    window.sessionStorage.removeItem(RESEND_AT_KEY);
  } catch {
    // A failed cleanup does not affect the server-enforced OTP guarantees.
  }
}

export function startOtpResendCooldown(): number {
  const resendAt = Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1_000;

  try {
    window.sessionStorage.setItem(RESEND_AT_KEY, String(resendAt));
  } catch {
    // The visual cooldown is best-effort; Supabase remains authoritative.
  }

  return resendAt;
}

export function readOtpResendAt(): number {
  try {
    const value = Number(window.sessionStorage.getItem(RESEND_AT_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

