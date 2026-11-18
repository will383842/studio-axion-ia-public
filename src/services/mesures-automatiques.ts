import "server-only";

/**
 * L5-18b : relecture automatique des chiffres à J+1, J+3 et J+7, SANS IA. Interrupteur « mesures.relecture_automatique »,
 * ÉTEINT par défaut : éteint, aucune requête, aucune écriture, aucune lecture de dépôt.
 *
 * Allumé : un passage toutes les 6 h au plus, 2 requêtes GET (liste des statistiques) au plus par passage, 0 si rien n'est dû.
 * Aucune lecture unitaire, aucun appel à un modèle, aucune notification, aucun envoi. Une réponse 202 (chiffres pas encore prêts)
 * ou un échec n'écrit rien : la publication reste due et sera reprise au passage suivant. La synchro (`zernio.ts`) garde son
 * budget de 51 requêtes. Allumage : seulement après la confirmation du fondateur que ces lectures ne sont pas facturées.
 */
import { JOUR_MS, cleJour } from "@/lib/dates";
import type { Publication } from "@/domaine/types";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { depots, journaliser, lireParametre } from "./_commun";
import { lireStatistiquesPeriode, type StatistiquesLues } from "./lecteur-statistiques";
import { appliquerStatistiquesLues } from "./mesures-completes";
import { cleZernioPresente, clientZernio } from "./zernio";

export const JOURS_RELECTURE = [1, 3, 7] as const;
export const INTERVALLE_RELECTURE_MS = 6 * 3_600_000;
export const PAGES_PAR_PASSAGE = 2;
/** Une échéance reste « due » pendant 3 jours après qu'elle est passée. */
const FENETRE_MS = 3 * JOUR_MS;
/** Clé de la mémoire du dernier passage (sur `globalThis`, comme les autres annexes de la boucle). */
export const CLE_MEMOIRE_RELECTURE = "__studio_relecture_mesures_dernier_passage";

/** Échéances J+1, J+3, J+7 (en ms) passées depuis moins de 3 jours et sans relevé « zernio » daté après elles. */
function echeancesDues(p: Publication, maintenant: number): number[] {
  const debut = Date.parse(p.date);
  if (!Number.isFinite(debut)) return [];
  const relevesZernio = (p.releves ?? []).filter((r) => r.source === "zernio").map((r) => Date.parse(r.le));
  return JOURS_RELECTURE.map((j) => debut + j * JOUR_MS).filter((e) => {
    const ecoule = maintenant - e;
    if (ecoule < 0 || ecoule >= FENETRE_MS) return false;
    return !relevesZernio.some((le) => Number.isFinite(le) && le > e);
  });
}

/** PURE : publications chez le diffuseur (jamais un essai ni un exemple) dont une échéance de relecture est due. */
export function publicationsDues(pubs: Publication[], maintenant: number): Publication[] {
  return pubs.filter((p) => p.via === "zernio" && !!p.idExterne && !p.estDemo && echeancesDues(p, maintenant).length > 0);
}

export async function relireMesuresDues(options: { instant?: number; client?: Pick<ClientZernio, "requete"> } = {}): Promise<{ requetes: number }> {
  // (i) Éteint : retour immédiat, rien d'autre n'est lu.
  if ((await lireParametre<boolean>("mesures.relecture_automatique", false)) !== true) return { requetes: 0 };
  const instant = options.instant ?? Date.now();
  // (ii) Un passage toutes les 6 h au plus.
  const memoire = globalThis as Record<string, unknown>;
  const dernier = memoire[CLE_MEMOIRE_RELECTURE];
  if (typeof dernier === "number" && instant - dernier < INTERVALLE_RELECTURE_MS) return { requetes: 0 };
  // (iii) Pas de clé : rien à faire (un client injecté pour les essais compte comme une clé).
  if (!options.client && !cleZernioPresente()) return { requetes: 0 };
  memoire[CLE_MEMOIRE_RELECTURE] = instant;
  // (iv) Rien de dû : aucune requête.
  const dues = publicationsDues(await depots().publications.lister(), instant);
  if (!dues.length) return { requetes: 0 };
  // (v) Une lecture de liste, 2 pages au plus.
  const debuts = dues.map((p) => Date.parse(p.date));
  const au = cleJour(new Date(instant));
  const du = cleJour(new Date(Math.min(...debuts)));
  const liste = await lireStatistiquesPeriode(options.client ?? clientZernio(), { du: du > au ? au : du, au, pagesMax: PAGES_PAR_PASSAGE });
  // (vi) Rapprochement comme L8-02b ; 202, échec ou chiffres « en cours » : rien d'écrit, la publication reste due.
  const parId = new Map<string, StatistiquesLues>();
  const parUrl = new Map<string, StatistiquesLues>();
  for (const l of liste.lignes) {
    if (l.idPostStudio && !parId.has(l.idPostStudio)) parId.set(l.idPostStudio, l);
    if (l.urlPubliee && !parUrl.has(l.urlPubliee)) parUrl.set(l.urlPubliee, l);
  }
  let relues = 0;
  for (const p of dues) {
    const l = parId.get(p.idExterne!) ?? (p.urlPubliee ? parUrl.get(p.urlPubliee) : undefined);
    if (!l || l.synchro === "en-cours") continue;
    const frais = (await depots().publications.obtenir(p.id)) ?? p;
    if (await appliquerStatistiquesLues(frais, l, new Date(instant))) relues++;
  }
  if (relues > 0) await journaliser("mesures_relues", `Chiffres relus automatiquement : ${relues}`);
  return { requetes: liste.requetes };
}
