/**
 * NOYAU DE VÉRIFICATION D'ESPACEMENT (PUR : aucune écriture, aucun réseau, aucune horloge système).
 * Trois règles sur des posts planifiés :
 *  - écart minimal en heures entre deux posts d'un même réseau : VIOLATION ;
 *  - même pilier + même cible : VIOLATION tant que l'écart en jours est inférieur à `repetitionJours` (J+4 accepté) ;
 *  - quota de posts par jour et réseau, ou jour sans publication (week-end LinkedIn) : AVERTISSEMENT.
 * Les heures sont des heures de Paris, converties par l'horloge sûre (changement d'heure compris).
 */
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";
import { reglesCadence } from "./regles";
import { cleCadence, type EntreeCadence } from "./empreinte";

export interface PostPlanifie extends EntreeCadence {
  id: string;
  reseau: string;
  /** AAAA-MM-JJ (Paris). */
  jour: string;
  /** HH:MM (Paris). */
  heure: string;
}

export interface ReglesEspacement {
  ecartMinH: number;
  quotaParJour: number;
  repetitionJours: number;
  /** Réseaux sans publication le samedi et le dimanche. */
  reseauxSansWeekend: string[];
}

export const REGLES_PAR_DEFAUT: ReglesEspacement = {
  ecartMinH: 3,
  quotaParJour: 1,
  repetitionJours: 4,
  reseauxSansWeekend: ["linkedin"],
};

export interface Constat {
  code: "ecart" | "repetition" | "quota" | "weekend";
  niveau: "violation" | "avertissement";
  posts: string[];
  message: string;
}

/** Règles par défaut dont l'écart minimal vient des bases (règle de cadence du réseau) quand il est connu. */
export function reglesDuReseau(reseau: string, base: ReglesEspacement = REGLES_PAR_DEFAUT): ReglesEspacement {
  const ecart = reglesCadence(reseau)[0]?.ecartMinH;
  return { ...base, ecartMinH: ecart ?? base.ecartMinH };
}

const MS_JOUR = 86_400_000;

function jourSemaine(jour: string): number {
  return new Date(`${jour}T00:00:00Z`).getUTCDay();
}
const estWeekend = (jour: string) => [0, 6].includes(jourSemaine(jour));
const ecartJours = (a: string, b: string) => Math.round(Math.abs(Date.parse(b) - Date.parse(a)) / MS_JOUR);
const instantMs = (p: PostPlanifie) => Date.parse(instantParis(p.jour, p.heure));

export function verifierEspacement(posts: readonly PostPlanifie[], regles: ReglesEspacement = REGLES_PAR_DEFAUT): Constat[] {
  const constats: Constat[] = [];
  const tries = [...posts].sort((a, b) => instantMs(a) - instantMs(b) || a.id.localeCompare(b.id));

  for (const [i, a] of tries.entries()) {
    if (regles.reseauxSansWeekend.includes(a.reseau) && estWeekend(a.jour)) {
      constats.push({ code: "weekend", niveau: "avertissement", posts: [a.id], message: `${a.reseau} : pas de publication le week-end (${a.jour}).` });
    }
    for (const b of tries.slice(i + 1)) {
      if (a.reseau === b.reseau) {
        const h = (instantMs(b) - instantMs(a)) / 3_600_000;
        if (h < regles.ecartMinH) {
          constats.push({ code: "ecart", niveau: "violation", posts: [a.id, b.id], message: `${a.reseau} : ${Math.round(h * 10) / 10} h d'écart, minimum ${regles.ecartMinH} h.` });
        }
      }
      if (cleCadence(a) === cleCadence(b) && ecartJours(a.jour, b.jour) < regles.repetitionJours) {
        constats.push({ code: "repetition", niveau: "violation", posts: [a.id, b.id], message: `Même pilier et même cible à moins de ${regles.repetitionJours} jours d'écart.` });
      }
    }
  }

  const parJour = new Map<string, PostPlanifie[]>();
  for (const p of tries) parJour.set(`${p.reseau}|${p.jour}`, [...(parJour.get(`${p.reseau}|${p.jour}`) ?? []), p]);
  for (const [cle, liste] of parJour) {
    if (liste.length > regles.quotaParJour) {
      constats.push({ code: "quota", niveau: "avertissement", posts: liste.map((p) => p.id), message: `${cle.replace("|", " le ")} : ${liste.length} posts, quota ${regles.quotaParJour} par jour.` });
    }
  }
  return constats;
}

/** Premier jour, à partir de `depuis`, sans week-end interdit et sous le quota du réseau. */
export function prochainJourLibre(reseau: string, depuis: string, posts: readonly PostPlanifie[], regles: ReglesEspacement = REGLES_PAR_DEFAUT): string {
  let jour = depuis;
  for (let i = 0; i < 366; i++, jour = ajouterJoursParis(jour, 1)) {
    if (regles.reseauxSansWeekend.includes(reseau) && estWeekend(jour)) continue;
    if (posts.filter((p) => p.reseau === reseau && p.jour === jour).length >= regles.quotaParJour) continue;
    return jour;
  }
  return jour;
}
