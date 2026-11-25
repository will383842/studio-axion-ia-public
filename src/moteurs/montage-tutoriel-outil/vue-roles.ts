/**
 * T-EXT-34 · VUE DES RÔLES (pure) : l'état d'un travail → les 10 lignes de l'écran « Suivi de fabrication ».
 * Avec un journal (`journal-roles.ts`), les lignes en viennent ; sans journal (master aujourd'hui), elles se déduisent des
 * étapes du moteur : « script » → Scénariste, « calage » et « plan » → Réalisateur. La voix, le montage et les formats
 * ne sont pas des rôles : le suivi général les montre au-dessus. Les pauses du moteur se lisent aussi.
 * Mots simples, vouvoiement, aucun mot technique, aucun montant.
 */
import type { Travail } from "@/domaine/types";
import { lireJournalRoles, ROLES, type EtatRole, type IdRole, type LigneJournal } from "./journal-roles";

export interface LigneRole {
  role: IdRole;
  libelle: string;
  etat: EtatRole;
  /** Une phrase d'état, sans mot technique. */
  phrase: string;
  /** Ce que le rôle a noté lui-même (journal), 120 caractères au plus. */
  detail?: string;
  /** Williams doit agir : la ligne peut porter « Voir et valider ». */
  attendWilliams: boolean;
}

export type TravailPourVue = Pick<Travail, "etapes" | "statut"> & Partial<Pick<Travail, "parametres">>;

interface Parole {
  libelle: string;
  /** « Le chef de projet » (sujet de la phrase). */
  sujet: string;
  enCours: string;
  fait: string;
  attend: string;
}

const PAROLES: Record<IdRole, Parole> = {
  "chef-de-projet": { libelle: "Chef de projet", sujet: "Le chef de projet", enCours: "classe votre demande", fait: "a classé votre demande", attend: "attend votre accord" },
  analyste: { libelle: "Analyste", sujet: "L'analyste", enCours: "étudie votre demande", fait: "a étudié votre demande", attend: "attend votre réponse" },
  maquettiste: { libelle: "Maquettiste", sujet: "Le maquettiste", enCours: "prépare la maquette", fait: "a préparé la maquette", attend: "attend que vous validiez la maquette" },
  stratege: { libelle: "Stratège de valeur", sujet: "Le stratège de valeur", enCours: "cherche ce que la vidéo vous apporte", fait: "a trouvé ce que la vidéo vous apporte", attend: "attend votre choix" },
  scenariste: { libelle: "Scénariste", sujet: "Le scénariste", enCours: "écrit le script", fait: "a écrit le script", attend: "attend votre choix" },
  realisateur: { libelle: "Réalisateur", sujet: "Le réalisateur", enCours: "découpe la vidéo en scènes", fait: "a découpé la vidéo en scènes", attend: "attend votre accord" },
  "directeur-motion": { libelle: "Directeur motion", sujet: "Le directeur motion", enCours: "prépare les mouvements", fait: "a préparé les mouvements", attend: "attend votre accord" },
  controleur: { libelle: "Contrôleur", sujet: "Le contrôleur", enCours: "contrôle la vidéo", fait: "a contrôlé la vidéo", attend: "attend votre accord" },
  regardeur: { libelle: "Regardeur", sujet: "Le regardeur", enCours: "regarde la vidéo", fait: "a regardé la vidéo", attend: "attend votre accord" },
  documentaliste: { libelle: "Documentaliste", sujet: "Le documentaliste", enCours: "range les pièces de la vidéo", fait: "a rangé les pièces de la vidéo", attend: "attend votre accord" },
};

export const PHRASE_SAUTE = "Pas nécessaire : votre dossier était complet.";

