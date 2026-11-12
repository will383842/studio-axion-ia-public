/**
 * CAL-16 · Contrôleur de diversité du calendrier (PUR, sans IA, sans appel réel).
 * - même format plus de N jours de suite sur un réseau : alerte (N = 2 par défaut) ;
 * - SUJET : si les deux créneaux portent une signature posée par l'usine, alerte « sujet-repete » si et seulement si
 *   les signatures sont égales (lecture seule, aucun calcul) ;
 * - TEXTE : deux textes trop proches (mots seuls, signature de l'usine exclue du calcul) : alerte « texte-proche ».
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
  /** Date civile « AAAA-MM-JJ » à l'heure de Paris (les heures ne comptent pas) ; aucune conversion ici : c'est à l'appelant. */
  jour: string;
  formatId: string;
  /** Texte comparé pour la proximité (sujet, ou corps du texte si l'écran le fournit). */
  sujet?: string;
  /** Signature posée par l'usine : lue telle quelle, comparée par égalité, jamais recalculée. */
  signatureUsine?: string;
}

export interface AlerteDiversite {
  type: "format-repete" | "texte-proche" | "sujet-repete";
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

/** Sujet : deux signatures de l'usine égales dans la fenêtre = même sujet. Aucun calcul sur les mots. */
function alertesSujet(items: readonly ElementDiversite[], fenetre: number): AlerteDiversite[] {
  const sortie: AlerteDiversite[] = [];
  const pret = items
    .map((it) => ({ it, n: numeroJour(it.jour), sig: it.signatureUsine?.trim() }))
    .filter((x): x is { it: ElementDiversite; n: number; sig: string } => x.n !== null && !!x.sig);
  for (let i = 0; i < pret.length; i++) {
    for (let j = i + 1; j < pret.length; j++) {
      const a = pret[i];
      const b = pret[j];
      if (Math.abs(a.n - b.n) > fenetre || a.sig !== b.sig) continue;
      sortie.push({ type: "sujet-repete", ids: [a.it.id, b.it.id], message: "Ces deux publications portent le même sujet (signature de l'usine)." });
    }
  }
  return sortie;
}

function alertesTexte(items: readonly ElementDiversite[], seuil: number, fenetre: number): AlerteDiversite[] {
  const sortie: AlerteDiversite[] = [];
  const pret = items
    .map((it) => ({ it, n: numeroJour(it.jour), e: empreinte({ sujet: it.sujet ?? "" }) }))
    .filter((x) => x.n !== null && x.e.axes.length > 0);
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

/** Seuil réglable : une valeur qui n'est pas un nombre fini ≥ `min` retombe sur le défaut (jamais d'alertes partout ni nulle part). */
function nombreOuDefaut(v: unknown, defaut: number, min: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= min ? v : defaut;
}

/** Contrôle une liste de créneaux. Ne modifie pas l'entrée ; les dates invalides sont ignorées. */
export function controlerDiversite(
  items: readonly ElementDiversite[],
  seuils: Partial<SeuilsDiversite> = {},
): ResultatDiversite {
  const s = {
    joursMaxMemeFormat: nombreOuDefaut(seuils.joursMaxMemeFormat, SEUILS_DIVERSITE.joursMaxMemeFormat, 1),
    seuilProximite: nombreOuDefaut(seuils.seuilProximite, SEUILS_DIVERSITE.seuilProximite, 0),
    fenetreJoursTexte: nombreOuDefaut(seuils.fenetreJoursTexte, SEUILS_DIVERSITE.fenetreJoursTexte, 0),
  };
  return {
    alertes: [...alertesFormat(items, s.joursMaxMemeFormat), ...alertesSujet(items, s.fenetreJoursTexte), ...alertesTexte(items, s.seuilProximite, s.fenetreJoursTexte)],
    bloquant: false,
  };
}
