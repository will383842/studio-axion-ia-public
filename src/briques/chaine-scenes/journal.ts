/**
 * Journal et suivi des étapes d'une chaîne par scènes. Chaque étape porte une EMPREINTE de ses entrées : une étape déjà
 * réussie avec la même empreinte est reprise telle quelle (y compris après une panne), sinon elle est refaite et le
 * journal est réécrit. Une étape « suivie » (voix, rendu…) tourne jusqu'à sa fin, en gardant son état après chaque tour,
 * et abandonne après `toursMax` tours.
 *
 * Tout ce qui touche l'extérieur (écriture du journal, horloge, attente) est injecté.
 */
import { stable } from "./empreinte";

/** Tours de boucle au plus par étape suivie, à défaut d'autre valeur. */
export const TOURS_MAX_PAR_DEFAUT = 2_000;

/** Une étape réussie : empreinte de ses entrées, durée, sortie (JSON). */
export interface EtapeFaite {
  empreinte: string;
  dureeMs: number;
  sortie: unknown;
}

/** Journal gardé entre deux lancements (reprise). Une chaîne peut y ajouter ses propres états en cours. */
export interface Journal<E extends string> {
  version: string;
  etapes: Partial<Record<E, EtapeFaite>>;
}

/** Une étape du lancement en cours, pour le compte rendu. */
export interface EtapeComptee<E extends string> {
  etape: E;
  statut: "faite" | "reprise";
  dureeMs: number;
}

/** Erreur levée par la chaîne : l'étape et ses raisons, en français. */
export type ConstructeurErreur<E extends string> = new (etape: E, raisons: readonly string[]) => Error;

export interface OptionsSuivi<E extends string, J extends Journal<E>> {
  /** Version de la chaîne : un journal d'une autre version est ignoré (tout est refait). */
  version: string;
  /** Journal lu (absent : premier lancement) et son écriture. */
  journal: { lu: J | null | undefined; ecrire: (j: J) => Promise<void> };
  /** Horloge des durées d'étape (ms). Défaut : `Date.now`. */
  horloge?: () => number;
  /** Attente entre deux tours d'une étape suivie restés sans changement. Défaut : rien. */
  attendre?: () => Promise<void>;
  /** Tours au plus par étape suivie. Défaut : `TOURS_MAX_PAR_DEFAUT`. */
  toursMax?: number;
  /** Erreur de la chaîne ; toute autre erreur levée dans une étape est enveloppée dans celle-ci. */
  erreur: ConstructeurErreur<E>;
}

export interface Suivi<E extends string, J extends Journal<E>> {
  /** Journal courant (celui lu, ou un journal neuf si la version diffère), modifié au fil des étapes. */
  readonly journal: J;
  /** Étapes du lancement en cours, dans l'ordre. */
  readonly etapes: EtapeComptee<E>[];
  etape<T>(nom: E, cle: string, faire: () => Promise<T>): Promise<T>;
  suivre<S>(nom: E, depart: S, tour: (e: S) => Promise<S>, fini: (e: S) => boolean, garder: (e: S) => Promise<void>): Promise<S>;
}

const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Crée le suivi des étapes d'un lancement. */
export function creerSuivi<E extends string, J extends Journal<E> = Journal<E>>(o: OptionsSuivi<E, J>): Suivi<E, J> {
  const horloge = o.horloge ?? Date.now;
  const attendre = o.attendre ?? (async () => undefined);
  const toursMax = o.toursMax ?? TOURS_MAX_PAR_DEFAUT;
  const Erreur = o.erreur;
  const journal: J = o.journal.lu?.version === o.version ? o.journal.lu : ({ version: o.version, etapes: {} } as J);
  const etapes: EtapeComptee<E>[] = [];

  /** Reprend l'étape si son empreinte est celle du journal ; sinon la fait et écrit le journal. */
  async function etape<T>(nom: E, cle: string, faire: () => Promise<T>): Promise<T> {
    const deja = journal.etapes[nom];
    if (deja && deja.empreinte === cle) {
      etapes.push({ etape: nom, statut: "reprise", dureeMs: 0 });
      return deja.sortie as T;
    }
    const t0 = horloge();
    try {
      const sortie = await faire();
      const dureeMs = horloge() - t0;
      journal.etapes[nom] = { empreinte: cle, dureeMs, sortie };
      await o.journal.ecrire(journal);
      etapes.push({ etape: nom, statut: "faite", dureeMs });
      return sortie;
    } catch (err) {
      if (err instanceof Erreur) throw err;
      throw new Erreur(nom, [raisonDe(err)]);
    }
  }

  /** Fait tourner une étape suivie jusqu'à `fini`, en gardant l'état après chaque tour. */
  async function suivre<S>(nom: E, depart: S, tour: (e: S) => Promise<S>, fini: (e: S) => boolean, garder: (e: S) => Promise<void>): Promise<S> {
    let e = depart;
    for (let n = 0; !fini(e); n++) {
      if (n >= toursMax) throw new Erreur(nom, [`L'étape ne s'est pas terminée après ${toursMax} tours.`]);
      const suivant = await tour(e);
      if (stable(suivant) === stable(e)) await attendre();
      e = suivant;
      await garder(e);
    }
    return e;
  }

  return { journal, etapes, etape, suivre };
}
