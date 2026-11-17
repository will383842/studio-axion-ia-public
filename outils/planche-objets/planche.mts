/**
 * PLANCHE D'ATTENTE (C9-40b-a). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-objets/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Une entrée Remotion temporaire est créée dans `studio-rendu/.planche-objets-attente-tmp/` puis supprimée, même en cas d'erreur.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-objets-attente"));
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const FORMATS = { "9x16": [1080, 1920], "4x5": [1080, 1350] } as const;
const FONDS = ["ivoire", "noir"] as const;
const COMPOSITIONS = Object.keys(FORMATS).flatMap((format) => FONDS.map((fond) => ({ id: `attente-${format}-${fond}`, format, fond })));

const dossierTmp = join(RACINE, "studio-rendu", ".planche-objets-attente-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheObjetsAttente } from "../../outils/planche-objets/PlancheObjetsAttente";
const Planche: React.FC<any> = ({ format, fond }) => <PlancheObjetsAttente format={format} fond={fond} />;
registerRoot(() => (<>${COMPOSITIONS.map((c) => {
    const [w, h] = FORMATS[c.format as keyof typeof FORMATS];
    return `<Composition id="${c.id}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={100} defaultProps={{ format: "${c.format}", fond: "${c.fond}" }} />`;
  }).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const c of COMPOSITIONS) {
    const inputProps = { format: c.format, fond: c.fond };
    const composition = await selectComposition({ serveUrl, id: c.id, inputProps });
    const output = join(SORTIE, `${c.id}.png`);
    await renderStill({ composition, serveUrl, output, frame: 50, inputProps, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
