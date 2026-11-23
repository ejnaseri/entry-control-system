import atlasGymLogo from "../assets/atlasgym-logo.png";
import type { ProductBrand } from "./productBrand.types";

export const PRODUCT_BRAND: ProductBrand = Object.freeze({
  edition: "FULL",
  name: "AtlasGym",
  shortName: "AtlasGym",
  editionLabel: "Full Edition",
  supportLabel: "AtlasGym Support",
  logoSrc: atlasGymLogo,
  iconHref: "/atlasgym-icon.svg",
  authSetupSubtitle: {
    en: "Set the first gym owner before using AtlasGym.",
    fa: "پیش از استفاده از AtlasGym نخستین مالک باشگاه را بسازید.",
    ps: "د AtlasGym له کارولو مخکې د جم لومړی مالک جوړ کړئ.",
  },
  authPanelBody: {
    en: "Local access control for members, attendance, devices, payments, and reports.",
    fa: "کنترل محلی دسترسی برای اعضا، حاضری، دستگاه‌ها، پرداخت‌ها و گزارش‌ها.",
    ps: "د غړو، حاضرۍ، وسیلو، تادیاتو او راپورونو لپاره محلي لاسرسي کنټرول.",
  },
});
