/**
 * Outils communs des opérations : téléchargement d'une entrée (adresse R2 signée), dépôt du résultat
 * (PUT signé), exécution de FFmpeg / ffprobe avec priorité basse. Aucun état : tout passe par un dossier temporaire.
 */
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as FluxWeb } from "node:stream/web";
import { ErreurRendu } from "./contrat.js";

/**
 * Mode ESSAI explicite (poste de développement, tests) : `STUDIO_RENDU_ESSAI=1`, jamais en production. Lui seul
 * permet les adresses de ce poste (`127.0.0.1`, `localhost`) et, pour la miniature, un fichier local.
 */
export function modeEssai(env: Record<string, string | undefined> = process.env): boolean {
  return env.STUDIO_RENDU_ESSAI === "1" && env.NODE_ENV !== "production";
}

/**
 * Hôtes que `studio-rendu` accepte de lire et d'écrire (relecture sécurité R45 n° 4, sur le modèle de `HOTES_CAPTURE`) :
 * le point d'accès R2 du compte, calculé comme le studio (`R2_PUBLIC_HOST`, sinon `{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`),
 * plus `STUDIO_RENDU_HOTES` (liste séparée par des virgules, facultative). Sans aucun des deux : aucun hôte.
 */
export function hotesPermis(env: Record<string, string | undefined> = process.env): string[] {
  const hotes: string[] = [];
  const compte = env.R2_ACCOUNT_ID?.trim();
  const r2 = env.R2_PUBLIC_HOST?.trim() || (compte ? `${compte}.r2.cloudflarestorage.com` : "");
  if (r2) hotes.push(r2);
  hotes.push(...(env.STUDIO_RENDU_HOTES ?? "").split(","));
  return [...new Set(hotes.map((h) => h.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase()).filter(Boolean))];
}

const HOTES_ESSAI = ["127.0.0.1", "localhost", "[::1]"];

/**
 * Signes qu'une adresse du stockage ne contient jamais telle quelle et que les lecteurs ne lisent pas tous pareil :
 * `\` (barre pour `new URL`, pas pour FFmpeg), `@` (FFmpeg prend l'hôte après le dernier `@`), espace, contrôle.
 */
const SIGNES_AMBIGUS = /[\\@\s\u0000-\u001f\u007f]/;

/**
 * Adresse acceptée : `https:`, hôte permis, sans port ni identifiants. En mode essai seulement : aussi `http(s)` vers
 * ce poste (port permis). PUR (selon l'environnement donné).
 *
 * Relecture sécurité R45 (2e lecture, A) : l'adresse doit être déjà sous sa forme normalisée (`new URL(a).href === a`)
 * et sans signe ambigu. Ainsi FFmpeg, ffprobe et `fetch` lisent exactement la même adresse que celle vérifiée ici.
 */
export function adressePermise(adresse: string, env: Record<string, string | undefined> = process.env): boolean {
  if (SIGNES_AMBIGUS.test(adresse)) return false;
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    return false;
  }
  if (u.href !== adresse) return false;
  if (u.username || u.password) return false;
  if (modeEssai(env) && (u.protocol === "http:" || u.protocol === "https:") && HOTES_ESSAI.includes(u.hostname)) return true;
  return u.protocol === "https:" && !u.port && hotesPermis(env).includes(u.hostname.toLowerCase());
}

