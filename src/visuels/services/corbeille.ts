import { joursRestants } from "@/domaine/corbeille";
import { corbeillePermise } from "@/domaine/visuels/statuts";
import type { Visuel } from "@/domaine/visuels/visuel";
import { ErreurVisuel, RENDU_PERIME_MS, type DependancesCarrousels } from "./carrousels";

/**
 * EXCEPTION VOULUE (décision du chef de chantier) : ni ce fichier ni `valider`/`refuser` ne vérifient `allume()`.
 * L'interrupteur du générateur n'interdit que de FABRIQUER (écrire le texte, rendre, refaire). Trier l'existant
 * (valider, refuser, mettre à la corbeille, restaurer, purger) reste permis générateur éteint.
 * Le test « générateur éteint : on peut trier l'existant » de `tests/visuels/tranche-bout-en-bout.test.ts` l'écrit.
 *
 * Corbeille de 30 jours des carrousels. « Mettre à la corbeille » ne change PAS le statut : il pose `corbeilleLe` et garde
 * `statutAvantCorbeille`. La purge ne supprime que des DOCUMENTS échus ; aucun fichier n'est jamais effacé (en cas de doute, on garde).
 */

export type DependancesCorbeilleVisuels = Pick<DependancesCarrousels, "depot" | "verrou" | "maintenant" | "lireParametre" | "ecrireParametre">;

export const CLE_DERNIER_PASSAGE_VISUELS = "corbeille-visuels.dernierPassage";
/** La purge tourne au plus une fois par heure, par paquets de 10 documents. */
const PASSAGE_MIN_MS = 3_600_000;
const PAQUET = 10;

/** Échu = 30 jours révolus ET jamais programme/publie (en cas de doute sur la date ou le statut : gardé). */
const echu = (v: Visuel, maintenantMs: number) =>
  !!v.corbeilleLe && joursRestants(v.corbeilleLe, maintenantMs) === 0 && corbeillePermise(v.statut) && corbeillePermise(v.statutAvantCorbeille ?? v.statut);

export async function mettreALaCorbeille(ids: string[], deps: DependancesCorbeilleVisuels): Promise<{ mises: number }> {
  return deps.verrou(async () => {
    const lus = (await Promise.all([...new Set(ids)].map((id) => deps.depot.obtenir(id)))).filter((v): v is Visuel => !!v && !v.corbeilleLe);
    const maintenantMs = Date.parse(deps.maintenant());
    for (const v of lus) {
      const renduVivant = v.statut === "rendu_en_cours" && !!v.renduDemandeLe && maintenantMs - Date.parse(v.renduDemandeLe) < RENDU_PERIME_MS;
      if (renduVivant) throw new ErreurVisuel("CORBEILLE_REFUSEE", `« ${v.titre} » est en cours de rendu : attendez la fin du rendu`);
      if (!corbeillePermise(v.statut)) throw new ErreurVisuel("CORBEILLE_REFUSEE", `« ${v.titre} » est ${v.statut === "publie" ? "publié" : "programmé"} : il ne va pas à la corbeille`);
    }
    const instant = deps.maintenant();
    for (const v of lus) await deps.depot.modifier(v.id, { corbeilleLe: instant, statutAvantCorbeille: v.statut });
    return { mises: lus.length };
  });
}

/** Rétablit un visuel à la corbeille depuis moins de 30 jours ; au-delà il n'est plus restaurable (il attend la purge). */
export async function restaurer(ids: string[], deps: DependancesCorbeilleVisuels): Promise<{ restaurees: number }> {
  return deps.verrou(async () => {
    const maintenantMs = Date.parse(deps.maintenant());
    let restaurees = 0;
    for (const id of new Set(ids)) {
      const v = await deps.depot.obtenir(id);
      if (!v?.corbeilleLe || !(joursRestants(v.corbeilleLe, maintenantMs) > 0)) continue;
      await deps.depot.modifier(id, { corbeilleLe: undefined, statutAvantCorbeille: undefined });
      restaurees++;
    }
    return { restaurees };
  });
}

/** Supprime les DOCUMENTS échus (jamais un fichier). Au plus un passage par heure, 10 documents par passage. */
export async function purgerCorbeilleVisuels(maintenantMs: number, deps: DependancesCorbeilleVisuels): Promise<{ supprimes: number; saute?: true }> {
  const saute = await deps.verrou(async () => {
    const dernier = Date.parse(await deps.lireParametre<string>(CLE_DERNIER_PASSAGE_VISUELS, ""));
    if (maintenantMs - dernier < PASSAGE_MIN_MS) return true;
    await deps.ecrireParametre(CLE_DERNIER_PASSAGE_VISUELS, new Date(maintenantMs).toISOString());
    return false;
  });
  if (saute) return { supprimes: 0, saute: true };
  const echus = (await deps.depot.lister((v) => echu(v, maintenantMs))).sort((a, b) => a.corbeilleLe!.localeCompare(b.corbeilleLe!)).slice(0, PAQUET);
  let supprimes = 0;
  for (const v of echus) {
    // Garde rejouée sous le verrou : restauré entre le choix du paquet et son tour, le visuel reste.
    supprimes += await deps.verrou(async () => {
      const frais = await deps.depot.obtenir(v.id);
      return frais && echu(frais, maintenantMs) && (await deps.depot.supprimer(v.id)) ? 1 : 0;
    });
  }
  return { supprimes };
}
