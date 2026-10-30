import {
  computeCardTilt,
  createTopologyNodes,
  resolveActiveSection,
  selectAnimationMode,
} from "./motion.js";

const root = document.documentElement;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

function currentMotionMode() {
  return selectAnimationMode({
    reducedMotion: reducedMotionQuery.matches,
    coarsePointer: coarsePointerQuery.matches,
    width: window.innerWidth,
  });
}

let motionMode = currentMotionMode();
root.dataset.motionMode = motionMode;
root.classList.add("motion-ready");

const filterButtons = [...document.querySelectorAll(".filter-button")];
const projectCards = [...document.querySelectorAll(".project-card")];
const visibleCount = document.querySelector("#visible-count");
const projectGrid = document.querySelector("#project-grid");

function animateFilteredCards(cards) {
  if (motionMode !== "full" || !("animate" in Element.prototype)) return;

  cards.forEach((card, index) => {
    card.animate(
      [
        { opacity: 0, transform: "translateY(14px) scale(0.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      {
        duration: 360,
        delay: Math.min(index * 42, 240),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      },
    );
  });
}

function applyFilter(filter, updateLocation = true) {
  const normalized = filterButtons.some((button) => button.dataset.filter === filter)
    ? filter
    : "all";
  const shownCards = [];

  for (const button of filterButtons) {
    const active = button.dataset.filter === normalized;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  for (const card of projectCards) {
    const visible = normalized === "all" || card.dataset.category === normalized;
    card.hidden = !visible;
    if (visible) shownCards.push(card);
  }

  if (visibleCount) visibleCount.textContent = String(shownCards.length);
  if (projectGrid) projectGrid.dataset.filter = normalized;

  if (updateLocation) {
    const url = new URL(window.location.href);
    if (normalized === "all") url.searchParams.delete("focus");
    else url.searchParams.set("focus", normalized);
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    animateFilteredCards(shownCards);
  }
}

for (const button of filterButtons) {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
}

const initialFilter = new URL(window.location.href).searchParams.get("focus") || "all";
applyFilter(initialFilter, false);

const revealItems = [...document.querySelectorAll(".reveal")];
let revealObserver;

function revealAll() {
  revealObserver?.disconnect();
  for (const item of revealItems) item.classList.add("visible");
}

function initReveals() {
  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
  });

  if (motionMode === "static" || !("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -7%", threshold: 0.08 },
  );

  for (const item of revealItems) revealObserver.observe(item);
}

initReveals();

const header = document.querySelector(".site-header");
const progress = document.querySelector("#scroll-progress");
const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const trackedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
let scrollFrame = 0;

