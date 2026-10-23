/**
 * RÉPÉTITION GÉNÉRALE de la variété « Image → vidéo » (lot F, doc 80 § 5) : 3 vidéos de bout en bout, SANS APPEL PAYANT.
 *
 *  - cartes C, D, E des fixtures ; graines « repetition-c », « -d », « -e » tirées à la suite avec historique (la 2ᵉ voit
 *    la 1ʳᵉ, la 3ᵉ les deux) ; fiche simulée écrite selon le récit tiré ;
 *  - voix : `public/demo/essai-voix.mp3` bouclée à la durée de la version par FFmpeg local, mots par `pisteSimulee` ;
 *    bruitages : `public/bruitages/*.wav` ;
 *  - rendu : le VRAI serveur `studio-rendu` lancé ici (`STUDIO_RENDU_ESSAI=1`) avec un faux seau HTTP (comme
 *    `studio-rendu/scripts/essai-local.ts`), puis le vrai service `rendreVersionIV` : scènes par bloc, montage `complet`.
 *
 * Étapes (une commande chacune, < 10 min ; tout est repris d'un passage à l'autre, rien n'est rendu deux fois) :
 *   studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts tirage
 *   … rendu --video 1 --version tiktok        (ou linkedin : version 4:5, allumée ICI seulement)
 *   … mesures                                  (FFprobe, images extraites, occupation, planche des tirages)
 * Sorties : `docs/formats/image-video/variete/integration/repetition/` (MP4 NON commités : voir `.gitignore`), le seau et
 * les voix dans `--travail` (défaut : un dossier temporaire du poste).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { AXES_VARIETE, type FormatIV, type RecetteVarieteIV } from "../../../src/briques/schema-motion/variete";
import type { CarteImage } from "../../../src/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "../../../src/domaine/image-video/plafonds";
import { creerServiceRenduHttp } from "../../../src/fournisseurs/rendu/client";
import { planMixageIV, type PisteVoixSeuleIV } from "../../../src/moteurs/montage-image-video/assemblage";
import { pisteSimulee } from "../../../src/moteurs/montage-image-video/calage";
import { argumentsNoirEtFige, figeHorsVoixMaxSec, lireNoirEtFige, lirePassagesFiges, passagesFigesRefusesIV } from "../../../src/moteurs/montage-image-video/commandes-ffmpeg";
import { FICHES_SIMULEES, ficheSimuleeRecit } from "../../../src/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV, FORMATS_PAR_RESEAU_IV, reseauxParFormatIV } from "../../../src/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "../../../src/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "../../../src/moteurs/montage-image-video/mise-en-scene";
import { ressemblanceRecette } from "../../../src/moteurs/montage-image-video/variete/ressemblance";
import { recettePourVersion, tirerVarieteIV } from "../../../src/moteurs/montage-image-video/variete/tirage";
import { parolesDeLaLigneIV, rendreVersionIV, type OutilsRenduIV } from "../../../src/services/image-video-rendu";

const RACINE = resolve(import.meta.dirname, "../../..");
const argument = (nom: string) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const etape = process.argv[2];
const SORTIE = resolve(argument("sortie") ?? join(RACINE, "docs/formats/image-video/variete/integration/repetition"));
const TRAVAIL = resolve(argument("travail") ?? join(tmpdir(), "repetition-generale-iv"));
const SEAU = join(TRAVAIL, "seau");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(SEAU, { recursive: true });

/* ------------------------------------------------------------------ */
/* Les 3 vidéos                                                          */
/* ------------------------------------------------------------------ */

const VIDEOS = [
  { n: 1, nom: "C", videoId: "repetition-c" },
  { n: 2, nom: "D", videoId: "repetition-d" },
  { n: 3, nom: "E", videoId: "repetition-e" },
] as const;
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(RACINE, `tests/image-video/fixtures/cartes/${nom}.json`), "utf8"));

