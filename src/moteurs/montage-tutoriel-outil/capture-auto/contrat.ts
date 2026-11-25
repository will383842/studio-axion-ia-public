/**
 * POSTE-3 : contrat de la boîte aux lettres « capture-boite.v1 » entre le Studio et le veilleur de l'hôte
 * (plan « poste relié » du 25/11, section 3). PUR : ni `server-only`, ni `node:fs`, ni alias `@/` (imports relatifs seulement),
 * pour être importable aussi bien par le service du Studio que par les scripts d'`outils/`.
 * Aucune lecture de disque ici : ce module ne fait que dire quels noms, quelles tailles et quels codes sont permis.
 */

export const VERSION_BOITE = "capture-boite.v1";
/** Racine de la boîte VUE DEPUIS le conteneur studio (constante : pas de variable d'environnement). */
export const RACINE_BOITE_STUDIO = "/var/studio-capture";

/**
 * ÉTAT DU VEILLEUR : pour l'instant (mode `construire` reporté, lot POSTE-1b) seul `film-zip` est servi.
 * Les types `film-description` et `apercu` font partie du contrat complet mais le veilleur y répond
 * `refus` avec le code `DEMANDE_INVALIDE`.
 */
export const TYPES_SERVIS = ["film-zip"] as const;
export const TYPES_DEMANDE = ["film-zip", "film-description", "apercu"] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

export const REGEX_ID = /^[a-z0-9-]{8,64}$/;
const REGEX_NOM_DOSSIER = /^(film-zip|film-description|apercu)--([a-z0-9-]{8,64})$/;
const REGEX_EMPREINTE = /^[a-f0-9]{8,64}$/;
const REGEX_NOM_IMAGE = /^[a-z0-9-]{1,40}\.png$/;

const KIO = 1024;
const MIO = 1024 * 1024;
export const BORNES = {
  /** = limite du zip du tutoriel (`LIMITES.tailleArchive` de decompresser-zip.ts). */
  zip: 50 * MIO,
  json: 256 * KIO,
  film: 500 * MIO,
  ffprobe: 64 * KIO,
  png: 5 * MIO,
  pngMax: 12,
  /** `etat.txt` : deux lignes courtes. */
  etat: 256,
  /** `attendue.txt` : une empreinte hexadécimale et un saut de ligne. */
  attendue: 128,
} as const;

/** Délais du plan §5 (millisecondes) : le poste est dit « éteint » si le pouls a plus de 5 minutes. */
export const POULS_MAX_MS = 5 * 60 * 1000;

export const STATUTS_REPONSE = ["ok", "refus", "panne"] as const;
export type StatutReponse = (typeof STATUTS_REPONSE)[number];

/** Liste FERMÉE des codes de `etat.txt` (plan §3). */
export const CODES_REPONSE = [
  "OK",
  "DEMANDE_INVALIDE",
  "ZIP_REFUSE",
  "MAQUETTE_INTROUVABLE",
  "CONTROLE_SOURCE",
  "TROP_GROS",
  "CAPTURE_ECHEC",
  "DUREE_DEPASSEE",
  "FILM_INVALIDE",
  "EMPREINTE",
  "INTERROMPU",
  "POSTE_OCCUPE",
] as const;
export type CodeReponse = (typeof CODES_REPONSE)[number];

/** Noms permis dans `demandes/<type>--<id>/` et leur taille maximale en octets. Liste fermée. */
export const FICHIERS_DEMANDE: Record<TypeDemande, Readonly<Record<string, number>>> = {
  "film-zip": { "dossier.zip": BORNES.zip, "scenario.json": BORNES.json, "calage.json": BORNES.json },
  "film-description": {
    "description.json": BORNES.json,
    "attendue.txt": BORNES.attendue,
    "scenario.json": BORNES.json,
    "calage.json": BORNES.json,
  },
  apercu: { "description.json": BORNES.json, "attendue.txt": BORNES.attendue },
};

