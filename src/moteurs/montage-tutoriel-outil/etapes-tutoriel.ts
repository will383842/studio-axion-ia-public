// Tutoriel d'outil, G5-01 : étapes et chapitres déduits du script, SANS Claude (fonction pure, déterministe).
// Aucun import `@/…` : ce fichier pourra être lu par le rendu.

/** Type minimal, compatible avec `MotHorodate` (src/domaine/types.ts). */
export interface MotTutoriel {
  mot: string;
  debutSec: number;
  finSec: number;
}

export interface EtapeTutoriel {
  numero: number;
  total: number;
  libelle: string;
  /** Rang (base 0) du premier mot de l'étape dans le script, marqueur compris. */
  premierMot: number;
  /** Rang (base 0) du dernier mot de l'étape. */
  dernierMot: number;
  debutSec: number;
  finSec: number;
}

export interface ChapitreTutoriel {
  titre: string;
  debutSec: number;
}

export interface EntreeEtapesTutoriel {
  script: string;
  mots: MotTutoriel[];
  dureeSec: number;
}

export interface SortieEtapesTutoriel {
  etapes: EtapeTutoriel[];
  chapitres: ChapitreTutoriel[];
}

/** Même seuil que `DUREE_MIN_CHAPITRES_SEC` (src/domaine/site-videos/chapitres.ts). */
export const DUREE_MIN_CHAPITRES_TUTORIEL_SEC = 30;
export const ETAPES_MAX = 9;
export const LIBELLE_MAX = 40;

const MARQUEUR =
  /^(?:étape\s*\d+|\d{1,2}\s*[.)]|d['’]abord|premièrement|ensuite|puis|après|enfin|pour finir)(?![\p{L}\d-])\s*[,:;.)\-–]?\s*/iu;

const dixieme = (n: number) => Math.round(n * 10) / 10;

/** Même découpe que `compterMots` du moteur : espaces seulement, donc « l'outil » = 1 mot. */
const compter = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

interface Phrase {
  texte: string;
  mots: number;
  marqueur: boolean;
  paragraphe: number;
}

function phrases(script: string): Phrase[] {
  const sortie: Phrase[] = [];
  const paragraphes = script.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  paragraphes.forEach((para, p) => {
    for (const ligne of para.split("\n")) {
      const morceaux = ligne.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
      // « 1. Ouvrez » : le point d'une numérotation ne termine pas la phrase.
      const fusion: string[] = [];
      for (let i = 0; i < morceaux.length; i++) {
        if (/^\d{1,2}[.)]$/.test(morceaux[i]) && i + 1 < morceaux.length) {
          fusion.push(`${morceaux[i]} ${morceaux[i + 1]}`);
          i++;
        } else fusion.push(morceaux[i]);
      }
      for (const texte of fusion) {
        sortie.push({ texte, mots: compter(texte), marqueur: MARQUEUR.test(texte), paragraphe: p });
      }
    }
  });
  return sortie;
}

function libelleDe(texte: string, numero: number): string {
  let l = texte.replace(MARQUEUR, "").replace(/[\s.!?…,:;]+$/u, "").trim();
  if (!l) return `Étape ${numero}`;
  l = l.charAt(0).toUpperCase() + l.slice(1);
  return l.length > LIBELLE_MAX ? `${l.slice(0, LIBELLE_MAX - 1).trimEnd()}…` : l;
}

interface Groupe {
  texte: string;
  mots: number;
}

/** Au-delà de 9, la plus courte fusionne avec sa voisine (la précédente, ou la suivante pour la première). */
function fusionner(groupes: Groupe[]): Groupe[] {
  const g = groupes.map((x) => ({ ...x }));
  while (g.length > ETAPES_MAX) {
    let i = 0;
    for (let k = 1; k < g.length; k++) if (g[k].mots < g[i].mots) i = k;
    const cible = i === 0 ? 1 : i - 1;
    const [a, b] = cible < i ? [cible, i] : [i, cible];
    g[a] = { texte: g[a].texte, mots: g[a].mots + g[b].mots };
    g.splice(b, 1);
  }
  return g;
}

export function etapesTutoriel({ script, mots, dureeSec }: EntreeEtapesTutoriel): SortieEtapesTutoriel {
  const vide: SortieEtapesTutoriel = { etapes: [], chapitres: [] };
  const ph = phrases(script);
  const total = ph.reduce((a, p) => a + p.mots, 0);
  if (total === 0) return vide;

  let groupes: Groupe[] = [];
  if (ph.filter((p) => p.marqueur).length >= 2) {
    // Les mots avant le premier marqueur n'ouvrent aucune étape.
    for (const p of ph) {
      if (p.marqueur) groupes.push({ texte: p.texte, mots: p.mots });
      else if (groupes.length) groupes[groupes.length - 1].mots += p.mots;
      else groupes.push({ texte: "", mots: p.mots });
    }
    if (groupes[0].texte === "") groupes = groupes.slice(1);
  } else {
    let courant = -1;
    for (const p of ph) {
      if (p.paragraphe !== courant) {
        groupes.push({ texte: p.texte, mots: p.mots });
        courant = p.paragraphe;
      } else groupes[groupes.length - 1].mots += p.mots;
    }
  }
  if (groupes.length < 2) return vide;
  groupes = fusionner(groupes);

  // Les mots avant le premier marqueur décalent le premier rang.
  const avant = total - groupes.reduce((a, g) => a + g.mots, 0);
  const suffisants = mots.length >= total;
  let rang = avant;
  const etapes: EtapeTutoriel[] = groupes.map((g, i) => {
    const premierMot = rang;
    const dernierMot = rang + g.mots - 1;
    rang += g.mots;
    const debutSec = suffisants ? mots[premierMot].debutSec : (premierMot / total) * dureeSec;
    const finSec = suffisants ? mots[dernierMot].finSec : ((dernierMot + 1) / total) * dureeSec;
    return {
      numero: i + 1,
      total: groupes.length,
      libelle: libelleDe(g.texte, i + 1),
      premierMot,
      dernierMot,
      debutSec: dixieme(debutSec),
      finSec: dixieme(finSec),
    };
  });

  const chapitres =
    dureeSec < DUREE_MIN_CHAPITRES_TUTORIEL_SEC ? [] : etapes.map((e) => ({ titre: e.libelle, debutSec: e.debutSec }));
  return { etapes, chapitres };
}
