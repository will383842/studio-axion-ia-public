/**
 * RC-14 : registre d'alertes unique, SANS IA. Chaque entrée lit des sources INJECTÉES (aucun réseau, aucune base) et
 * ne rend qu'un niveau : « ok », « alerte » ou « non-evalue » (affiché « non évalué »). Horloge injectée.
 * - Santé et âge de la dernière sauvegarde : mêmes règles que l'alerte externe L5-08 (deploiement/surveiller.sh, 36 h).
 * - Quota Zernio et jetons : calculés ailleurs (STU-JETONS) ; on ne lit ici que le résultat fourni par une fonction.
 * Les seuils sont ci-dessous, et toutes les comparaisons passent par `evaluerSeuil` (seuil.ts).
 */
import { dansFenetre, ecartJours, jourParis } from "./jours";
import { evaluerSeuil, type Niveau } from "./seuil";

export type { Niveau } from "./seuil";

export const LIBELLE_NIVEAU: Record<Niveau, string> = { ok: "ok", alerte: "alerte", "non-evalue": "non évalué" };

/** Seuils du registre (réglables ici, nulle part ailleurs). */
export const SEUILS = {
  quotaPourcent: 80,
  visuelManquantJours: 7,
  /** Échéance d'accès : alerte à 14 jours restants ou moins (échéance passée comprise). */
  echeanceJours: 14,
  sauvegardeHeures: 36,
} as const;

export interface EntreeCalendrierAlerte {
  /** Jour de Paris, AAAA-MM-JJ. */
  jour: string;
  /** null = on ne sait pas. */
  aVisuel: boolean | null;
}
export interface EcheanceAcces {
  libelle: string;
  /** AAAA-MM-JJ (Paris), ou null si inconnue. */
  jour: string | null;
}
export interface Sources {
  calendrier?: EntreeCalendrierAlerte[] | null;
  /** Résultat de STU-JETONS : pourcentage du quota utilisé, ou null. */
  quotaPourcent?: (() => number | null) | undefined;
  /** Résultat de STU-JETONS : niveau des jetons, lu tel quel. */
  jetons?: (() => "ok" | "alerte") | undefined;
  echeances?: EcheanceAcces[] | null;
  santeOk?: boolean | null;
  ageSauvegardeHeures?: number | null;
}
export type Horloge = () => Date;

export interface ResultatAlerte {
  id: string;
  libelle: string;
  niveau: Niveau;
  detail: string;
}
interface Contexte {
  sources: Sources;
  aujourdhui: string;
}
interface DefinitionAlerte {
  id: string;
  libelle: string;
  evaluer: (c: Contexte) => { niveau: Niveau; detail: string };
}

const NON_EVALUE = (detail: string) => ({ niveau: "non-evalue" as const, detail });

/** Trou à J+h : aucune publication ce jour-là (aucune publication). Même règle pour J+7 et J+2. */
function trou(horizon: number): DefinitionAlerte["evaluer"] {
  return ({ sources, aujourdhui }) => {
    if (!sources.calendrier) return NON_EVALUE("calendrier non disponible");
    const jours = sources.calendrier.map((e) => ecartJours(aujourdhui, e.jour));
    const publications = jours.filter((j) => j === horizon).length;
    const niveau = evaluerSeuil(publications, { seuil: 0, sens: "au-plus" });
    // Une date illisible pourrait être celle du jour visé : le trou n'est alors pas certain, donc « non évalué ».
    if (jours.some((j) => j === null)) return NON_EVALUE("au moins une date du calendrier est illisible");
    return { niveau, detail: niveau === "alerte" ? `rien de prévu à J+${horizon}` : `une publication est prévue à J+${horizon}` };
  };
}

