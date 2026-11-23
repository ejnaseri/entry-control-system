import type { AppEdition } from "../api/auth";

export type ProductBrand = Readonly<{
  edition: AppEdition;
  name: string;
  shortName: string;
  editionLabel: string;
  supportLabel: string;
  logoSrc: string;
  sidebarLogoSrc?: string;
  iconHref: string;
  authSetupSubtitle: Readonly<Record<"en" | "fa" | "ps", string>>;
  authPanelBody: Readonly<Record<"en" | "fa" | "ps", string>>;
}>;
