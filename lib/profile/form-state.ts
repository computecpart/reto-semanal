export interface ProfileFormState {
  fieldErrors: Partial<Record<string, string>>;
  message: string;
  status: "error" | "idle" | "success";
}

export const INITIAL_PROFILE_FORM_STATE: ProfileFormState = {
  fieldErrors: {},
  message: "",
  status: "idle",
};

export function collectFieldErrors(
  issues: readonly { message: string; path: PropertyKey[] }[],
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