export const PHRASE_DEVIS_A_ACCEPTER = "Le devis attend votre accord.";
export const PHRASE_DEVIS_ATTEINT = "Le devis de cette vidéo est atteint : rien de plus n'est lancé sans votre accord.";
export const PHRASE_OUTILS_ATTENDUS = "En attente des outils de fabrication : rien n'a échoué.";
export const PHRASE_FILM_A_CAPTURER = "Le film de navigation attend d'être déposé : rien n'a échoué.";
export const PHRASE_SCRIPT_NON_ECRIT = "Le script attend votre texte : collez-le, la vidéo reprend.";
export const PHRASE_DOSSIER_INCOMPLET = "Votre dossier n'est pas encore lisible : la vidéo reprend dès qu'il l'est.";
export const PHRASE_DEMANDE_VIDE = "Votre demande est trop courte : précisez-la pour que la vidéo démarre.";
export const PHRASE_DEMANDE_ARRETEE = "Cette demande a été arrêtée : rien de plus n'est lancé.";
/** Phrase de repli (rôle inconnu). Aucun geste ne relance un rôle arrêté : la phrase ne dit donc jamais « réessayez ». */
export const PHRASE_EQUIPE_BLOQUEE = "Une étape de préparation n'a pas abouti et cette demande ne repart pas seule : collez votre script pour une nouvelle demande.";
/** Ce qui s'est passé, rôle par rôle (jamais un mot technique ni un montant). */
export const CAUSE_PAR_ROLE: Partial<Record<IdRole, string>> = {
  "chef-de-projet": "Le classement de votre demande n'a pas abouti : rien d'autre n'a été dépensé.",
  analyste: "L'étude de votre demande n'a pas donné de résultat utilisable : rien d'autre n'a été dépensé.",
  maquettiste: "La maquette proposée n'avait pas la forme attendue : rien d'autre n'a été dépensé.",
  stratege: "La recherche de ce que la vidéo vous apporte n'a pas donné de résultat utilisable : rien d'autre n'a été dépensé.",
  scenariste: "Le script proposé n'avait pas la forme attendue : rien d'autre n'a été dépensé.",
  realisateur: "Le découpage de la vidéo en scènes n'a pas pu se faire.",
};
const SUITE_BLOQUEE = " Cette demande ne repart pas seule : collez votre script pour une nouvelle demande.";
export const PHRASE_PIECE_A_CONSTRUIRE = "La pièce de la vidéo se prépare.";
export const PHRASE_PIECE_A_VALIDER = "La pièce de la vidéo attend votre accord.";
export const PHRASE_PIECE_A_REVOIR = "La pièce de la vidéo a un point à revoir : elle attend votre avis.";

/** Les codes de pause du moteur que l'écran sait lire (T-EXT-42 pose les deux premiers), un à un : quel rôle parle, dans quel état, avec quelle phrase (`undefined` : phrase du rôle). */
const PAUSES_CONNUES: Record<string, { role: IdRole; etat: EtatRole; phrase?: string; /** Phrase = message posé par le moteur (variable selon le cas). */ phraseDuMoteur?: true; /** L'écran de validation sait servir cette pause : « Voir et valider » y mène. */ lien?: "validation" }> = {
  TO_SCRIPT_A_VALIDER: { role: "scenariste", etat: "attend-williams", lien: "validation" },
  TO_SCRIPT_ABSENT: { role: "scenariste", etat: "attend-williams" },
  TO_SCRIPT_NON_ECRIT: { role: "scenariste", etat: "attend-williams", phrase: PHRASE_SCRIPT_NON_ECRIT },
  TO_DEVIS_A_ACCEPTER: { role: "chef-de-projet", etat: "attend-williams", phrase: PHRASE_DEVIS_A_ACCEPTER, lien: "validation" },
  TO_DEVIS_ATTEINT: { role: "chef-de-projet", etat: "attend-williams", phrase: PHRASE_DEVIS_ATTEINT, lien: "validation" },
  TO_OUTILS_NON_RELIES: { role: "chef-de-projet", etat: "a-venir", phrase: PHRASE_OUTILS_ATTENDUS },
  TO_FILM_A_CAPTURER: { role: "documentaliste", etat: "a-venir", phrase: PHRASE_FILM_A_CAPTURER, lien: "validation" },
  TO_DOSSIER_INCOMPLET: { role: "documentaliste", etat: "a-venir", phrase: PHRASE_DOSSIER_INCOMPLET },
  TO_DEMANDE_VIDE: { role: "chef-de-projet", etat: "attend-williams", phrase: PHRASE_DEMANDE_VIDE },
  TO_DEMANDE_ARRETEE: { role: "chef-de-projet", etat: "a-venir", phrase: PHRASE_DEMANDE_ARRETEE },
  TO_EQUIPE_BLOQUEE: { role: "chef-de-projet", etat: "a-revoir", phrase: PHRASE_EQUIPE_BLOQUEE },
  TO_CAS_V2: { role: "chef-de-projet", etat: "attend-williams", phraseDuMoteur: true },
  TO_PIECE_A_CONSTRUIRE: { role: "maquettiste", etat: "en-cours", phrase: PHRASE_PIECE_A_CONSTRUIRE },
  TO_PIECE_A_VALIDER: { role: "maquettiste", etat: "attend-williams", phrase: PHRASE_PIECE_A_VALIDER },
  TO_PIECE_A_REVOIR: { role: "maquettiste", etat: "attend-williams", phrase: PHRASE_PIECE_A_REVOIR },
};

