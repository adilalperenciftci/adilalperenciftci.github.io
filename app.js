const filterButtons = [...document.querySelectorAll(".filter-button")];
const projectCards = [...document.querySelectorAll(".project-card")];
const visibleCount = document.querySelector("#visible-count");

function applyFilter(filter, updateLocation = true) {
  const normalized = filterButtons.some((button) => button.dataset.filter === filter)
    ? filter
    : "all";

  for (const button of filterButtons) {
    const active = button.dataset.filter === normalized;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  let count = 0;
  for (const card of projectCards) {
    const visible = normalized === "all" || card.dataset.category === normalized;
    card.hidden = !visible;
    if (visible) count += 1;
  }

  if (visibleCount) visibleCount.textContent = String(count);

  if (updateLocation) {
    const url = new URL(window.location.href);
    if (normalized === "all") url.searchParams.delete("focus");
    else url.searchParams.set("focus", normalized);
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

for (const button of filterButtons) {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
}

const initialFilter = new URL(window.location.href).searchParams.get("focus") || "all";
applyFilter(initialFilter, false);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = [...document.querySelectorAll(".reveal")];

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  for (const item of revealItems) item.classList.add("visible");
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );
  for (const item of revealItems) observer.observe(item);
}

const year = document.querySelector("#current-year");
if (year) year.textContent = String(new Date().getUTCFullYear());
