/**
 * LE RETOUR FERME D'ABORD LA FEUILLE (vérification de la navigation, 03/10/2026 ; E2E-2 parcours n° 24).
 *
 * Avant : une feuille (ou une fenêtre) ouverte, le geste « retour » du téléphone quittait la PAGE, avec la saisie.
 * Maintenant : à l'ouverture, une entrée est ajoutée à l'historique, à la MÊME adresse (l'état de Next est recopié,
 * le routeur n'y voit qu'un retour sur la même page). Le retour retire cette entrée : la feuille se ferme, la page reste.
 *
 * La difficulté : une feuille fermée À L'ÉCRAN (OK, glissé, lien suivi depuis la feuille) laisse son entrée derrière
 * elle. On ne la retire PAS tout de suite (`history.back()` pendant une navigation lancée depuis la feuille l'annulerait,
 * c'est ce qui avait fait renoncer au correctif en E2E-2). On la note « orpheline » : au retour suivant, si l'on
 * retombe sur la même adresse sans rien de neuf, le retour est REJOUÉ une fois, pour ne jamais « rien faire ».
 *
 * PUR : l'historique et l'adresse sont injectés (tests sans navigateur). Un seul gardien par onglet (`gardeRetour()`).
 */

export const CLE_FEUILLE = "__feuilleStudio";

export interface HistoriqueMinimal {
  readonly state: unknown;
  pushState(etat: unknown, titre: string, adresse?: string): void;
  back(): void;
}

export interface GardeRetour {
  /** Une feuille s'ouvre : `fermer` sera appelé si le retour du navigateur arrive pendant qu'elle est ouverte. */
  ouvrir(id: string, fermer: () => void): void;
  /** La feuille s'est fermée autrement que par le retour (OK, glissé, lien, démontage). Sans effet si déjà retirée. */
  fermeParEcran(id: string): void;
  /** À brancher sur l'événement `popstate`. */
  surRetour(): void;
  /** L'adresse a changé par une navigation ordinaire (lien, `router.push`) : l'entrée orpheline n'est plus « juste derrière ». */
  surNavigation(): void;
  /** Pour les tests : nombre de feuilles ouvertes suivies. */
  readonly ouvertes: number;
}

function estMarque(etat: unknown): boolean {
  return !!etat && typeof etat === "object" && CLE_FEUILLE in (etat as Record<string, unknown>);
}

export function creerGardeRetour(historique: HistoriqueMinimal, adresse: () => string): GardeRetour {
  const pile: { id: string; fermer: () => void }[] = [];
  /** Adresse d'une entrée ajoutée par une feuille fermée à l'écran, sur laquelle on se trouve encore. */
  let orpheline: string | null = null;

  return {
    get ouvertes() {
      return pile.length;
    },
    ouvrir(id, fermer) {
      if (pile.some((f) => f.id === id)) return;
      // Réouverture sur l'entrée laissée par la fermeture précédente : on la reprend (pas d'entrée en double).
      if (orpheline !== null && orpheline === adresse() && estMarque(historique.state)) {
        orpheline = null;
        pile.push({ id, fermer });
        return;
      }
      const etat = historique.state && typeof historique.state === "object" ? (historique.state as Record<string, unknown>) : {};
      historique.pushState({ ...etat, [CLE_FEUILLE]: id }, "", adresse());
      orpheline = null;
      pile.push({ id, fermer });
    },
    fermeParEcran(id) {
      const i = pile.findIndex((f) => f.id === id);
      if (i < 0) return;
      pile.splice(i, 1);
      // Plus aucune feuille ouverte, et l'entrée ajoutée est toujours celle où l'on se trouve : elle devient orpheline.
      if (!pile.length && estMarque(historique.state)) orpheline = adresse();
    },
    surRetour() {
      const haut = pile.pop();
      if (haut) {
        orpheline = null;
        haut.fermer();
        return;
      }
      if (orpheline !== null && !estMarque(historique.state) && adresse() === orpheline) {
        // On vient de quitter l'entrée orpheline pour la même page : le retour n'a rien changé à l'écran, on le rejoue.
        orpheline = null;
        historique.back();
        return;
      }
      // Retour (depuis une autre page) sur une entrée laissée par une feuille : le prochain retour la sautera.
      orpheline = estMarque(historique.state) ? adresse() : null;
    },
    surNavigation() {
      if (orpheline !== null && adresse() !== orpheline) orpheline = null;
    },
  };
}

let unique: GardeRetour | null = null;

/** Le gardien de l'onglet (navigateur seulement), branché une fois sur `popstate`. */
export function gardeRetour(): GardeRetour | null {
  if (typeof window === "undefined") return null;
  if (!unique) {
    unique = creerGardeRetour(window.history, () => window.location.href);
    window.addEventListener("popstate", () => unique?.surRetour());
  }
  return unique;
}
