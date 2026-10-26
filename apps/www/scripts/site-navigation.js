const normalizePath = (pathname) =>
  pathname === "/" ? "/" : pathname.replace(/\/+$/, "");

const canonical = new URL(
  document.querySelector('link[rel="canonical"]')?.href ?? location.href,
  location.href,
);
const canonicalPath = normalizePath(canonical.pathname);
const chrome = document.querySelector(".site-chrome");

if (chrome) {
  const matchesCurrentPage = (link) => {
    const target = new URL(link.href, location.href);
    return (
      target.origin === location.origin &&
      normalizePath(target.pathname) === canonicalPath
    );
  };

  chrome.querySelectorAll("a[href]").forEach((link) => {
    if (matchesCurrentPage(link)) link.setAttribute("aria-current", "page");
  });

  chrome.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!link || !matchesCurrentPage(link)) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === "_blank" ||
      link.hasAttribute("download")
    )
      return;

    event.preventDefault();
  });
}

const statusDots = [...document.querySelectorAll("[data-site-status]")];
if (statusDots.length) {
  fetch("/api/site-status", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then(({ sites = {} }) => {
      for (const dot of statusDots) {
        const value = sites[dot.dataset.siteStatus];
        const state =
          value === true ? "online" : value === false ? "offline" : value;
        const label =
          state === "online"
            ? "在线"
            : state === "offline"
              ? "离线"
              : state === "unpublished"
                ? "尚未并入本站"
                : "状态未知";
        dot.dataset.state = state || "unknown";
        dot.setAttribute("aria-label", label);
        dot.title = label;
      }
    })
    .catch(() => {
      for (const dot of statusDots) {
        if (dot.dataset.siteStatus !== "psyche") {
          dot.dataset.state = "unknown";
          dot.setAttribute("aria-label", "状态未知");
          dot.title = "状态未知";
        }
      }
    });
}

if (!document.querySelector("script[data-site-language]")) {
  const localeScript = document.createElement("script");
  localeScript.src = "/assets/site-language.js?v=20261014-1";
  localeScript.dataset.siteLanguage = "";
  document.head.append(localeScript);
}
