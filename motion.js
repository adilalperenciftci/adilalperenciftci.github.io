const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createTopologyNodes(width, height, count, seed = 0xacc1fc1) {
  const safeWidth = Math.max(1, Number(width) || 0);
  const safeHeight = Math.max(1, Number(height) || 0);
  const safeCount = clamp(Math.floor(Number(count) || 0), 0, 64);
  const random = seededRandom(seed);

  return Array.from({ length: safeCount }, () => ({
    x: random() * safeWidth,
    y: random() * safeHeight,
    vx: (random() - 0.5) * 0.2,
    vy: (random() - 0.5) * 0.2,
    radius: 0.7 + random() * 1.5,
    phase: random() * Math.PI * 2,
  }));
}

export function computeCardTilt(rect, clientX, clientY, maxTilt = 4) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
  }

  const x = clamp((clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((clientY - rect.top) / rect.height, 0, 1);
  const limit = Math.abs(Number(maxTilt) || 0);

  return {
    rotateX: (0.5 - y) * limit * 2,
    rotateY: (x - 0.5) * limit * 2,
    glowX: Math.round(x * 100),
    glowY: Math.round(y * 100),
  };
}

export function selectAnimationMode({ reducedMotion, coarsePointer, width }) {
  if (reducedMotion) return "static";
  if (coarsePointer || width < 760) return "ambient";
  return "full";
}

export function resolveActiveSection(sections, scrollY, viewportHeight) {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const readingLine = scrollY + viewportHeight * 0.34;
  const containing = sections.find(
    (section) => section.top <= readingLine && section.bottom > readingLine,
  );
  if (containing) return containing.id;
  if (readingLine < sections[0].top) return sections[0].id;

  let nearest = sections[0];
  for (const section of sections) {
    if (section.top > readingLine) break;
    nearest = section;
  }
  return nearest.id;
}
