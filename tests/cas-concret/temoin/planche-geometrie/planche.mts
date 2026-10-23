/**
 * PLANCHE DE GÉOMÉTRIE du format « Cas concret MD » (tâche B1c) : une image fixe par type d'écran, rendue avec
 * Remotion (composition `CasConcretEcran`, dernière image : tous les mots sont posés) à partir de `exemples.ts`, dans la
 * zone commune aux quatre réseaux (Facebook, Instagram, TikTok, LinkedIn). Sur chaque image, en surimpression légère :
 *   - les zones protégées des réseaux (voile sombre hachuré) ;
 *   - le cadre de la ZONE DE TEXTE (trait plein vert) : aucun texte porteur de sens ne doit en sortir ;
 *   - le cadre de la ZONE DE DESSIN (pointillé violet) : un objet sans texte utile peut aller jusque-là ;
 *   - la bande des sous-titres (bande jaune), avec une ligne de sous-titres d'essai posée dedans, sur un cartouche ;
 *   - le contour fin de chaque boîte de texte de la géométrie.
 * Sorties (JPEG 540 × 960, qualité 80) : `<etat>-<type>.jpg` ; et, quand les deux états existent,
 * `comparaison-<type>.jpg` : la référence la plus proche, l'état « avant » et l'état « après », côte à côte.
 *
 * Rendu local, sans serveur ni service payant. Usage (depuis la racine, après `npm --prefix studio-rendu ci`) :
 *   npx tsx tests/cas-concret/temoin/planche-geometrie/planche.mts <avant|apres> [type…]
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import type { BoitePx, ProprietesEcran } from "../../../../src/briques/ecrans-motion";

const RACINE = process.cwd();
const ICI = join(RACINE, "tests/cas-concret/temoin/planche-geometrie");
const REFERENCE = join(RACINE, "tests/cas-concret/temoin/reference");
const etat = process.argv[2];
if (etat !== "avant" && etat !== "apres") {
  console.error("Usage : planche.mts <avant|apres> [type…]");
  process.exit(2);
}
const filtre = process.argv.slice(3);

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
type ConfigWebpack = { resolve?: { modules?: string[] } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string; webpackOverride?: (c: ConfigWebpack) => ConfigWebpack }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
// Les exemples (`studio-rendu`, module ES) lisent la brique (`src`, CommonJS pour Node) : `tsx` ne relie pas leurs
// exports. Ils sont donc empaquetés ensemble par esbuild (celui de `studio-rendu`), puis chargés en mémoire.
type Brique = typeof import("../../../../src/briques/ecrans-motion");
type Exemples = typeof import("../../../../studio-rendu/compositions/cas-concret/exemples");
const esbuild = (await import(exiger.resolve("esbuild"))) as { build: (o: Record<string, unknown>) => Promise<{ outputFiles: { text: string }[] }> };
const paquet = await esbuild.build({
  stdin: {
    contents: `export * from "./studio-rendu/compositions/cas-concret/exemples";\nexport { disposer, imagesEcran, zonesEcran } from "./src/briques/ecrans-motion";\n`,
    resolveDir: RACINE,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { disposer, imagesEcran, zonesEcran, exemplesEcrans, ZONE_QUATRE_RESEAUX } = (await import(`data:text/javascript;base64,${Buffer.from(paquet.outputFiles[0].text).toString("base64")}`)) as Pick<Brique, "disposer" | "imagesEcran" | "zonesEcran"> & Exemples;

const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

/** Zones protégées des quatre réseaux, une à une (`src/reseaux`, 9:16, recopiées : la planche les montre en voile). */
const RESEAUX = [
  { nom: "Facebook", haut: 14, droite: 16, bas: 30, gauche: 6 },
  { nom: "Instagram", haut: 14, droite: 16, bas: 30, gauche: 6 },
  { nom: "TikTok", haut: 10, droite: 18, bas: 26, gauche: 4 },
  { nom: "LinkedIn", haut: 8, droite: 4, bas: 14, gauche: 4 },
];

