/**
 * PLANCHE DES AVIS D'EXEMPLE (C8-A05). Lancé à la main ; aucun générateur n'importe ce fichier ; avis d'EXEMPLE seulement
 * (`exemple: true`, filigrane « EXEMPLE »). Images dans `docs/captures/avis-client/<ratio>-<variante>.png`.
 * Usage (racine) : `pnpm exec tsx outils/avis-client/planche.mts`
 * Une entrée Remotion temporaire est créée dans `studio-rendu/` puis supprimée (aucun fichier existant modifié).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AVIS_EXEMPLE, AVIS_EXEMPLE_LONG, AVIS_EXEMPLE_NOTE3 } from "./exemple";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "avis-client");
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const RATIOS = { "9x16": ["9:16", 1080, 1920], "16x9": ["16:9", 1920, 1080], "1x1": ["1:1", 1080, 1080] } as const;
const VARIANTES = { note5: AVIS_EXEMPLE, note3: AVIS_EXEMPLE_NOTE3, long: AVIS_EXEMPLE_LONG } as const;

const dossierTmp = join(RACINE, "studio-rendu", ".planche-avis-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { CarteAvisClient } from "../compositions/avis-client/CarteAvisClient";
const Planche: React.FC<any> = ({ avis, ratio }) => (
  <AbsoluteFill style={{ background: "#D8D6CC" }}>
    <CarteAvisClient avis={avis} ratio={ratio} />
  </AbsoluteFill>
);
registerRoot(() => (<>${Object.entries(RATIOS)
    .map(([n, [, w, h]]) => `<Composition id="Avis-${n}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={50} defaultProps={{}} />`)
    .join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const [nom, [ratio]] of Object.entries(RATIOS)) {
    for (const [variante, avis] of Object.entries(VARIANTES)) {
      const inputProps = { avis, ratio };
      const composition = await selectComposition({ serveUrl, id: `Avis-${nom}`, inputProps });
      await renderStill({ composition, serveUrl, output: join(SORTIE, `${nom}-${variante}.png`), frame: 10, inputProps, chromiumOptions: { gl: "swangle" } });
    }
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
