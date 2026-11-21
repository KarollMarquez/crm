const API =
  typeof window === "undefined"
    ? process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001"
    : "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const timeout = AbortSignal.timeout(isForm ? 120000 : 20000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) || {}),
  };
  if (isForm) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  } else if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    signal,
    credentials: "include",
    headers,
  });
  if (res.status === 401 && typeof window !== "undefined") {
    if (path === "/auth/me" || !path.startsWith("/auth")) {
      window.location.href = "/login";
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || "Request failed");
  }
  return data as T;
}

export type Me = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
  plan: string;
  branding?: { appName: string; logoUrl?: string | null; primaryColor: string };
};
