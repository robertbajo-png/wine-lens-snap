import { useCallback, useMemo } from "react";
import { useSettings } from "@/settings/SettingsContext";
import {
  translations,
  getLocaleFromLang,
  getDateLocale,
  type SupportedLocale,
  type TranslationKey,
} from "@/lib/translations";

type TranslationParams = Record<string, string | number>;

export const useTranslation = () => {
  const { lang } = useSettings();

  const locale = useMemo<SupportedLocale>(() => getLocaleFromLang(lang), [lang]);
  const dateLocale = useMemo(() => getDateLocale(lang), [lang]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const template = translations[locale][key] ?? translations.sv[key] ?? key;

      if (!params) {
        return template;
      }

      return Object.entries(params).reduce<string>((result, [paramKey, paramValue]) => {
        return result.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
      }, template);
    },
    [locale],
  );

  return { t, locale, dateLocale, lang };
};
