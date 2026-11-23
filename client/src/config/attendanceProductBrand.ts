import type { ProductBrand } from "./productBrand.types";

export const PRODUCT_BRAND: ProductBrand = Object.freeze({
  edition: "ATTENDANCE",
  name: "Entry Control Attendance",
  shortName: "Entry Control",
  editionLabel: "Attendance Edition",
  supportLabel: "Entry Control Support",
  logoSrc: "/entrycontrol-attendance-icon.svg",
  sidebarLogoSrc: "/atlas-attendance-logo.png",
  iconHref: "/entrycontrol-attendance-icon.svg",
  authSetupSubtitle: {
    en: "Create the first Attendance Owner account.",
    fa: "نخستین حساب مالک حاضری را بسازید.",
    ps: "د حاضرۍ د مالک لومړی حساب جوړ کړئ.",
  },
  authPanelBody: {
    en: "Local employee attendance, K40 device operations, and secure time records.",
    fa: "حاضری محلی کارمندان، عملیات دستگاه K40 و ثبت امن زمان.",
    ps: "د کارکوونکو محلي حاضري، د K40 وسیلې چارې او خوندي وخت ثبت.",
  },
});
