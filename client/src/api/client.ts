import axios from "axios";

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const apiConfiguration = {
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
};

export const api = axios.create(apiConfiguration);

// Bootstrap 401s are resolved by AuthProvider's generation-aware state machine.
// They must not emit the global unauthorized event for an older request.
export const authBootstrapApi = axios.create(apiConfiguration);

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : "Request failed");
  }

  const data = error.response?.data;
  const responseMessage =
    data && typeof data === "object" && "message" in data ? data.message : undefined;
  return new ApiError(
    typeof responseMessage === "string" ? responseMessage : error.message,
    error.response?.status,
    data
  );
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(toApiError(error));
  }
);

authBootstrapApi.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error))
);
