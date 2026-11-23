import {
  normalizePublicApiIdentity,
  type PublicApiIdentityPayload,
} from "../auth/authState";
import { authBootstrapApi } from "./client";

export async function getPublicApiIdentity(signal?: AbortSignal) {
  const res = await authBootstrapApi.get<PublicApiIdentityPayload>("/api", { signal });
  return normalizePublicApiIdentity(res.data);
}