/** Les trois recettes, tirées à la suite : la 2ᵉ voit la 1ʳᵉ, la 3ᵉ les deux (la plus récente d'abord). */
function tirages(): { n: number; nom: string; videoId: string; recette: RecetteVarieteIV }[] {
  const historique: RecetteVarieteIV[] = [];
  return VIDEOS.map((v) => {
    const recette = tirerVarieteIV({ graine: v.videoId, carte: carteDe(v.nom), format: "9:16", historique });
    historique.unshift(recette);
    return { ...v, recette };
  });
}

/** Une version de la vidéo : TikTok (9:16, son groupe de fins) ou LinkedIn (4:5, allumé pour la répétition). */
function versionDe(n: number, quelle: "tiktok" | "linkedin") {
  const t = tirages().find((x) => x.n === n)!;
  const carte = carteDe(t.nom);
  const fiche = ficheSimuleeRecit(carte.image.empreinte, t.recette.recit) ?? FICHES_SIMULEES[carte.image.empreinte];
  const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit });
  const fin = plan.fins.find((f) => f.reseaux.includes(quelle))!;
  const format: FormatIV = quelle === "linkedin" ? "4:5" : "9:16";
  const reseaux = reseauxParFormatIV(fin.reseaux, { formats: FORMATS_PAR_RESEAU_IV }).find((x) => x.format === format)!.reseaux as ReseauIV[];
  const voix = pisteSimulee(fiche, fin.muet ? null : fin);
  const recette = recettePourVersion(t.recette, reseaux, format);
  const r = mettreEnSceneIV({ carte, fiche, voix, fin, reseaux, bruitagesValides: BRUITAGES_V4_IV, variete: recette, format, graine: t.videoId });
  const version = format === "9:16" ? fin.id : `${fin.id}-4x5`;
  return { ...t, carte, fiche, fin, format, reseaux, voix, recette, resultat: r, version, nomFichier: `video-${n}-${quelle}` };
}

const ligneRecette = (r: RecetteVarieteIV) => AXES_VARIETE.map((a) => r[a]).join(" · ");

/* ------------------------------------------------------------------ */
/* Tirage                                                                */
/* ------------------------------------------------------------------ */

if (etape === "tirage") {
  const t = tirages();
  for (const x of t) console.log(`Vidéo ${x.n} (carte ${x.nom}, graine ${x.videoId}) : ${ligneRecette(x.recette)}`);
  const paires = [
    [0, 1],
    [0, 2],
    [1, 2],
  ].map(([a, b]) => ({ paire: `${a + 1}-${b + 1}`, ressemblance: Math.round(ressemblanceRecette(t[a].recette, t[b].recette) * 1000) / 10 }));
  for (const p of paires) console.log(`Ressemblance ${p.paire} : ${p.ressemblance} %`);
  const versions = t.flatMap((x) => (["tiktok", "linkedin"] as const).map((q) => versionDe(x.n, q)));
  for (const v of versions) console.log(`  ${v.nomFichier} : ${v.resultat.ok ? "mise en scène OK" : `REFUSÉE : ${v.resultat.phrases.join(" | ")}`} · ${v.resultat.ligne.dureeSec} s · ${v.resultat.ligne.blocs.length} blocs · ouverture ${v.recette.ouverture} · replis ${v.resultat.ligne.variete?.replis.map((r) => `${r.code} (${r.raison})`).join(", ") || "aucun"}`);
  writeFileSync(
    join(SORTIE, "recettes.json"),
    `${JSON.stringify(
      {
        videos: t.map((x) => ({ n: x.n, carte: x.nom, graine: x.videoId, recette: x.recette })),
        ressemblances: paires,
        versions: versions.map((v) => ({ fichier: v.nomFichier, version: v.version, format: v.format, reseaux: v.reseaux, recette: v.recette, dureeSec: v.resultat.ligne.dureeSec, ok: v.resultat.ok, phrases: v.resultat.phrases, replis: v.resultat.ligne.variete?.replis ?? [] })),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Rendu : vrai serveur studio-rendu + faux seau                        */
/* ------------------------------------------------------------------ */

/** Navigateur de Remotion pour le serveur : la coquille sans tête du poste (aucun téléchargement). */
function preparerNavigateur(): void {
  // Version attendue par Remotion (fichier lu directement : le paquet n'exporte pas ce chemin).
  const source = readFileSync(join(RACINE, "studio-rendu/node_modules/@remotion/renderer/dist/browser/get-chrome-download-url.js"), "utf8");
  const TESTED_VERSION = /TESTED_VERSION = '([^']+)'/.exec(source)?.[1] ?? "";
  const dossier = join(RACINE, "studio-rendu/node_modules/.remotion/chrome-headless-shell");
  const exe = join(dossier, "linux64/chrome-headless-shell-linux64/chrome-headless-shell");
  if (!existsSync(exe)) {
    mkdirSync(dirname(exe), { recursive: true });
    symlinkSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", exe);
  }
  writeFileSync(join(dossier, "VERSION"), TESTED_VERSION);
}

/** Faux seau : GET /lire/<clé> (seau, sinon `public/` pour les bruitages), PUT /depot/<clé> (écrit dans le seau). */
async function ouvrirSeau(): Promise<{ base: string; fermer: () => void }> {
  const seau = createServer((req, res) => {
    const url = decodeURIComponent(req.url ?? "");
    if (req.method === "GET" && url.startsWith("/lire/")) {
      const cle = url.slice(6);
      const chemin = [join(SEAU, cle), join(RACINE, "public", cle)].find((c) => existsSync(c) && statSync(c).isFile());
      if (!chemin) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-length": statSync(chemin).size });
      createReadStream(chemin).pipe(res);
      return;
    }
    if (req.method === "PUT" && url.startsWith("/depot/")) {
      const chemin = join(SEAU, url.slice(7));
      mkdirSync(dirname(chemin), { recursive: true });
      const f = createWriteStream(chemin);
      req.pipe(f);
      f.on("finish", () => {
        res.writeHead(200, { etag: '"essai"' });
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((ok) => seau.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(seau.address() as AddressInfo).port}`, fermer: () => seau.close() };
}

