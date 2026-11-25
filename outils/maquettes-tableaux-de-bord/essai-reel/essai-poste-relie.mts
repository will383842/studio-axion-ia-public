/**
 * POSTE-3 : essai du « poste relié » par le chef, SANS Studio en ligne (plan du 25/11, section 7).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/essai-reel/essai-poste-relie.mts --boite <dossier hors dépôt> --preparer [--maquette <dossier>]
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/essai-reel/essai-poste-relie.mts --boite <dossier hors dépôt> --direct   (cloud ou CI seulement)
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/essai-reel/essai-poste-relie.mts --boite <dossier hors dépôt> --lire [--id <id>]
 *
 *  --preparer : écrit `demandes/film-zip--<id>` comme le Studio l'écrirait (mêmes noms, mêmes bornes : `contrat.ts`) à partir d'une maquette
 *               (défaut `05-stocks`) : zip fait en mémoire, `scenario.json` du dossier, calage SYNTHÉTIQUE (3 s par étape, aucune voix).
 *               Crée `PRET`, `pouls`, `demandes/`, `reponses/` si absents. Aucun navigateur, aucune garde d'environnement.
 *  --direct   : à la place du veilleur et du conteneur : prend la demande, la décompresse avec `decompresser-zip.ts`, lance `capturer.mts`
 *               hors conteneur, mesure le film avec ffprobe local et écrit la réponse au format de la boîte. Garde 51c (`environnementAutorise`) :
 *               cloud ou CI seulement, jamais le PC. Le `ffprobe.json` est celui de l'essai (local), pas celui du poste.
 *  --lire     : relit la réponse avec les règles du contrat (lstat, O_NOFOLLOW, fstat, noms en liste fermée, signature MP4) et affiche le verdict.
 *
 * Codes de sortie : 0 ok · 3 environnement interdit · 4 entrée refusée · 5 capture en échec.
 * Zéro euro : ni Claude, ni HeyGen, ni ElevenLabs, ni rendu. Rien n'est écrit dans le dépôt (`--boite` doit être HORS du dépôt).
 */
import { spawnSync } from "node:child_process";
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, rmSync, writeSync, fsyncSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32, decompresserZip, ErreurZip, lireArchiveSurDisque } from "../capture/decompresser-zip";
import { environnementAutorise, indicesConteneur } from "../capture/garde";
import { lireCalage } from "../capture/plan-capture";
import { lireScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";
import {
  BORNES,
  FICHIERS_DEMANDE,
  FICHIERS_REPONSE,
  PHRASES_CODE,
  calageRegulier,
  dimensionsFilm,
  idDemande,
  jugerFfprobe,
  lireEtat,
  lireNomDossier,
  nomDossier,
  signatureMp4,
  type CodeReponse,
  type StatutReponse,
} from "../../../src/moteurs/montage-tutoriel-outil/capture-auto/contrat";

export const RACINE_DEPOT = fileURLToPath(new URL("../../../", import.meta.url));
export const MAQUETTE_PAR_DEFAUT = "outils/maquettes-tableaux-de-bord/05-stocks";
export const SORTIE = { ok: 0, environnement: 3, entree: 4, capture: 5 } as const;
const DELAI_CAPTURE_MS = 900_000;

export type Mode = "preparer" | "direct" | "lire";
export interface Options {
  mode: Mode;
  boite: string;
  maquette: string;
  id?: string;
}
export type LectureArguments = { ok: true; options: Options } | { ok: false; message: string };

/** Lecture PURE des arguments : une seule action, `--boite` obligatoire. */
export function lireArguments(argv: readonly string[]): LectureArguments {
  const modes: Mode[] = [];
  const valeurs: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--preparer" || a === "--direct" || a === "--lire") modes.push(a.slice(2) as Mode);
    else if (a === "--boite" || a === "--maquette" || a === "--id") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) return { ok: false, message: `Valeur manquante après ${a}.` };
      valeurs[a.slice(2)] = v;
    } else return { ok: false, message: `Argument inconnu : ${a}.` };
  }
  if (modes.length !== 1) return { ok: false, message: "Choisissez une seule action : --preparer, --direct ou --lire." };
  if (!valeurs.boite) return { ok: false, message: "Argument « --boite » obligatoire." };
  const options: Options = { mode: modes[0]!, boite: valeurs.boite, maquette: valeurs.maquette ?? MAQUETTE_PAR_DEFAUT };
  if (valeurs.id !== undefined) options.id = valeurs.id;
  return { ok: true, options };
}

