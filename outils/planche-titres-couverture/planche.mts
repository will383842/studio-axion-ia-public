/**
 * PLANCHE D'ATTENTE (C11-T6b-p). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-titres-couverture/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Une entrée Remotion temporaire est créée dans `studio-rendu/.planche-titres-couverture-tmp/` puis supprimée, même en cas d'erreur.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-titres-couverture"));
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const RATIOS = { "9x16": ["9:16", 1080, 1920], "4x5": ["4:5", 1080, 1350], "1x1": ["1:1", 1080, 1080], "16x9": ["16:9", 1920, 1080] } as const;
const FONDS = ["ivoire", "noir"] as const;
const COMPOSITIONS = Object.keys(RATIOS).flatMap((cle) => FONDS.map((fond) => ({ id: `titres-couverture-${cle}-${fond}`, cle: cle as keyof typeof RATIOS, fond })));

const dossierTmp = join(RACINE, "studio-rendu", ".planche-titres-couverture-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheTitresCouverture } from "../../outils/planche-titres-couverture/PlancheTitresCouverture";
const Planche: React.FC<any> = ({ ratio, fond }) => <PlancheTitresCouverture ratio={ratio} fond={fond} />;
registerRoot(() => (<>${COMPOSITIONS.map((c) => {
    const [ratio, w, h] = RATIOS[c.cle];
    return `<Composition id="${c.id}" component={Planche} width={${w}} height={${h}} fps={30} durationInFrames={30} defaultProps={{ ratio: "${ratio}", fond: "${c.fond}" }} />`;
  }).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const c of COMPOSITIONS) {
    const inputProps = { ratio: RATIOS[c.cle][0], fond: c.fond };
    const composition = await selectComposition({ serveUrl, id: c.id, inputProps });
    const output = join(SORTIE, `${c.id}.png`);
    await renderStill({ composition, serveUrl, output, frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
