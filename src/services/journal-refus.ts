/**
 * CAL-20 — Service du journal des refus (stockage en mémoire, injectable ; aucun appel réel).
 * Aucune suppression : seules des écritures en ajout, et des changements de statut de règle.
 */
import {
  cleMotif,
  motifsAProposer,
  type Refus,
  type RegleProposee,
  type ReseauRefus,
} from "@/domaine/calendrier/journal-refus";
import { compterRefusParMotif } from "@/domaine/calendrier/journal-refus";

export type OptionsJournalRefus = {
  maintenant?: () => Date;
  genererId?: () => string;
};

export function creerJournalRefus(options: OptionsJournalRefus = {}) {
  const maintenant = options.maintenant ?? (() => new Date());
  let compteur = 0;
  const genererId = options.genererId ?? (() => `refus-${++compteur}`);
  const refus: Refus[] = [];
  const regles = new Map<string, RegleProposee>();

  function chercher(): void {
    const connus = new Set([...regles.values()].map((r) => cleMotif(r.motif)));
    const comptes = compterRefusParMotif(refus);
    for (const k of motifsAProposer(refus, connus)) {
      const id = `regle-${genererId()}`;
      regles.set(id, { id, motif: k, nombreRefus: comptes.get(k) ?? 0, statut: "proposee", proposeeLe: maintenant() });
    }
  }

  function decider(id: string, statut: "appliquee" | "ecartee"): RegleProposee {
    const r = regles.get(id);
    if (!r) throw new Error(`Règle inconnue : ${id}`);
    if (r.statut !== "proposee") throw new Error(`Règle déjà décidée : ${id}`);
    const maj = { ...r, statut, decideeLe: maintenant() };
    regles.set(id, maj);
    return maj;
  }

  return {
    noterRefus(entree: { motif: string; reseau: ReseauRefus }): Refus {
      if (!entree.motif.trim()) throw new Error("Le motif du refus est obligatoire.");
      const r: Refus = { id: genererId(), motif: entree.motif.trim(), reseau: entree.reseau, date: maintenant() };
      refus.push(r);
      chercher();
      return r;
    },
    lister(): readonly Refus[] {
      return [...refus];
    },
    reglesAProposer(): RegleProposee[] {
      return [...regles.values()].filter((r) => r.statut === "proposee");
    },
    reglesAppliquees(): RegleProposee[] {
      return [...regles.values()].filter((r) => r.statut === "appliquee");
    },
    toutesLesRegles(): RegleProposee[] {
      return [...regles.values()];
    },
    /** Seul l'accord du fondateur fait passer une règle à « appliquée ». */
    donnerAccord(id: string): RegleProposee {
      return decider(id, "appliquee");
    },
    refuserRegle(id: string): RegleProposee {
      return decider(id, "ecartee");
    },
  };
}

export type JournalRefus = ReturnType<typeof creerJournalRefus>;
