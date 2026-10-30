# adilalperenciftci.github.io

Dependency-free static portfolio for systems security research and verified upstream engineering work.

The interface uses a deterministic canvas topology, bounded pointer depth, progressive section reveals, active navigation, and URL-addressable patch filters. Motion is selected at runtime across full, ambient, and static modes so coarse pointers and reduced-motion preferences remain first-class paths. All content remains available when JavaScript is disabled.

## Local verification

```sh
node tests/site.test.mjs
node --test tests/motion.test.mjs
```

`tests/browser.test.mjs` exercises the full, ambient, static, and no-script experiences in Chromium, including overflow, filtering, navigation, canvas lifecycle, and pointer-depth behavior.

GitHub Pages deploys the repository root from the `main` branch through `.github/workflows/pages.yml`.
