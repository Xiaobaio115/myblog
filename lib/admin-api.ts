const ADMIN_PASSWORD_KEY = "admin_password";
const ADMIN_PASSWORD_EVENT = "admin-password-change";

export class AdminApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.payload = payload;
  }
}

type AdminFetchOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  body?: BodyInit | null;
  json?: unknown;
  password?: string;
  fallbackError?: string;
};

export function getAdminPassword() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
}

export function setAdminPassword(password: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_PASSWORD_KEY, password);
  window.dispatchEvent(new Event(ADMIN_PASSWORD_EVENT));
}

export function clearAdminPassword() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_PASSWORD_KEY);
  window.dispatchEvent(new Event(ADMIN_PASSWORD_EVENT));
}

export function subscribeToAdminPassword(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(ADMIN_PASSWORD_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(ADMIN_PASSWORD_EVENT, handleChange);
  };
}

export async function parseAdminResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function adminFetch<T = unknown>(
  input: RequestInfo | URL,
  options: AdminFetchOptions = {}
): Promise<T> {
  const {
    auth = true,
    json,
    password = getAdminPassword(),
    fallbackError = "请求失败，请稍后重试。",
    headers: initialHeaders,
    body: rawBody,
    ...init
  } = options;
  const headers = new Headers(initialHeaders);

  if (auth) {
    if (!password) {
      throw new AdminApiError("后台会话已失效，请重新登录。", 401, null);
    }
    headers.set("x-admin-password", password);
  }

  let body = rawBody;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const response = await fetch(input, {
    ...init,
    body,
    headers,
    cache: init.cache ?? "no-store",
  });
  const payload = await parseAdminResponse<unknown>(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : fallbackError;
    throw new AdminApiError(message, response.status, payload);
  }

  return payload as T;
}