function phraseDe(role: IdRole, etat: EtatRole): string {
  const p = PAROLES[role];
  switch (etat) {
    case "a-venir":
      return `${p.sujet} n'a pas encore commencé.`;
    case "en-cours":
      return `${p.sujet} ${p.enCours}.`;
    case "attend-williams":
      return `${p.sujet} ${p.attend}.`;
    case "fait":
      return `${p.sujet} ${p.fait}.`;
    case "a-revoir":
      return `${p.sujet} a trouvé un point à revoir.`;
    case "saute":
      return PHRASE_SAUTE;
  }
}

function ligne(role: IdRole, etat: EtatRole, phrase?: string, detail?: string): LigneRole {
  return { role, libelle: PAROLES[role].libelle, etat, phrase: phrase ?? phraseDe(role, etat), ...(detail ? { detail } : {}), attendWilliams: etat === "attend-williams" };
}

/** Le rôle arrêté : celui dont la DERNIÈRE ligne du journal est « à revoir » et qui est le plus récent. */
function roleBloque(travail: TravailPourVue): IdRole | null {
  const roles = ((travail.parametres as { tutoriel?: { roles?: unknown } } | undefined)?.tutoriel?.roles ?? []) as unknown;
  if (!Array.isArray(roles)) return null;
  const vus = new Set<string>();
  for (let i = roles.length - 1; i >= 0; i--) {
    const l = roles[i] as { role?: unknown; etat?: unknown } | null;
    if (!l || typeof l.role !== "string" || !(ROLES as readonly string[]).includes(l.role) || vus.has(l.role)) continue;
    vus.add(l.role);
    if (l.etat === "a-revoir") return l.role as IdRole;
  }
  return null;
}

/** Ce qui s'est passé quand l'équipe est arrêtée, en une phrase simple. La raison du réalisateur, entre parenthèses dans le message du moteur, est reprise. */
export function causeEquipeBloquee(travail: TravailPourVue): string {
  const message = pauseDe(travail)?.message ?? "";
  const raison = /\(([^()]+)\)\s*$/.exec(message)?.[1]?.trim().replace(/[.\s]+$/, "");
  if (raison) return `${CAUSE_PAR_ROLE.realisateur} Raison : ${raison}.${SUITE_BLOQUEE}`;
  const role = roleBloque(travail);
  const cause = role ? CAUSE_PAR_ROLE[role] : undefined;
  return cause ? `${cause}${SUITE_BLOQUEE}` : PHRASE_EQUIPE_BLOQUEE;
}

function pauseDe(travail: TravailPourVue): { code: string; message?: string } | null {
  const p = (travail.parametres as { pause?: { code?: unknown; message?: unknown } } | undefined)?.pause;
  if (!p || typeof p.code !== "string") return null;
  const message = typeof p.message === "string" && p.message.trim() ? p.message.trim() : undefined;
  return { code: p.code, ...(message ? { message } : {}) };
}

/** Le message de la pause en cours (celui que le moteur a posé), pour l'afficher tel quel ; `null` s'il n'y a pas de pause ou pas de message. */
export function messageDePause(travail: TravailPourVue): string | null {
  return pauseDe(travail)?.message ?? null;
}

/** Vrai si la pause en cours est de celles que l'écran de validation sert : « Voir et valider » peut alors y mener. */
export function pauseALienValidation(travail: TravailPourVue): boolean {
  const p = pauseDe(travail);
  return !!p && PAUSES_CONNUES[p.code]?.lien === "validation";
}

/**
 * Où mène « Voir et valider » pour l'état courant du travail (calculé à chaque rafraîchissement, jamais figé au rendu serveur) :
 * maquettiste qui attend Williams ou à revoir → « Votre maquette » ; sinon pause que l'écran de validation sert → cet écran ; sinon aucun lien.
 */
