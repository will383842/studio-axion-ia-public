/**
 * CONTRÔLE DU MOTION DU FILM (T-EXT-44) — PUR. Relit un `PlanMotionFilm` toutes les 20 ms (1/50 s) et nomme ce qui
 * choquerait à l'écran, en français. Sera importé par le contrôleur sans IA (T-EXT-23) : aucun appelant ici.
 * Imports relatifs seulement.
 */
import { ACCELERATION_MAX_ECRANS_S2, ECHELLE_MAX, ECHELLE_MIN, PAS_MESURE_MS, VITESSE_MAX_ECRANS_S, curseurA, mondeVersEcranPose, poseA, type EntreeMotionFilm, type PlanMotionFilm } from "./motion-film";

export type CodeDefautMotion = "VITESSE" | "A_COUP" | "ZOOM_HORS_BORNES" | "ZONE_COUPEE" | "SOUS_LES_SOUS_TITRES" | "CLIC_DECALE" | "CURSEUR_HORS_CADRE" | "DEUX_PROJECTEURS";

export interface DefautMotion {
  code: CodeDefautMotion;
  tMs: number;
  message: string;
}

export interface ResultatControleMotion {
  ok: boolean;
  defauts: DefautMotion[];
}

/** Tolérance de mesure (px, écrans) : l'arrondi du pas de 20 ms ne fait jamais un défaut. */
const TOL = 1e-6;
const TOL_PX = 0.5;
/** Écart toléré entre le clic et le début du mot. */
export const CLIC_ECART_MAX_MS = 80;
const HAUT_DEFAUT_PCT = 72;

const sec = (ms: number) => `${(ms / 1000).toFixed(2).replace(".", ",")} s`;

