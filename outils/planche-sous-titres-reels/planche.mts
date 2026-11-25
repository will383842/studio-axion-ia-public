/**
 * PLANCHE « SOUS-TITRES RÉELS » (FIX-MINIMAL-FOND-CLAIR-v21s). Lancé à la main ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-sous-titres-reels/planche.mts [--navigateur <chemin>] [--sortie <dossier>] [--nom <préfixe>] [--phrase "<texte>"] [--gabarits karaoke,minimal,impact,bandeau] [--facteur-ombre 1|2]`
 * Images : `<sortie>/<nom>-9x16.png` et `<nom>-16x9.png` ; défaut `docs/captures/sous-titres-reels`, jamais ajouté au dépôt.
 * L'entrée Remotion temporaire charge la VRAIE Manrope (`chargerPolices`) avant de dessiner, puis est supprimée, même en cas d'erreur.
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
const SORTIE = resolve(lireArguments(ARGUMENTS, "sortie") ?? join(RACINE, "docs", "captures", "sous-titres-reels"));
const NAVIGATEUR = lireArguments(ARGUMENTS, "navigateur");
const NOM = lireArguments(ARGUMENTS, "nom") ?? "planche";
const PHRASE = lireArguments(ARGUMENTS, "phrase") ?? "Ton droit reste gratuit";
const GABARITS = (lireArguments(ARGUMENTS, "gabarits") ?? "karaoke,minimal,impact,bandeau").split(",");
const FACTEUR = Number(lireArguments(ARGUMENTS, "facteur-ombre") ?? "1");
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
type ConfigWebpack = { resolve?: { alias?: Record<string, string> } };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string; webpackOverride?: (c: ConfigWebpack) => ConfigWebpack }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown>; browserExecutable?: string | null }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string }; browserExecutable?: string | null }) => Promise<unknown>;
};

const FORMATS = [
  { nom: "9x16", largeur: 1080, hauteur: 1920 },
  { nom: "16x9", largeur: 1920, hauteur: 1080 },
] as const;

const dossierTmp = join(RACINE, "studio-rendu", ".planche-sous-titres-reels-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { chargerPolices, FAMILLES } from "../compositions/sous-titres/polices";
import { PlancheSousTitresReels } from "../../outils/planche-sous-titres-reels/PlancheSousTitresReels";
const Planche: React.FC<any> = ({ phrase, gabarits, facteurOmbre, format }) => {
  chargerPolices(["Manrope Medium", "Manrope ExtraBold"]);
  return <PlancheSousTitresReels phrase={phrase} gabarits={gabarits} facteurOmbre={facteurOmbre} format={format} familles={FAMILLES} />;
};
registerRoot(() => (<>${FORMATS.map((f) => `<Composition id="SousTitresReels-${f.nom}" component={Planche} width={${f.largeur}} height={${f.hauteur}} fps={25} durationInFrames={50} defaultProps={{}} />`).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({
    entryPoint: entree,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": join(RACINE, "src") } } }),
  });
  for (const f of FORMATS) {
    const inputProps = { phrase: PHRASE, gabarits: GABARITS, facteurOmbre: FACTEUR, format: f.nom };
    const composition = await selectComposition({ serveUrl, id: `SousTitresReels-${f.nom}`, inputProps, browserExecutable: NAVIGATEUR ?? null });
    await renderStill({ composition, serveUrl, output: join(SORTIE, `${NOM}-${f.nom}.png`), frame: 10, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: NAVIGATEUR ?? null });
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
