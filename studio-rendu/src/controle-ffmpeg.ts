/**
 * CONTRÔLE RÉEL DE FFMPEG (09/10, après la panne d'export : `overlay=format=yuv444p10` refusé par le FFmpeg 5.1 de
 * l'image). Les tests vérifiaient le TEXTE des commandes ; ici, les commandes écrites par le code (mêmes fonctions que
 * la production) sont EXÉCUTÉES avec le FFmpeg de l'image, sur des sources lavfi courtes (≈ 1 s) :
 *
 *   - master « avocat » 8 bits (`argumentsImageFfmpeg` : décor, liseré, zoom fixe, zoom lent, LUT, grain, vignette,
 *     fondu de fin) et master « face caméra » 10 bits (source pré-cadrée, écran partagé, mises en page côté et
 *     vignette) ; 10/10 : retouche face caméra avec zoom et carte plein écran, COULEURS mesurées sur une mire (master
 *     et export) et garde-fou des couleurs (`controlerCouleurs`) éprouvé sur un export juste et un export cassé ;
 *   - master du lot M4 (`argumentsMaster` + `grapheCouleurs`) ;
 *   - export complet (`argumentsExport` : `grapheExport` 8 et 10 bits, libx264 High 4.1, 2 passes et CRF, AAC) et
 *     ses mesures (ffprobe : yuv420p, High, niveau 4.1, BT.709, `+faststart`) ;
 *   - chaîne du son (`preparerSon` : loudnorm mesuré, chaîne de la voix, limiteur, ebur128) ;
 *   - note VMAF de l'export (09/10 : `mesurerVmaf`, libvmaf contre le graphe d'export) et relance UNIQUE plus fine
 *     d'un export volontairement dégradé (`noterEtRelancer`).
 *
 * Utilisé par `deploiement/verifier-outils-video.sh` (dans l'image fraîchement construite, AVANT toute mise en ligne)
 * et par le test Vitest `tests/ffmpeg-reel.test.ts` (avec le FFmpeg du poste, s'il existe).
 *
 *   node_modules/.bin/tsx src/controle-ffmpeg.ts        → une ligne par contrôle, code 1 si un seul échoue
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DIMENSIONS_SCENE, type ParametresExport, type PlanScene, type ProprietesImageComposition } from "../../src/briques/composition/scene.js";
import { geometrieCote, geometrieVignette } from "../../src/briques/habillage-facecam/mise-en-page.js";
import { lutIdentite } from "../../src/lib/lut3d.js";
import { ecrireCube } from "../../src/lib/qc-lut.js";
import { argumentsExport, argumentsMaster, grapheCouleurs, lireExport, listeConcatTexte, moovAvantMdat, sourceGrain } from "./composition/ffmpeg.js";
import { argumentsImageFfmpeg, type FichiersImage } from "./composition/image-ffmpeg.js";
import { controlerCouleurs, ecartCouleurs, mesurerCouleurs, type Zone } from "./composition/couleurs.js";
import { mesurerVmaf, noterEtRelancer } from "./operations/composition.js";
import { argumentsEtalonnageVideo, filtreEtalonnage } from "./operations/etalonnage.js";
import { executer, FFMPEG, FFPROBE } from "./outils.js";
import { preparerSon } from "./son/chaine.js";

export interface ResultatControle {
  nom: string;
  ok: boolean;
  dureeMs: number;
  erreur?: string;
}

const FPS = 25;
const DUREE = 1;
const IMAGES = DUREE * FPS;
const COULEURS = { grainPct: 4, grainTaillePx: 2, vignettePct: 12 };
const CADRAGE = { valeur: "large" as const, zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
const EXPORT: ParametresExport = { fps: FPS, debitKbps: 8000, debitMaxKbps: 12000, audioKbps: 320, audioHz: 48000 };

/** Sources lavfi (≈ 1 s) : prises 8 et 10 bits, décor, carte, son, calques texte transparents, LUT. */
function sources(): { nom: string; args: string[] }[] {
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE["9:16"];
  const t = (s: number) => ["-t", s.toFixed(2)];
  return [
    { nom: "source : prise 8 bits", args: ["-f", "lavfi", "-i", `testsrc2=s=${W}x${H}:r=${FPS}`, ...t(DUREE + 0.2), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "prise.mp4"] },
    { nom: "source : prise 10 bits", args: ["-f", "lavfi", "-i", `testsrc2=s=${W}x${H}:r=${FPS}`, ...t(DUREE + 0.2), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "8", "-pix_fmt", "yuv420p10le", "-profile:v", "high10", "prise10.mov"] },
    { nom: "source : décor", args: ["-f", "lavfi", "-i", `gradients=s=${W}x${H}:n=3`, "-frames:v", "1", "decor.png"] },
    { nom: "source : carte", args: ["-f", "lavfi", "-i", `testsrc=s=${W}x${H}:r=${FPS}`, ...t(DUREE + 0.2), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "carte.mp4"] },
    // Voix de synthèse : un son modulé et du bruit (loudnorm et ebur128 ont de quoi mesurer).
    { nom: "source : voix", args: ["-f", "lavfi", "-i", `sine=f=220:r=48000,volume='0.3+0.25*sin(2*PI*3*t)':eval=frame`, "-f", "lavfi", "-i", "anoisesrc=r=48000:a=0.01", "-filter_complex", "[0][1]amix=inputs=2:normalize=0", ...t(DUREE + 0.2), "-ac", "1", "-c:a", "pcm_f32le", "voix.wav"] },
    { nom: "source : calques texte", args: ["-f", "lavfi", "-i", `color=c=black@0:s=${W}x${H}:r=${FPS},format=rgba,drawbox=x=90:y=1400:w=900:h=180:color=white@0.85:t=fill`, "-frames:v", "2", "-start_number", "0", "t-%06d.png"] },
  ];
}