export function controlerMotionFilm(plan: PlanMotionFilm, entree: EntreeMotionFilm): ResultatControleMotion {
  const defauts: DefautMotion[] = [];
  const f = plan.geometrie.format;
  const page = plan.geometrie.page;
  const yST = ((plan.geometrie.hautSousTitresPct ?? HAUT_DEFAUT_PCT) / 100) * f.hauteur;
  const cibles = entree.nav.cibles.filter((c) => c.zonePct);

  const derniere = Math.max(plan.camera[plan.camera.length - 1]?.tMs ?? 0, plan.curseur[plan.curseur.length - 1]?.tMs ?? 0, ...cibles.map((c) => c.finMs));

  /** Un seul défaut par série continue de mesures fautives. */
  const serie = (code: CodeDefautMotion, fautif: (t: number) => string | null, de: number, a: number) => {
    let ouvert = false;
    for (let t = de; t <= a + 1e-9; t += PAS_MESURE_MS) {
      const m = fautif(t);
      if (m && !ouvert) defauts.push({ code, tMs: t, message: m });
      ouvert = !!m;
    }
  };

  // Caméra : bornes du zoom, vitesse, à-coup (vecteur « écrans » : centre rapporté à la vue, et logarithme du zoom).
  const vec = (t: number) => {
    const p = poseA(plan, t);
    return { cx: p.cx, cy: p.cy, z: p.zoom };
  };
  const vitesse = (t: number) => {
    const a = vec(t - PAS_MESURE_MS);
    const b = vec(t);
    const z = Math.max(a.z, b.z);
    const dt = PAS_MESURE_MS / 1000;
    return { x: (((b.cx - a.cx) * z) / f.largeur) / dt, y: (((b.cy - a.cy) * z) / f.hauteur) / dt, z: Math.log(b.z / a.z) / dt };
  };
  serie("ZOOM_HORS_BORNES", (t) => {
    const z = vec(t).z;
    return z < ECHELLE_MIN - TOL || z > ECHELLE_MAX + TOL ? `Le zoom (${z.toFixed(2).replace(".", ",")}) sort des bornes de ${ECHELLE_MIN} à ${ECHELLE_MAX}.` : null;
  }, 0, derniere);
  serie("VITESSE", (t) => {
    const v = vitesse(t);
    const n = Math.hypot(v.x, v.y, v.z);
    return n > VITESSE_MAX_ECRANS_S + TOL ? `La caméra va trop vite (${n.toFixed(2).replace(".", ",")} écran/s, au plus ${String(VITESSE_MAX_ECRANS_S).replace(".", ",")}).` : null;
  }, PAS_MESURE_MS, derniere);
  serie("A_COUP", (t) => {
    const a = vitesse(t - PAS_MESURE_MS);
    const b = vitesse(t);
    const acc = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (PAS_MESURE_MS / 1000);
    return acc > ACCELERATION_MAX_ECRANS_S2 + TOL ? `La caméra démarre ou s'arrête à-coup (${acc.toFixed(1).replace(".", ",")} écrans/s², au plus ${ACCELERATION_MAX_ECRANS_S2}).` : null;
  }, 2 * PAS_MESURE_MS, derniere);

  // Zone visée : entière dans le cadre, et au-dessus de la bande des sous-titres, à l'instant de son mot.
  // Cran « aucun » : pas de caméra, donc rien à cadrer ; le film se lit tel qu'il est posé.
  for (const c of entree.nav.cran === "aucun" ? [] : cibles) {
    const z = c.zonePct!;
    const pose = poseA(plan, c.instantMs);
    const hg = mondeVersEcranPose(pose, f, { x: page.x + (z.x / 100) * page.largeur, y: page.y + (z.y / 100) * page.hauteur });
    const bd = mondeVersEcranPose(pose, f, { x: page.x + ((z.x + z.largeur) / 100) * page.largeur, y: page.y + ((z.y + z.hauteur) / 100) * page.hauteur });
    if (hg.x < -TOL_PX || hg.y < -TOL_PX || bd.x > f.largeur + TOL_PX || bd.y > f.hauteur + TOL_PX) defauts.push({ code: "ZONE_COUPEE", tMs: c.instantMs, message: `La zone de « ${c.etapeId} » est coupée par le bord de l'image à ${sec(c.instantMs)}.` });
    if (bd.y > yST + TOL_PX) defauts.push({ code: "SOUS_LES_SOUS_TITRES", tMs: c.instantMs, message: `La zone de « ${c.etapeId} » passe sous les sous-titres à ${sec(c.instantMs)}.` });
  }

  // Clic : sur le mot (à 80 ms près).
  for (const c of cibles) {
    const proche = plan.clics.reduce<number>((m, k) => Math.min(m, Math.abs(k.tMs - c.instantMs)), Infinity);
    if (!(proche <= CLIC_ECART_MAX_MS)) defauts.push({ code: "CLIC_DECALE", tMs: c.instantMs, message: `Le clic de « ${c.etapeId} » n'est pas sur son mot (${Number.isFinite(proche) ? `écart de ${Math.round(proche)} ms` : "aucun clic"}).` });
  }

  // Curseur : jamais hors du cadre de la caméra (caché pendant un volet).
  if (plan.curseur.length > 0) {
    serie("CURSEUR_HORS_CADRE", (t) => {
      const p = curseurA(plan, t);
      if (!p) return null;
      const e = mondeVersEcranPose(poseA(plan, t), f, { x: page.x + (p.x / 100) * page.largeur, y: page.y + (p.y / 100) * page.hauteur });
      return e.x < -TOL_PX || e.y < -TOL_PX || e.x > f.largeur + TOL_PX || e.y > f.hauteur + TOL_PX ? "Le curseur sort du cadre de la caméra." : null;
    }, plan.curseur[0]!.tMs, plan.curseur[plan.curseur.length - 1]!.tMs);
  }

  // Projecteurs : jamais deux en même temps.
  const ps = [...plan.projecteurs].sort((a, b) => a.debutMs - b.debutMs);
  for (let i = 1; i < ps.length; i++) {
    if (ps[i]!.debutMs < ps[i - 1]!.finMs) defauts.push({ code: "DEUX_PROJECTEURS", tMs: ps[i]!.debutMs, message: `Deux zones sont éclairées en même temps à ${sec(ps[i]!.debutMs)}.` });
  }

  defauts.sort((a, b) => a.tMs - b.tMs);
  return { ok: defauts.length === 0, defauts };
}
