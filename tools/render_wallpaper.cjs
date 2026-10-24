// node render_wall.cjs <page.html> <out.png> <width> <height> <dpr> [bodyClass]
const { chromium } = require("playwright");
const { pathToFileURL } = require("url");
(async () => {
  const [page, out, w, h, dpr, cls] = process.argv.slice(2);
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(dpr) });
  const errors = [];
  pg.on("pageerror", (e) => errors.push(String(e)));
  await pg.goto(pathToFileURL(page).href);
  await pg.waitForFunction("typeof window.__setTime === 'function'");
  if (cls) await pg.evaluate((c) => document.body.classList.add(c), cls);
  await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await pg.screenshot({ path: out });
  console.log(out, "errors", errors.length, errors.join(" | "));
  await browser.close();
})();
