/**
 * T-EXT-54b : lanceur COMMUN de mesure d'une vidéo finie (cloud ou CI seulement, jamais le PC), sans IA, 0 €.
 *
 *   pnpm exec tsx outils/mesures/mesurer-video-finie.mts --video <fichier.mp4> [--fin-utile-ms N] [--source <fichier> --zones <zones.json>] --sortie <dossier hors dépôt>
 *
 * Codes : 0 ok · 3 environnement interdit · 4 entrée refusée · 5 FFmpeg absent ou en échec.
 * Toujours : images noires et figées sur tout le fichier. Avec --source et --zones : netteté de chaque zone, puis note.
 * Fichiers locaux seulement (aucune adresse réseau). Écrit `mesures-video.json` sous --sortie, jamais dans le dépôt.
 * Jamais appelé par le Studio. Les formules viennent toutes de `src/briques/controle-image/mesures-video.ts`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import {
  argumentsDetections,
  argumentsSsim,
  lireDetections,
  lireSsim,
  mesuresPourControle,
  noterZones,
  type MesureZone,
  type ZoneMesure,
} from "../../src/briques/controle-image/mesures-video";
import { environnementAutorise } from "../maquettes-tableaux-de-bord/capture/garde";

const RACINE_DEPOT = fileURLToPath(new URL("../../", import.meta.url));

export class Arret extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Options {
  video: string;
  finUtileMs?: number;
  source?: string;
  zones?: string;
  sortie: string;
}

/** Lit les arguments `--cle valeur` ; refuse tout argument inconnu, manquant ou une sortie dans le dépôt. */
export function lireOptions(argv: string[], racineDepot: string = RACINE_DEPOT): Options {
  const brut: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i];
    const valeur = argv[i + 1];
    if (!cle?.startsWith("--") || valeur === undefined) throw new Arret(4, `Argument invalide près de « ${cle ?? ""} ».`);
    brut[cle.slice(2)] = valeur;
  }
  for (const cle of Object.keys(brut)) {
    if (!["video", "fin-utile-ms", "source", "zones", "sortie"].includes(cle)) throw new Arret(4, `Argument inconnu : --${cle}.`);
  }
  if (!brut.video) throw new Arret(4, "Il manque --video.");
  if (!brut.sortie) throw new Arret(4, "Il manque --sortie.");
  if (Boolean(brut.source) !== Boolean(brut.zones)) throw new Arret(4, "--source et --zones vont ensemble.");
  for (const f of [brut.video, brut.source, brut.zones]) {
    if (f && /^[a-z][a-z0-9+.-]*:\/\//i.test(f.trim())) throw new Arret(4, "Fichiers locaux seulement : aucune adresse réseau.");
  }
  const rel = relative(resolve(racineDepot), resolve(brut.sortie));
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Arret(4, "La sortie doit être hors du dépôt.");
  let finUtileMs: number | undefined;
  if (brut["fin-utile-ms"] !== undefined) {
    finUtileMs = Number(brut["fin-utile-ms"]);
    if (!Number.isFinite(finUtileMs) || finUtileMs < 0) throw new Arret(4, "--fin-utile-ms doit être un nombre positif.");
  }
  return { video: brut.video, finUtileMs, source: brut.source, zones: brut.zones, sortie: brut.sortie };
}

/** Durée lue dans « Duration: 00:00:42.50 » (millisecondes) ; `undefined` si absente. */
export function dureeMs(stderr: string): number | undefined {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) return undefined;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

function lancerFfmpeg(args: string[]): { ok: boolean; stderr: string } {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.error) return { ok: false, stderr: "" };
  return { ok: true, stderr: r.stderr ?? "" };
}

function lireZones(chemin: string): ZoneMesure[] {
  try {
    const j = JSON.parse(readFileSync(chemin, "utf8")) as unknown;
    const liste = Array.isArray(j) ? j : (j as { zones?: unknown })?.zones;
    if (!Array.isArray(liste)) throw new Error("forme");
    return liste as ZoneMesure[];
  } catch {
    throw new Arret(4, `Fichier de zones illisible : ${chemin}`);
  }
}

function phrases(mesures: Record<string, number>, zones: MesureZone[]): string[] {
  const l: string[] = [];
  if (mesures.imagesFigeesHorsFin === undefined) l.push("Images figées : non mesuré (sortie de FFmpeg illisible).");
  else l.push(mesures.imagesFigeesHorsFin === 0 ? "Aucune image figée trop longtemps." : `${mesures.imagesFigeesHorsFin} passage(s) figé(s) trop longtemps.`);
  if (mesures.imageNoireTete === undefined) l.push("Images noires : non mesuré.");
  else {
    l.push(mesures.imageNoireTete === 0 ? "Pas d'image noire au début." : "La vidéo commence par une image noire.");
    l.push(mesures.imagesNoiresHorsFin === 0 ? "Aucune image noire en cours de route." : `${mesures.imagesNoiresHorsFin ?? 0} passage(s) noir(s) en cours de route.`);
  }
  for (const z of zones) l.push(z.verdict === "ok" ? `Zone « ${z.id} » : nette.` : z.raisons.join(" "));
  return l;
}

/** Le lanceur. La garde d'environnement passe AVANT tout lancement de FFmpeg. */
export function principal(argv: string[], env: Record<string, string | undefined>, plateforme: string): number {
  try {
    const garde = environnementAutorise(env, plateforme);
    if (!garde.ok) throw new Arret(3, garde.raison);
    const o = lireOptions(argv);
    if (!existsSync(o.video)) throw new Arret(4, `Vidéo introuvable : ${o.video}`);
    if (o.source && !existsSync(o.source)) throw new Arret(4, `Source introuvable : ${o.source}`);
    const zonesBrutes = o.zones ? lireZones(o.zones) : [];

    const sonde = lancerFfmpeg(["-version"]);
    if (!sonde.ok) throw new Arret(5, "FFmpeg est nécessaire pour la mesure.");

    const argsDet = argumentsDetections(o.video);
    if (!argsDet) throw new Arret(4, "Vidéo refusée.");
    const det = lancerFfmpeg(argsDet);
    if (!det.ok) throw new Arret(5, "FFmpeg est nécessaire pour la mesure.");
    const finUtileMs = o.finUtileMs ?? dureeMs(det.stderr) ?? Number.POSITIVE_INFINITY;
    const detections = lireDetections(det.stderr, { finUtileMs: Number.isFinite(finUtileMs) ? finUtileMs : Number.MAX_SAFE_INTEGER });
    const mesures = mesuresPourControle(detections) as Record<string, number>;

    let zones: MesureZone[] = [];
    if (o.source && o.zones) {
      const ssims: Record<string, number | null> = {};
      for (const z of zonesBrutes) {
        const a = argumentsSsim({ source: o.source, video: o.video, zone: z });
        const r = a ? lancerFfmpeg(a) : { ok: false, stderr: "" };
        ssims[z.id] = r.ok ? lireSsim(r.stderr) : null;
      }
      zones = noterZones(zonesBrutes, ssims);
    }

    mkdirSync(o.sortie, { recursive: true });
    writeFileSync(join(o.sortie, "mesures-video.json"), JSON.stringify({ mesures, zones }, null, 2) + "\n");
    for (const ligne of phrases(mesures, zones)) console.log(ligne);
    return 0;
  } catch (e) {
    if (e instanceof Arret) {
      console.error(e.message);
      return e.code;
    }
    console.error("Mesure interrompue.");
    return 5;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2), process.env, process.platform);
}
