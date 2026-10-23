// Assemble les planches de contrôle à partir des rendus (lancer rendre.cjs avant).
// node docs/vignettes/maquettes/planches.cjs   (NODE_PATH doit contenir playwright)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ICI = __dirname;
const ORDRE = ["avocat", "facecam", "facecam-animee", "tableau-anime", "cas-concret", "image-video",
  "podcast", "createur-b", "ecran-partage", "motion", "ugc", "selfie"];
const VISAGE = ["avocat", "facecam", "facecam-animee", "podcast", "createur-b", "ecran-partage", "ugc", "selfie"];
const img = (d, id) => "file://" + path.join(ICI, d, id + ".jpg");
const FOND = "background:#0b0704;margin:0;font:600 15px Inter;color:#BFA88B";

// Une case rognée : on garde la bande centrale de la couverture 9:16 (1080×1920)
const rogne = (src, w, ratio) => {
  const h = Math.round(w / ratio);             // hauteur de la case
  const echelle = w / 1080;                    // largeur pleine
  const decalage = Math.round((1920 * echelle - h) / 2);
  return `<div style="width:${w}px;height:${h}px;overflow:hidden;position:relative">
    <img src="${src}" style="position:absolute;left:0;top:-${decalage}px;width:${w}px"></div>`;
};

const PLANCHES = {
  "serie-16x9": { w: 1720, html: () => `<body style="${FOND};padding:24px">
    <div style="display:grid;grid-template-columns:repeat(4,400px);gap:24px 24px">
    ${ORDRE.map(id => `<div><img src="${img("16x9", id)}" style="width:400px;display:block"><div style="margin-top:6px">${id}</div></div>`).join("")}
    </div></body>` },
  "serie-160": { w: 760, html: () => `<body style="${FOND};padding:20px;font-size:11px">
    <div style="margin-bottom:12px;font-size:13px">Taille réelle d'une vignette sur téléphone : 160 px de large</div>
    <div style="display:grid;grid-template-columns:repeat(4,160px);gap:14px 20px">
    ${ORDRE.map(id => `<div><img src="${img("16x9", id)}" style="width:160px;display:block"><div style="margin-top:3px">${id}</div></div>`).join("")}
    </div></body>` },
  "couvertures-9x16": { w: 1720, html: () => `<body style="${FOND};padding:24px">
    <div style="display:grid;grid-template-columns:repeat(6,262px);gap:20px">
    ${ORDRE.map(id => `<div><img src="${img("9x16", id)}" style="width:262px;display:block"><div style="margin-top:6px">${id}</div></div>`).join("")}
    </div></body>` },
  "grille-profil": { w: 1240, html: () => `<body style="${FOND};padding:24px">
    <div style="display:flex;gap:40px">
      <div><div style="margin-bottom:10px">Grille Instagram (3:4)</div>
        <div style="display:grid;grid-template-columns:repeat(3,190px);gap:3px">${ORDRE.map(id => rogne(img("9x16", id), 190, 3 / 4)).join("")}</div></div>
      <div><div style="margin-bottom:10px">Grille carrée (1:1)</div>
        <div style="display:grid;grid-template-columns:repeat(3,190px);gap:3px">${ORDRE.map(id => rogne(img("9x16", id), 190, 1)).join("")}</div></div>
    </div></body>` },
  "instagram-sans-visage": { w: 1240, html: () => `<body style="${FOND};padding:24px">
    <div style="margin-bottom:10px">Instagram : variantes sans visage (grille 3:4 à gauche, couverture entière à droite)</div>
    <div style="display:flex;gap:40px">
      <div style="display:grid;grid-template-columns:repeat(3,190px);gap:3px;align-content:start">${VISAGE.map(id => rogne(img("instagram", id), 190, 3 / 4)).join("")}</div>
      <div style="display:grid;grid-template-columns:repeat(4,130px);gap:12px;align-content:start">${VISAGE.map(id => `<div><img src="${img("instagram", id)}" style="width:130px;display:block"><div style="font-size:11px;margin-top:3px">${id}</div></div>`).join("")}</div>
    </div></body>` },
};

(async () => {
  fs.mkdirSync(path.join(ICI, "planches"), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [nom, { w, html }] of Object.entries(PLANCHES)) {
    const fichier = path.join(ICI, "planches", `.${nom}.html`);
    fs.writeFileSync(fichier, `<!doctype html><meta charset="utf-8">${html()}`);
    await p.setViewportSize({ width: w, height: 400 });
    await p.goto("file://" + fichier);
    await p.waitForLoadState("networkidle");
    const sortie = path.join(ICI, "planches", `${nom}.${nom === "serie-160" ? "png" : "jpg"}`);
    await p.screenshot({ path: sortie, fullPage: true, ...(sortie.endsWith(".jpg") ? { type: "jpeg", quality: 86 } : {}) });
    fs.unlinkSync(fichier);
    console.log("planche", nom);
  }
  await b.close();
})();