/** Proprétés d'image minimales, comme celles que `parametresComposition` écrit (avocat ou face caméra). */
function proprietes(dix: boolean): ProprietesImageComposition {
  const { largeur, hauteur } = DIMENSIONS_SCENE["9:16"];
  const tiers = DUREE / 4;
  const plan = (i: number, extra: Partial<PlanScene> = {}): PlanScene => ({ debutSec: i * tiers, finSec: (i + 1) * tiers, type: "double", angle: "principal", cadrage: CADRAGE, ...extra });
  const base = { ratio: "9:16" as const, largeur, hauteur, fps: FPS, images: IMAGES, decor: { teinte: "#2A2420", directionLumiere: "gauche" as const, flouPx: 0, clair: false } };
  if (!dix)
    return {
      ...base,
      doubles: { principal: { type: "video", url: "prise.mp4", transparent: false } },
      contour: { couleur: "#FFB070", cote: "droite" },
      fonduFinSec: 0.3,
      plans: [plan(0), plan(1, { cadrage: { ...CADRAGE, valeur: "poitrine", zoom: 1.15, zoomFin: 1.15 } }), plan(2, { cadrage: { ...CADRAGE, zoomFin: 1.06 } }), plan(3)],
    };
  const vignette = geometrieVignette(largeur, hauteur);
  return {
    ...base,
    sourcePreCadree: true,
    source10bits: true,
    doubles: { principal: { type: "video", url: "prise10.mov", transparent: false } },
    plans: [
      plan(0, { cadrage: { ...CADRAGE, zoomFin: 1.06 } }),
      plan(1, { ecranPartage: { carte: "entree:carte", hauteurHaut: 860, sourceY: 300, entreeImages: 5, carteDebutSec: 0 } }),
      plan(2, { miseEnPage: { mode: "cote", cote: "droite", carte: "entree:carte", entreeImages: 5, carteDebutSec: 0, geometrie: { cote: geometrieCote(largeur, "droite") } } }),
      plan(3, { miseEnPage: { mode: "vignette", cote: "droite", carte: "entree:carte", entreeImages: 5, carteDebutSec: 0, geometrie: { vignette } } }),
    ],
  };
}