/** Vrai si `boite` est HORS du dépôt (chemin résolu ; le plus proche parent existant est résolu aussi, pour les liens). */
export function boiteHorsDepot(boite: string, racineDepot: string = RACINE_DEPOT): boolean {
  const reel = (p: string): string => {
    let courant = resolve(p);
    const reste: string[] = [];
    while (!existsSync(courant) && dirname(courant) !== courant) {
      reste.unshift(courant.slice(dirname(courant).length + 1));
      courant = dirname(courant);
    }
    return resolve(realpathSync.native(courant), ...reste);
  };
  const v = relative(reel(racineDepot), reel(boite));
  return v.startsWith("..") || isAbsolute(v);
}

/** Garde 51c : cloud ou CI seulement (ou conteneur de capture). Utilisée par `--direct` seulement. */
export function gardeDirect(env: Record<string, string | undefined>, plateforme: string, conteneur = false) {
  return environnementAutorise(env, plateforme, conteneur);
}

// --- zip en mémoire (méthode 0, « stockée ») -------------------------------------------------------------------------------

export interface FichierZip {
  nom: string;
  octets: Buffer;
}
/** Écrivain ZIP minimal : fichiers stockés, UTF-8, mode 0644, date fixe. Lisible par `lireArchive` de decompresser-zip.ts. */
export function construireZip(fichiers: readonly FichierZip[]): Buffer {
  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const crc = crc32(f.octets);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.octets.length, 18);
    local.writeUInt32LE(f.octets.length, 22);
    local.writeUInt16LE(nom.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.octets.length, 20);
    central.writeUInt32LE(f.octets.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(((0o100644 << 16) >>> 0), 38);
    central.writeUInt32LE(decalage, 42);
    locaux.push(local, nom, f.octets);
    centraux.push(central, nom);
    decalage += 30 + nom.length + f.octets.length;
  }
  const tailleCentral = centraux.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...centraux, fin]);
}

/**
 * Fichiers du zip d'essai : la maquette TELLE QUELLE, rendue AUTONOME (un client enverrait un dossier complet) : la charte et la police,
 * que la maquette lit hors de son dossier, sont embarquées à la racine du zip et les deux adresses relatives sont réécrites.
 */
export function fichiersMaquetteAutonome(dossier: string, racineDepot: string = RACINE_DEPOT): FichierZip[] {
  const extensions = new Set(["html", "css", "js", "json", "svg", "png", "jpg", "jpeg", "webp", "woff2", "txt", "md"]);
  const sortie: FichierZip[] = [];
  for (const nom of readdirSync(dossier).sort()) {
    const st = lstatSync(join(dossier, nom));
    if (!st.isFile() || !extensions.has(nom.split(".").pop()!.toLowerCase())) continue;
    let octets = readFileSync(join(dossier, nom));
    if (nom === "index.html") octets = Buffer.from(octets.toString("utf8").replace('href="../charte/charte.css"', 'href="charte.css"'), "utf8");
    sortie.push({ nom, octets });
  }
  if (!sortie.some((f) => f.nom === "index.html")) throw new Error("La maquette n'a pas d'index.html à sa racine.");
  const charte = readFileSync(join(racineDepot, "outils/maquettes-tableaux-de-bord/charte/charte.css"), "utf8").replace(
    "../../../src/app/polices/manrope-latin.woff2",
    "manrope-latin.woff2",
  );
  sortie.push({ nom: "charte.css", octets: Buffer.from(charte, "utf8") });
  sortie.push({ nom: "manrope-latin.woff2", octets: readFileSync(join(racineDepot, "src/app/polices/manrope-latin.woff2")) });
  return sortie;
}

// --- écriture et lecture de fichiers sûres ---------------------------------------------------------------------------------

const { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_NONBLOCK } = constants;