/** Noms permis dans `reponses/<type>--<id>/` (hors dossier `apercu/`) et leur taille maximale. Liste fermée. */
export const FICHIERS_REPONSE: Record<TypeDemande, Readonly<Record<string, number>>> = {
  "film-zip": { "etat.txt": BORNES.etat, "navigation.mp4": BORNES.film, "navigation.json": BORNES.json, "ffprobe.json": BORNES.ffprobe },
  "film-description": { "etat.txt": BORNES.etat, "navigation.mp4": BORNES.film, "navigation.json": BORNES.json, "ffprobe.json": BORNES.ffprobe },
  apercu: { "etat.txt": BORNES.etat, "apercu-piece.json": BORNES.json },
};
/** Seul type de réponse qui contient un sous-dossier d'images. */
export const DOSSIER_APERCU = "apercu";

export const estTypeDemande = (v: unknown): v is TypeDemande => typeof v === "string" && (TYPES_DEMANDE as readonly string[]).includes(v);
export const estIdValide = (v: unknown): v is string => typeof v === "string" && REGEX_ID.test(v);
export const estEmpreinteValide = (v: unknown): v is string => typeof v === "string" && REGEX_EMPREINTE.test(v);
export const estNomImageValide = (v: unknown): v is string => typeof v === "string" && REGEX_NOM_IMAGE.test(v);
export const estCodeReponse = (v: unknown): v is CodeReponse => typeof v === "string" && (CODES_REPONSE as readonly string[]).includes(v);

/**
 * Id déterministe : `<videoId nettoyé, 40 caractères au plus>-<12 premiers hexadécimaux du sha256 du contenu>`.
 * Même travail = même id = jamais deux demandes. `sha256` est passé en paramètre pour que ce module reste pur.
 */
export function idDemande(videoId: string, contenu: string, sha256: (s: string) => string): string {
  const propre = String(videoId).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  const empreinte = sha256(contenu);
  if (typeof empreinte !== "string" || !/^[a-f0-9]{12,}$/.test(empreinte)) throw new Error("Empreinte de demande invalide.");
  const id = `${propre}-${empreinte.slice(0, 12)}`;
  if (!REGEX_ID.test(id)) throw new Error("Identifiant de demande invalide.");
  return id;
}

/** Nom du dossier d'une demande ou d'une réponse. Lève si le type ou l'id sort du contrat. */
export function nomDossier(type: TypeDemande, id: string): string {
  if (!estTypeDemande(type)) throw new Error("Type de demande inconnu.");
  if (!estIdValide(id)) throw new Error("Identifiant de demande invalide.");
  return `${type}--${id}`;
}

/** Relit un nom de dossier de la boîte ; tout autre motif (`..`, `/`, majuscules, type inconnu, id trop long) donne `null`. */
export function lireNomDossier(nom: unknown): { type: TypeDemande; id: string } | null {
  if (typeof nom !== "string") return null;
  const m = REGEX_NOM_DOSSIER.exec(nom);
  return m ? { type: m[1] as TypeDemande, id: m[2]! } : null;
}

/** Dossier de préparation d'une demande, renommé vers `demandes/<type>--<id>` une fois complet. */
export const dossierPrep = (id: string): string => {
  if (!estIdValide(id)) throw new Error("Identifiant de demande invalide.");
  return `.prep-${id}`;
};

// --- calage -------------------------------------------------------------------------------------------------------------

export interface EtapeCalage {
  id: string;
  debutMs: number;
  finMs: number;
}
export interface CalageContrat {
  dureeVoixMs: number;
  etapes: EtapeCalage[];
}

/**
 * Calage au format lu par `lireCalage` (`outils/maquettes-tableaux-de-bord/capture/plan-capture.ts`). Refus (exception) si vide
 * ou si une valeur n'est pas un nombre fini. Les règles d'ordre et de durée minimale restent celles de `planFilm`.
 */
