export const APP_EDITIONS = Object.freeze(["FULL", "ATTENDANCE"] as const);

export type AppEdition = (typeof APP_EDITIONS)[number];
