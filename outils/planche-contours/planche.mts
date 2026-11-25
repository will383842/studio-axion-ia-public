/**
 * PLANCHE « CONTOURS » (PLANCHE-CONTOURS-a-v21r). Lancé à la main ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-contours/planche.mts [--navigateur <chemin>] [--sortie <dossier>]` (aucune variable d'environnement lue).
 * Images : `<sortie>/V0-9x16.png`, `V1-9x16.png`, `V2-9x16.png` (+ `-16x9`) ; défaut `docs/captures/contours`, jamais ajouté au dépôt.
 * Une entrée Remotion temporaire est créée dans `studio-rendu/` puis supprimée, même en cas d'erreur (aucun fichier existant modifié).
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
const SORTIE = resolve(lireArguments(ARGUMENTS, "sortie") ?? join(RACINE, "docs", "captures", "contours"));
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

const VARIANTES = ["V0", "V1", "V2"] as const;
const FORMATS = [
  { nom: "9x16", largeur: 1080, hauteur: 1920 },
  { nom: "16x9", largeur: 1920, hauteur: 1080 },
] as const;

const dossierTmp = join(RACINE, "studio-rendu", ".planche-contours-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheContours } from "../../outils/planche-contours/PlancheContours";
const Planche: React.FC<any> = ({ variante, format }) => <PlancheContours variante={variante} format={format} />;
registerRoot(() => (<>${FORMATS.map((f) => `<Composition id="Contours-${f.nom}" component={Planche} width={${f.largeur}} height={${f.hauteur}} fps={25} durationInFrames={50} defaultProps={{}} />`).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({
    entryPoint: entree,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": join(RACINE, "src") } } }),
  });
  for (const f of FORMATS) {
    for (const variante of VARIANTES) {
      const inputProps = { variante, format: f.nom };
      const composition = await selectComposition({ serveUrl, id: `Contours-${f.nom}`, inputProps, browserExecutable: NAVIGATEUR ?? null });
      await renderStill({ composition, serveUrl, output: join(SORTIE, `${variante}-${f.nom}.png`), frame: 10, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: NAVIGATEUR ?? null });
    }
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
