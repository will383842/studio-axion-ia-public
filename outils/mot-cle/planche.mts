/**
 * PLANCHE « MOT-CLÉ » (PLANCHE-MOT-CLE-v21n). Lancé à la main ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/mot-cle/planche.mts [--navigateur <chemin>] [--sortie <dossier>]` (aucune variable d'environnement lue).
 * Images : `<sortie>/etiquette.png` et `<sortie>/bandeau.png` (défaut : `docs/captures/mot-cle`, jamais ajouté au dépôt).
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
const SORTIE = resolve(lireArguments(ARGUMENTS, "sortie") ?? join(RACINE, "docs", "captures", "mot-cle"));
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

const STYLES = ["etiquette", "bandeau"] as const;

const dossierTmp = join(RACINE, "studio-rendu", ".planche-mot-cle-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheMotCle } from "../../outils/mot-cle/PlancheMotCle";
const Planche: React.FC<any> = ({ style }) => <PlancheMotCle style={style} />;
registerRoot(() => (<>${STYLES.map((s) => `<Composition id="MotCle-${s}" component={Planche} width={1080} height={1920} fps={25} durationInFrames={50} defaultProps={{}} />`).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({
    entryPoint: entree,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": join(RACINE, "src") } } }),
  });
  for (const style of STYLES) {
    const inputProps = { style };
    const composition = await selectComposition({ serveUrl, id: `MotCle-${style}`, inputProps, browserExecutable: NAVIGATEUR ?? null });
    await renderStill({ composition, serveUrl, output: join(SORTIE, `${style}.png`), frame: 10, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: NAVIGATEUR ?? null });
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
