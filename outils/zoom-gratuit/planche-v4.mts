/**
 * C8-Z10a : planche avant/après du zoom gratuit de la v4.
 * Lancé À LA MAIN : `pnpm exec tsx outils/zoom-gratuit/planche-v4.mts <dossier> [--prise <fichier.mp4>] [--plan <plan.json>]`.
 * Jamais importé par `src/` ni `studio-rendu/`. 0 € : FFmpeg local. Aucun son.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zoomsPriseV4 } from "../../src/moteurs/montage-facecam-animee/zoom-gratuit-v4";
import { filtreZoomPrise } from "../../studio-rendu/src/composition/zoom-prise";

export type FenetreV4 = { debutSec: number; finSec: number; facteur: number };
export type PlanV4 = { elementsV4?: readonly { debut: number; fin: number }[] };
export type EntreePlancheV4 = { plan: PlanV4; gardes: readonly { debutSec: number; finSec: number }[]; dureeSec: number; largeur: number; hauteur: number };
export type CasePlancheV4 = { colonne: "avant" | "apres" | "temoin"; instant: "debut" | "milieu" | "fin" | "plaquette"; t: number; fenetre: number | null };

const virgule = (n: number, d = 3): string => n.toFixed(d).replace(".", ",");
const figer = <T,>(o: T): T => {
  if (o && typeof o === "object") for (const v of Object.values(o)) figer(v);
  return Object.freeze(o);
};

/** Prise montée d'exemple : 40 s, 1080 × 1920, 9 gardes (raccords à 4 ; 9 ; 12,5 ; 18,5 ; 22,5 ; 27,5 ; 30,5 ; 35,5 s), 2 plaquettes. Figée, sans hasard. */
export function planExempleV4(): EntreePlancheV4 {
  const durees = [4, 5, 3.5, 6, 4, 5, 3, 5, 4.5];
  let t = 0;
  const gardes = durees.map((d) => { const g = { debutSec: t, finSec: t + d }; t += d; return g; });
  return figer({ plan: { elementsV4: [{ debut: 6, fin: 9 }, { debut: 21, fin: 25 }] }, gardes, dureeSec: 40, largeur: 1080, hauteur: 1920 });
}

export function fenetresPlancheV4(e: EntreePlancheV4): FenetreV4[] {
  return zoomsPriseV4({ actif: true, plan: e.plan, gardes: e.gardes, dureeSec: e.dureeSec, largeur: e.largeur, hauteur: e.hauteur })?.fenetres ?? [];
}

/** 3 instants × 2 colonnes par fenêtre, plus 1 témoin au milieu de la première plaquette (identique avant/après). Triées par instant. */
export function casesPlancheV4(fenetres: readonly FenetreV4[], plan: PlanV4 = {}): CasePlancheV4[] {
  const cases: CasePlancheV4[] = [];
  fenetres.forEach((f, i) => {
    const instants: [CasePlancheV4["instant"], number][] = [["debut", f.debutSec + 0.05], ["milieu", (f.debutSec + f.finSec) / 2], ["fin", f.finSec - 0.05]];
    for (const [instant, t] of instants) for (const colonne of ["avant", "apres"] as const) cases.push({ colonne, instant, t, fenetre: i });
  });
  const p = plan.elementsV4?.[0];
  if (p) cases.push({ colonne: "temoin", instant: "plaquette", t: (p.debut + p.fin) / 2, fenetre: null });
  return cases.map((c, i) => ({ c, i })).sort((a, b) => a.c.t - b.c.t || a.i - b.i).map((x) => x.c);
}

/** Plus grand nombre de zooms commencés dans une fenêtre glissante de 60 s (même calcul que `regles.ts` : `debutSec > début − 60`). */
export function maxParMinuteV4(fenetres: readonly FenetreV4[]): number {
  return Math.max(0, ...fenetres.map((m) => fenetres.filter((g) => g.debutSec <= m.debutSec && g.debutSec > m.debutSec - 60).length));
}

export function rapportPlancheV4(fenetres: readonly FenetreV4[], plan: PlanV4, dureeSec = 40): string[] {
  const lignes = fenetres.map((f, i) => {
    const ecarts = (plan.elementsV4 ?? []).map((p) => Math.max(0, p.debut - f.finSec, f.debutSec - p.fin));
    const proche = ecarts.length ? `plaquette la plus proche à ${virgule(Math.min(...ecarts), 1)} s` : "aucune plaquette";
    return `zoom ${i + 1} : ${virgule(f.debutSec)} → ${virgule(f.finSec)} s, ×${String(f.facteur).replace(".", ",")} ; ${proche}`;
  });
  const pic = maxParMinuteV4(fenetres);
  lignes.push(`${fenetres.length} zoom(s) en ${virgule(dureeSec, 0)} s ; au plus ${pic} dans une même minute (maximum 4)${pic > 4 ? " — ATTENTION : dépassement, la règle des 4 par minute n'est pas respectée" : ""}`);
  return lignes;
}