export function calageDepuis(etapes: readonly EtapeCalage[], dureeVoixMs: number): CalageContrat {
  if (!Array.isArray(etapes) || etapes.length === 0) throw new Error("Le calage doit contenir au moins une étape.");
  if (typeof dureeVoixMs !== "number" || !Number.isFinite(dureeVoixMs) || dureeVoixMs <= 0) throw new Error("La durée de la voix doit être un nombre positif.");
  const propres = etapes.map((e) => {
    const ok = typeof e?.id === "string" && e.id.trim().length > 0 && Number.isFinite(e.debutMs) && Number.isFinite(e.finMs) && e.debutMs >= 0 && e.finMs > e.debutMs;
    if (!ok) throw new Error("Une étape du calage est invalide.");
    return { id: e.id, debutMs: e.debutMs, finMs: e.finMs };
  });
  return { dureeVoixMs, etapes: propres };
}

/** Calage SYNTHÉTIQUE (essais sans voix) : chaque étape dure `pasMs` (3 s par défaut), bout à bout ; aucune voix n'existe. */
export function calageRegulier(ids: readonly string[], pasMs = 3000): CalageContrat {
  return calageDepuis(
    ids.map((id, i) => ({ id, debutMs: i * pasMs, finMs: (i + 1) * pasMs })),
    ids.length * pasMs,
  );
}

// --- etat.txt -----------------------------------------------------------------------------------------------------------

export type LectureEtat = { ok: true; statut: StatutReponse; code: CodeReponse } | { ok: false; raison: string };

/**
 * `etat.txt` : exactement deux lignes. 1re : `ok`, `refus` ou `panne` ; 2e : un code de la liste fermée.
 * `ok` va avec le code `OK` et seulement lui. Tout le reste est refusé.
 */
export function lireEtat(texte: unknown): LectureEtat {
  if (typeof texte !== "string") return { ok: false, raison: "État illisible." };
  const lignes = texte.replace(/\n$/, "").split("\n");
  if (lignes.length !== 2) return { ok: false, raison: "L'état doit tenir en deux lignes." };
  const [statut, code] = lignes as [string, string];
  if (!(STATUTS_REPONSE as readonly string[]).includes(statut)) return { ok: false, raison: "Statut inconnu." };
  if (!estCodeReponse(code)) return { ok: false, raison: "Code inconnu." };
  if ((statut === "ok") !== (code === "OK")) return { ok: false, raison: "Statut et code incohérents." };
  return { ok: true, statut: statut as StatutReponse, code };
}

// --- film ---------------------------------------------------------------------------------------------------------------

/**
 * Ce qu'encode `capturer.mts` (outils/maquettes-tableaux-de-bord/capture/) : pages à `deviceScaleFactor: 2`, PNG envoyés tels
 * quels à ffmpeg SANS mise à l'échelle (`argumentsEncodage` de `capture/film-images.ts` : `-c:v libx264 -pix_fmt yuv420p`, `-r 25`, `-an`).
 */
export const CODEC_FILM = "h264";
export const FACTEUR_ECHELLE_FILM = 2;
export const IMAGES_PAR_SECONDE_FILM = 25;
export const TOLERANCE_DUREE_FILM_MS = 1000;

/** Dimensions du film attendues pour un scénario `largeur` × `hauteur` (en pixels CSS de la maquette). */
export const dimensionsFilm = (largeur: number, hauteur: number): { largeur: number; hauteur: number } => ({
  largeur: largeur * FACTEUR_ECHELLE_FILM,
  hauteur: hauteur * FACTEUR_ECHELLE_FILM,
});

export interface AttenduFilm {
  dureeMs: number;
  largeur: number;
  hauteur: number;
}
export type VerdictFfprobe = { ok: true; dureeMs: number } | { ok: false; raisons: string[] };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Juge un `ffprobe.json` (`-show_streams -show_format`, forme JSON) : un SEUL flux, vidéo, h264, aux dimensions attendues,
 * durée du conteneur égale à `dureeMs` à ± 1 s. Accepte le texte ou l'objet ; ne lève jamais.
 */