function ecrireNeuf(chemin: string, octets: Uint8Array): void {
  const fd = openSync(chemin, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  try {
    let ecrit = 0;
    while (ecrit < octets.length) ecrit += writeSync(fd, octets, ecrit, octets.length - ecrit);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Fichier ordinaire, sans lien, un seul nom, ≤ borne. Lève sinon. */
function lireSur(chemin: string, borne: number): Buffer {
  if (!lstatSync(chemin).isFile()) throw new Error(`« ${chemin} » n'est pas un fichier ordinaire.`);
  const fd = openSync(chemin, O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.nlink !== 1) throw new Error(`« ${chemin} » : fichier refusé (lien physique ou non ordinaire).`);
    if (st.size > borne) throw new Error(`« ${chemin} » : fichier trop gros.`);
    const t = Buffer.alloc(st.size);
    let lu = 0;
    while (lu < t.length) {
      const n = readSync(fd, t, lu, t.length - lu, lu);
      if (n === 0) break;
      lu += n;
    }
    return t.subarray(0, lu);
  } finally {
    closeSync(fd);
  }
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

// --- --preparer ------------------------------------------------------------------------------------------------------------

export function preparer(boite: string, dossierMaquette: string): { id: string; dossier: string } {
  const lecture = lireScenarioMaquette(JSON.parse(readFileSync(join(dossierMaquette, "scenario.json"), "utf8")));
  if (!lecture.ok) throw new Error(`Scénario refusé : ${lecture.erreurs.join(" ")}`);
  const scenarioBrut = readFileSync(join(dossierMaquette, "scenario.json"));
  const calage = calageRegulier(lecture.scenario.etapes.map((e) => e.id));
  const zip = construireZip(fichiersMaquetteAutonome(dossierMaquette));
  const fichiers: Record<string, Buffer> = {
    "dossier.zip": zip,
    "scenario.json": scenarioBrut,
    "calage.json": Buffer.from(JSON.stringify(calage), "utf8"),
  };
  for (const [nom, borne] of Object.entries(FICHIERS_DEMANDE["film-zip"])) if (fichiers[nom]!.length > borne) throw new Error(`« ${nom} » dépasse la taille permise.`);
  const id = idDemande(lecture.scenario.maquette, Buffer.concat([scenarioBrut, Buffer.from(fichiers["calage.json"]!)]).toString("latin1"), sha256);
  const nom = nomDossier("film-zip", id);
  for (const d of ["demandes", "reponses", "echecs"]) mkdirSync(join(boite, d), { recursive: true, mode: 0o700 });
  if (existsSync(join(boite, "demandes", nom)) || existsSync(join(boite, "reponses", nom))) throw new Error("Cette demande existe déjà dans la boîte.");
  const prep = join(boite, "demandes", `.prep-${id}`);
  mkdirSync(prep, { mode: 0o700 });
  for (const [n, o] of Object.entries(fichiers)) ecrireNeuf(join(prep, n), o);
  renameSync(prep, join(boite, "demandes", nom));
  if (!existsSync(join(boite, "PRET"))) ecrireNeuf(join(boite, "PRET"), Buffer.alloc(0));
  rmSync(join(boite, "pouls"), { force: true });
  ecrireNeuf(join(boite, "pouls"), Buffer.from(new Date().toISOString() + "\n"));
  return { id, dossier: join(boite, "demandes", nom) };
}

// --- --lire ----------------------------------------------------------------------------------------------------------------

export interface VerdictLecture {
  statut: StatutReponse;
  code: CodeReponse;
  phrase: string;
  octetsFilm: number | null;
  verdictFfprobe: "ok" | "refuse" | "absent";
  raisonsFfprobe: string[];
  etapesNavigation: number | null;
}

/** Relit `reponses/<nom>` selon le contrat. Lève à la moindre anomalie (réponse hostile). */
export function lireReponseEssai(boite: string, id: string): VerdictLecture | null {
  const nom = nomDossier("film-zip", id);
  const dossier = join(boite, "reponses", nom);
  let st;
  try {
    st = lstatSync(dossier);
  } catch {
    return null;
  }
  if (!st.isDirectory()) throw new Error("Le dossier de réponse n'est pas un vrai dossier.");
  const permis = FICHIERS_REPONSE["film-zip"];
  const noms = readdirSync(dossier);
  for (const n of noms) if (!Object.prototype.hasOwnProperty.call(permis, n)) throw new Error(`Nom inattendu dans la réponse : « ${n} ».`);
  const etat = lireEtat(lireSur(join(dossier, "etat.txt"), BORNES.etat).toString("utf8"));
  if (!etat.ok) throw new Error(`État refusé : ${etat.raison}`);
  const v: VerdictLecture = {
    statut: etat.statut,
    code: etat.code,
    phrase: PHRASES_CODE[etat.code],
    octetsFilm: null,
    verdictFfprobe: "absent",
    raisonsFfprobe: [],
    etapesNavigation: null,
  };
  if (etat.statut !== "ok") return v;
  const film = lireSur(join(dossier, "navigation.mp4"), BORNES.film);
  if (!signatureMp4(film.subarray(0, 16))) throw new Error("Le film n'est pas un MP4.");
  v.octetsFilm = film.length;
  const navigation = JSON.parse(lireSur(join(dossier, "navigation.json"), BORNES.json).toString("utf8")) as {
    largeur?: unknown;
    hauteur?: unknown;
    dureeVoixMs?: unknown;
    cibles?: unknown;
  };
  if (!Array.isArray(navigation.cibles)) throw new Error("navigation.json : « cibles » manque.");
  v.etapesNavigation = navigation.cibles.length;
  const { largeur, hauteur, dureeVoixMs } = navigation;
  if (typeof largeur !== "number" || typeof hauteur !== "number" || typeof dureeVoixMs !== "number") throw new Error("navigation.json : dimensions ou durée illisibles.");
  // Attendu tiré de navigation.json (en production, POSTE-4 le tirera du calage de la demande).
  const juge = jugerFfprobe(lireSur(join(dossier, "ffprobe.json"), BORNES.ffprobe).toString("utf8"), {
    dureeMs: dureeVoixMs + 500,
    ...dimensionsFilm(largeur, hauteur),
  });
  v.verdictFfprobe = juge.ok ? "ok" : "refuse";
  if (!juge.ok) v.raisonsFfprobe = juge.raisons;
  return v;
}

function trouverId(boite: string, dossier: "demandes" | "reponses", id?: string): string {
  if (id) return id;
  const trouves = readdirSync(join(boite, dossier))
    .map(lireNomDossier)
    .filter((x): x is NonNullable<typeof x> => x !== null && x.type === "film-zip");
  if (trouves.length !== 1) throw new Error(`Il faut exactement un film-zip dans « ${dossier} » (ou passer --id) : ${trouves.length} trouvé(s).`);
  return trouves[0]!.id;
}

// --- --direct --------------------------------------------------------------------------------------------------------------

function ecrireReponse(boite: string, id: string, statut: StatutReponse, code: CodeReponse, fichiers: Record<string, Buffer> = {}): void {
  const nom = nomDossier("film-zip", id);
  const prep = join(boite, "reponses", `.prep-${id}`);
  rmSync(prep, { recursive: true, force: true });
  mkdirSync(prep, { mode: 0o700 });
  ecrireNeuf(join(prep, "etat.txt"), Buffer.from(`${statut}\n${code}\n`));
  for (const [n, o] of Object.entries(fichiers)) ecrireNeuf(join(prep, n), o);
  renameSync(prep, join(boite, "reponses", nom));
}

function direct(boite: string, idDemandee?: string): number {
  const id = trouverId(boite, "demandes", idDemandee);
  const nom = nomDossier("film-zip", id);
  const source = join(boite, "demandes", nom);
  if (!lstatSync(source).isDirectory()) {
    console.error("La demande n'est pas un vrai dossier.");
    return SORTIE.entree;
  }
  const permis = FICHIERS_DEMANDE["film-zip"];
  const presents = readdirSync(source).sort();
  if (JSON.stringify(presents) !== JSON.stringify(Object.keys(permis).sort())) {
    console.error("Les fichiers de la demande ne sont pas ceux du contrat.");
    return SORTIE.entree;
  }
  const travail = mkdtempSync(join(tmpdir(), "poste-relie-"));
  try {
    // Comme le veilleur : la demande est copiée vers un dossier neuf, puis retirée de la boîte ; on ne travaille que sur la copie.
    for (const [n, borne] of Object.entries(permis)) ecrireNeuf(join(travail, n), lireSur(join(source, n), borne));
    rmSync(source, { recursive: true, force: true });

    const lecture = lireCalage(JSON.parse(readFileSync(join(travail, "calage.json"), "utf8")));
    const echec = (code: CodeReponse, sortie: number, message: string): number => {
      console.error(message);
      ecrireReponse(boite, id, sortie === SORTIE.entree ? "refus" : "panne", code);
      return sortie;
    };
    if (!lecture.ok) return echec("DEMANDE_INVALIDE", SORTIE.entree, `Calage refusé : ${lecture.erreurs.join(" ")}`);
    const maquette = join(travail, "zip", "maquette");
    mkdirSync(join(travail, "zip"));
    try {
      decompresserZip(lireArchiveSurDisque(join(travail, "dossier.zip")), maquette);
    } catch (e) {
      if (e instanceof ErreurZip) return echec("ZIP_REFUSE", SORTIE.entree, `Archive refusée (${e.famille}) : ${e.message}`);
      throw e;
    }
    if (!existsSync(join(maquette, "index.html"))) return echec("MAQUETTE_INTROUVABLE", SORTIE.entree, "Aucun index.html à la racine de la maquette.");

    const sortieCapture = join(travail, "capture");
    mkdirSync(sortieCapture);
    const tsx = join(RACINE_DEPOT, "node_modules/.bin/tsx");
    const r = spawnSync(
      tsx,
      [
        join(RACINE_DEPOT, "outils/maquettes-tableaux-de-bord/capture/capturer.mts"),
        "--maquette", maquette,
        "--scenario", join(travail, "scenario.json"),
        "--calage", join(travail, "calage.json"),
        "--sortie", sortieCapture,
      ],
      { encoding: "utf8", timeout: DELAI_CAPTURE_MS, maxBuffer: 64 * 1024 * 1024, env: process.env },
    );
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    if (r.error || r.status !== 0) {
      const delai = (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
      return echec(delai ? "DUREE_DEPASSEE" : "CAPTURE_ECHEC", SORTIE.capture, `La capture a échoué (code ${r.status ?? "?"}).`);
    }
    const sous = readdirSync(sortieCapture).filter((n) => lstatSync(join(sortieCapture, n)).isDirectory());
    if (sous.length !== 1) return echec("CAPTURE_ECHEC", SORTIE.capture, "La capture n'a pas rendu un dossier unique.");
    const dossierCapture = join(sortieCapture, sous[0]!);
    const film = lireSur(join(dossierCapture, "navigation.mp4"), BORNES.film);
    const navigation = lireSur(join(dossierCapture, "navigation.json"), BORNES.json);

    const sonde = spawnSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", join(dossierCapture, "navigation.mp4")], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (sonde.error || sonde.status !== 0 || Buffer.byteLength(sonde.stdout) > BORNES.ffprobe) return echec("FILM_INVALIDE", SORTIE.capture, "ffprobe local en échec.");
    const sc = lireScenarioMaquette(JSON.parse(readFileSync(join(travail, "scenario.json"), "utf8")));
    if (!sc.ok) return echec("DEMANDE_INVALIDE", SORTIE.entree, "Scénario refusé.");
    const juge = jugerFfprobe(sonde.stdout, { dureeMs: lecture.calage.dureeVoixMs + 500, ...dimensionsFilm(sc.scenario.largeur, sc.scenario.hauteur) });
    console.log(`Vérification de durée faite par ffprobe LOCAL (essai) : ${juge.ok ? "conforme" : juge.raisons.join(" ")}`);
    if (!juge.ok) return echec("FILM_INVALIDE", SORTIE.capture, "Le film ne passe pas le contrôle de ffprobe.");
    ecrireReponse(boite, id, "ok", "OK", { "navigation.mp4": film, "navigation.json": navigation, "ffprobe.json": Buffer.from(sonde.stdout, "utf8") });
    console.log(`Réponse écrite : reponses/${nom}`);
    return SORTIE.ok;
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}

// --- principal -------------------------------------------------------------------------------------------------------------

function principal(argv: readonly string[]): number {
  const lu = lireArguments(argv);
  if (!lu.ok) {
    console.error(lu.message);
    return SORTIE.entree;
  }
  const { mode, boite: boiteBrute, maquette } = lu.options;
  const boite = resolve(boiteBrute);
  if (!boiteHorsDepot(boite)) {
    console.error("« --boite » doit être hors du dépôt.");
    return SORTIE.entree;
  }
  try {
    if (mode === "direct") {
      const v = gardeDirect(process.env, process.platform, indicesConteneur(existsSync));
      if (!v.ok) {
        console.error(v.raison);
        return SORTIE.environnement;
      }
      return direct(boite, lu.options.id);
    }
    if (mode === "preparer") {
      const r = preparer(boite, resolve(RACINE_DEPOT, maquette));
      console.log(`Demande écrite : ${r.dossier}`);
      return SORTIE.ok;
    }
    const id = trouverId(boite, "reponses", lu.options.id);
    const verdict = lireReponseEssai(boite, id);
    if (!verdict) {
      console.error("Pas encore de réponse.");
      return SORTIE.entree;
    }
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.statut === "ok" && verdict.verdictFfprobe === "ok" ? SORTIE.ok : SORTIE.capture;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return SORTIE.entree;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(principal(process.argv.slice(2)));
