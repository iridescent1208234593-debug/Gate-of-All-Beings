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
