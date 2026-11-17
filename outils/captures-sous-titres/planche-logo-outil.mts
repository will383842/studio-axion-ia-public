/**
 * PLANCHE DE LA PASTILLE « LOGO + NOM D'OUTIL » (C8-L08) — outil local, Remotion `still`, aucun réseau, aucun son.
 * Pour que Williams juge le dessin avant tout logo réel : 2 variantes (`ligne`, `autonome`) × fonds (ivoire, noir) ×
 * 2 formats (9:16, 16:9) × 3 cas (avec logo, repli texte seul, logo trop petit) sur `fond-clair.jpg`.
 * Logos de test = FORMES NEUTRES SANS MARQUE (carré, rond, triangle) : aucun logo d'outil réel, aucun logo de client.
 * Rien n'est branché dans le Studio ni dans le rendu : seul un point d'entrée Remotion temporaire est créé dans
 * `studio-rendu/` puis supprimé (aucun fichier existant modifié). Images dans `docs/captures/logo-outil/`.
 *
 * Usage (racine) : `pnpm exec tsx outils/captures-sous-titres/planche-logo-outil.mts`
 * (`studio-rendu` doit avoir ses paquets : `npm ci` dans ce dossier.)
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geometriePastilleLogo, type DemandePastilleLogo, type FondPastille, type VariantePastilleLogo } from "../../src/briques/sous-titres/pastille-logo";
import type { DessinLogo } from "../../src/briques/motion/logos-outils/types";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "logo-outil");
mkdirSync(SORTIE, { recursive: true });

/** Formes neutres (aucune marque) : un seul `<path>` chacune, vue carrée de 24. */
const TABLE_TEST: Record<string, DessinLogo> = {
  "essai-carre": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0H24V24H0Z" }]] },
  "essai-rond": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M12 0A12 12 0 1 1 12 24A12 12 0 1 1 12 0Z" }]] },
  "essai-triangle": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M12 1L23 23H1Z" }]] },
};

const FORMATS = { "9x16": [1080, 1920], "16x9": [1920, 1080] } as const;
const VARIANTES: VariantePastilleLogo[] = ["ligne", "autonome"];
const FONDS: FondPastille[] = ["ivoire", "noir"];
/** Chaque cas : id de logo (absent = repli texte seul) et taille du texte à 1 080 de large (20 px < minimum : « trop petit »), mise à l'échelle de la largeur de l'image comme le minimum du logo. */
const CAS = [
  { nom: "avec-logo", logoId: "essai-carre", taille: 64 },
  { nom: "avec-logo-rond", logoId: "essai-rond", taille: 64 },
  { nom: "avec-logo-triangle", logoId: "essai-triangle", taille: 64 },
  { nom: "repli-texte-seul", logoId: undefined, taille: 64 },
  { nom: "logo-trop-petit", logoId: "essai-carre", taille: 20 },
] as const;

const fond = `data:image/jpeg;base64,${readFileSync(join(ICI, "fond-clair.jpg")).toString("base64")}`;
const dossierTmp = join(RACINE, "studio-rendu", ".planche-logo-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entree = join(dossierTmp, "index.tsx");
writeFileSync(
  entree,
  `import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { PastilleLogo } from "../compositions/sous-titres/PastilleLogo";
const Planche: React.FC<any> = ({ fond, geometrie }) => (
  <AbsoluteFill style={{ background: "#888" }}>
    <img src={fond} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <PastilleLogo geometrie={geometrie} debutSec={0} finSec={4} />
  </AbsoluteFill>
);
registerRoot(() => (<>${Object.entries(FORMATS)
    .map(([n, [w, h]]) => `<Composition id="Planche-${n}" component={Planche} width={${w}} height={${h}} fps={25} durationInFrames={100} defaultProps={{}} />`)
    .join("")}</>));
`,
);

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown>; browserExecutable?: string | null }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string }; browserExecutable?: string | null }) => Promise<unknown>;
};

/** Navigateur local facultatif (variable `NAVIGATEUR`), sinon celui de Remotion. */
const browserExecutable = process.env.NAVIGATEUR ?? null;
const lignes: string[] = [];
try {
  const serveUrl = await bundle({ entryPoint: entree });
  for (const [nom, [largeurImage, hauteurImage]] of Object.entries(FORMATS)) {
    for (const variante of VARIANTES) {
      for (const fondVoulu of FONDS) {
        for (const cas of CAS) {
          const demande: DemandePastilleLogo = {
            variante, outilId: "chatgpt", logoId: cas.logoId, fondsPermis: ["ivoire", "noir"], fondVoulu,
            largeurImage, hauteurImage, tailleTextePx: (cas.taille * largeurImage) / 1080,
            ...(variante === "ligne" ? { xCentre: largeurImage / 2, yCentre: hauteurImage * 0.5 } : { zone: "bas" as const }),
          };
          const geometrie = geometriePastilleLogo(demande, TABLE_TEST);
          const fichier = `${nom}-${variante}-${fondVoulu}-${cas.nom}.png`;
          lignes.push(`${fichier}\tavecLogo=${geometrie?.avecLogo}\traison=${geometrie?.raisonTexteSeul ?? "-"}`);
          const inputProps = { fond, geometrie };
          const composition = await selectComposition({ serveUrl, id: `Planche-${nom}`, inputProps, browserExecutable });
          await renderStill({ composition, serveUrl, output: join(SORTIE, fichier), frame: 30, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable });
        }
      }
    }
  }
  writeFileSync(join(SORTIE, "planche.txt"), lignes.join("\n") + "\n");
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
