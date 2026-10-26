const brand = document.querySelector(".site-brand");
const name = brand?.querySelector("[data-brand-face]");
const current = name?.querySelector(".face-current");

if (brand && name && current) {
  const FACES = [
    "¯\\_(ツ)_/¯",
    "(⌐■_■)",
    "ʕ•ᴥ•ʔ",
    "\\ (•◡•) /",
    "(>‿<)",
    "ᕙ(‸↼)ᕗ",
    "(｡•̀ᴗ-)✧",
  ];
  const NAME = current.textContent.trim();
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let bag = [];
  let last = -1;
  let active = false;

  function nextFace() {
    if (!bag.length) {
      bag = FACES.map((_, index) => index);
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[other]] = [bag[other], bag[index]];
      }
      if (bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    return bag.shift();
  }

  function swap(text, isFace) {
    current.textContent = text;
    current.classList.toggle("is-face", isFace);
    current.classList.remove("face-anim");
    void current.offsetWidth;
    current.classList.add("face-anim");
  }

  function showFace() {
    if (active) return;
    active = true;
    last = nextFace();
    swap(FACES[last], true);
  }

  function restoreName() {
    if (!active) return;
    active = false;
    swap(NAME, false);
  }

  name.addEventListener("mouseenter", () => {
    if (finePointer.matches) showFace();
  });
  name.addEventListener("mouseleave", () => {
    if (finePointer.matches) restoreName();
  });

  brand.addEventListener("focusin", () => {
    if (finePointer.matches) showFace();
  });
  brand.addEventListener("focusout", (event) => {
    if (finePointer.matches && !brand.contains(event.relatedTarget)) {
      restoreName();
    }
  });

  name.addEventListener("click", (event) => {
    if (finePointer.matches || event.detail === 0) return;
    event.preventDefault();
    if (active) restoreName();
    else showFace();
  });
}