export function lienDeSuivi(travail: TravailPourVue, videoId: string): string | undefined {
  const maquette = vueRoles(travail).find((l) => l.role === "maquettiste");
  // « À revoir » sans pièce proposée : la page maquette n'aurait rien à montrer, le lien n'est pas proposé (l'arrêt se lit sur le suivi).
  if (maquette && (maquette.etat === "attend-williams" || (maquette.etat === "a-revoir" && aUnePiece(travail)))) return `/tutoriel-outil/maquette/${videoId}`;
  return pauseALienValidation(travail) ? `/tutoriel-outil/${videoId}` : undefined;
}

/** État d'un groupe d'étapes du moteur (absentes du travail : ignorées ; aucune présente : « à venir »). */
function etatDesEtapes(travail: TravailPourVue, cles: string[]): EtatRole {
  const e = travail.etapes.filter((x) => cles.includes(x.cle));
  if (!e.length) return "a-venir";
  if (e.some((x) => x.statut === "echec")) return "a-revoir";
  if (e.every((x) => x.statut === "terminee" || x.statut === "ignoree")) return "fait";
  if (e.some((x) => x.statut === "en_cours" || x.statut === "terminee")) return "en-cours";
  return "a-venir";
}

function deduire(travail: TravailPourVue): LigneJournal[] {
  const le = "";
  const etat = (role: IdRole, e: EtatRole): LigneJournal => ({ role, etat: e, le });
  return [etat("scenariste", etatDesEtapes(travail, ["script"])), etat("realisateur", etatDesEtapes(travail, ["calage", "plan"]))];
}

export function vueRoles(travail: TravailPourVue): LigneRole[] {
  const journal = lireJournalRoles(travail.parametres);
  const notes = new Map<IdRole, LigneJournal>((journal.length ? journal : deduire(travail)).map((l) => [l.role, l]));
  const lignes = ROLES.map((r) => {
    const n = notes.get(r);
    return ligne(r, n?.etat ?? "a-venir", undefined, n?.resume);
  });
  const pause = pauseDe(travail);
  if (!pause) return lignes;
  const remplacer = (role: IdRole, etat: EtatRole, phrase?: string) => {
    const i = ROLES.indexOf(role);
    lignes[i] = ligne(role, etat, phrase, lignes[i].detail);
  };
  const connue = PAUSES_CONNUES[pause.code];
  // Équipe arrêtée : la phrase se pose sur la ligne du rôle qui a vraiment échoué (sinon sur le chef de projet).
  if (pause.code === "TO_EQUIPE_BLOQUEE") remplacer(roleBloque(travail) ?? "chef-de-projet", "a-revoir", causeEquipeBloquee(travail));
  else if (connue) remplacer(connue.role, connue.etat, connue.phraseDuMoteur ? pause.message : connue.phrase);
  // Code inconnu : on montre le message du moteur plutôt que rien.
  else if (pause.message) remplacer("chef-de-projet", "a-venir", pause.message);
  return lignes;
}

/** La grille est proposable à Williams tant qu'aucun contrôleur ni regardeur n'a trouvé un point à revoir. */
export function grilleProposable(travail: TravailPourVue): boolean {
  return !vueRoles(travail).some((l) => (l.role === "controleur" || l.role === "regardeur") && l.etat === "a-revoir");
}

/* ------------------------------------------------------------------ */
/* Arrêt lisible : la cause et les boutons honnêtes                     */
/* ------------------------------------------------------------------ */

export interface BoutonArret {
  genre: "voir-maquette" | "voir-et-valider" | "coller-script" | "refaire-demande";
  libelle: string;
  href: string;
}

export interface ArretLisible {
  code: string;
  /** Une phrase simple : ce qui s'est passé ou ce qu'on attend de Williams. */
  cause: string;
  /** Remarques brutes du lecteur (3 au plus, 120 caractères), pour le détail repliable « Ce qui a été relevé ». */
  releves: string[];
  boutons: BoutonArret[];
  /** Rien ne tourne : la barre dit « En pause » au lieu d'un temps restant. */
  enPause: boolean;
}

const RELEVES_MAX = 3;
const RELEVE_LONGUEUR = 120;
const LIBELLE_VOIR_MAQUETTE = "Voir la maquette";

/** Une pièce a été proposée par le maquettiste (« Voir la maquette » a quelque chose à montrer). */
function aUnePiece(travail: TravailPourVue): boolean {
  const equipe = (travail.parametres as { tutoriel?: { equipe?: { pieceCreee?: unknown } } } | undefined)?.tutoriel?.equipe;
  return !!equipe && typeof equipe.pieceCreee === "object" && equipe.pieceCreee !== null;
}