/** Refus clair (sans l'adresse : elle peut être signée) si l'adresse n'est pas une des nôtres ; sinon l'adresse normalisée. */
export function exigerAdressePermise(adresse: string): string {
  if (!adressePermise(adresse)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Adresse refusée : elle ne vient pas du stockage du studio." });
  return new URL(adresse).href;
}

/** Plafond de toute entrée téléchargée sans plafond plus strict (relecture sécurité R45 n° 7) : 4 Go. */
export const OCTETS_MAX_ENTREE = 4 * 1024 * 1024 * 1024;

/**
 * Télécharge une entrée vers un fichier local. Adresse expirée ou refusée : erreur `fichier-inaccessible` (nouvelle
 * adresse, même clé). Seulement une adresse permise (`exigerAdressePermise`), jamais de redirection suivie.
 * `maxOctets` (lots R4-R5 ; 4 Go par défaut) : refus clair au-delà, sur la longueur annoncée ET en comptant le flux
 * (une longueur absente ou fausse ne passe pas).
 */
export async function telecharger(url: string, chemin: string, signal?: AbortSignal, maxOctets: number = OCTETS_MAX_ENTREE): Promise<void> {
  const r = await fetch(exigerAdressePermise(url), { signal, redirect: "error" });
  if (r.status === 403 || r.status === 404) throw new ErreurRendu({ code: "fichier-inaccessible", reessayable: true, message: `Entrée inaccessible (${r.status}).` });
  if (!r.ok || !r.body) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `Lecture de l'entrée impossible (${r.status}).` });
  const trop = () => new ErreurRendu({ code: "refuse", reessayable: false, message: `Entrée trop volumineuse (plus de ${Math.round(maxOctets / 1024 / 1024)} Mo).` });
  if (Number(r.headers.get("content-length") ?? 0) > maxOctets) {
    await r.body.cancel().catch(() => undefined);
    throw trop();
  }
  let recus = 0;
  const compteur = new Transform({
    transform(morceau: Buffer, _e, suite) {
      recus += morceau.length;
      if (recus > maxOctets) return suite(trop());
      suite(null, morceau);
    },
  });
  await pipeline(Readable.fromWeb(r.body as unknown as FluxWeb<Uint8Array>), compteur, createWriteStream(chemin));
}

/** Dépose un fichier local à l'adresse signée de sortie (PUT), seulement vers une adresse permise. */
export async function deposer(urlDepot: string, chemin: string, mime: string, signal?: AbortSignal): Promise<void> {
  if (!urlDepot) return; // essai local sans stockage
  const adresse = exigerAdressePermise(urlDepot);
  const { size } = await stat(chemin);
  const r = await fetch(adresse, {
    method: "PUT",
    headers: { "content-type": mime, "content-length": String(size) },
    body: Readable.toWeb(createReadStream(chemin)) as unknown as BodyInit,
    signal,
    redirect: "error",
    // @ts-expect-error -- Node : corps en flux, obligatoire pour fetch avec un ReadableStream.
    duplex: "half",
  });
  if (!r.ok) throw new ErreurRendu({ code: r.status === 403 ? "fichier-inaccessible" : "indisponible", reessayable: true, message: `Dépôt du résultat refusé (${r.status}).` });
}

/**
 * Formats permis d'une entrée TÉLÉCHARGÉE (relecture sécurité R45 n° 6), reconnus à leurs premiers octets : jamais une
 * liste de lecture (HLS, concat…) ni un format qui va chercher d'autres fichiers. Le nom est celui du démultiplexeur
 * FFmpeg, imposé par `-f` avant l'entrée.
 */
export type FormatEntree = "png_pipe" | "jpeg_pipe" | "webp_pipe" | "mov" | "wav" | "flac" | "ogg" | "mp3";
export const FORMATS_IMAGE: readonly FormatEntree[] = ["png_pipe", "jpeg_pipe", "webp_pipe"];
export const FORMATS_VIDEO: readonly FormatEntree[] = ["mov"];
export const FORMATS_AUDIO: readonly FormatEntree[] = ["wav", "flac", "ogg", "mp3", "mov"];

