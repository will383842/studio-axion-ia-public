/**
 * Zones masquées d'une vidéo d'écran, avec attestation obligatoire.
 * Pur : aucun import de service, aucun accès disque, aucune horloge, ne lève jamais.
 * Sans attestation dans le suivi : refus clair, jamais de vidéo d'écran sans contrôle.
 * Le dessin du masque (flou, aplat) au rendu est hors périmètre.
 */
import { MAX_ZONES, type SuiviSourceEcran } from "@/domaine/source-ecran";

/** Rectangle en % de la source (0 à 100) ; sans plage de temps = actif sur toute la durée. */
export interface MasqueEcran {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  debutMs: number | null;
  finMs: number | null;
  motif?: string;
}

export interface ZoneAjoutee {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  debutMs?: number;
  finMs?: number;
  motif?: string;
}

export type ResultatMasques =
  | { ok: true; masques: MasqueEcran[]; remarques: string[] }
  | { ok: false; phrase: string };

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const borner = (v: number) => Math.min(100, Math.max(0, v));

export function masquesEcran(suivi: SuiviSourceEcran | null | undefined, zonesAjoutees: ZoneAjoutee[] = []): ResultatMasques {
  const a = suivi?.attestation;
  if (!suivi || !a || typeof a.texte !== "string" || typeof a.le !== "string" || a.texte.trim() === "" || a.le.trim() === "") {
    return {
      ok: false,
      phrase: "Cette vidéo d'écran n'a pas été contrôlée : confirmez d'abord que rien de privé n'y apparaît.",
    };
  }
  const remarques: string[] = [];
  const masques: MasqueEcran[] = [];
  for (const z of Array.isArray(suivi.zones) ? suivi.zones : []) {
    const m = rectangle(z.x, z.y, z.largeur, z.hauteur);
    if (m && fini(z.debutMs) && fini(z.finMs) && z.finMs > z.debutMs) {
      masques.push({ ...m, debutMs: z.debutMs, finMs: z.finMs, ...(typeof z.motif === "string" ? { motif: z.motif } : {}) });
    }
  }
  let ecartees = 0;
  for (const z of Array.isArray(zonesAjoutees) ? zonesAjoutees : []) {
    const m = z ? rectangle(z.x, z.y, z.largeur, z.hauteur) : null;
    const avecPlage = fini(z?.debutMs) && fini(z?.finMs);
    if (!m || (avecPlage && (z.finMs as number) <= (z.debutMs as number)) || (!avecPlage && (z.debutMs !== undefined || z.finMs !== undefined))) {
      ecartees++;
      continue;
    }
    masques.push({
      ...m,
      debutMs: avecPlage ? (z.debutMs as number) : null,
      finMs: avecPlage ? (z.finMs as number) : null,
      ...(typeof z.motif === "string" ? { motif: z.motif } : {}),
    });
  }
  if (ecartees > 0) remarques.push(`zones ajoutées : ${ecartees} zone(s) invalide(s) écartée(s)`);
  if (masques.length > MAX_ZONES) {
    remarques.push(`masques : ${masques.length - MAX_ZONES} zone(s) au-delà du plafond de ${MAX_ZONES} écartée(s)`);
    masques.length = MAX_ZONES;
  }
  return { ok: true, masques, remarques };
}

function rectangle(x: unknown, y: unknown, l: unknown, h: unknown): Pick<MasqueEcran, "x" | "y" | "largeur" | "hauteur"> | null {
  if (!fini(x) || !fini(y) || !fini(l) || !fini(h) || l <= 0 || h <= 0) return null;
  const bx = borner(x);
  const by = borner(y);
  const largeur = Math.min(l, 100 - bx);
  const hauteur = Math.min(h, 100 - by);
  if (largeur <= 0 || hauteur <= 0) return null;
  return { x: bx, y: by, largeur, hauteur };
}

/** Masques actifs à l'instant `ms` (début inclus, fin exclue ; sans plage : toujours actif). */
export function masqueA(masques: MasqueEcran[], ms: number): MasqueEcran[] {
  return masques.filter((m) => m.debutMs === null || m.finMs === null || (ms >= m.debutMs && ms < m.finMs));
}
