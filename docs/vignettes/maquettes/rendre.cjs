// Rend les maquettes en images avec Playwright (chromium déjà installé).
// node docs/vignettes/maquettes/rendre.cjs [id ...]   (NODE_PATH doit contenir playwright)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ICI = __dirname;
const PAGE = "file://" + path.join(ICI, "gabarit", "page.html");
const VISAGE = ["avocat", "facecam", "facecam-animee", "podcast", "createur-b", "ecran-partage", "ugc", "selfie"];

(async () => {
  const b = await chromium.launch();
  const ids = process.argv.slice(2);
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const tous = ids.length ? ids : await (async () => {
    await p.goto(PAGE + "?g=avocat&r=169");
    return p.evaluate(() => Object.keys(window.GENERATEURS));
  })();
  for (const d of ["16x9", "9x16", "instagram"]) fs.mkdirSync(path.join(ICI, d), { recursive: true });
  const prendre = async (id, r, insta, dossier) => {
    const [w, h] = r === "916" ? [1080, 1920] : [1280, 720];
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`${PAGE}?g=${id}&r=${r}${insta ? "&insta=1" : ""}`);
    await p.waitForSelector("body[data-pret='1']");
    await p.waitForLoadState("networkidle");
    await p.screenshot({ path: path.join(ICI, dossier, `${id}.jpg`), type: "jpeg", quality: 88 });
  };
  for (const id of tous) {
    await prendre(id, "169", false, "16x9");
    await prendre(id, "916", false, "9x16");
    if (VISAGE.includes(id)) await prendre(id, "916", true, "instagram");
    console.log("rendu", id);
  }
  await b.close();
})();