/** Format reconnu à partir des 16 premiers octets, ou null. PUR. */
export function formatReconnu(o: Uint8Array): FormatEntree | null {
  const texte = (debut: number, fin: number) => String.fromCharCode(...o.subarray(debut, fin));
  if (o.length >= 8 && o[0] === 0x89 && texte(1, 4) === "PNG") return "png_pipe";
  if (o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "jpeg_pipe";
  if (o.length >= 12 && texte(0, 4) === "RIFF" && texte(8, 12) === "WEBP") return "webp_pipe";
  if (o.length >= 12 && (texte(0, 4) === "RIFF" || texte(0, 4) === "RF64") && texte(8, 12) === "WAVE") return "wav";
  if (o.length >= 4 && texte(0, 4) === "fLaC") return "flac";
  if (o.length >= 4 && texte(0, 4) === "OggS") return "ogg";
  if (o.length >= 3 && texte(0, 3) === "ID3") return "mp3";
  if (o.length >= 2 && o[0] === 0xff && (o[1] & 0xe6) === 0xe2) return "mp3"; // trame MPEG couche III
  if (o.length >= 8 && ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(texte(4, 8))) return "mov";
  return null;
}

/** Format d'un fichier téléchargé, s'il est parmi ceux permis ; sinon refus clair. */
export async function formatFichier(chemin: string, permis: readonly FormatEntree[]): Promise<FormatEntree> {
  const f = await open(chemin, "r");
  try {
    const entete = new Uint8Array(16);
    const { bytesRead } = await f.read(entete, 0, 16, 0);
    const format = formatReconnu(entete.subarray(0, bytesRead));
    if (!format || !permis.includes(format)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Fichier d'un type non permis." });
    return format;
  } finally {
    await f.close();
  }
}

/** Options à placer AVANT le `-i` d'une entrée téléchargée : fichier local seulement, format imposé. PUR. */
export function lectureLocale(format: FormatEntree): string[] {
  return ["-protocol_whitelist", "file", "-f", format];
}

/** Lance une commande (FFmpeg, ffprobe) et renvoie sa sortie standard. */
export function executer(commande: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((ok, ko) => {
    const p = spawn(commande, args, { signal, windowsHide: true });
    let sortie = "";
    let erreurs = "";
    p.stdout.on("data", (d: Buffer) => (sortie += d.toString()));
    p.stderr.on("data", (d: Buffer) => (erreurs = (erreurs + d.toString()).slice(-4000)));
    p.on("error", (e) => ko(new ErreurRendu({ code: "inconnu", reessayable: true, message: `${commande} : ${e.message}` })));
    p.on("close", (code) => (code === 0 ? ok(sortie) : ko(new ErreurRendu({ code: "inconnu", reessayable: true, message: `${commande} a échoué (${code}) : ${erreurs.split("\n").filter(Boolean).pop() ?? ""}` }))));
  });
}

/**
 * Comme `executer`, mais renvoie aussi la sortie d'erreur ENTIÈRE (bornée à 4 Mo) : FFmpeg y écrit ses mesures
 * (`ebur128`, `loudnorm`, `blackdetect`). Lot M4.
 */
export function executerAvecErreurs(commande: string, args: string[], signal?: AbortSignal, cwd?: string): Promise<{ sortie: string; erreurs: string }> {
  return new Promise((ok, ko) => {
    const p = spawn(commande, args, { signal, windowsHide: true, cwd });
    let sortie = "";
    let erreurs = "";
    p.stdout.on("data", (d: Buffer) => (sortie = (sortie + d.toString()).slice(-4_000_000)));
    p.stderr.on("data", (d: Buffer) => (erreurs = (erreurs + d.toString()).slice(-4_000_000)));
    p.on("error", (e) => ko(new ErreurRendu({ code: "inconnu", reessayable: true, message: `${commande} : ${e.message}` })));
    p.on("close", (code) => (code === 0 ? ok({ sortie, erreurs }) : ko(new ErreurRendu({ code: "inconnu", reessayable: true, message: `${commande} a échoué (${code}) : ${erreurs.split(/\r?\n/).filter(Boolean).pop() ?? ""}` }))));
  });
}

/** Retire toute adresse d'un message (une adresse signée ne doit jamais ressortir dans une erreur). PUR. */
export function sansAdresses(message: string): string {
  return message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[adresse]");
}

/**
 * Durée d'un média (ffprobe). `avantEntree` : options placées avant l'entrée (protocoles permis, format). Erreur
 * claire, sans l'adresse lue.
 */
export async function dureeMedia(entree: string, signal?: AbortSignal, avantEntree: string[] = []): Promise<number> {
  let json: string;
  try {
    json = await executer(FFPROBE, ["-v", "error", ...avantEntree, "-show_entries", "format=duration", "-of", "json", entree], signal);
  } catch (e) {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: sansAdresses(`Média illisible : ${e instanceof Error ? e.message : "erreur"}`) });
  }
  const d = Number((JSON.parse(json) as { format?: { duration?: string } }).format?.duration);
  if (!Number.isFinite(d) || d <= 0) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Média illisible (durée inconnue)." });
  return d;
}

export const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
export const FFPROBE = process.env.FFPROBE ?? "ffprobe";