/** Image de référence la plus proche de chaque type (`tests/cas-concret/temoin/reference/ref-<t>.jpg`). */
const REFERENCES: Record<string, string> = {
  accroche: "ref-0.8.jpg",
  chiffre: "ref-2.5.jpg",
  "liste-avant": "ref-6.jpg",
  titre: "ref-13.jpg",
  etape: "ref-16.jpg",
  objet: "ref-19.5.jpg",
  "objet-ecran-reel": "ref-19.5.jpg",
  preuve: "ref-32.jpg",
  resultat: "ref-23.5.jpg",
  question: "ref-13.jpg",
  "appel-mot": "ref-41.jpg",
  promesse: "ref-47.jpg",
  lien: "ref-47.jpg",
};

/** Le vrai écran de la référence (formulaire filmé), passé en adresse `data:` : aucun fichier à servir. */
const FORMULAIRE = `data:image/jpeg;base64,${readFileSync(join(REFERENCE, "rushes/form-024.jpg")).toString("base64")}`;
const CAPTURE = { src: FORMULAIRE, cle: "form", sorte: "image" as const, largeur: 1080, hauteur: 1920 };

/** Les écrans de la planche : les 12 exemples (l'étape montre le vrai écran), plus l'écran `objet` avec un vrai écran. */
function ecransPlanche(): { nom: string; p: ProprietesEcran }[] {
  const ex = exemplesEcrans();
  const liste = ex.map((p) => ({ nom: p.type as string, p: p.type === "etape" ? ({ ...p, visuel: { capture: CAPTURE } } as ProprietesEcran) : p }));
  const objet = ex.find((p) => p.type === "objet")!;
  liste.splice(6, 0, { nom: "objet-ecran-reel", p: { ...objet, titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { capture: CAPTURE } } as ProprietesEcran });
  return liste.filter((e) => !filtre.length || filtre.includes(e.nom));
}

/** Entrée Remotion écrite à la volée hors du dépôt (le typage du studio ne voit pas `remotion`). */
const temp = mkdtempSync(join(tmpdir(), "planche-geometrie-"));
const entree = join(temp, "entree.tsx");
writeFileSync(
  entree,
  `import { registerRoot } from "remotion";\nimport { CompositionsCasConcret } from ${JSON.stringify(join(RACINE, "studio-rendu/compositions/cas-concret/Compositions"))};\nregisterRoot(() => <CompositionsCasConcret />);\n`,
);
const modules = join(RACINE, "studio-rendu/node_modules");
const serveUrl = await bundle({ entryPoint: entree, webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, modules: [modules, "node_modules", ...(c.resolve?.modules ?? [])] } }) });

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 540, height: 960 } });
const police = (f: string) => `data:font/ttf;base64,${readFileSync(join(RACINE, "studio-rendu/compositions/commune/polices", f)).toString("base64")}`;
const POLICES = `@font-face{font-family:I;src:url(${police("Inter-Bold.ttf")})}`;
const px = (b: BoitePx) => `left:${b.x / 2}px;top:${b.y / 2}px;width:${b.largeur / 2}px;height:${b.hauteur / 2}px`;

