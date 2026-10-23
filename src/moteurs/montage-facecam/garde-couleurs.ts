/**
 * GARDE-FOU DES COULEURS (10/10, constat « zoom demandé = image cassée »). PUR.
 *
 * Une version face caméra est sortie avec toute l'image filmée en jaune et magenta ; la note VMAF n'a rien vu (elle
 * compare l'export au master, déjà faux). La composition finale compare donc aussi l'export à la PRISE ÉTALONNÉE (la
 * passe image, en amont de toute composition) : mêmes instants, même cadre (`studio-rendu`, `couleurs.ts`). Au-delà du
 * seuil, la version n'est PAS livrée : la chaîne s'arrête en échec, la version d'avant reste celle de la vidéo, et Will
 * reçoit un message clair.
 *
 * Instants comparés : sur des plans filmés tirés de la passe image, loin des raccords et de tout ce qui couvre l'image
 * (cartes plein écran, écrans partagés, mises en page, effets spéciaux). Aucune comparaison (rien n'est bloqué) quand
 * l'image ne vient pas de la passe : décor IA appliqué, effet réaliste réussi, multicaméra, passe absente.
 */
import type { PlanCamera } from "@/briques/realisation";
import type { ControleCouleurs } from "@/briques/composition/scene";

/** Instants comparés au plus (deux images lues chacun : quelques secondes de calcul). */
export const PAIRES_COULEURS_MAX = 6;
/** Marge autour d'un raccord ou d'un passage couvert (s). */
const MARGE_RACCORD_SEC = 0.3;

export const MESSAGE_COULEURS =
  "Les couleurs de la nouvelle version sont anormales (image filmée aux couleurs faussées) : elle n'a pas été livrée et la version précédente reste en ligne. Le studio est prévenu ; vous pourrez redemander la modification.";

/**
 * Paires (instant de l'export, instant et cadre dans la prise étalonnée) réparties sur la vidéo. `bandeX` : colonne de
 * la source où commence la passe image (son cadre est la bande utile). Aucun instant possible : liste vide.
 */
export function pairesCouleurs(plans: Pick<PlanCamera, "debutSec" | "finSec" | "priseDebutSec" | "cadre">[], bandeX: number, couverts: { debutSec: number; finSec: number }[], dureeSec: number, max = PAIRES_COULEURS_MAX): ControleCouleurs["paires"] {
  const libre = (t: number) => !couverts.some((c) => t > c.debutSec - MARGE_RACCORD_SEC && t < c.finSec + MARGE_RACCORD_SEC);
  const paires: ControleCouleurs["paires"] = [];
  const candidats = 4 * max;
  for (let i = 0; i < candidats && paires.length < max; i++) {
    // Instants répartis (milieux de tranches), essayés dans un ordre qui couvre toute la vidéo dès les premiers.
    const k = (i * 7) % candidats;
    const t = +((dureeSec * (k + 0.5)) / candidats).toFixed(3);
    const p = plans.find((x) => t >= x.debutSec + MARGE_RACCORD_SEC && t < x.finSec - MARGE_RACCORD_SEC);
    if (!p || !libre(t)) continue;
    const c = p.cadre;
    paires.push({ exportSec: t, referenceSec: +(p.priseDebutSec + t - p.debutSec).toFixed(3), cadre: { x: Math.max(0, c.x - bandeX), y: c.y, largeur: c.largeur, hauteur: c.hauteur } });
  }
  return paires.sort((a, b) => a.exportSec - b.exportSec);
}

/** La composition faite a-t-elle mesuré des couleurs aberrantes ? (Une mesure impossible ne bloque jamais.) */
export function couleursBloquent(mesures: Record<string, number> | undefined): boolean {
  return mesures?.couleursAberrantes === 1;
}