/**
 * Étiquettes BT.709 plage tv d'un fichier produit. Depuis FFmpeg 7.1, `-color_primaries` / `-color_trc` en sortie ne
 * passent plus à libx264 derrière un filtre : seules les étiquettes posées dans le graphe (`setparams`) tiennent.
 */
async function verifierBt709(fichier: string, dossier: string): Promise<void> {
  const lu = (await executer(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_primaries,color_transfer,color_space,color_range", "-of", "csv=p=0", join(dossier, fichier)])).trim();
  if (lu.split(",").sort().join(",") !== "bt709,bt709,bt709,tv") throw new Error(`${fichier} étiqueté « ${lu} » au lieu de BT.709 tv`);
}

/** Lecture des étiquettes d'un fichier exporté : celles que le contrôle de la composition exige. */
async function verifierExport(video: string, dossier: string): Promise<void> {
  const m = lireExport(await executer(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", join(dossier, video)]));
  const manques = [
    m.yuv420p ? "" : "yuv420p",
    m.profilHigh ? "" : "profil High",
    m.niveau === 41 ? "" : `niveau 4.1 (lu : ${m.niveau})`,
    m.bt709 && m.plageTv ? "" : "étiquettes BT.709 plage tv",
    m.audioHz === 48000 && m.audioCanaux === 2 ? "" : "AAC 48 kHz stéréo",
  ].filter(Boolean);
  if (!moovAvantMdat((await readFile(join(dossier, video))).subarray(0, 4 * 1024 * 1024))) manques.push("+faststart");
  if (manques.length) throw new Error(`${video} : ${manques.join(", ")} manquant`);
}

/** FFmpeg dans `dossier` ; en échec, les dernières lignes de sa sortie d'erreur (la vraie raison, pas « Invalid argument »). */
function lancer(args: string[], dossier: string): Promise<void> {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, args, { cwd: dossier, stdio: ["ignore", "ignore", "pipe"] });
    let erreurs = "";
    p.stderr.on("data", (d: Buffer) => (erreurs = (erreurs + d.toString()).slice(-8000)));
    p.on("error", ko);
    p.on("close", (code) => (code === 0 ? ok() : ko(new Error(`FFmpeg a échoué (${code}) :\n        ${erreurs.split(/\r?\n/).filter(Boolean).slice(-5).join("\n        ")}`))));
  });
}

/* ------------------------------------------------------------------ */
/* Bandes sur le mur (rapport V6, P0 n° 1-2)                           */
/* ------------------------------------------------------------------ */

/** Niveaux 10 bits d'un dégradé de mur doux (sur toute la largeur) : ≈ 30 niveaux seulement en 8 bits. */
export const NIVEAUX_DEGRADE_MUR = 120;

/** Prise 10 bits sans perte : un mur en dégradé horizontal doux (luma 420 → 540 sur 1023), comme un mur éclairé de côté. */
export function argumentsDegradeMur(sortie: string, largeur: number, hauteur: number, dureeSec = 1.2): string[] {
  return [
    "-f", "lavfi", "-i", `nullsrc=s=${largeur}x${hauteur}:r=${FPS}:d=${dureeSec.toFixed(2)},format=yuv420p10le,geq=lum='420+${NIVEAUX_DEGRADE_MUR}*X/W':cb=512:cr=512`,
    "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", "-pix_fmt", "yuv420p10le",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", sortie,
  ];
}

/**
 * Nombre de niveaux de luminance distincts sur UNE ligne d'une image (à `instantSec`), lus en 10 bits, au milieu de la
 * largeur (10 % à 90 %). Un dégradé intact garde ses niveaux ; une descente en 8 bits en garde ≈ 4 fois moins (bandes).
 */
export function niveauxLigne(dossier: string, fichier: string, instantSec: number, ligne: number): number {
  const r = spawnSync(FFMPEG, ["-v", "error", "-nostdin", "-ss", instantSec.toFixed(3), "-i", fichier, "-frames:v", "1", "-vf", `crop=iw:1:0:${ligne},format=gray10le`, "-f", "rawvideo", "-"], { cwd: dossier, maxBuffer: 1 << 24 });
  if (r.status !== 0 || !r.stdout?.length) throw new Error(`lecture de ${fichier} impossible : ${r.stderr?.toString().slice(-300)}`);
  const n = r.stdout.length / 2;
  const valeurs = new Set<number>();
  for (let x = Math.floor(n * 0.1); x < Math.floor(n * 0.9); x++) valeurs.add(r.stdout.readUInt16LE(2 * x));
  return valeurs.size;
}

/** Contrôle : le master face caméra garde ≥ 85 % des niveaux du dégradé de mur (aucune bande ajoutée par la composition). */
async function verifierDegradeMur(dossier: string): Promise<void> {
  const source = niveauxLigne(dossier, "mur.mov", 0.2, Math.round(DIMENSIONS_SCENE["9:16"].hauteur * 0.8));
  const master = niveauxLigne(dossier, "master-mur.mov", 0.2, Math.round(DIMENSIONS_SCENE["9:16"].hauteur * 0.8));
  if (master < source * 0.85) throw new Error(`bandes : ${master} niveaux gardés sur ${source} dans le dégradé du mur`);
}

/* ------------------------------------------------------------------ */
/* Couleurs de l'image filmée (10/10, « zoom demandé = image cassée ») */
/* ------------------------------------------------------------------ */

/**
 * Mire 10 bits « face caméra » (lavfi) : mur clair en haut, grand aplat de peau au centre, sweat bleu-gris en bas. Les
 * zones `ZONES_MIRE` restent dans l'image d'un plan large ET d'un plan serré à 130 % centré (0,5 ; 0,4).
 */
export const MIRE_FACECAM = [
  `color=c=0x7F7F7F:s=1080x1920:r=${FPS}:d=${(DUREE + 0.2).toFixed(2)},format=rgb24`,
  "drawbox=x=0:y=0:w=1080:h=300:color=0xB9B5AE:t=fill",
  "drawbox=x=216:y=384:w=648:h=864:color=0xE0AC8F:t=fill",
  "drawbox=x=0:y=1450:w=1080:h=470:color=0x4A5568:t=fill",
].join(",");
export const ZONES_MIRE: Record<string, Zone> = { mur: { x: 0.3, y: 0.02, largeur: 0.4, hauteur: 0.05 }, peau: { x: 0.42, y: 0.36, largeur: 0.16, hauteur: 0.08 } };

/** Piste montée 10 bits de la mire, comme la rend le cadrage (yuv420p10le, BT.709 tv étiqueté). */
export function argumentsMireFacecam(sortie: string): string[] {
  return ["-f", "lavfi", "-i", MIRE_FACECAM, "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "8", "-profile:v", "high10", sortie];
}

/** Plans d'une retouche face caméra : plan large, carte plein écran (Remotion), plan serré à 130 % (zoom demandé). */
export function plansZoomEtCarte(dureeSec: number): PlanScene[] {
  const t = (k: number) => +((dureeSec * k) / 5).toFixed(3);
  return [
    { debutSec: 0, finSec: t(2), type: "double", angle: "principal", cadrage: CADRAGE },
    { debutSec: t(2), finSec: t(3), type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: "entree:carte-pe-1", video: true } },
    { debutSec: t(3), finSec: dureeSec, type: "double", angle: "principal", cadrage: { ...CADRAGE, valeur: "serre", zoom: 1.3, zoomFin: 1.3 } },
  ] as PlanScene[];
}

/** Chrominance de la mire gardée (± 3 sur 255) dans le plan large (0,2 s) et le plan zoomé (0,8 s) de `fichier`. */
async function verifierCouleursMire(dossier: string, fichier: string): Promise<void> {
  for (const t of [0.2 * DUREE, 0.8 * DUREE])
    for (const [nom, zone] of Object.entries(ZONES_MIRE)) {
      const e = ecartCouleurs(await mesurerCouleurs(FFMPEG, join(dossier, fichier), t, zone), await mesurerCouleurs(FFMPEG, join(dossier, "mire-facecam.mov"), 0.2, zone));
      if (e.ecartUV >= 3) throw new Error(`${fichier} : ${nom} à ${t.toFixed(1)} s, chrominance décalée de ${e.ecartUV.toFixed(1)} sur 255 (couleurs cassées)`);
    }
}

/** Garde-fou : l'export juste passe ; le même aux U et V permutés est déclaré aberrant. */
async function verifierGardeFouCouleurs(dossier: string): Promise<void> {
  const paires = [{ exportSec: 0.2 * DUREE, referenceSec: 0.2 * DUREE }, { exportSec: 0.3 * DUREE, referenceSec: 0.3 * DUREE }];
  const bon = await controlerCouleurs(FFMPEG, join(dossier, "export-zoom-carte.mp4"), join(dossier, "mire-facecam.mov"), paires);
  if (bon.couleursAberrantes !== 0) throw new Error(`export juste refusé : ${JSON.stringify(bon)}`);
  await lancer(["-hide_banner", "-nostdin", "-y", "-i", "export-zoom-carte.mp4", "-vf", "format=yuv444p,shuffleplanes=0:2:1,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "export-casse.mp4"], dossier);
  const casse = await controlerCouleurs(FFMPEG, join(dossier, "export-casse.mp4"), join(dossier, "mire-facecam.mov"), paires);
  if (casse.couleursAberrantes !== 1) throw new Error(`export aux couleurs aberrantes NON détecté : ${JSON.stringify(casse)}`);
}

/** Les contrôles, dans l'ordre (chacun lit les fichiers des précédents, dans `dossier`). */
export function controles(dossier: string): { nom: string; executer: () => Promise<unknown> }[] {
  const ff = (args: string[]) => () => lancer(["-hide_banner", "-nostdin", "-y", ...args], dossier);
  const fichiers = (dix: boolean): FichiersImage => ({
    decor: dix ? undefined : "decor.png",
    doubles: { principal: { fichier: dix ? "prise10.mov" : "prise.mp4", video: true } },
    illustrations: {},
    luts: [{ fichier: "lut.cube", plages: [[0, DUREE / 2]] }],
    son: "voix.wav",
    cartes: dix ? { carte: "carte.mp4" } : undefined,
  });
  const exportDe = (master: string, texte: string, e: ParametresExport, sortie: string) => async () => {
    const a = argumentsExport(master, texte, e, "passe", sortie, 2);
    if (a.passe1.length) await lancer(["-nostdin", ...a.passe1], dossier);
    await lancer(["-nostdin", ...a.passe2], dossier);
    await verifierExport(sortie, dossier);
  };
  // Commande exécutée, puis étiquettes BT.709 du fichier produit.
  const apres = (f: () => Promise<unknown>, fichier: string) => async () => {
    await f();
    await verifierBt709(fichier, dossier);
  };
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE["9:16"];
  return [
    { nom: "version", executer: () => executer(FFMPEG, ["-hide_banner", "-version"]) },
    { nom: "ffprobe", executer: () => executer(FFPROBE, ["-hide_banner", "-version"]) },
    ...sources().map((s) => ({ nom: s.nom, executer: ff(s.args) })),
    { nom: "source : LUT (ecrireCube)", executer: () => writeFile(join(dossier, "lut.cube"), ecrireCube(lutIdentite(17), "Contrôle")) },
    { nom: "source : liste concat du texte", executer: () => writeFile(join(dossier, "liste.txt"), listeConcatTexte(["t-000000.png", "t-000001.png"], [10, IMAGES - 10], FPS)) },
    { nom: "chaîne du son (preparerSon : loudnorm, voix, limiteur, ebur128)", executer: () => preparerSon({ voix: join(dossier, "voix.wav"), dureeSec: DUREE, dossier, passeHautHz: 80, seuilLraCompression: 0, ratioCompression: 2.5, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb: -42, graine: 7 }) },
    { nom: "master avocat 8 bits (argumentsImageFfmpeg)", executer: apres(ff(argumentsImageFfmpeg(proprietes(false), COULEURS, fichiers(false), DUREE, "master8.mov", { fils: 2 }).slice(2)), "master8.mov") },
    { nom: "master face caméra 10 bits (argumentsImageFfmpeg)", executer: apres(ff(argumentsImageFfmpeg(proprietes(true), COULEURS, fichiers(true), DUREE, "master10.mov", { fils: 2 }).slice(2)), "master10.mov") },
    // V6 P0 n° 1-2 : un dégradé de mur 10 bits traverse la composition face caméra sans perdre ses niveaux.
    { nom: "source : dégradé de mur 10 bits", executer: ff(argumentsDegradeMur("mur.mov", W, H)) },
    {
      nom: "master face caméra 10 bits : aucune bande sur le dégradé du mur",
      executer: async () => {
        const p = { ...proprietes(true), doubles: { principal: { type: "video" as const, url: "mur.mov", transparent: false } }, plans: proprietes(true).plans.slice(0, 2) };
        await ff(argumentsImageFfmpeg(p, { ...COULEURS, grainPct: 0, vignettePct: 0 }, { ...fichiers(true), doubles: { principal: { fichier: "mur.mov", video: true } } }, DUREE, "master-mur.mov", { fils: 2 }).slice(2))();
        await verifierDegradeMur(dossier);
      },
    },
    // 10/10 (« zoom demandé = image cassée ») : retouche face caméra avec zoom et carte plein écran, couleurs mesurées.
    { nom: "source : mire face caméra 10 bits (mur, peau, sweat)", executer: ff(argumentsMireFacecam("mire-facecam.mov")) },
    {
      nom: "master face caméra 10 bits avec zoom et carte plein écran : couleurs de l'image filmée gardées",
      executer: async () => {
        const p = { ...proprietes(true), doubles: { principal: { type: "video" as const, url: "mire-facecam.mov", transparent: false } }, plans: plansZoomEtCarte(DUREE) };
        await ff(argumentsImageFfmpeg(p, COULEURS, { doubles: { principal: { fichier: "mire-facecam.mov", video: true } }, illustrations: { 1: { fichier: "carte.mp4", video: true } }, luts: [], son: "voix.wav" }, DUREE, "master-zoom-carte.mov", { fils: 2 }).slice(2))();
        await verifierBt709("master-zoom-carte.mov", dossier);
        await verifierCouleursMire(dossier, "master-zoom-carte.mov");
      },
    },
    {
      nom: "export 10 bits avec zoom et carte plein écran : couleurs gardées, garde-fou des couleurs (juste : livré ; aberrant : arrêté)",
      executer: async () => {
        await exportDe("master-zoom-carte.mov", "liste.txt", { ...EXPORT, source10bits: true, mode: "crf", crf: 17 }, "export-zoom-carte.mp4")();
        await verifierCouleursMire(dossier, "export-zoom-carte.mp4");
        await verifierGardeFouCouleurs(dossier);
      },
    },
    { nom: "master M4 (argumentsMaster + grapheCouleurs)", executer: apres(ff(argumentsMaster("prise.mp4", "voix.wav", grapheCouleurs(COULEURS, [{ fichier: "lut.cube", plages: [[0, 0.5]] }], { largeur: W, hauteur: H }), sourceGrain({ largeur: W, hauteur: H }, 2, FPS, DUREE), "master-m4.mov").slice(2)), "master-m4.mov") },
    { nom: "étalonnage d'une vidéo (filtreEtalonnage + LUT)", executer: apres(ff(argumentsEtalonnageVideo([], "prise.mp4", filtreEtalonnage("lut.cube", "video"), "etalonnee.mp4").slice(4)), "etalonnee.mp4") },
    { nom: "export 8 bits, 2 passes (grapheExport, libx264 High 4.1)", executer: exportDe("master8.mov", "liste.txt", EXPORT, "export8.mp4") },
    { nom: "export 8 bits, CRF, séquence PNG", executer: exportDe("master-m4.mov", "t-%06d.png", { ...EXPORT, mode: "crf", crf: 17 }, "export8-crf.mp4") },
    { nom: "export 10 bits, 2 passes (grapheExport 10 bits)", executer: exportDe("master10.mov", "liste.txt", { ...EXPORT, source10bits: true }, "export10.mp4") },
    { nom: "export 10 bits, CRF", executer: exportDe("master10.mov", "liste.txt", { ...EXPORT, source10bits: true, mode: "crf", crf: 17 }, "export10-crf.mp4") },
    { nom: "note VMAF de l'export 10 bits (libvmaf contre le graphe d'export)", executer: () => noteBonne(dossier) },
    { nom: "export dégradé (CRF 45) : note VMAF sous 93, relance UNIQUE plus fine (noterEtRelancer)", executer: async () => {
      await exportDe("master10.mov", "liste.txt", EXPORT_DEGRADE, "export10-degrade.mp4")();
      await relanceDegrade(dossier);
    } },
  ];
}

const EXPORT_10_CRF: ParametresExport = { ...EXPORT, source10bits: true, mode: "crf", crf: 17, vmafMin: 93 };
const EXPORT_DEGRADE: ParametresExport = { ...EXPORT_10_CRF, crf: 45 };

/** L'export CRF 17 du contrôle : note VMAF lue, au-dessus du seuil, sur une image sur 5. */
async function noteBonne(dossier: string): Promise<void> {
  const n = await mesurerVmaf(join(dossier, "export10-crf.mp4"), join(dossier, "master10.mov"), dossier, EXPORT_10_CRF, dossier);
  if (!(n.vmaf >= 93 && n.vmaf <= 100) || n.vmafImages < 4) throw new Error(`note VMAF ${n.vmaf} sur ${n.vmafImages} image(s) (attendu ≥ 93)`);
}

/** Export CRF 45 : sous le seuil, relancé UNE fois à CRF 42, gardé s'il est meilleur. */
async function relanceDegrade(dossier: string): Promise<void> {
  const { mesures: m } = await noterEtRelancer(join(dossier, "export10-degrade.mp4"), join(dossier, "master10.mov"), dossier, EXPORT_DEGRADE, dossier, [], {});
  if (m.vmafErreur) throw new Error("note VMAF impossible");
  if (!(m.vmafAvantRelance < 93) || m.vmafRelance !== 1 || m.crfRelance !== 42) throw new Error(`relance attendue : ${JSON.stringify(m)}`);
  if (!(m.vmaf >= m.vmafAvantRelance)) throw new Error(`relance moins bonne gardée : ${m.vmaf} < ${m.vmafAvantRelance}`);
  await verifierExport("export10-degrade.mp4", dossier);
}

/** Exécute tous les contrôles dans un dossier temporaire (effacé). Un échec n'arrête pas les suivants. */
export async function controlerFfmpeg(): Promise<ResultatControle[]> {
  const dossier = await mkdtemp(join(tmpdir(), "controle-ffmpeg-"));
  const resultats: ResultatControle[] = [];
  try {
    for (const c of controles(dossier)) {
      const debut = Date.now();
      try {
        await c.executer();
        resultats.push({ nom: c.nom, ok: true, dureeMs: Date.now() - debut });
      } catch (e) {
        resultats.push({ nom: c.nom, ok: false, dureeMs: Date.now() - debut, erreur: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
  return resultats;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = (await executer(FFMPEG, ["-hide_banner", "-version"]).catch(() => "")).split("\n")[0];
  console.log(`studio-rendu — ${version || "FFmpeg introuvable"}`);
  const r = await controlerFfmpeg();
  for (const x of r) console.log(`${x.ok ? "OK   " : "ÉCHEC"} ${x.nom} (${x.dureeMs} ms)${x.erreur ? `\n      ${x.erreur}` : ""}`);
  const echecs = r.filter((x) => !x.ok).length;
  console.log(echecs ? `${echecs} contrôle(s) FFmpeg en échec sur ${r.length}.` : `${r.length} contrôles FFmpeg réussis.`);
  process.exit(echecs ? 1 : 0);
}
