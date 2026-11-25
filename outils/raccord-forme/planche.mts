/**
 * PLANCHE « RACCORD PAR FORME » (PLANCHE-RACCORD-FORME-v21p). Lancé à la main ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/raccord-forme/planche.mts [--navigateur <chemin>] [--sortie <dossier>]` (aucune variable d'environnement lue).
 * Images : `temoin-eteint.png`, `raccord-00.png`, `raccord-05.png`, `raccord-10.png`, `raccord-12.png` (défaut : `docs/captures/raccord-forme`, jamais ajouté au dépôt).
 * La VRAIE composition `PlanDeScenes` rend une tranche issue de la chaîne réelle (`tranche.ts`). Une entrée Remotion temporaire est créée dans
 * `studio-rendu/` puis supprimée, même en cas d'erreur (aucun fichier existant modifié).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
/** Lit `--nom valeur` dans la ligne de commande ; absent : `undefined`. */
function lireArguments(args: string[], nom: string): string | undefined {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
const ARGUMENTS = process.argv.slice(2);
const SORTIE = resolve(lireArguments(ARGUMENTS, "sortie") ?? join(RACINE, "docs", "captures", "raccord-forme"));
const NAVIGATEUR = lireArguments(ARGUMENTS, "navigateur");
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
type ConfigWebpack = { resolve?: { alias?: Record<string, string> } };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string; webpackOverride?: (c: ConfigWebpack) => ConfigWebpack }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown>; browserExecutable?: string | null }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string }; browserExecutable?: string | null }) => Promise<unknown>;
};

// `server-only` (importé par la chaîne du cas concret) refuse tout autre contexte que Next : ici, un module vide, le temps de ce script local.
const requisRacine = createRequire(import.meta.url);
const cheminServerOnly = requisRacine.resolve("server-only");
requisRacine.cache[cheminServerOnly] = { id: cheminServerOnly, filename: cheminServerOnly, loaded: true, exports: {}, children: [], paths: [], path: dirname(cheminServerOnly) } as unknown as NodeJS.Module;
const { trancheRaccordForme } = await import("./tranche");
const t = await trancheRaccordForme();
console.log(`scène du raccord : ${t.sceneId}, image de début : ${t.imageDebut}`);
const VUES = [
  { nom: "temoin-eteint", plan: t.temoin, image: t.imageDebut + 5 },
  // Image locale 0 : si la scène n'est active qu'à l'image suivante (début entre deux images), on prend la première image où elle existe.
  ...[0, 5, 10, 12].map((k) => ({ nom: `raccord-${String(k).padStart(2, "0")}`, plan: t.tranche, image: k === 0 ? t.premiereImage : t.imageDebut + k })),
];

const dossierTmp = join(RACINE, "studio-rendu", ".planche-raccord-forme-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import { Composition, registerRoot } from "remotion";
import { PlanDeScenes, metaPlanDeScenes, PLAN_VIDE } from "../compositions/plan-scenes/PlanDeScenes";
registerRoot(() => (<Composition id="PlanDeScenes" component={PlanDeScenes} width={1080} height={1920} fps={25} durationInFrames={75} defaultProps={PLAN_VIDE} calculateMetadata={metaPlanDeScenes} />));
`,
);
try {
  const serveUrl = await bundle({
    entryPoint: entree,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": join(RACINE, "src") } } }),
  });
  for (const v of VUES) {
    const inputProps = { plan: v.plan };
    const composition = await selectComposition({ serveUrl, id: "PlanDeScenes", inputProps, browserExecutable: NAVIGATEUR ?? null });
    await renderStill({ composition, serveUrl, output: join(SORTIE, `${v.nom}.png`), frame: v.image, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: NAVIGATEUR ?? null });
    console.log(`${v.nom}.png (image ${v.image})`);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
