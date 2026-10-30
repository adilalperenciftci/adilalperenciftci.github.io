import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCardTilt,
  createTopologyNodes,
  resolveActiveSection,
  selectAnimationMode,
} from "../motion.js";

test("createTopologyNodes returns deterministic bounded geometry", () => {
  const first = createTopologyNodes(1200, 720, 24, 0xacc1fc1);
  const second = createTopologyNodes(1200, 720, 24, 0xacc1fc1);

  assert.deepEqual(first, second);
  assert.equal(first.length, 24);
  for (const node of first) {
    assert.ok(node.x >= 0 && node.x <= 1200, `x out of bounds: ${node.x}`);
    assert.ok(node.y >= 0 && node.y <= 720, `y out of bounds: ${node.y}`);
    assert.ok(Math.abs(node.vx) <= 0.1, `vx too large: ${node.vx}`);
    assert.ok(Math.abs(node.vy) <= 0.1, `vy too large: ${node.vy}`);
    assert.ok(node.radius >= 0.7 && node.radius <= 2.2, `radius out of bounds: ${node.radius}`);
  }
});

test("createTopologyNodes clamps invalid dimensions and excessive counts", () => {
  const nodes = createTopologyNodes(0, -20, 500, 0);

  assert.equal(nodes.length, 64);
  for (const node of nodes) {
    assert.ok(node.x >= 0 && node.x <= 1);
    assert.ok(node.y >= 0 && node.y <= 1);
  }
});

test("computeCardTilt is neutral at center and bounded outside the card", () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  assert.deepEqual(computeCardTilt(rect, 300, 150, 5), {
    rotateX: 0,
    rotateY: 0,
    glowX: 50,
    glowY: 50,
  });
  assert.deepEqual(computeCardTilt(rect, -1000, 2000, 5), {
    rotateX: -5,
    rotateY: -5,
    glowX: 0,
    glowY: 100,
  });
});

test("computeCardTilt handles a collapsed rectangle safely", () => {
  assert.deepEqual(computeCardTilt({ left: 10, top: 20, width: 0, height: 0 }, 10, 20), {
    rotateX: 0,
    rotateY: 0,
    glowX: 50,
    glowY: 50,
  });
});

test("selectAnimationMode respects reduced motion, pointer precision, and viewport", () => {
  assert.equal(selectAnimationMode({ reducedMotion: true, coarsePointer: false, width: 1440 }), "static");
  assert.equal(selectAnimationMode({ reducedMotion: false, coarsePointer: true, width: 1440 }), "ambient");
  assert.equal(selectAnimationMode({ reducedMotion: false, coarsePointer: false, width: 680 }), "ambient");
  assert.equal(selectAnimationMode({ reducedMotion: false, coarsePointer: false, width: 1440 }), "full");
});

test("resolveActiveSection selects the section nearest the reading line", () => {
  const sections = [
    { id: "research", top: 700, bottom: 1400 },
    { id: "upstream", top: 1400, bottom: 2900 },
    { id: "labs", top: 2900, bottom: 3600 },
  ];

  assert.equal(resolveActiveSection(sections, 0, 900), "research");
  assert.equal(resolveActiveSection(sections, 1200, 900), "upstream");
  assert.equal(resolveActiveSection(sections, 4000, 900), "labs");
  assert.equal(resolveActiveSection([], 4000, 900), null);
});