export const REGISTRE: DefinitionAlerte[] = [
  { id: "trou-j7", libelle: "Trou du calendrier à J+7", evaluer: trou(7) },
  { id: "trou-j2", libelle: "Trou du calendrier à J+2", evaluer: trou(2) },
  {
    id: "visuel-manquant",
    libelle: "Publication prochaine sans visuel",
    evaluer: ({ sources, aujourdhui }) => {
      if (!sources.calendrier) return NON_EVALUE("calendrier non disponible");
      const proches = sources.calendrier.filter((e) => {
        return dansFenetre(ecartJours(aujourdhui, e.jour), SEUILS.visuelManquantJours);
      });
      const sans = proches.filter((e) => e.aVisuel === false).length;
      const inconnus = proches.filter((e) => e.aVisuel === null || e.aVisuel === undefined).length;
      if (sans) return { niveau: evaluerSeuil(sans, { seuil: 1, sens: "au-moins" }), detail: `${sans} publication(s) des ${SEUILS.visuelManquantJours} prochains jours sans visuel` };
      const datesIllisibles = sources.calendrier.some((e) => ecartJours(aujourdhui, e.jour) === null);
      if (datesIllisibles) return NON_EVALUE("au moins une date du calendrier est illisible");
      if (inconnus) return NON_EVALUE("visuel inconnu pour au moins une publication");
      return { niveau: "ok", detail: "tous les visuels sont présents" };
    },
  },
  {
    id: "quota",
    libelle: "Quota Zernio",
    evaluer: ({ sources }) => {
      let valeur: number | null = null;
      try {
        valeur = sources.quotaPourcent?.() ?? null;
      } catch {
        valeur = null;
      }
      const niveau = evaluerSeuil(valeur, { seuil: SEUILS.quotaPourcent, sens: "au-moins" });
      if (niveau === "non-evalue") return NON_EVALUE("quota non lisible");
      return { niveau, detail: `quota utilisé à ${valeur} % (seuil ${SEUILS.quotaPourcent} %)` };
    },
  },
  {
    id: "jetons",
    libelle: "Jetons des comptes",
    evaluer: ({ sources }) => {
      let r: unknown = null;
      try {
        r = sources.jetons?.() ?? null;
      } catch {
        r = null;
      }
      if (r === "ok") return { niveau: "ok", detail: "jetons valides" };
      if (r === "alerte") return { niveau: "alerte", detail: "jeton à renouveler" };
      return NON_EVALUE("jetons non lisibles");
    },
  },
  {
    id: "echeances",
    libelle: "Échéances d'accès",
    evaluer: ({ sources, aujourdhui }) => {
      if (!sources.echeances) return NON_EVALUE("échéances non disponibles");
      let inconnue = false;
      const proches: string[] = [];
      for (const e of sources.echeances) {
        const reste = e.jour === null ? null : ecartJours(aujourdhui, e.jour);
        const niveau = evaluerSeuil(reste, { seuil: SEUILS.echeanceJours, sens: "au-plus" });
        if (niveau === "non-evalue") inconnue = true;
        else if (niveau === "alerte") proches.push(e.libelle);
      }
      if (proches.length) return { niveau: "alerte", detail: `à renouveler : ${proches.join(", ")}` };
      if (inconnue) return NON_EVALUE("date d'échéance inconnue");
      return { niveau: "ok", detail: "aucune échéance proche" };
    },
  },
  {
    id: "sante",
    libelle: "Santé du studio",
    evaluer: ({ sources }) => {
      if (typeof sources.santeOk !== "boolean") return NON_EVALUE("santé non lue");
      return sources.santeOk ? { niveau: "ok", detail: "le studio répond" } : { niveau: "alerte", detail: "le studio ne répond pas correctement" };
    },
  },
  {
    id: "sauvegarde",
    libelle: "Dernière sauvegarde",
    evaluer: ({ sources }) => {
      const h = sources.ageSauvegardeHeures;
      const niveau = evaluerSeuil(h, { seuil: SEUILS.sauvegardeHeures, sens: "au-moins" });
      if (niveau === "non-evalue") return NON_EVALUE("âge de la sauvegarde inconnu");
      return { niveau, detail: `dernière sauvegarde il y a ${h} h (seuil ${SEUILS.sauvegardeHeures} h)` };
    },
  },
];

export function evaluerRegistre(sources: Sources, horloge: Horloge): ResultatAlerte[] {
  const aujourdhui = jourParis(horloge());
  return REGISTRE.map((def) => {
    let r: { niveau: Niveau; detail: string };
    try {
      r = def.evaluer({ sources, aujourdhui });
    } catch {
      r = NON_EVALUE("évaluation impossible");
    }
    return { id: def.id, libelle: def.libelle, niveau: r.niveau, detail: r.detail };
  });
}