/** Le vrai serveur `studio-rendu` (processus à part, mode essai) ; rend son adresse quand il répond. */
async function lancerServeur(): Promise<{ base: string; processus: ChildProcess }> {
  const port = 4300 + (process.pid % 500);
  const processus = spawn(join(RACINE, "studio-rendu/node_modules/.bin/tsx"), ["src/index.ts"], {
    cwd: join(RACINE, "studio-rendu"),
    env: { ...process.env, PORT: String(port), STUDIO_RENDU_ESSAI: "1", NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const journal = createWriteStream(join(TRAVAIL, "serveur.log"), { flags: "a" });
  processus.stdout?.pipe(journal);
  processus.stderr?.pipe(journal);
  processus.on("exit", (code, signal) => journal.write(`[répétition] studio-rendu arrêté (code ${code}, signal ${signal})\n`));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/rendus/jamais-vu`);
      if (r.status === 404) return { base, processus };
    } catch {
      // pas encore prêt
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  processus.kill();
  throw new Error("studio-rendu ne démarre pas (voir serveur.log).");
}

/** Voix de la version : l'essai de voix bouclé à la durée de la piste simulée (WAV 48 kHz mono). */
function voixDe(cle: string, dureeSec: number): string {
  const chemin = join(SEAU, cle);
  if (!existsSync(chemin)) {
    mkdirSync(dirname(chemin), { recursive: true });
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-stream_loop", "-1", "-i", join(RACINE, "public/demo/essai-voix.mp3"), "-t", String(dureeSec), "-ar", "48000", "-ac", "1", chemin]);
    if (r.status !== 0) throw new Error(`Voix impossible : ${String(r.stderr)}`);
  }
  return createHash("sha256").update(readFileSync(chemin)).digest("hex").slice(0, 32);
}

if (etape === "rendu") {
  const n = Number(argument("video"));
  const quelle = (argument("version") ?? "tiktok") as "tiktok" | "linkedin";
  const budgetSec = Number(argument("budget") ?? 540);
  const v = versionDe(n, quelle);
  if (!v.resultat.ok) console.warn(`Mise en scène refusée (rendu quand même, pour voir) : ${v.resultat.phrases.join(" | ")}`);
  const ligne: LigneDeTempsIV = v.resultat.ligne;
  const cleVoix = `voix/${v.videoId}-${v.version}.wav`;
  const piste: PisteVoixSeuleIV = { version: v.version, reseaux: v.reseaux, courte: false, cle: cleVoix, dureeSec: v.voix.dureeSec, empreinte: voixDe(cleVoix, v.voix.dureeSec), mots: v.voix.mots, motsCorps: v.voix.motsCorps, finVoixSec: v.voix.finVoixSec, coupesDeplacees: 0, tempo: 1 };
  const mixage = planMixageIV(piste, ligne.bruitages, ligne.dureeSec);
  const id = `rg-${createHash("sha256").update(JSON.stringify([v.version, ligne, mixage.id])).digest("hex").slice(0, 24)}`;
  preparerNavigateur();
  const seau = await ouvrirSeau();
  const serveur = await lancerServeur();
  const outils: OutilsRenduIV = {
    rendu: creerServiceRenduHttp(serveur.base),
    env: "dev",
    signerLecture: async (cle) => `${seau.base}/lire/${encodeURIComponent(cle.replace(/^\/+/, ""))}`,
    signerDepot: async (cle) => `${seau.base}/depot/${encodeURIComponent(cle)}`,
    existe: async (cle) => existsSync(join(SEAU, cle)),
    sons: BRUITAGES_V4_IV.map((s) => ({ elementId: s.elementId, cle: s.cle, mime: s.mime, dureeSec: s.dureeSec })),
  };
  const debut = Date.now();
  let fini: Awaited<ReturnType<typeof rendreVersionIV>> | null = null;
  let derniere = "";
  try {
    while (!fini && (Date.now() - debut) / 1000 < budgetSec) {
      try {
        fini = await rendreVersionIV({ id, videoId: v.videoId, version: v.version, reseaux: v.reseaux, ligne, mixage, piste, essai: 1 }, outils);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (!(e as { enCours?: boolean }).enCours) throw e;
        if (m !== derniere) console.log(`${Math.round((Date.now() - debut) / 1000)} s · ${m}`);
        derniere = m;
        await new Promise((ok) => setTimeout(ok, 2000));
      }
    }
  } finally {
    serveur.processus.kill();
    seau.fermer();
  }
  if (!fini) {
    console.log(`Pas fini en ${budgetSec} s : relancez la même commande (les scènes rendues sont gardées).`);
    process.exit(2);
  }
  copyFileSync(join(SEAU, fini.cle), join(SORTIE, `${v.nomFichier}.mp4`));
  writeFileSync(join(SORTIE, `${v.nomFichier}.json`), `${JSON.stringify({ fichier: `${v.nomFichier}.mp4`, version: v.version, format: v.format, reseaux: v.reseaux, dureeLigneSec: ligne.dureeSec, recette: v.recette, mesuresServeur: fini.mesures, renduEnSec: Math.round((Date.now() - debut) / 1000) }, null, 2)}\n`);
  console.log(`Rendu : ${v.nomFichier}.mp4 (${fini.dureeSec} s) en ${Math.round((Date.now() - debut) / 1000)} s.`);
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Mesures                                                               */
/* ------------------------------------------------------------------ */

if (etape === "mesures") {
  const fichiers = readdirSync(SORTIE).filter((f) => /^video-\d-(tiktok|linkedin)\.mp4$/.test(f)).sort();
  const images = join(SORTIE, "images");
  mkdirSync(images, { recursive: true });
  const bilan: Record<string, unknown>[] = [];
  for (const f of fichiers) {
    const nom = basename(f, ".mp4");
    const info = JSON.parse(readFileSync(join(SORTIE, `${nom}.json`), "utf8")) as { dureeLigneSec: number };
    const chemin = join(SORTIE, f);
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", chemin], { encoding: "utf8" }).stdout) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
    const video = probe.streams.find((s) => s.codec_type === "video")!;
    const duree = Number(probe.format.duration);
    const journal = spawnSync("ffmpeg", argumentsNoirEtFige(chemin), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stderr;
    // Noir ou figé HORS FIN : les 2 dernières secondes (phrase-choc tenue, fin) sont jugées à l'œil.
    const noirs = [...journal.matchAll(/black_start:\s*([\d.]+)[\s\S]*?black_duration:\s*([\d.]+)/g)].filter((m) => Number(m[1]) < duree - 2).map((m) => ({ quoi: "noir", debut: Number(m[1]), duree: Number(m[2]) }));
    // Figé (décision de Will du 17/10) : jusqu'à 2,5 s tant que la voix parle, 0,5 s hors voix ; mots = ceux de la ligne rendue.
    const n = Number(/^video-(\d)-/.exec(nom)![1]);
    const paroles = parolesDeLaLigneIV(versionDe(n, nom.endsWith("linkedin") ? "linkedin" : "tiktok").resultat.ligne);
    const figes = lirePassagesFiges(journal, duree);
    const figesRefuses = passagesFigesRefusesIV(figes.filter((p) => p.debutSec < duree - 2), paroles).map((p) => ({ quoi: "figé", debut: p.debutSec, duree: p.dureeSec }));
    const instants = [0.5, 1.5, 3, ...Array.from({ length: Math.floor(duree / 3) }, (_, k) => 3 * (k + 2))].filter((t) => t < duree - 0.05);
    for (const t of instants) spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", chemin, "-frames:v", "1", "-q:v", "3", join(images, `${nom}-${String(t).replace(".", "_")}.jpg`)]);
    const occupation = spawnSync("python3", ["-I", join(RACINE, "docs/formats/image-video/variete/prototypes/occupation.py"), images, ...instants.map((t) => `${nom}-${String(t).replace(".", "_")}`)], { encoding: "utf8" }).stdout;
    writeFileSync(join(SORTIE, `${nom}-occupation.txt`), occupation);
    bilan.push({
      fichier: f,
      empreinte: createHash("sha256").update(readFileSync(chemin)).digest("hex"),
      octets: statSync(chemin).size,
      dureeSec: duree,
      dureeLigneSec: info.dureeLigneSec,
      ecartSec: Math.round((duree - info.dureeLigneSec) * 1000) / 1000,
      largeur: video.width,
      hauteur: video.height,
      son: probe.streams.some((s) => s.codec_type === "audio"),
      ...lireNoirEtFige(journal, duree),
      figeHorsVoixMaxSec: figeHorsVoixMaxSec(figes, paroles),
      noirOuFigeHorsFin: [...noirs.filter((x) => x.duree > 0.5), ...figesRefuses],
      images: instants.length,
      occupationOk: (occupation.match(/ OK$/gm) ?? []).length,
      occupationNon: (occupation.match(/ NON$/gm) ?? []).length,
    });
    console.log(`${f} : ${duree.toFixed(2)} s (ligne ${info.dureeLigneSec} s) · ${video.width} × ${video.height} · ${instants.length} images`);
  }
  writeFileSync(join(SORTIE, "mesures.json"), `${JSON.stringify(bilan, null, 2)}\n`);
  // Planche des 3 tirages : mêmes moments (TikTok 9:16), une rangée par vidéo.
  const t = tirages();
  const moments = ["0_5", "1_5", "3", "9", "18", "27"];
  // Légende : la recette de la version TikTok rendue (ouverture du 9:16), pas celle tirée pour la vidéo.
  const rangs = t.filter((x) => existsSync(join(images, `video-${x.n}-tiktok-0_5.jpg`))).map((x) => `Vidéo ${x.n}|${ligneRecette(versionDe(x.n, "tiktok").recette)}|${moments.map((m) => `video-${x.n}-tiktok-${m}`).join(",")}`);
  if (rangs.length) {
    const r = spawnSync("python3", ["-I", join(RACINE, "docs/formats/image-video/variete/prototypes/tirages.py"), join(SORTIE, "planche-tirages.jpg"), images, "0.5 s,1.5 s,3 s,9 s,18 s,27 s", ...rangs], { encoding: "utf8" });
    if (r.status !== 0) console.warn(r.stderr);
  }
  process.exit(0);
}

console.log("Usage : repetition-generale.mts tirage | rendu --video 1|2|3 --version tiktok|linkedin | mesures");
process.exit(1);
