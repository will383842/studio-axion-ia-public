/**
 * APPELS D'ÉCRITURE DÉTACHÉS (tâche X2). La boucle de fond attend un passage au plus 30 s (90 s tant que la voix n'est
 * pas faite) ; un appel Claude réel dure de 60 à 240 s. Un appel attendu dans le passage serait compté en panne alors
 * qu'il est payé, puis relancé et payé une seconde fois.
 *
 * Les outils d'écriture sont donc ENVELOPPÉS (`ecritureDetachee`) quand le service fournit `detache` :
 *   - premier passage : l'appel est LANCÉ sans être attendu ; le journal de la vidéo note « appel en cours » (identifiant
 *     de l'appel, heure) ; l'appel, quand il finit, écrit sa réponse dans le stockage des appels (`AppelsDetaches`) ;
 *   - passages suivants : la réponse est RELUE ; pas arrivée → le passage rend la main (`attente`) ; arrivée → elle est
 *     rendue telle quelle, et l'écriture (ou la reformulation) continue. Une réponse déjà arrivée est rejouée à chaque
 *     passage, jamais redemandée : la relance de l'écriture repart de la première réponse gardée ;
 *   - tant qu'un appel est en cours et plus jeune que `DELAI_REPONSE_APPEL_MS`, aucun autre n'est lancé pour la même
 *     étape, même après un redémarrage (l'état est dans le journal, gardé dans le travail) ; passé ce délai : l'étape
 *     échoue en clair (`expire`) ; « Réessayer » lance un seul nouvel appel, sauf si la réponse de l'ancien est arrivée
 *     entre-temps : elle est reprise au lieu de repayer. Une panne rendue par l'appel est rendue une fois ; « Réessayer »
 *     relance alors un appel.
 * PUR (aucun service) ; le journal et l'heure sont fournis par la chaîne.
 */
import { empreinteStable } from "@/briques/chaine-scenes";
import type { OutilsEcriture, ReponseAppelEcriture } from "./outils";

/** Au-delà, un appel sans réponse est tenu pour perdu : l'étape échoue, « Réessayer » relance. */
export const DELAI_REPONSE_APPEL_MS = 6 * 60_000;

/** Phrase de l'étape dont l'appel n'a pas répondu à temps. */
export const reponseNonArrivee = (libelle: string) => `L'étape « ${libelle} » n'a pas abouti : la réponse n'est pas arrivée.`;

/** Un appel détaché, gardé dans le journal sous son identifiant (celui de sa réservation). */
export interface AppelSuivi {
  /** Empreinte de la demande (rôle et entrée) : une autre demande sous le même identifiant est un autre appel. */
  empreinte: string;
  /** N° du lancement (1, puis un de plus à chaque « Réessayer » après un délai dépassé ou une panne). */
  tentative: number;
  /** Heure du lancement (ms). */
  le: number;
  /** Lancement clos sans réponse utile (délai dépassé ou panne rendue) : le suivant relance. */
  clos?: true;
}

export interface OptionsEcritureDetachee {
  /** Le journal de la vidéo : les appels y sont notés (`appels`). */
  journal: { appels?: Record<string, AppelSuivi> };
  /** Garde le journal (après chaque changement de `appels`). */
  garder: () => Promise<void>;
  horloge: () => number;
  /** Libellé de l'étape (« L'écriture », « La voix »). */
  libelle: string;
  /** Erreur « pas encore de réponse » : le passage rend la main, le suivant relit. */
  attente: (libelle: string) => Error;
  /** Erreur « délai dépassé » : l'étape échoue avec cette phrase. */
  expire: (phrase: string) => Error;
}

const cleDe = (appelId: string, s: Pick<AppelSuivi, "empreinte" | "tentative">, tentative = s.tentative) => `${appelId}.${s.empreinte.slice(0, 12)}.${tentative}`;

/**
 * Outils d'écriture dont chaque appel est détaché (voir l'en-tête). Sans `detache` : les outils tels quels. L'appel est
 * rattaché à la réservation qui le précède (`budget.reserver`, identifiant d'appel unique) ; une réservation d'un appel
 * déjà lancé n'est pas refaite.
 */
export function ecritureDetachee(outils: OutilsEcriture, o: OptionsEcritureDetachee): OutilsEcriture {
  const d = outils.detache;
  if (!d) return outils;
  let courant: string | undefined;

  const appeler: OutilsEcriture["appeler"] = async (role, entree): Promise<ReponseAppelEcriture> => {
    const appelId = courant;
    courant = undefined;
    if (!appelId) throw new Error("Appel d'écriture sans réservation.");
    const empreinte = empreinteStable("appel-ecriture/1", role.id, role.version, role.modele, entree);
    const appels = (o.journal.appels ??= {});
    const deja = appels[appelId]?.empreinte === empreinte ? appels[appelId] : undefined;

    if (deja) {
      // Une réponse arrivée, même celle d'un ancien lancement, est reprise : jamais repayée.
      for (let t = deja.tentative; t >= 1; t--) {
        const r = await d.lire(cleDe(appelId, deja, t));
        if (r?.ok) return r;
        if (r && !deja.clos && t === deja.tentative) {
          deja.clos = true;
          await o.garder();
          return r;
        }
      }
      if (!deja.clos) {
        if (o.horloge() - deja.le < DELAI_REPONSE_APPEL_MS) throw o.attente(o.libelle);
        deja.clos = true;
        await o.garder();
        throw o.expire(reponseNonArrivee(o.libelle));
      }
    }

    // Premier lancement, ou nouveau lancement après « Réessayer » : noté au journal AVANT de partir.
    const suivi: AppelSuivi = { empreinte, tentative: (deja?.tentative ?? 0) + 1, le: o.horloge() };
    appels[appelId] = suivi;
    await o.garder();
    await d.lancer(cleDe(appelId, suivi), () => outils.appeler(role, entree));
    throw o.attente(o.libelle);
  };

  // X12 : une réponse gardée, relue sous l'empreinte notée au journal (celle de l'époque), jamais relancée.
  const relire: NonNullable<OutilsEcriture["relire"]> = async (appelId) => {
    const s = o.journal.appels?.[appelId];
    if (!s) return null;
    for (let t = s.tentative; t >= 1; t--) {
      const r = await d.lire(cleDe(appelId, s, t));
      if (r?.ok) return r;
    }
    return null;
  };

  return {
    appeler,
    relire,
    ...(outils.memoireCommune ? { memoireCommune: outils.memoireCommune } : {}),
    budget: {
      reserver: async (demande) => {
        courant = demande.appelId;
        const s = o.journal.appels?.[demande.appelId];
        // Appel déjà lancé (en cours ou répondu) : sa réservation est faite, la refaire compterait deux fois.
        if (s && !s.clos) return { ok: true };
        return outils.budget.reserver(demande);
      },
    },
  };
}
