import { createClientBuildIdentity } from "../auth/authState";

declare const __ECS_CLIENT_BUILD_IDENTITY__: Parameters<typeof createClientBuildIdentity>[0];

export const CLIENT_BUILD_IDENTITY = createClientBuildIdentity(__ECS_CLIENT_BUILD_IDENTITY__);
