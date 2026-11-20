/**
 * C5-5.09b-v20b : planche avant/après du calque texte de la face caméra 9:16 (sans plan, puis avec le plan dessiné sous le texte).
 * Outil manuel (jamais lancé en CI) : 6 instants de `mots-planche.json` (ceux du filet C5-5.09a), Remotion + Chrome local.
 * Aucun son, aucune voix, aucun envoi : le dessin du plan est allumé ICI seulement (propriété `planScenes` de la commande de rendu).
 * Usage (depuis la racine) : `npx tsx outils/chantier5/planche-plan-scenes.mts`  (Chrome : variable CHROME, sinon /opt/pw-browsers/chromium).
 * Sorties : `outils/chantier5/planche-plan-scenes.jpg` (2 lignes × 6 vignettes) et `outils/chantier5/reference.json`.
 * Prérequis : `cd studio-rendu && npm ci --ignore-scripts`. Aucune dépendance ajoutée.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { donneesCalque, fabriquerSousTitres } from "../../src/briques/sous-titres/index";
import { RECETTE_COMPOSITION_FACECAM } from "../../src/moteurs/montage-facecam/habillage";
import { PLAN_DEMO } from "../../src/briques/plan-scenes/demo";
import { validerPlan } from "../../src/briques/plan-scenes/validateur";
import { instantsTexte } from "../../studio-rendu/src/composition/texte-instants";

const racine = resolve(import.meta.dirname, "../..");
const rendu = resolve(racine, "studio-rendu");
const requis = createRequire(join(rendu, "package.json"));
const charger = async (nom: string) => import(pathToFileURL(requis.resolve(nom)).href);
const { bundle } = (await charger("@remotion/bundler")) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await charger("@remotion/renderer")) as {
  renderStill: (o: Record<string, unknown>) => Promise<unknown>;
  selectComposition: (o: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

interface Planche { dureeSec: number; fps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
const planche = JSON.parse(readFileSync(resolve(racine, "outils/chantier5/mots-planche.json"), "utf8")) as Planche;
const IMAGES = Math.ceil(planche.dureeSec * planche.fps);
const PHRASE = planche.mots.map((m) => m.mot).join(" ");

const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: planche.dureeSec, mots: planche.mots, emphase: ["paniers", "pommes", "rouges"], base: "karaoke", intensite: "equilibre" });
const centre = RECETTE_COMPOSITION_FACECAM.centreSousTitres["9:16"];
const sousTitres = donneesCalque({ segments, base: "karaoke", ratio: "9:16", style: { positionPct: centre } as never });
const base = { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: planche.fps, images: IMAGES, incrustations: [] as never[], sousTitres };
const plan = validerPlan({ ...PLAN_DEMO, facecam: true }).plan;

// Mêmes 6 instants que le filet C5-5.09a.
const segs = sousTitres.segments;
const valeur = segs.flatMap((s) => s.mots).find((m) => m.enValeur);
const instants = [0.1, segs[0].debutSec + 0.05, (valeur ? valeur.debutSec : segs[0].mots[0].debutSec) + 0.05, planche.dureeSec / 2, (segs[1] ?? segs[0]).debutSec + 0.02, planche.dureeSec + 1].map((x) => +x.toFixed(3));

const navigateur = process.env.CHROME ?? "/opt/pw-browsers/chromium";
const reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle", headless: true, disableWebSecurity: false, ignoreCertificateErrors: false, enableMultiProcessOnLinux: false }, chromeMode: "headless-shell" };
const tmp = mkdtempSync(join(tmpdir(), "planche-plan-scenes-"));
try {
  const serveUrl = await bundle({ entryPoint: resolve(rendu, "compositions/index.ts") });
  const colonnes = [
    { nom: "sans-plan", props: base },
    { nom: "avec-plan", props: { ...base, planScenes: plan } },
  ];
  const images: { colonne: string; t: number; fichier: string; md5: string }[] = [];
  const decompte: Record<string, number> = {};
  for (const c of colonnes) {
    decompte[c.nom] = instantsTexte(c.props as never).instants.length;
    for (const [i, t] of instants.entries()) {
      const inputProps = { ...c.props, instants: [t] } as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "CompositionTexte", inputProps, ...reglages });
      const fichier = join(tmp, `${c.nom}-${i}.png`);
      await renderStill({ composition, serveUrl, frame: 0, output: fichier, inputProps, imageFormat: "png", ...reglages });
      images.push({ colonne: c.nom, t, fichier, md5: createHash("md5").update(readFileSync(fichier)).digest("hex") });
    }
  }
  // Planche : fond gris sombre (le calque est transparent), 2 lignes × 6 vignettes de 270 × 480.
  const entrees = images.flatMap((x) => ["-i", x.fichier]);
  const filtre = images.map((_, i) => `color=c=0x303030:s=1080x1920,format=rgba[f${i}];[f${i}][${i}:v]overlay,scale=270:480[v${i}]`).join(";") + ";" +
    [0, 1].map((l) => `${Array.from({ length: 6 }, (_, k) => `[v${l * 6 + k}]`).join("")}hstack=inputs=6[l${l}]`).join(";") + ";[l0][l1]vstack=inputs=2[out]";
  const sortieJpg = resolve(racine, "outils/chantier5/planche-plan-scenes.jpg");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...entrees, "-filter_complex", filtre, "-map", "[out]", "-frames:v", "1", "-q:v", "5", sortieJpg]);
  mkdirSync(resolve(racine, "outils/chantier5"), { recursive: true });
  const reference = {
    note: "Produit par outils/chantier5/planche-plan-scenes.mts (C5-5.09b-v20b). Sortie du rendu, pas un instantané à régénérer sans accord du relecteur.",
    source: "outils/chantier5/mots-planche.json",
    tempsTexteSec: instants,
    imagesTexte: decompte,
    images: images.map((x) => ({ colonne: x.colonne, tSec: x.t, md5: x.md5 })),
  };
  writeFileSync(resolve(racine, "outils/chantier5/reference.json"), JSON.stringify(reference, null, 1) + "\n");
  console.log("planche :", sortieJpg);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