/** Remarques du rôle arrêté, nettoyées : textes seulement, jamais de montant, jamais d'objet. */
function relevesDe(travail: TravailPourVue, role: IdRole | null): string[] {
  if (!role) return [];
  const brutes = (travail.parametres as { tutoriel?: { equipe?: { remarques?: Record<string, unknown> } } } | undefined)?.tutoriel?.equipe?.remarques?.[role];
  if (!Array.isArray(brutes)) return [];
  return brutes
    .filter((r): r is string => typeof r === "string" && !!r.trim() && !/[€$]|\b(usd|eur|euros?|dollars?)\b/i.test(r))
    .map((r) => r.replace(/\s+/g, " ").trim().slice(0, RELEVE_LONGUEUR))
    .slice(0, RELEVES_MAX);
}

/**
 * L'arrêt du tutoriel en clair (PUR) : la cause, ce que l'équipe a relevé et les seuls boutons qui servent. « Réessayer » n'en
 * fait jamais partie : un travail en pause ne rejoue pas son rôle (seule une panne, travail en échec, a son bouton « Réessayer »).
 * `null` s'il n'y a pas de pause.
 */
export function arretLisible(travail: TravailPourVue, videoId: string): ArretLisible | null {
  const pause = pauseDe(travail);
  if (!pause) return null;
  const connue = PAUSES_CONNUES[pause.code];
  const maquette: BoutonArret = { genre: "voir-maquette", libelle: LIBELLE_VOIR_MAQUETTE, href: `/tutoriel-outil/maquette/${videoId}` };
  const valider: BoutonArret = { genre: "voir-et-valider", libelle: "Voir et valider", href: `/tutoriel-outil/${videoId}` };
  const coller: BoutonArret = { genre: "coller-script", libelle: "Coller mon script", href: "/tutoriel-outil" };
  const refaire: BoutonArret = { genre: "refaire-demande", libelle: "Préciser ma demande", href: "/tutoriel-outil" };
  const fait = (cause: string, boutons: BoutonArret[], releves: string[] = [], enPause = true): ArretLisible => ({ code: pause.code, cause, releves, boutons, enPause });
  switch (pause.code) {
    case "TO_EQUIPE_BLOQUEE":
      return fait(causeEquipeBloquee(travail), [...(aUnePiece(travail) ? [maquette] : []), coller], relevesDe(travail, roleBloque(travail)));
    case "TO_PIECE_A_VALIDER":
    case "TO_PIECE_A_REVOIR":
      return fait(connue!.phrase!, [maquette]);
    case "TO_PIECE_A_CONSTRUIRE":
      return fait(connue!.phrase!, [], [], false);
    case "TO_SCRIPT_A_VALIDER":
      return fait(pause.message ?? "Le script attend votre choix.", [valider]);
    case "TO_SCRIPT_ABSENT":
      return fait("Le script n'est pas encore là : collez-le, la vidéo reprend.", [coller]);
    case "TO_SCRIPT_NON_ECRIT":
      return fait(PHRASE_SCRIPT_NON_ECRIT, [coller]);
    case "TO_DEVIS_A_ACCEPTER":
      return fait(PHRASE_DEVIS_A_ACCEPTER, [valider]);
    case "TO_DEVIS_ATTEINT":
      return fait(PHRASE_DEVIS_ATTEINT, [valider]);
    case "TO_FILM_A_CAPTURER":
      return fait(PHRASE_FILM_A_CAPTURER, [valider]);
    case "TO_DEMANDE_VIDE":
      return fait(PHRASE_DEMANDE_VIDE, [refaire]);
    case "TO_DOSSIER_INCOMPLET":
      return fait(pause.message ?? PHRASE_DOSSIER_INCOMPLET, []);
    default:
      // Autres pauses connues (outils, demande arrêtée, cas à trancher) ou inconnues : la phrase, sans bouton inventé.
      return fait(connue?.phrase ?? pause.message ?? "La vidéo est en pause.", []);
  }
}

/** Vrai quand la barre doit dire « En pause » : une pause où rien ne tourne (la pièce « se prépare » n'en est pas une). */
export function estEnPause(travail: TravailPourVue): boolean {
  return arretLisible(travail, "x")?.enPause === true;
}
