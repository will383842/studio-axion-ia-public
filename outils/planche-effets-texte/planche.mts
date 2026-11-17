/**
 * PLANCHE D'ATTENTE (C11-T8b-p). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-effets-texte/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Une entrée Remotion temporaire est créée dans `studio-rendu/.planche-effets-texte-tmp/` puis supprimée, même en cas d'erreur.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-effets-texte"));
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const FONDS = ["ivoire", "noir"] as const;
const COMPOSITIONS = FONDS.map((fond) => ({ id: `effets-texte-${fond}`, fond }));

const dossierTmp = join(RACINE, "studio-rendu", ".planche-effets-texte-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { Composition, registerRoot } from "remotion";
import { PlancheEffetsTexte } from "../../outils/planche-effets-texte/PlancheEffetsTexte";
const Planche: React.FC<any> = ({ fond }) => <PlancheEffetsTexte fond={fond} />;
registerRoot(() => (<>${COMPOSITIONS.map(
    (c) => `<Composition id="${c.id}" component={Planche} width={1080} height={1920} fps={30} durationInFrames={90} defaultProps={{ fond: "${c.fond}" }} />`,
  ).join("")}</>));
`,
);
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const c of COMPOSITIONS) {
    const inputProps = { fond: c.fond };
    const composition = await selectComposition({ serveUrl, id: c.id, inputProps });
    const output = join(SORTIE, `${c.id}.png`);
    await renderStill({ composition, serveUrl, output, frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