/** Arguments FFmpeg pour UNE image à l'instant t (`-ss` côté sortie : le temps `t` du filtre reste juste). */
export function argumentsFfmpegPlancheV4(e: { t: number; fenetres: readonly FenetreV4[]; avec: boolean; largeur: number; hauteur: number; prise?: string; sortie: string }): string[] {
  const source = e.prise ? ["-i", e.prise] : ["-f", "lavfi", "-i", `testsrc2=size=${e.largeur}x${e.hauteur}:rate=30`];
  const filtre = e.avec ? filtreZoomPrise([...e.fenetres], e.largeur, e.hauteur) : "";
  return ["-y", "-v", "error", ...source, ...(filtre ? ["-vf", filtre] : []), "-ss", String(e.t), "-frames:v", "1", e.sortie];
}

function ffmpeg(args: string[]): number {
  const t0 = performance.now();
  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg a échoué (${args.slice(0, 6).join(" ")} …)`);
  return (performance.now() - t0) / 1000;
}

function main(): void {
  const args = process.argv.slice(2);
  const valeur = (nom: string) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
  const prise = valeur("--prise");
  const fichierPlan = valeur("--plan");
  const sortie = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--prise" && args[i - 1] !== "--plan");
  if (!sortie) { console.error("Usage : pnpm exec tsx outils/zoom-gratuit/planche-v4.mts <dossier> [--prise <fichier.mp4>] [--plan <plan.json>]"); process.exit(1); }
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    console.error("Outil manquant : ffmpeg. Rien n'est téléchargé ni installé ; installer à la main puis relancer.");
    process.exit(1);
  }
  const entree: EntreePlancheV4 = fichierPlan ? (JSON.parse(readFileSync(fichierPlan, "utf8")) as EntreePlancheV4) : planExempleV4();
  const dossier = resolve(sortie);
  mkdirSync(dossier, { recursive: true });
  const fenetres = fenetresPlancheV4(entree);
  const cases = casesPlancheV4(fenetres, entree.plan);
  const noms: string[] = [];
  cases.forEach((c, i) => {
    const nom = join(dossier, `case-${String(i).padStart(2, "0")}-${c.colonne}-${c.instant}.png`);
    ffmpeg(argumentsFfmpegPlancheV4({ t: c.t, fenetres, avec: c.colonne !== "avant", largeur: entree.largeur, hauteur: entree.hauteur, prise, sortie: nom }));
    noms.push(nom);
  });
  // Planche assemblée : 2 colonnes (avant | après), le témoin à la fin.
  const rangees = cases.map((c, i) => ({ c, nom: noms[i] }));
  const ordre = [...rangees.filter((r) => r.c.colonne !== "temoin"), ...rangees.filter((r) => r.c.colonne === "temoin")];
  if (ordre.length) {
    const liste = join(dossier, "ordre.txt");
    writeFileSync(liste, ordre.map((r) => `file '${r.nom}'\nduration 1`).join("\n") + "\n");
    ffmpeg(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", liste, "-vf", `scale=270:-1,tile=2x${Math.ceil(ordre.length / 2)}`, "-frames:v", "1", join(dossier, "planche.png")]);
  }
  const mire = ["-y", "-v", "error", "-f", "lavfi", "-i", `testsrc2=size=${entree.largeur}x${entree.hauteur}:rate=30`, "-t", "10"];
  const sans = ffmpeg([...mire, "-c:v", "libx264", "-preset", "veryfast", "-f", "null", "-"]);
  const avec = ffmpeg([...mire, "-vf", filtreZoomPrise(fenetres, entree.largeur, entree.hauteur), "-c:v", "libx264", "-preset", "veryfast", "-f", "null", "-"]);
  const txt = [...rapportPlancheV4(fenetres, entree.plan, entree.dureeSec), `temps de rendu de 10 s de mire : sans zoom ${virgule(sans, 1)} s, avec zoom ${virgule(avec, 1)} s`];
  writeFileSync(join(dossier, "planche.txt"), txt.join("\n") + "\n");
  console.log(txt.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
