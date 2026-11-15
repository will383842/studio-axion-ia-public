/**
 * RC-25 — « Valeur d'abord » : contrôle de la porte L1-08 (fonction pure).
 * Produit des AVERTISSEMENTS (jamais un blocage). Une exception motivée peut les lever ;
 * elle est alors journalisée (entrée de journal renvoyée, rien n'est supprimé).
 * Aucun appel réel, aucune écriture.
 */

/**
 * HYPOTHESE : valeurs de la recommandation du dossier, en attente de la décision D-4.
 * Elles ne sont pas une décision : à modifier ici seulement, après arbitrage du fondateur.
 */
export const HYPOTHESE_D4 = {
  /** Fenêtre en nombre de publications (la plus stricte des deux fenêtres gagne). */
  fenetrePublications: 20,
  /** Fenêtre en jours glissants. */
  fenetreJours: 30,
  /** Offres max sur les comptes du fondateur. */
  fondateurMaxOffres: 1,
  /** Offres max sur les pages. */
  pageMaxOffres: 3,
  /** Offres max sur groupe, lettre, podcast. */
  autreMaxOffres: 0,
  /** Jamais 2 offres de suite sur un compte du fondateur. */
  interdireOffresDeSuiteFondateur: true,
  /** Extension aux pages : proposée, à confirmer dans D-4. */
  interdireOffresDeSuitePage: false,
} as const;

export type FamilleCompte = "fondateur" | "page" | "autre";
export type NaturePublication = "offre" | "valeur";

export type PublicationValeur = {
  readonly id: string;
  readonly compte: string;
  readonly famille: FamilleCompte;
  /** Jour AAAA-MM-JJ. */
  readonly jour: string;
  readonly nature: NaturePublication;
};

export type ExceptionMotivee = {
  readonly motif: string;
  readonly par: string;
  readonly date: string;
};

export type CodeAvertissement = "trop-d-offres" | "offres-de-suite";

export type AvertissementValeur = {
  readonly code: CodeAvertissement;
  readonly message: string;
  readonly leveeParException: boolean;
};

export type EntreeJournalException = {
  readonly publicationId: string;
  readonly compte: string;
  readonly codes: readonly CodeAvertissement[];
  readonly motif: string;
  readonly par: string;
  readonly date: string;
};

export type ResultatValeurDAbord = {
  readonly avertissements: readonly AvertissementValeur[];
  readonly journal: readonly EntreeJournalException[];
  readonly exceptionRefusee: boolean;
  /** Toujours faux : la règle avertit, elle ne bloque pas. */
  readonly bloquant: false;
};

const JOUR_MS = 86_400_000;
const ms = (jour: string) => Date.parse(`${jour}T00:00:00Z`);

function maxOffres(famille: FamilleCompte): number {
  if (famille === "fondateur") return HYPOTHESE_D4.fondateurMaxOffres;
  if (famille === "page") return HYPOTHESE_D4.pageMaxOffres;
  return HYPOTHESE_D4.autreMaxOffres;
}

function deSuiteInterdit(famille: FamilleCompte): boolean {
  if (famille === "fondateur") return HYPOTHESE_D4.interdireOffresDeSuiteFondateur;
  if (famille === "page") return HYPOTHESE_D4.interdireOffresDeSuitePage;
  return false;
}

export function verifierValeurDAbord(
  historique: readonly PublicationValeur[],
  candidate: PublicationValeur,
  exception?: ExceptionMotivee,
): ResultatValeurDAbord {
  const sans = { avertissements: [], journal: [], exceptionRefusee: false, bloquant: false } as const;
  if (candidate.nature !== "offre") return sans;

  const duCompte = historique
    .filter((p) => p.compte === candidate.compte)
    .sort((a, b) => ms(a.jour) - ms(b.jour));

  // Fenêtre la plus stricte : les 19 dernières + la candidate = 20 ; et 30 jours glissants.
  const parNombre = duCompte.slice(-(HYPOTHESE_D4.fenetrePublications - 1));
  const limiteJour = ms(candidate.jour) - HYPOTHESE_D4.fenetreJours * JOUR_MS;
  const parJours = duCompte.filter((p) => ms(p.jour) > limiteJour);
  const fenetre = parNombre.filter((p) => parJours.includes(p));
  const offres = fenetre.filter((p) => p.nature === "offre").length;

  const bruts: { code: CodeAvertissement; message: string }[] = [];
  const max = maxOffres(candidate.famille);
  if (offres + 1 > max) {
    bruts.push({
      code: "trop-d-offres",
      message: `Cette offre porterait à ${offres + 1} les offres récentes sur ${candidate.compte} (au plus ${max}).`,
    });
  }
  const derniere = duCompte[duCompte.length - 1];
  if (deSuiteInterdit(candidate.famille) && derniere?.nature === "offre") {
    bruts.push({ code: "offres-de-suite", message: `Deux offres de suite sur ${candidate.compte}.` });
  }
  if (bruts.length === 0) return sans;

  const motif = exception?.motif.trim() ?? "";
  const valide = exception !== undefined && motif.length > 0;
  const avertissements = bruts.map((b) => ({ ...b, leveeParException: valide }));
  const journal: EntreeJournalException[] = valide
    ? [{ publicationId: candidate.id, compte: candidate.compte, codes: bruts.map((b) => b.code), motif, par: exception.par, date: exception.date }]
    : [];
  return { avertissements, journal, exceptionRefusee: exception !== undefined && !valide, bloquant: false };
}
