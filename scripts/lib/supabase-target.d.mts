export interface BootstrapTarget {
  email: string;
  environment: "demo" | "local" | "production";
  projectRef: string;
  secretKey: string;
  url: string;
}

export function projectRefFromUrl(value: string): string;

export function resolveBootstrapTarget(
  environment: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
): BootstrapTarget;
