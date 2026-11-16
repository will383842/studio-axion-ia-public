/**
 * Boucle d'étapes GÉNÉRIQUE du gabarit (G1-03), extraite de `montage-demo-facecam/chaine.ts` et `index.ts` (sans les
 * modifier). Elle garde l'état d'un travail dans `travail.parametres.gabarit`, avance d'un pas à chaque appel, reprend
 * après un redémarrage (l'état est dans le travail) et se met en PAUSE claire quand les dépendances ne sont pas reliées
 * (jamais un échec, jamais une vidéo d'essai). Zéro euro, aucun appel à Claude, aucun import de `studio-rendu`.
 */
import type { CommandeFabrication, EtapeTravail, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import type { DefinitionEtapeMoteur } from "../types";

/** Ce que tout état de moteur construit par le gabarit contient ; le moteur y ajoute ce qui lui est propre (JSON seulement). */
export interface EtatGabarit {
  /** Clés des étapes terminées, dans l'ordre. */
  faites: string[];
  /** Étape en échec (jamais posée par une pause). */
  echec?: { etape: string; message: string; reessayable: boolean };
  /** Tout est fait : le résultat peut être rendu. */
  fini?: boolean;
}

/** Contexte donné à `avancer` du moteur : tout ce qu'il peut lire, rien d'autre. */
export interface ContexteAvance<Entrees> {
  commande: CommandeFabrication;
  entrees: Entrees;
  travailId: string;
  versionId: string;
  /** Numéro de tentative du travail (1 au premier passage, +1 par « Réessayer »). */
  tentative: number;
  etapes: DefinitionEtapeMoteur[];
}

/** Étapes dont toutes les dépendances sont faites et qui ne le sont pas elles-mêmes, dans l'ordre de la définition. */
export function etapesPretes(defs: DefinitionEtapeMoteur[], faites: string[]): DefinitionEtapeMoteur[] {
  return defs.filter((d) => !faites.includes(d.cle) && d.dependDe.every((x) => faites.includes(x)));
}

/** Avancement de chaque étape d'après l'état (même règle que la démo : faite, en échec, ou en cours si elle est prête). */
export function etapesSelonEtat(etapes: EtapeTravail[], etat: EtatGabarit): EtapeTravail[] {
  let echecPose = false;
  const defs: DefinitionEtapeMoteur[] = etapes.map((e) => ({ cle: e.cle, nom: e.nom, icone: e.icone, dependDe: e.dependDe, dureeEstimeeSec: 0 }));
  const prochaine = etapesPretes(defs, etat.faites)[0]?.cle;
  return etapes.map((e) => {
    if (etat.faites.includes(e.cle)) return { ...e, statut: "terminee" as const, progression: 100, coutReel: ZERO, erreur: undefined };
    if (etat.echec && !echecPose && etat.echec.etape === e.cle) {
      echecPose = true;
      return { ...e, statut: "echec" as const, progression: 50, erreur: { code: "GABARIT_ECHEC", reessayable: etat.echec.reessayable, messagePourWill: etat.echec.message, detailTechnique: `Étape « ${e.cle} ».` } };
    }
    if (!etat.echec && !etat.fini && e.cle === prochaine && etat.faites.length > 0) return { ...e, statut: "en_cours" as const, progression: 50 };
    return e;
  });
}

/** Un nouveau travail « en file » portant l'état de départ (le moteur le fait avancer ensuite). */
export function nouveauTravailGabarit(id: string, defs: DefinitionEtapeMoteur[], commande: CommandeFabrication, ctx: { travailId: string; versionId: string; type?: Travail["type"]; titre: string; maintenant?: number }, etat: EtatGabarit): Travail {
  const iso = new Date(ctx.maintenant ?? Date.now()).toISOString();
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: id,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    // `origine` de la commande : posée ici, relue par le test de conformité (« usine » jusqu'au résultat).
    parametres: { gabarit: etat, ...(commande.origine ? { origine: commande.origine } : {}) },
  };
}

/**
 * Un pas de la chaîne : le moteur avance son état (`pas`) ; le gabarit recalcule les étapes, le statut et la progression.
 * Une panne imprévue du moteur n'échoue pas : le même état est retenté au tour suivant (rien n'est perdu).
 */
export async function avancerChaine<E extends EtatGabarit>(travail: Travail, etat: E, pas: (etat: E) => Promise<E>, maintenant: number): Promise<{ travail: Travail; etat: E; fini: boolean }> {
  let suivant: E;
  try {
    suivant = await pas(etat);
  } catch {
    suivant = etat;
  }
  const etapes = etapesSelonEtat(travail.etapes, suivant);
  const fini = !!suivant.fini;
  const enEchec = etapes.find((e) => e.statut === "echec");
  const iso = new Date(maintenant).toISOString();
  const resultat: Travail = {
    ...travail,
    etapes,
    progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(1, etapes.length)),
    statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
    erreur: enEchec?.erreur,
    modifieLe: iso,
    termineLe: fini ? iso : undefined,
    parametres: { ...travail.parametres, gabarit: suivant },
  };
  return { travail: resultat, etat: suivant, fini };
}
