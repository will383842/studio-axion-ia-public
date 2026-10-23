/**
 * APERÇUS DE LA FIN DES DEUX VERTICAUX (Reels et stories ; TikTok et Shorts) : rendu RÉEL (Remotion, Chromium sans
 * affichage) de la DERNIÈRE scène de chaque variante, fabriquée par la chaîne avec des doubles. La voix n'est pas lue :
 * le minutage de la voix modèle déjà enregistrée (`temps-formation.json`) est injecté (corps, puis l'appel lu « à part »).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/fins-par-reseau/apercus-fin.mts [dossier de sortie]
 * Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { finEtAppelDuTableau, reseauDeLaSortie } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";
import { contexteFormation, ficheFormation, motsFormation } from "../style-v2/temoin-formation";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-fins-par-reseau"));
mkdirSync(sortie, { recursive: true });

// Voix modèle : le corps (tout sauf l'appel) et l'appel, comme deux lectures séparées.
const tous = motsFormation();
const nAppel = 7;
const corps = tous.slice(0, -nAppel);
const t0 = tous[tous.length - nAppel].debutSec - 0.05;
const appel = tous.slice(-nAppel).map((m) => ({ ...m, debutSec: +(m.debutSec - t0).toFixed(3), finSec: +(m.finSec - t0).toFixed(3) }));

const fiche = { ...ficheFormation(), appelId: "fin-if-mot-envoi" };
const d = doubles(fiche);
const voix = d.outils.voix.voix();
const r = await fabriquerTableau({
  ...d.outils,
  contexte: contexteFormation(),
  sorties: ["vertical", "vertical-liens"],
  choisirFin: (appelId, s) => finEtAppelDuTableau(reseauDeLaSortie(s, {}, ["vertical", "vertical-liens"]), appelId, undefined, { mot: "CINQ" }),
  voix: {
    ...d.outils.voix,
    voix: () => ({
      ...voix,
      async lire(demande) {
        const base = await voix.lire(demande);
        const mots = demande.texte.endsWith("Je vous l'envoie.") && demande.texte.length < 80 ? appel : corps;
        return { ...base, mots, dureeSec: +(mots.at(-1)!.finSec + 0.5).toFixed(3) };
      },
    }),
  },
});
console.log(r.sorties.map((s) => `${s.format} : ${s.dureeSec} s, scènes rendues ${s.scenes.rendues.join(",")}`).join("\n"));

const scenes = d.scenesSoumises().map((x) => (x.parametres as { proprietes: ProprietesTableauScene }).proprietes);
const derniere = fiche.scenes.at(-1)!.id;
const [ig, tk] = scenes.filter((p) => p.scene.id === derniere);

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/opt/pw-browsers/chromium"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });

for (const [nom, p] of [["reels", ig], ["tiktok", tk]] as const) {
  const v2 = p.v2!;
  // Instants : pendant l'écran d'appel, à la fin de la voix, et en fin de tenue (avant le fondu).
  const debutAppel = Object.values(v2.temps).at(-1)!.debutMs;
  const instants = [debutAppel + 600, v2.finVoixMs - 300, v2.finVoixMs + 1500, v2.finVideoMs - 450];
  for (const ms of instants) {
    const frame = Math.max(0, Math.min(Math.round(((ms - p.scene.debutMs) / 1000) * p.fps), Math.round(((p.scene.finMs - p.scene.debutMs) / 1000) * p.fps) - 1));
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const png = join(sortie, `${nom}-${(ms / 1000).toFixed(1)}s.png`);
    await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
    const jpg = png.replace(/\.png$/, ".jpg");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=360:-2:flags=lanczos", "-q:v", "4", jpg]);
    console.log(`${nom} ${(ms / 1000).toFixed(1)} s → ${jpg}`);
  }
}
