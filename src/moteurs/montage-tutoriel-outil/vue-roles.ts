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
const CODE_DEVIS_A_ACCEPTER = "TO_DEVIS_A_ACCEPTER";
const CODE_DEVIS_ATTEINT = "TO_DEVIS_ATTEINT";
const CODE_OUTILS_NON_RELIES = "TO_OUTILS_NON_RELIES";
const CODES_SCRIPT_A_FAIRE = ["TO_SCRIPT_A_VALIDER", "TO_SCRIPT_ABSENT"];

export const PHRASE_DEVIS_A_ACCEPTER = "Le devis attend votre accord.";
export const PHRASE_DEVIS_ATTEINT = "Le devis de cette vidéo est atteint : rien de plus n'est lancé sans votre accord.";
export const PHRASE_OUTILS_ATTENDUS = "En attente des outils de fabrication : rien n'a échoué.";

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

function pauseDe(travail: TravailPourVue): { code: string } | null {
  const p = (travail.parametres as { pause?: { code?: unknown } } | undefined)?.pause;
  return p && typeof p.code === "string" ? { code: p.code } : null;
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
  if (CODES_SCRIPT_A_FAIRE.includes(pause.code)) remplacer("scenariste", "attend-williams");
  else if (pause.code === CODE_DEVIS_A_ACCEPTER) remplacer("chef-de-projet", "attend-williams", PHRASE_DEVIS_A_ACCEPTER);
  else if (pause.code === CODE_DEVIS_ATTEINT) remplacer("chef-de-projet", "attend-williams", PHRASE_DEVIS_ATTEINT);
  else if (pause.code === CODE_OUTILS_NON_RELIES) remplacer("chef-de-projet", "a-venir", PHRASE_OUTILS_ATTENDUS);
  return lignes;
}

/** La grille est proposable à Williams tant qu'aucun contrôleur ni regardeur n'a trouvé un point à revoir. */
export function grilleProposable(travail: TravailPourVue): boolean {
  return !vueRoles(travail).some((l) => (l.role === "controleur" || l.role === "regardeur") && l.etat === "a-revoir");
}
