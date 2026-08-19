const INTERNAL_ORIGIN = "https://internal.invalid";

export function isSafeInternalHref(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 500 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    return url.origin === INTERNAL_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}
