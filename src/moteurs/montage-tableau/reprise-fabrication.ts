/**
 * Tableau — la boucle « page fautive refaite une fois, regardée une seconde fois » (S-12-BRANCHER-a-v21n, variante A'),
 * posée dans le MOTEUR : un premier passage de fabrication, la lecture du verdict du regard, et SEULEMENT si `suiteDuRegard`
 * dit « refaire » un second passage avec la fiche refaite (`pageDePlus`). Au plus 1 page refaite, au plus 2 regards PAR VIDÉO
 * (compteur rangé dans le journal de la vidéo). Tout est INJECTÉ (fabriquer, lire/écrire le compteur) : ce module n'importe ni
 * service, ni fournisseur, ni argent, et personne ne l'importe encore (aucun appelant : rien ne change pour la vidéo).
 * Porte : `actif === true` exactement ; sinon un seul passage, sortie identique. Ne lève jamais.
 */
import type { VerdictRegard } from "@/briques/regardeur";
import { boucleDuRegard, type ArretBoucle } from "./boucle-regard";
import { pageDePlus } from "./densite";
import type { FicheTableau } from "./fiche";
import { suiteDuRegard } from "./reprise-du-regard";

/** Ce que rend un passage de fabrication : les clés de la vidéo faite et le verdict du regard (absent = non regardée). */
/** Regards au plus par vidéo : même valeur que `MAX_REGARDS_PAR_VIDEO` de la garde du regard (non importée : un test de master interdit tout importeur de la garde ; un test de ce lot compare les deux). */
export const MAX_REGARDS_PAR_VIDEO = 2;

export interface PassageFabrique<C = unknown> {
  cles: C;
  verdict?: VerdictRegard;
}

export interface PortsReprise<C = unknown> {
  /** Un passage complet. `maxAppels` : regards permis pour CE passage (0 ou 1) ; le futur appelant en fait une `garderRegard`. */
  fabriquer: (fiche: FicheTableau, options: { maxAppels: number }) => Promise<PassageFabrique<C>>;
  /** Regards déjà faits pour cette vidéo (champ `regards` du journal). Illisible (lève, ou pas un entier) = plafond atteint. */
  lireRegardsFaits: () => number | Promise<number>;
  /** Range le nombre de regards faits, AVANT de rendre le verdict. */
  ecrireRegardsFaits: (n: number) => void | Promise<void>;
}

export interface EntreeReprise {
  fiche: FicheTableau;
  /** `true` exact allume la reprise ; tout le reste = un seul passage. */
  actif: boolean;
}

export type ArretReprise = ArretBoucle | "inactif" | "non-relue" | "plafond-regards" | "fabrication-en-panne";

export interface SortieReprise<C = unknown> {
  /** La fiche à garder (celle d'entrée, ou la refaite si elle est saine). */
  fiche: FicheTableau;
  /** Clés de la vidéo gardée ; `null` si le premier passage est tombé en panne. */
  cles: C | null;
  /** Regards faits PAR CET APPEL. */
  regards: number;
  refaites: 0 | 1;
  arret: ArretReprise;
  raisons: string[];
}

const SORTIE_PANNE = (fiche: FicheTableau): SortieReprise<never> => ({
  fiche, cles: null, regards: 0, refaites: 0, arret: "fabrication-en-panne", raisons: ["La fabrication a échoué : rien n'a été refait."],
});

/** Ne lève jamais. */
export async function fabriquerAvecReprise<C>(entree: EntreeReprise, ports: PortsReprise<C>): Promise<SortieReprise<C>> {
  const fiche = entree.fiche;
  try {
    return await passer(fiche, entree.actif === true, ports);
  } catch {
    return SORTIE_PANNE(fiche);
  }
}

async function passer<C>(fiche: FicheTableau, actif: boolean, ports: PortsReprise<C>): Promise<SortieReprise<C>> {
  if (!actif) {
    try {
      const p = await ports.fabriquer(fiche, { maxAppels: 0 });
      return { fiche, cles: p.cles, regards: 0, refaites: 0, arret: "inactif", raisons: [] };
    } catch {
      return SORTIE_PANNE(fiche);
    }
  }

  // Combien de regards sont déjà faits ? Illisible = plafond atteint (jamais sans plafond).
  let faits = MAX_REGARDS_PAR_VIDEO;
  try {
    const lu = await ports.lireRegardsFaits();
    if (typeof lu === "number" && Number.isInteger(lu) && lu >= 0) faits = lu;
  } catch { /* illisible : plafond atteint */ }

  const nonRelue = async (): Promise<SortieReprise<C>> => {
    try {
      const p = await ports.fabriquer(fiche, { maxAppels: 0 });
      return { fiche, cles: p.cles, regards: 0, refaites: 0, arret: "non-relue", raisons: ["Images non relues : le plafond de regards de cette vidéo est atteint."] };
    } catch {
      return SORTIE_PANNE(fiche);
    }
  };
  if (faits >= MAX_REGARDS_PAR_VIDEO) return nonRelue();

  /** Compte un regard AVANT de le payer ; si le compteur ne s'écrit pas, ce passage ne regarde pas. */
  const compter = async (n: number): Promise<boolean> => {
    try { await ports.ecrireRegardsFaits(n); return true; } catch { return false; }
  };

  let passage1: PassageFabrique<C> | null = null;
  let passage2: PassageFabrique<C> | null = null;
  let plafondAtteint = false;
  let premierSansRegard = false;

  try {
    const issue = await boucleDuRegard(fiche, {
      suite: suiteDuRegard,
      regarder: async (f, rang) => {
        if (rang === 2) {
          if (!passage2?.verdict) throw new Error("second regard absent");
          return passage2.verdict;
        }
        const permis = await compter(faits + 1);
        if (!permis) { premierSansRegard = true; passage1 = await ports.fabriquer(f, { maxAppels: 0 }); throw new Error("compteur non écrit"); }
        passage1 = await ports.fabriquer(f, { maxAppels: 1 });
        if (!passage1.verdict) throw new Error("premier regard absent");
        return passage1.verdict;
      },
      refaire: async (f, pages) => {
        let c = f;
        for (const p of pages) c = pageDePlus(c, p) ?? c;
        // Le second regard est le dernier permis : compté AVANT d'être payé.
        if (faits + 2 > MAX_REGARDS_PAR_VIDEO || !(await compter(faits + 2))) { plafondAtteint = true; throw new Error("plafond de regards"); }
        passage2 = await ports.fabriquer(c, { maxAppels: 1 });
        return c;
      },
    });
    if (!passage1) return SORTIE_PANNE(fiche);
    const gardee = issue.fiche !== fiche && passage2 ? (passage2 as PassageFabrique<C>) : (passage1 as PassageFabrique<C>);
    const arret: ArretReprise = plafondAtteint && issue.arret === "refaire-en-panne" ? "plafond-regards" : issue.arret;
    const regards = premierSansRegard ? 0 : issue.regards;
    return { fiche: issue.fiche, cles: gardee.cles, regards, refaites: issue.refaites, arret, raisons: issue.raisons };
  } catch {
    return passage1 ? { fiche, cles: (passage1 as PassageFabrique<C>).cles, regards: 0, refaites: 0, arret: "regard-en-panne", raisons: ["Reprise impossible : la vidéo est gardée telle quelle."] } : SORTIE_PANNE(fiche);
  }
}
