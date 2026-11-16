/**
 * Suivi d'une source d'écran (version 1) et lecteur tolérant.
 * Pur : aucun import de service, aucun accès disque, ne lève jamais.
 * Données privées : les remarques ne contiennent que des comptes.
 */

export interface PointSuivi {
  tMs: number;
  /** % de la source, 0 à 100. */
  x: number;
  y: number;
}

export interface ZoneSuivi {
  debutMs: number;
  finMs: number;
  /** % de la source, 0 à 100. */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  motif?: string;
}

export interface SuiviSourceEcran {
  version: 1;
  origine: "navigateur" | "fichier" | "inconnue";
  imagesParSeconde: number;
  /** Pixels de la source. */
  largeur: number;
  hauteur: number;
  curseur: PointSuivi[];
  clics: PointSuivi[];
  zones: ZoneSuivi[];
  attestation?: { texte: string; le: string };
}

export const MAX_POINTS_CURSEUR = 20000;
export const MAX_CLICS = 2000;
export const MAX_ZONES = 200;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const borner = (v: number) => Math.min(100, Math.max(0, v));

function lirePoints(brut: unknown, max: number, nom: string, remarques: string[]): PointSuivi[] {
  if (brut === undefined) return [];
  if (!Array.isArray(brut)) {
    remarques.push(`${nom} : liste absente ou illisible, ignorée`);
    return [];
  }
  const sortie: PointSuivi[] = [];
  let ecartes = 0;
  for (const p of brut) {
    if (estObjet(p) && fini(p.tMs) && p.tMs >= 0 && fini(p.x) && fini(p.y)) {
      sortie.push({ tMs: p.tMs, x: borner(p.x), y: borner(p.y) });
    } else ecartes++;
  }
  if (ecartes > 0) remarques.push(`${nom} : ${ecartes} point(s) invalide(s) écarté(s)`);
  sortie.sort((a, b) => a.tMs - b.tMs);
  if (sortie.length > max) {
    remarques.push(`${nom} : ${sortie.length - max} point(s) au-delà du plafond de ${max} écarté(s)`);
    sortie.length = max;
  }
  return sortie;
}

function lireZones(brut: unknown, remarques: string[]): ZoneSuivi[] {
  if (brut === undefined) return [];
  if (!Array.isArray(brut)) {
    remarques.push("zones : liste absente ou illisible, ignorée");
    return [];
  }
  const sortie: ZoneSuivi[] = [];
  let ecartes = 0;
  for (const z of brut) {
    if (
      estObjet(z) && fini(z.debutMs) && fini(z.finMs) && z.debutMs >= 0 && z.finMs > z.debutMs &&
      fini(z.x) && fini(z.y) && fini(z.largeur) && fini(z.hauteur) && z.largeur > 0 && z.hauteur > 0
    ) {
      const x = borner(z.x);
      const y = borner(z.y);
      const largeur = Math.min(z.largeur, 100 - x);
      const hauteur = Math.min(z.hauteur, 100 - y);
      if (largeur <= 0 || hauteur <= 0) {
        ecartes++;
        continue;
      }
      const zone: ZoneSuivi = { debutMs: z.debutMs, finMs: z.finMs, x, y, largeur, hauteur };
      if (typeof z.motif === "string") zone.motif = z.motif;
      sortie.push(zone);
    } else ecartes++;
  }
  if (ecartes > 0) remarques.push(`zones : ${ecartes} zone(s) invalide(s) écartée(s)`);
  sortie.sort((a, b) => a.debutMs - b.debutMs);
  if (sortie.length > MAX_ZONES) {
    remarques.push(`zones : ${sortie.length - MAX_ZONES} zone(s) au-delà du plafond de ${MAX_ZONES} écartée(s)`);
    sortie.length = MAX_ZONES;
  }
  return sortie;
}

/** Lit un suivi brut. Ne lève jamais ; `suivi: null` si inutilisable. */
export function lireSuiviSourceEcran(brut: unknown): { suivi: SuiviSourceEcran | null; remarques: string[] } {
  const remarques: string[] = [];
  try {
    if (!estObjet(brut)) return { suivi: null, remarques: ["suivi : entrée non objet"] };
    if (!fini(brut.imagesParSeconde) || brut.imagesParSeconde < 1 || brut.imagesParSeconde > 120) {
      return { suivi: null, remarques: ["suivi : imagesParSeconde hors 1-120"] };
    }
    if (!fini(brut.largeur) || !fini(brut.hauteur) || brut.largeur <= 0 || brut.hauteur <= 0) {
      return { suivi: null, remarques: ["suivi : dimensions de la source invalides"] };
    }
    const origine = brut.origine === "navigateur" || brut.origine === "fichier" ? brut.origine : "inconnue";
    const suivi: SuiviSourceEcran = {
      version: 1,
      origine,
      imagesParSeconde: brut.imagesParSeconde,
      largeur: brut.largeur,
      hauteur: brut.hauteur,
      curseur: lirePoints(brut.curseur, MAX_POINTS_CURSEUR, "curseur", remarques),
      clics: lirePoints(brut.clics, MAX_CLICS, "clics", remarques),
      zones: lireZones(brut.zones, remarques),
    };
    const a = brut.attestation;
    if (estObjet(a) && typeof a.texte === "string" && typeof a.le === "string") {
      suivi.attestation = { texte: a.texte, le: a.le };
    }
    return { suivi, remarques };
  } catch {
    return { suivi: null, remarques: ["suivi : lecture impossible"] };
  }
}
