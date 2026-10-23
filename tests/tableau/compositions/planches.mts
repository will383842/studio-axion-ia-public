/**
 * PLANCHES D'APERÇU du tableau animé : pour chacune des 4 fiches d'exemple, la DERNIÈRE image de chaque scène côte à
 * côte (`planche-<structure>.png`), et des images pleine taille : milieu de la scène 2 (le crayon écrit) et fin de la
 * scène 5 (bulle de preuve). Rendu local Remotion (même composition que le conteneur), sans serveur ni voix réelle.
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/compositions/planches.mts [dossier de sortie]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { ElementTableau, FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { imagesScene } from "../../../studio-rendu/compositions/tableau/proprietes";
import { EXEMPLES, copie } from "../regles/exemples";
import { scenesExemple } from "./outils";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, ".planches-tableau"));
mkdirSync(sortie, { recursive: true });
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

/** Un mot important par fiche (champ `importants` de la fiche), pour le voir souligné. */
const IMPORTANTS: Record<string, [string, string]> = { "erreur-corrigee": ["e06", "questions"], "avant-apres": ["e07", "cinq"], demonstration: ["e05", "trois"], "question-abonne": ["e05", "fermée"] };

const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
const planches: { nom: string; images: string[] }[] = [];
for (const [nom, base] of Object.entries(EXEMPLES)) {
  const fiche: FicheTableau = copie(base);
  const [id, mot] = IMPORTANTS[nom];
  const ligne = fiche.scenes.flatMap((s) => s.elements).find((e): e is Extract<ElementTableau, { type: "ligne" }> => e.id === id && e.type === "ligne")!;
  ligne.importants = [mot];
  const scenes = scenesExemple(fiche);
  const images: string[] = [];
  for (const [k, p] of scenes.entries()) {
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const n = imagesScene(p);
    const fin = join(sortie, `${nom}_s0${k + 1}_fin.png`);
    await renderStill({ composition, serveUrl, output: fin, frame: n - 1, inputProps, imageFormat: "png", ...reglages });
    images.push(fin);
    if (k === 1) await renderStill({ composition, serveUrl, output: join(sortie, `${nom}_s02_milieu-crayon.png`), frame: Math.floor((n - 1) / 2), inputProps, imageFormat: "png", ...reglages });
    if (k === 4) await renderStill({ composition, serveUrl, output: join(sortie, `${nom}_s05_milieu-crayon.png`), frame: Math.floor((n - 1) * 0.6), inputProps, imageFormat: "png", ...reglages });
  }
  planches.push({ nom, images });
  console.log(`${nom} : ${images.length} scènes rendues`);
}

// Planches : les dernières images côte à côte, au quart, légendées.
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 6 * 282 + 6, height: 530 } });
for (const p of planches) {
  const cases = p.images.map((f, i) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString("base64")}"><figcaption>s0${i + 1}</figcaption></figure>`).join("");
  await page.setContent(`<html><body style="margin:0;background:#222;display:flex;gap:12px;padding:6px"><style>figure{margin:0;width:270px}img{width:270px;height:480px;display:block}figcaption{color:#eee;font:22px sans-serif;text-align:center;padding-top:6px}</style>${cases}</body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(sortie, `planche-${p.nom}.png`) });
}
await nav.close();
console.log(`Planches dans ${sortie}`);
