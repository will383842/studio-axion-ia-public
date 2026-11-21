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

/** Codes de pause du moteur que l'écran sait lire (T-EXT-42 pose les deux premiers). */

export const PHRASE_DEVIS_A_ACCEPTER = "Le devis attend votre accord.";
export const PHRASE_DEVIS_ATTEINT = "Le devis de cette vidéo est atteint : rien de plus n'est lancé sans votre accord.";
export const PHRASE_OUTILS_ATTENDUS = "En attente des outils de fabrication : rien n'a échoué.";
export const PHRASE_FILM_A_CAPTURER = "Le film de navigation attend d'être déposé : rien n'a échoué.";
export const PHRASE_SCRIPT_NON_ECRIT = "Le script attend votre texte : collez-le, la vidéo reprend.";
export const PHRASE_DOSSIER_INCOMPLET = "Votre dossier n'est pas encore lisible : la vidéo reprend dès qu'il l'est.";
export const PHRASE_DEMANDE_VIDE = "Votre demande est trop courte : précisez-la pour que la vidéo démarre.";
export const PHRASE_DEMANDE_ARRETEE = "Cette demande a été arrêtée : rien de plus n'est lancé.";
export const PHRASE_EQUIPE_BLOQUEE = "Une étape de préparation n'a pas abouti : réessayez ou collez votre script.";
export const PHRASE_PIECE_A_CONSTRUIRE = "La pièce de la vidéo se prépare.";
export const PHRASE_PIECE_A_VALIDER = "La pièce de la vidéo attend votre accord.";
export const PHRASE_PIECE_A_REVOIR = "La pièce de la vidéo a un point à revoir : elle attend votre avis.";

/** Les codes de pause du tutoriel, un à un : quel rôle parle, dans quel état, avec quelle phrase (`undefined` : phrase du rôle). */
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

/** Vrai si la pause attend un geste de Williams (l'écran de validation est alors le bon lien). */
export function pauseAttendWilliams(travail: TravailPourVue): boolean {
  const p = pauseDe(travail);
  return !!p && PAUSES_CONNUES[p.code]?.etat === "attend-williams";
}

/** Vrai si la pause en cours est de celles que l'écran de validation sert : « Voir et valider » peut alors y mener. */
export function pauseALienValidation(travail: TravailPourVue): boolean {
  const p = pauseDe(travail);
  return !!p && PAUSES_CONNUES[p.code]?.lien === "validation";
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
  if (connue) remplacer(connue.role, connue.etat, connue.phraseDuMoteur ? pause.message : connue.phrase);
  // Code inconnu : on montre le message du moteur plutôt que rien.
  else if (pause.message) remplacer("chef-de-projet", "a-venir", pause.message);
  return lignes;
}

/** La grille est proposable à Williams tant qu'aucun contrôleur ni regardeur n'a trouvé un point à revoir. */
export function grilleProposable(travail: TravailPourVue): boolean {
  return !vueRoles(travail).some((l) => (l.role === "controleur" || l.role === "regardeur") && l.etat === "a-revoir");
}