export function jugerFfprobe(brut: unknown, attendu: AttenduFilm): VerdictFfprobe {
  const raisons: string[] = [];
  let j: unknown = brut;
  try {
    if (typeof brut === "string") j = JSON.parse(brut);
  } catch {
    return { ok: false, raisons: ["Le relevé du film est illisible."] };
  }
  if (!estObjet(j)) return { ok: false, raisons: ["Le relevé du film est illisible."] };
  const flux = Array.isArray(j.streams) ? j.streams : [];
  if (flux.length !== 1 || !estObjet(flux[0])) raisons.push("Le film doit contenir un seul flux, vidéo.");
  const f = estObjet(flux[0]) ? flux[0] : {};
  if (flux.length >= 1) {
    if (f.codec_type !== "video") raisons.push("Le flux n'est pas une vidéo.");
    if (f.codec_name !== CODEC_FILM) raisons.push("Le codec du film n'est pas celui attendu.");
    if (f.width !== attendu.largeur || f.height !== attendu.hauteur) raisons.push("Les dimensions du film ne sont pas celles attendues.");
  }
  const format = estObjet(j.format) ? j.format : {};
  const secondes = typeof format.duration === "string" || typeof format.duration === "number" ? Number(format.duration) : Number.NaN;
  const dureeMs = Number.isFinite(secondes) ? secondes * 1000 : Number.NaN;
  if (!Number.isFinite(dureeMs) || dureeMs < 0) raisons.push("La durée du film est illisible.");
  else if (Math.abs(dureeMs - attendu.dureeMs) > TOLERANCE_DUREE_FILM_MS) raisons.push("La durée du film ne correspond pas à celle attendue.");
  return raisons.length === 0 ? { ok: true, dureeMs } : { ok: false, raisons };
}

/** Signature du MP4 : « ftyp » aux octets 4 à 7 (mêmes 16 premiers octets que `estLeBonFilm` du dépôt manuel). */
export function signatureMp4(debut: Uint8Array): boolean {
  return debut.length >= 8 && debut[4] === 0x66 && debut[5] === 0x74 && debut[6] === 0x79 && debut[7] === 0x70;
}

// --- phrases pour Williams ----------------------------------------------------------------------------------------------

/** Une phrase claire par code : jamais le journal brut, jamais de montant, pas de jargon. */
export const PHRASES_CODE: Record<CodeReponse, string> = {
  OK: "Le film de la maquette est prêt.",
  DEMANDE_INVALIDE: "La demande de capture n'a pas été comprise par le poste de capture : déposez le film à la main.",
  ZIP_REFUSE: "Le dossier envoyé n'a pas pu être ouvert sur le poste de capture : vérifiez qu'il contient un index.html, ou déposez le film à la main.",
  MAQUETTE_INTROUVABLE: "Le dossier envoyé ne contient pas une maquette claire (un seul index.html à la racine) : corrigez le dossier, ou déposez le film à la main.",
  CONTROLE_SOURCE: "Le dossier envoyé contient des éléments que le poste de capture refuse d'ouvrir : déposez le film à la main.",
  TROP_GROS: "Le dossier envoyé est trop volumineux pour le poste de capture : allégez-le, ou déposez le film à la main.",
  CAPTURE_ECHEC: "Le poste de capture n'a pas réussi à filmer la maquette : déposez le film à la main.",
  DUREE_DEPASSEE: "Le poste de capture a mis trop de temps et a été arrêté : déposez le film à la main.",
  FILM_INVALIDE: "Le film rendu par le poste de capture n'a pas passé les contrôles : déposez le film à la main.",
  EMPREINTE: "La pièce à construire ne correspond plus à ce qui avait été validé : reprenez la validation.",
  INTERROMPU: "Le poste de capture a été interrompu pendant le travail : la capture sera retentée ou déposez le film à la main.",
  POSTE_OCCUPE: "Le poste de capture était déjà occupé : rien n'a été lancé, la capture sera retentée plus tard.",
};
export const PHRASE_POSTE_ETEINT = "Le poste de capture n'est pas allumé : la vidéo attend, rien n'a échoué.";
export const PHRASE_BOITE_NON_PRETE = "La boîte du poste de capture n'est pas prête : la vidéo attend, rien n'a échoué.";
export const PHRASE_SANS_REPONSE = "Le poste de capture ne répond plus : déposez le film à la main.";