mkdirSync(ICI, { recursive: true });
for (const { nom, p } of ecransPlanche()) {
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "CasConcretEcran", inputProps, ...reglages });
  const png = join(temp, `${nom}.png`);
  await renderStill({ composition, serveUrl, output: png, frame: imagesEcran(p) - 1, inputProps, imageFormat: "png", ...reglages });

  // La bande des sous-titres de l'écran : ce qui sépare le bas de sa zone utile du bas de la zone sûre.
  const sure = zonesEcran(ZONE_QUATRE_RESEAUX, p.largeur, p.hauteur, 0).texte;
  const z = zonesEcran(ZONE_QUATRE_RESEAUX, p.largeur, p.hauteur, (sure.y + sure.hauteur - (p.zone.y + p.zone.hauteur)) / p.hauteur);
  const voiles = RESEAUX.map((r) => {
    const L = p.largeur / 2;
    const H = p.hauteur / 2;
    const t = [
      [0, 0, L, (H * r.haut) / 100],
      [0, H * (1 - r.bas / 100), L, (H * r.bas) / 100],
      [0, 0, (L * r.gauche) / 100, H],
      [L * (1 - r.droite / 100), 0, (L * r.droite) / 100, H],
    ];
    return t.map(([x, y, l, h]) => `<i class="v" style="left:${x}px;top:${y}px;width:${l}px;height:${h}px"></i>`).join("");
  }).join("");
  const boites = disposer(p)
    .textes.map((t) => `<i class="b" style="${px(t.boite)}"></i>`)
    .join("");
  const html = `<html><head><style>${POLICES}
    body{margin:0;width:540px;height:960px;position:relative;overflow:hidden}
    img{position:absolute;left:0;top:0;width:540px;height:960px}
    i{position:absolute;display:block;box-sizing:border-box}
    .v{background:rgba(0,0,0,.07)}
    .t{border:2px solid rgba(40,200,90,.95)}
    .d{border:2px dashed rgba(150,80,230,.95)}
    .s{background:rgba(255,215,0,.16);border-top:1px solid rgba(255,215,0,.8);border-bottom:1px solid rgba(255,215,0,.8)}
    .b{border:1px solid rgba(40,200,90,.45)}
    .st{position:absolute;display:flex;align-items:center;justify-content:center;font:22px I;color:#fff;white-space:nowrap}
    .st span{background:rgba(17,10,5,.72);border-radius:10px;padding:3px 12px}
    .st b{color:#F0703C}
    .tag{position:absolute;left:4px;bottom:4px;font:12px I;color:#fff;background:rgba(0,0,0,.6);padding:2px 5px}
  </style></head><body>
    <img src="data:image/png;base64,${readFileSync(png).toString("base64")}">
    ${voiles}${boites}
    <i class="d" style="${px(z.dessin)}"></i>
    <i class="t" style="${px(z.texte)}"></i>
    <i class="s" style="${px(z.sousTitres)}"></i>
    <div class="st" style="${px(z.sousTitres)}"><span>Elle s'inscrit toute <b>seule,</b></span></div>
    <div class="tag">${etat} · ${nom}</div>
  </body></html>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(ICI, `${etat}-${nom}.jpg`), type: "jpeg", quality: 80 });
  console.log(`${etat}-${nom}.jpg`);
}

// Comparaisons : référence | avant | après, quand les deux états existent.
await page.setViewportSize({ width: 1080, height: 660 });
for (const { nom } of ecransPlanche()) {
  const fichiers = [join(REFERENCE, REFERENCES[nom]), join(ICI, `avant-${nom}.jpg`), join(ICI, `apres-${nom}.jpg`)];
  if (!fichiers.every((f) => existsSync(f))) continue;
  const cases = fichiers
    .map((f, i) => `<figure><img src="data:image/jpeg;base64,${readFileSync(f).toString("base64")}"><figcaption>${["référence", "avant", "après"][i]}</figcaption></figure>`)
    .join("");
  await page.setContent(`<html><head><style>${POLICES}body{margin:0;background:#222;display:flex;gap:0;padding:0}figure{margin:0;width:360px}img{width:360px;height:640px;display:block}figcaption{color:#eee;font:14px I;text-align:center;height:20px;line-height:20px}</style></head><body>${cases}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(ICI, `comparaison-${nom}.jpg`), type: "jpeg", quality: 80 });
}
await nav.close();
rmSync(temp, { recursive: true, force: true });
console.log(`Planche « ${etat} » dans ${ICI}`);
