/**
 * N-04b — où poser les petits objets (gros chiffre, étape, coche) sur les scènes du tableau : dans la place encore vide
 * de la page, sous ce qui est déjà écrit et au-dessus des sous-titres, jamais sur l'écriture. Pur, ne lève jamais.
 * Côté moteur seulement (jamais lu par le rendu). `permis` vide = éteint (`{}`). Rien ne l'appelle encore (N-04e).
 */
import type { ObjetScene } from "@/briques/tableau-scene/objets";
import type { ProprietesTableauScene } from "@/briques/tableau-scene/types";
import { OBJET_GROS_CHIFFRE } from "@/briques/motion/petits-objets/gros-chiffre";
import { OBJET_ETAPE } from "@/briques/motion/petits-objets/etapes";
import { OBJET_COCHE } from "@/briques/motion/petits-objets/marques";
import { OBJETS_PAR_VIDEO_MAX, type DefinitionObjet } from "@/briques/motion/petits-objets/contrat";
import { objetsDepuisMots } from "@/briques/plan-scenes-objets/regles";
import type { MotMinute } from "@/briques/plan-scenes/schema";

/** Les trois objets que le tableau sait poser (jamais `objet-cartes-coche`). */
const DEFINITIONS: Readonly<Record<string, DefinitionObjet<unknown>>> = {
  "objet-gros-chiffre": OBJET_GROS_CHIFFRE as DefinitionObjet<unknown>,
  "objet-etape": OBJET_ETAPE as DefinitionObjet<unknown>,
  "objet-coche": OBJET_COCHE as DefinitionObjet<unknown>,
};

const MARGE_PX = 24;
const ECHELLE_MIN = 0.6;

export function objetsDesScenes(entree: { proprietes: readonly ProprietesTableauScene[]; mots: readonly MotMinute[]; permis: readonly string[] }): Record<string, ObjetScene[]> {
  try {
    const proprietes: readonly ProprietesTableauScene[] = entree.proprietes;
    const permis = (Array.isArray(entree.permis) ? entree.permis : []).filter((p): p is string => typeof p === "string" && p in DEFINITIONS);
    if (permis.length === 0 || !Array.isArray(entree.proprietes) || !Array.isArray(entree.mots) || entree.mots.length === 0) return {};
    const sortie: Record<string, ObjetScene[]> = {};
    for (const prop of objetsDepuisMots(entree.mots, { permis }).slice(0, OBJETS_PAR_VIDEO_MAX)) {
      const def = DEFINITIONS[prop.id];
      const t = prop.debutSec * 1000;
      const p = proprietes.find((x) => t >= x.scene.debutMs && t < x.scene.finMs);
      if (!def || !p) continue;
      if (p.v2 || (p.styleReference && p.styleReference.style !== "reference/1")) continue;
      const finMs = Math.min(prop.finSec * 1000, p.scene.finMs);
      if ((finMs - t) / 1000 < def.dureeSec.min) continue;
      const bas = p.page.elements
        .filter((e) => p.dejaEcrits.includes(e.elementId) || e.sceneId === p.scene.id)
        .reduce((m, e) => { const r = (e.encombrement ?? e).px; return Math.max(m, r.y + r.hauteur); }, 0);
      const z = p.zoneSure.px;
      const haut = Math.max(bas, z.y) + MARGE_PX;
      const fond = Math.min(p.bandeSousTitres.px.y, z.y + z.hauteur) - MARGE_PX;
      const libreH = fond - haut;
      const libreL = z.largeur;
      if (!(libreH > 0) || !(libreL > 0)) continue;
      const w = def.toile.largeur * (p.largeur / 1080);
      const h = def.toile.hauteur * (p.largeur / 1080);
      const echelle = Math.min(1, libreL / w, libreH / h);
      if (!(echelle >= ECHELLE_MIN)) continue;
      const largeur = w * echelle;
      const hauteur = h * echelle;
      const boite = { x: Math.round(z.x + (libreL - largeur) / 2), y: Math.round(haut), largeur: Math.round(largeur), hauteur: Math.round(hauteur) };
      (sortie[p.scene.id] ??= []).push({
        id: prop.id,
        debutMs: Math.round(t - p.scene.debutMs),
        finMs: Math.round(finMs - p.scene.debutMs),
        parametres: Object.freeze({ ...(prop.parametres as Record<string, unknown>) }),
        boite,
      });
    }
    return sortie;
  } catch {
    return {};
  }
}
