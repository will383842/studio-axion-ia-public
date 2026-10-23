/**
 * APERÇUS DE LA FIN DE TIKTOK ET SHORTS, UNE SEULE DEMANDE (14/10) : rendu RÉEL (Remotion, Chromium sans affichage) de
 * la DERNIÈRE scène du vertical « liens », fabriquée par la chaîne avec des doubles (voix simulée, aucun appel payant),
 * pour trois types de vidéo : méthode en étapes (témoin « réponses types ») → « enregistrez » ; question → la question ;
 * mot proposé sans étapes → « le lien est dans mon profil ». Une planche par type (4 instants de la dernière scène).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/fin-tiktok-une-demande/apercus.mts [dossier de sortie]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-fins-tiktok"));
mkdirSync(sortie, { recursive: true });

const temoin = JSON.parse(readFileSync(join(RACINE, "tests/tableau/temoins/blocage-fin-tiktok-2026-10-14.json"), "utf8")) as { fiche: FicheTableau };
const sansEtapes = (f: FicheTableau): FicheTableau => ({ ...f, scenes: f.scenes.map((s) => ({ ...s, texteDit: s.texteDit.replace(/^(Un|Deux|Trois|Quatre)\. /, "") })) });
const avecQuestion = (): FicheTableau => ({ ...sansEtapes(temoin.fiche), structure: "question-abonne" });
const cas: [string, FicheTableau][] = [
  ["etapes-enregistrer", temoin.fiche],
  ["question", avecQuestion()],
  ["mot-lien-profil", sansEtapes(temoin.fiche)],
];
const sorties = sortiesDesReseaux(["verticaux"]);

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

for (const [nom, fiche] of cas) {
  const ids = [...new Set(fiche.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  const contexte = { aujourdhui: "2026-10-14", sourcesChiffres: [], preuves: [], matieres: ids.map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" })), texteScript: fiche.scenes.map((s) => s.texteDit).join(" ") };
  const d = doubles(fiche);
  const r = await fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin: choisirFinTableau({}, { sorties, mot: "REPONSES" }), dejaVu: { coche: true, le: "2026-10-14" } });
  const liens = r.sorties.find((s) => s.format === "vertical-liens");
  console.log(`${nom} : fin ${JSON.stringify(liens?.fin)}`);
  const derniere = fiche.scenes.at(-1)!.id;
  const p = d
    .scenesSoumises()
    .map((x) => (x.parametres as { proprietes: ProprietesTableauScene }).proprietes)
    .filter((x) => x.scene.id === derniere)
    .at(-1)!;
  const v2 = p.v2!;
  const debutFin = Object.values(v2.temps).at(-1)!.debutMs;
  const images: string[] = [];
  for (const ms of [p.scene.debutMs + 400, debutFin + 600, v2.finVoixMs - 200, v2.finVideoMs - 450]) {
    const frame = Math.max(0, Math.min(Math.round(((ms - p.scene.debutMs) / 1000) * p.fps), Math.round(((p.scene.finMs - p.scene.debutMs) / 1000) * p.fps) - 1));
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const png = join(sortie, `${nom}-${(ms / 1000).toFixed(1)}s.png`);
    await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
    images.push(png);
  }
  // Planche : les 4 instants côte à côte, réduits.
  const planche = join(sortie, `planche-${nom}.jpg`);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...images.flatMap((i) => ["-i", i]), "-filter_complex", `${images.map((_, i) => `[${i}:v]scale=360:-2:flags=lanczos[v${i}]`).join(";")};${images.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${images.length}`, "-q:v", "4", planche]);
  for (const i of images) execFileSync("rm", ["-f", i]);
  console.log(`→ ${planche}`);
}
