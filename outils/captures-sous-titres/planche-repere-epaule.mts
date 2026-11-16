/**
 * PLANCHE DU REPÈRE ÉPAULE (C2-U18) — outil local, Remotion `still`, aucun réseau. Pour juger le grief du 19/10
 * (« effet peu lisible ») : 3 teintes × 2 côtés × 2 formats sur `fond-clair.jpg`, images dans `docs/captures/repere-epaule/`.
 * L'image « v4 à côté » n'est pas produite ici (sans importer `CercleEpaule`) : à comparer avec une capture v4 existante.
 *
 * Usage (racine) : `pnpm exec tsx outils/captures-sous-titres/planche-repere-epaule.mts`
 * Un point d'entrée Remotion temporaire est créé dans `studio-rendu/` puis supprimé (aucun fichier existant modifié).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "repere-epaule");
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const fond = `data:image/jpeg;base64,${readFileSync(join(ICI, "fond-clair.jpg")).toString("base64")}`;
const dossierTmp = join(RACINE, "studio-rendu", ".planche-repere-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
const FORMATS = { "9x16": [1080, 1920], "16x9": [1920, 1080] } as const;
writeFileSync(
  entree,
  `import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { RepereEpaule } from "../compositions/sous-titres/RepereEpaule";
const Planche: React.FC<any> = ({ fond, repere }) => (
  <AbsoluteFill style={{ background: "#888" }}>
    <img src={fond} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <RepereEpaule {...repere} />
  </AbsoluteFill>
);
registerRoot(() => (<>${Object.entries(FORMATS)
    .map(([n, [w, h]]) => `<Composition id="Planche-${n}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={50} defaultProps={{}} />`)
    .join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const [nom] of Object.entries(FORMATS)) {
    for (const teinte of ["terracotta", "ivoire", "ardoise"] as const) {
      for (const cote of ["gauche", "droite"] as const) {
        const inputProps = { fond, repere: { x: cote === "gauche" ? 0.62 : 0.38, y: 0.55, cote, texte: "À retenir", teinte } };
        const composition = await selectComposition({ serveUrl, id: `Planche-${nom}`, inputProps });
        await renderStill({ composition, serveUrl, output: join(SORTIE, `${nom}-${teinte}-${cote}.png`), frame: 30, inputProps, chromiumOptions: { gl: "swangle" } });
      }
    }
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
