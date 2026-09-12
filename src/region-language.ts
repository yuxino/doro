/** English-first IP-country policy, vendored from yuxino-labs/web-shared.
 * No browser-language/time-zone inference; no persisted IP or country.
 */
export type RegionLanguage = "en" | "zh";
export type RegionLanguageOptions = { englishPaths?: string[]; chinesePaths?: string[] };
export function startRegionLanguage(apply: (language: RegionLanguage) => void | false, options: RegionLanguageOptions = {}): { select: (language: RegionLanguage) => void; dispose: () => void } {
  const key = "yuxino:site-language:manual:v1";
  const parse = (value: string | null | undefined): RegionLanguage | undefined => value === "en" ? "en" : value === "zh" || value === "zh-CN" ? "zh" : undefined;
  const url = new URL(window.location.href);
  const normalize = (path: string) => path.replace(/\/+$/, "") || "/";
  const path = normalize(url.pathname);
  const route = (options.chinesePaths ?? ["/zh", "/zh.html"]).some(p => normalize(p) === path) ? "zh" : (options.englishPaths ?? ["/en", "/en.html"]).some(p => normalize(p) === path) ? "en" : undefined;
  let saved: RegionLanguage | undefined;
  try { saved = parse(window.localStorage.getItem(key)); } catch { /* Optional storage. */ }
  let manual = parse(url.searchParams.get("lang")) ?? route ?? saved;
  let current: RegionLanguage = manual ?? "en";
  let disposed = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { controller?.abort(); if (timer !== undefined) clearTimeout(timer); };
  const remember = (language: RegionLanguage) => { manual = language; cancel(); try { window.localStorage.setItem(key, language); } catch { /* Explicit URL still works. */ } };
  const select = (language: RegionLanguage) => { if (disposed || !parse(language)) return; remember(language); if (language !== current) { current = language; apply(language); } };
  const onClick = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest("a[hreflang], a[lang], button[data-language], button[data-lang]");
    if (!control) return;
    const language = parse(control.getAttribute("hreflang") ?? control.getAttribute("lang") ?? control.getAttribute("data-language") ?? control.getAttribute("data-lang"));
    if (!language) return;
    if (control.tagName === "A") {
      const target = new URL(control.getAttribute("href") || "", window.location.href);
      if (target.origin !== url.origin) return;
      remember(language); target.searchParams.set("lang", language);
      control.setAttribute("href", target.pathname + target.search + target.hash);
    } else select(language);
  };
  window.document.addEventListener("click", onClick, true);
  const dispose = () => { disposed = true; cancel(); window.document.removeEventListener("click", onClick, true); };
  if (apply(current) === false) { dispose(); return { select, dispose }; }
  if (!manual) {
    const lookup = async (): Promise<RegionLanguage> => {
      try {
        controller = new AbortController();
        const response = await window.fetch("https://api.country.is/", { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
        if (!response.ok) return "en";
        const data: unknown = await response.json();
        const country = data && typeof data === "object" && "country" in data ? data.country : undefined;
        return typeof country === "string" && ["CN", "HK", "MO", "TW"].includes(country) ? "zh" : "en";
      } catch { return "en"; }
    };
    const deadline = new Promise<RegionLanguage>(resolve => { timer = setTimeout(() => { controller?.abort(); resolve("en"); }, 1500); });
    void Promise.race([lookup(), deadline]).then(language => { if (timer !== undefined) clearTimeout(timer); if (disposed || manual || language === current) return; current = language; apply(language); });
  }
  return { select, dispose };
}
