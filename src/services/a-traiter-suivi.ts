/**
 * À TRAITER · SUIVI (ATR-02a). Priorité à 4 niveaux, spam masqué, délai de réponse, rappels de cloche en journée, compteurs.
 * Fonctions pures (sauf `deposerRappelsCloche`, dont toutes les dépendances sont injectables). AUCUN appelant n'est branché :
 * rien ne déclenche `deposerRappelsCloche` aujourd'hui. Aucune réponse n'est envoyée, rien n'est supprimé.
 * Données : jamais d'identifiant de personne ; seulement l'extrait déjà échappé, lu pour classer, jamais recopié dans un message.
 *
 * Valeurs du fondateur (12/11) : 4 heures sans réponse, rappels de 8 h à 20 h seulement, cloche seule (ni push ni e-mail).
 * PROPOSITIONS du pilotage (à valider) : les créneaux 9 h / 13 h / 19 h et les listes de mots ci-dessous.
 */
import { CRENEAUX_RAPPEL, DELAI_RAPPEL_HEURES, creneauEnCours, parisDe, rappelsDus, type ReglageRappels } from "./a-traiter-pur";
import type { CarteATraiter } from "./a-traiter-types";

// Les fonctions pures vivent dans a-traiter-pur.ts ; réexportées ici pour ne casser aucun appelant.
export * from "./a-traiter-pur";

/** Réglage de l'interrupteur des rappels (défaut faux) : reste ici, recensé par tests/usine/interrupteurs-inventaire. */
export const REGLAGE_RAPPELS_ACTIFS = "a_traiter.rappels_actifs";

export interface DependancesRappels {
  env?: Record<string, string | undefined>;
  maintenant?: () => Date;
  lireCartes?: () => Promise<CarteATraiter[]>;
  /** Valeur brute du réglage `a_traiter.rappels_actifs` : seul `true` l'allume. */
  lireReglage?: () => Promise<unknown>;
  creer?: (
    n: { type: "info"; titre: string; message: string; lien: string },
    options: { cloche: true },
  ) => Promise<unknown>;
  dejaDepose?: (cle: string) => Promise<boolean>;
  marquerDepose?: (cle: string) => Promise<void>;
  reglage?: ReglageRappels;
}
export type ResultatRappels = { depose: boolean; raison: string };

/** Mémoire de processus des créneaux déjà notifiés (perdue au redémarrage : à remplacer par un dépôt quand un appelant existera). */
const dejaFaits = new Set<string>();

/**
 * Dépose UNE cloche par créneau et par jour. Ne fait RIEN si `A_TRAITER_ENABLED` est éteint OU si le réglage
 * `a_traiter.rappels_actifs` (défaut faux) n'est pas exactement `true`. Cloche seule : ni push ni e-mail. Aucun appelant.
 */
export async function deposerRappelsCloche(deps: DependancesRappels = {}): Promise<ResultatRappels> {
  const { aTraiterActif } = await import("./a-traiter");
  if (!aTraiterActif(deps.env ?? process.env)) return { depose: false, raison: "interrupteur_eteint" };
  const lireReglage =
    deps.lireReglage ??
    (async () => (await import("./_commun")).lireParametre<unknown>(REGLAGE_RAPPELS_ACTIFS, false));
  if ((await lireReglage()) !== true) return { depose: false, raison: "rappels_eteints" };

  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const creneau = creneauEnCours(maintenant, deps.reglage?.creneaux ?? CRENEAUX_RAPPEL);
  if (creneau === null) return { depose: false, raison: "hors_creneau" };

  const lireCartes = deps.lireCartes ?? (async () => (await import("./a-traiter-depot")).creerDepotParametre().lire());
  const dues = rappelsDus(await lireCartes(), maintenant, deps.reglage);
  if (dues.length === 0) return { depose: false, raison: "rien_a_rappeler" };

  const cle = `${parisDe(maintenant).jour}|${creneau}`;
  const deja = deps.dejaDepose ?? (async (k: string) => dejaFaits.has(k));
  const marquer = deps.marquerDepose ?? (async (k: string) => void dejaFaits.add(k));
  if (await deja(cle)) return { depose: false, raison: "deja_depose" };

  const creer = deps.creer ?? (async (n, o) => (await import("./notifications")).creerNotification(n, o));
  const delai = deps.reglage?.delaiHeures ?? DELAI_RAPPEL_HEURES;
  const n = dues.length;
  await creer(
    {
      type: "info",
      titre: "À traiter : des commentaires attendent votre réponse",
      message:
        n === 1
          ? `Un commentaire attend votre réponse depuis plus de ${delai} heures. Ouvrez la liste À traiter pour le voir.`
          : `${n} commentaires attendent votre réponse depuis plus de ${delai} heures. Ouvrez la liste À traiter pour les voir.`,
      lien: "/a-traiter",
    },
    { cloche: true },
  );
  await marquer(cle);
  return { depose: true, raison: "cloche_deposee" };
}
