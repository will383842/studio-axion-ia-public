/**
 * PLANCHE DES ÉMOJIS (C9-40c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-emojis/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Une entrée Remotion temporaire est créée dans `studio-rendu/.planche-emojis-tmp/` puis supprimée, même en cas d'erreur.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EMOJIS_FLUENT } from "../../src/briques/motion/petits-objets/emojis/index.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-emojis"));
mkdirSync(SORTIE, { recursive: true });

const DOSSIER_EMOJIS = join(RACINE, "src", "briques", "motion", "petits-objets", "emojis");
const svgs: Record<string, string> = Object.fromEntries(EMOJIS_FLUENT.map((e) => [e.id, readFileSync(join(DOSSIER_EMOJIS, e.fichier), "utf8")]));

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const FORMATS = { "9x16": [1080, 1920], "4x5": [1080, 1350] } as const;
const FONDS = ["ivoire", "noir"] as const;
const COMPOSITIONS = Object.keys(FORMATS).flatMap((format) => FONDS.map((fond) => ({ id: `emojis-${format}-${fond}`, format, fond })));

const dossierTmp = join(RACINE, "studio-rendu", ".planche-emojis-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheEmojis } from "../../outils/planche-emojis/PlancheEmojis";
const Planche: React.FC<any> = ({ format, fond, svgs }) => <PlancheEmojis format={format} fond={fond} svgs={svgs} />;
registerRoot(() => (<>${COMPOSITIONS.map((c) => {
    const [w, h] = FORMATS[c.format as keyof typeof FORMATS];
    return `<Composition id="${c.id}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={100} defaultProps={{ format: "${c.format}", fond: "${c.fond}", svgs: {} }} />`;
  }).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const c of COMPOSITIONS) {
    const inputProps = { format: c.format, fond: c.fond, svgs };
    const composition = await selectComposition({ serveUrl, id: c.id, inputProps });
    const output = join(SORTIE, `${c.id}.png`);
    await renderStill({ composition, serveUrl, output, frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
