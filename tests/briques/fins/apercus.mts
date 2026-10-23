/**
 * APERÇUS d'images de la fin (TB-15) et de la couverture de série (TB-16) : 3 images de chaque, rendu local Remotion
 * (même composition que le conteneur), sans serveur ni appel réel. Usage (racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/briques/fins/apercus.mts [dossier de sortie]
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { FIN_EXEMPLE } from "../../../studio-rendu/compositions/commune/fin/exemple";
import { planifierFin } from "../../../studio-rendu/compositions/commune/fin/plan";
import { COUVERTURE_EXEMPLE } from "../../../studio-rendu/compositions/commune/miniature-serie/exemple";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, ".apercus-tableau"));
mkdirSync(sortie, { recursive: true });
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface Choisie { width: number; height: number; fps: number; durationInFrames: number }
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<Choisie>;
  renderStill: (o: { composition: Choisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });

async function image(id: string, props: Record<string, unknown>, frame: number, nom: string) {
  const composition = await selectComposition({ serveUrl, id, inputProps: props, ...reglages });
  await renderStill({ composition, serveUrl, output: join(sortie, nom), frame: Math.min(frame, composition.durationInFrames - 1), inputProps: props, imageFormat: "png", ...reglages });
  console.log(nom);
}

const fins = [
  { nom: "enregistrement", p: { ...FIN_EXEMPLE } },
  { nom: "question", p: { ...FIN_EXEMPLE, phrase: "Votre question en commentaire", dureeMs: 3000 } },
  { nom: "commentaire", p: { ...FIN_EXEMPLE, phrase: "Commentez MÉTHODE", dureeMs: 4000 } },
];
for (const { nom, p } of fins) {
  const plan = planifierFin(p);
  const props = p as unknown as Record<string, unknown>;
  await image("TableauFin", props, Math.round((plan.coche.debut + plan.coche.duree * 0.5) * plan.fps), `fin_${nom}_coche-en-cours.png`);
  await image("TableauFin", props, plan.images - 1, `fin_${nom}_derniere.png`);
}
const couvertures = [
  { nom: "9x16", p: { ...COUVERTURE_EXEMPLE } },
  { nom: "1x1", p: { ...COUVERTURE_EXEMPLE, ratio: "1:1", douleur: "Vos équipes perdent une heure par jour", motCle: "heure" } },
  { nom: "9x16-longue", p: { ...COUVERTURE_EXEMPLE, douleur: "Votre assistant répond à côté de la question", motCle: "côté", serie: "L'IA au bureau" } },
];
for (const { nom, p } of couvertures) await image("TableauCouvertureSerie", p as unknown as Record<string, unknown>, 0, `couverture_${nom}.png`);
console.log(`Aperçus dans ${sortie}`);
