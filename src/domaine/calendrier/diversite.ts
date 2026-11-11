/**
 * CAL-16 · Contrôleur de diversité du calendrier (PUR, sans IA, sans appel réel).
 * - même format plus de N jours de suite sur un réseau : alerte (N = 2 par défaut) ;
 * - deux publications au sujet trop proche : alerte (le sujet se lit via l'empreinte L3-11 ; la signature
 *   posée par l'usine est lue telle quelle, rien n'est recalculé ici pour elle).
 * Une alerte ne bloque JAMAIS un ajout manuel : `bloquant` vaut toujours false.
 */
import { empreinte } from "@/domaine/proximite/empreinte";
import { scoreProximite } from "@/domaine/proximite/score";

export interface SeuilsDiversite {
  /** Nombre de jours consécutifs autorisés avec le même format sur un réseau (alerte au-delà). */
  joursMaxMemeFormat: number;
  /** Score de proximité (0-1) à partir duquel deux textes sont jugés trop proches. */
  seuilProximite: number;
  /** Écart maximal en jours entre deux publications pour comparer leurs textes. */
  fenetreJoursTexte: number;
}

export const SEUILS_DIVERSITE: Readonly<SeuilsDiversite> = {
  joursMaxMemeFormat: 2,
  seuilProximite: 0.6,
  fenetreJoursTexte: 14,
};

export interface ElementDiversite {
  id: string;
  reseau: string;
  /** Date civile « AAAA-MM-JJ » (les heures ne comptent pas). */
  jour: string;
  formatId: string;
  sujet?: string;
  /** Signature posée par l'usine : lue telle quelle. */
  signatureUsine?: string;
}

export interface AlerteDiversite {
  type: "format-repete" | "texte-proche";
  reseau?: string;
  ids: string[];
  message: string;
}

export interface ResultatDiversite {
  alertes: AlerteDiversite[];
  /** Toujours false : une alerte informe, elle n'empêche rien. */
  bloquant: false;
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Numéro de jour civil (UTC, donc insensible au changement d'heure) ; null si la date est invalide. */
function numeroJour(j: string): number | null {
  const m = JOUR.exec(j);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return Math.round(t / 86_400_000);
}

function alertesFormat(items: readonly ElementDiversite[], max: number): AlerteDiversite[] {
  const sortie: AlerteDiversite[] = [];
  const groupes = new Map<string, { jour: number; id: string }[]>();
  for (const it of items) {
    const n = numeroJour(it.jour);
    if (n === null) continue;
    const cle = `${it.reseau}\u0000${it.formatId}`;
    (groupes.get(cle) ?? groupes.set(cle, []).get(cle)!).push({ jour: n, id: it.id });
  }
  for (const [cle, liste] of groupes) {
    const [reseau, formatId] = cle.split("\u0000");
    // un seul représentant par jour civil
    const parJour = new Map<number, string[]>();
    for (const x of liste) (parJour.get(x.jour) ?? parJour.set(x.jour, []).get(x.jour)!).push(x.id);
    const jours = [...parJour.keys()].sort((a, b) => a - b);
    let debut = 0;
    for (let i = 1; i <= jours.length; i++) {
      if (i < jours.length && jours[i] === jours[i - 1] + 1) continue;
      const longueur = i - debut;
      if (longueur > max) {
        const ids = jours.slice(debut, i).flatMap((j) => parJour.get(j)!);
        sortie.push({
          type: "format-repete",
          reseau,
          ids,
          message: `Le format « ${formatId} » revient ${longueur} jours de suite sur ${reseau} (au plus ${max} conseillés).`,
        });
      }
      debut = i;
    }
  }
  return sortie;
}

function alertesTexte(items: readonly ElementDiversite[], seuil: number, fenetre: number): AlerteDiversite[] {
  const sortie: AlerteDiversite[] = [];
  const pret = items
    .map((it) => ({ it, n: numeroJour(it.jour), e: empreinte({ sujet: it.sujet ?? "", signatureUsine: it.signatureUsine }) }))
    .filter((x) => x.n !== null && (x.e.axes.length > 0 || x.e.signature));
  for (let i = 0; i < pret.length; i++) {
    for (let j = i + 1; j < pret.length; j++) {
      const a = pret[i];
      const b = pret[j];
      if (Math.abs((a.n as number) - (b.n as number)) > fenetre) continue;
      const score = scoreProximite(a.e, b.e);
      if (score > 0 && score >= seuil) {
        sortie.push({
          type: "texte-proche",
          ids: [a.it.id, b.it.id],
          message: `Deux publications se ressemblent (proximité ${Math.round(score * 100)} %).`,
        });
      }
    }
  }
  return sortie;
}

/** Contrôle une liste de créneaux. Ne modifie pas l'entrée ; les dates invalides sont ignorées. */
export function controlerDiversite(
  items: readonly ElementDiversite[],
  seuils: Partial<SeuilsDiversite> = {},
): ResultatDiversite {
  const s = { ...SEUILS_DIVERSITE, ...seuils };
  return {
    alertes: [...alertesFormat(items, s.joursMaxMemeFormat), ...alertesTexte(items, s.seuilProximite, s.fenetreJoursTexte)],
    bloquant: false,
  };
}
