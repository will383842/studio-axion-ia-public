/**
 * PLANCHE « TENDANCES 2027 » (X1-17a). Lancé à la main ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Images dans `docs/captures/tendances-2027/<format>.png`.
 * Usage (racine) : `pnpm exec tsx outils/tendances-2027/planche.mts [--navigateur <chemin>] [--sortie <dossier>]` (aucune variable d'environnement lue).
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
const SORTIE = resolve(lireArguments(ARGUMENTS, "sortie") ?? join(RACINE, "docs", "captures", "tendances-2027"));
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

const FORMATS = { "9x16": [1080, 1920], "4x5": [1080, 1350], "1x1": [1080, 1080], "16x9": [1920, 1080] } as const;
const GRAINE = 1;

const dossierTmp = join(RACINE, "studio-rendu", ".planche-tendances-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheTendances2027 } from "../../outils/tendances-2027/PlancheTendances2027";
const Planche: React.FC<any> = ({ format, graine }) => <PlancheTendances2027 format={format} graine={graine} />;
registerRoot(() => (<>${Object.entries(FORMATS)
    .map(([n, [w, h]]) => `<Composition id="Tendances-${n}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={50} defaultProps={{}} />`)
    .join("")}</>));
`,
);
try {
  const serveUrl = await bundle({
    entryPoint: entree,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": join(RACINE, "src") } } }),
  });
  for (const nom of Object.keys(FORMATS)) {
    const inputProps = { format: nom, graine: GRAINE };
    const composition = await selectComposition({ serveUrl, id: `Tendances-${nom}`, inputProps, browserExecutable: NAVIGATEUR ?? null });
    await renderStill({ composition, serveUrl, output: join(SORTIE, `${nom}.png`), frame: 10, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: NAVIGATEUR ?? null });
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
