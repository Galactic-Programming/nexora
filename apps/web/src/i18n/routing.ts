import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // All locales supported by the customer web app.
  locales: ["en", "vi"],

  // Used when no locale matches (e.g. the bare "/" before a redirect).
  defaultLocale: "en",
});