function updateScrollState() {
  scrollFrame = 0;
  const scrollY = window.scrollY;
  const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const ratio = Math.min(1, Math.max(0, scrollY / scrollRange));

  progress?.style.setProperty("--scroll-progress", ratio.toFixed(4));
  header?.classList.toggle("is-scrolled", scrollY > 24);

  const sectionBounds = trackedSections.map((section) => {
    const rect = section.getBoundingClientRect();
    return {
      id: section.id,
      top: rect.top + scrollY,
      bottom: rect.bottom + scrollY,
    };
  });
  const activeId = resolveActiveSection(sectionBounds, scrollY, window.innerHeight);

  for (const link of sectionLinks) {
    const active = link.getAttribute("href") === `#${activeId}`;
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function scheduleScrollUpdate() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(updateScrollState);
}

window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
updateScrollState();

const depthCards = [...document.querySelectorAll("[data-depth-card]")];

function resetDepthCard(card) {
  card.style.setProperty("--tilt-x", "0deg");
  card.style.setProperty("--tilt-y", "0deg");
  card.style.setProperty("--glow-x", "50%");
  card.style.setProperty("--glow-y", "50%");
}

function initDepthCards() {
  for (const card of depthCards) {
    resetDepthCard(card);
    card.addEventListener("pointermove", (event) => {
      if (motionMode !== "full" || event.pointerType === "touch") return;
      const tilt = computeCardTilt(card.getBoundingClientRect(), event.clientX, event.clientY, 3.2);
      card.style.setProperty("--tilt-x", `${tilt.rotateX.toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${tilt.rotateY.toFixed(2)}deg`);
      card.style.setProperty("--glow-x", `${tilt.glowX}%`);
      card.style.setProperty("--glow-y", `${tilt.glowY}%`);
    });
    card.addEventListener("pointerleave", () => resetDepthCard(card));
  }
}

initDepthCards();

function initTopology() {
  const canvas = document.querySelector("#topology-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let nodes = [];
  let frame = 0;
  let lastTime = 0;
  let mode = motionMode;
  const pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.34, active: false };

  function nodeCount() {
    if (mode === "full") return 34;
    if (mode === "ambient") return 20;
    return 14;
  }

  function draw(time = 0, advance = false) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const linkDistance = mode === "full" ? 176 : 138;
    const elapsed = Math.min(2, Math.max(0.25, (time - lastTime) / 16.67 || 1));
    lastTime = time;

    if (advance) {
      for (const node of nodes) {
        node.x += node.vx * elapsed;
        node.y += node.vy * elapsed;
        if (node.x < -12) node.x = width + 12;
        if (node.x > width + 12) node.x = -12;
        if (node.y < -12) node.y = height + 12;
        if (node.y > height + 12) node.y = -12;
      }
    }

    context.lineWidth = 0.7;
    for (let first = 0; first < nodes.length; first += 1) {
      for (let second = first + 1; second < nodes.length; second += 1) {
        const a = nodes[first];
        const b = nodes[second];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > linkDistance) continue;
        const alpha = (1 - distance / linkDistance) * (mode === "full" ? 0.18 : 0.1);
        context.strokeStyle = `rgba(53, 211, 235, ${alpha.toFixed(3)})`;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }

    for (const node of nodes) {
      const shimmer = 0.72 + Math.sin(time * 0.0012 + node.phase) * 0.28;
      context.fillStyle = `rgba(94, 224, 242, ${(0.24 * shimmer).toFixed(3)})`;
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fill();
    }

    if (pointer.active && mode === "full") {
      const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 220);
      glow.addColorStop(0, "rgba(53, 211, 235, 0.055)");
      glow.addColorStop(1, "rgba(53, 211, 235, 0)");
      context.fillStyle = glow;
      context.fillRect(pointer.x - 220, pointer.y - 220, 440, 440);
    }
  }

  function tick(time) {
    if (mode === "static" || document.hidden) return;
    draw(time, true);
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    if (mode === "static") {
      canvas.dataset.animationState = "static";
      draw(0, false);
      return;
    }
    canvas.dataset.animationState = "running";
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    nodes = createTopologyNodes(width, height, nodeCount());
    start();
  }

  function setMode(nextMode) {
    mode = nextMode;
    resize();
  }

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      canvas.dataset.animationState = "paused";
    } else {
      start();
    }
  });

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resize);
  }, { passive: true });

  resize();
  return { setMode };
}

const topology = initTopology();

function updateEnvironment() {
  const nextMode = currentMotionMode();
  if (nextMode === motionMode) return;
  motionMode = nextMode;
  root.dataset.motionMode = motionMode;
  topology?.setMode(motionMode);

  if (motionMode === "static") revealAll();
  for (const card of depthCards) resetDepthCard(card);
}

reducedMotionQuery.addEventListener?.("change", updateEnvironment);
coarsePointerQuery.addEventListener?.("change", updateEnvironment);

let environmentFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(environmentFrame);
  environmentFrame = requestAnimationFrame(updateEnvironment);
}, { passive: true });

window.addEventListener("pointermove", (event) => {
  if (motionMode !== "full") return;
  root.style.setProperty("--pointer-x", `${event.clientX}px`);
  root.style.setProperty("--pointer-y", `${event.clientY}px`);
}, { passive: true });

const year = document.querySelector("#current-year");
if (year) year.textContent = String(new Date().getUTCFullYear());
