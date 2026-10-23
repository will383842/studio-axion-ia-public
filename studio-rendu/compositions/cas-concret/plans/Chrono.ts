/**
 * PLAN DE L'OBJET `chrono` (R3) : un anneau qui se remplit pendant que le compteur monte de 0 à la valeur demandée,
 * puis bat une fois (référence : bloc `s12`, « Quinze minutes »).
 * Textes : `textes[0]` = la valeur (« 15 ») ; `textes[1]` = l'unité (sinon « minutes »).
 * Moment : événement `chrono` (sinon 0,3 s) ; montée en 0,55 s.
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t`.
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { ajuster, enCapitales, sansBalises } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, progres, teinte, va } from "./commun";
import { cadrer, heureObjet, type ContexteObjet } from "./Objet";
import { animDe, arrivee } from "./anim-objets";

/** Unité écrite sous le compteur quand l'objet n'en fournit pas. */
export const UNITE_CHRONO = "minutes";
/** Durée de la montée du compteur (s). */
export const MONTEE_CHRONO_S = 0.55;

/** Valeur demandée : le premier nombre de `textes[0]` (0 s'il n'y en a pas). */
export function valeurDemandee(textes: readonly string[] | undefined): number {
  const m = /\d+(?:[.,]\d+)?/.exec(textes?.[0] ?? "");
  return m ? Number(m[0].replace(",", ".")) : 0;
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_CHRONO = Object.freeze(["", "anneau qui s'ouvre, unité après", "compteur d'abord, anneau ensuite"]);
/** L7 · durée du remplissage de l'anneau quand il suit le compteur (animation 2), en s. */
const REMPLISSAGE_APRES_S = 0.45;

/** Ce qui est visible du chrono (anneau de la référence : 740 px, rayon 320, trait 30). */
export function planChrono(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planChronoAnime(p, n) : planChronoV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planChronoV4(p: ContexteObjet) {
  const boite = cadrer(1, p.boite);
  const S = boite.largeur;
  const k = S / 740;
  const valeur = valeurDemandee(p.textes);
  const decimales = Number.isInteger(valeur) ? 0 : 1;
  const depart = heureObjet(p, "chrono", 0.3);
  const T = p.t - depart;
  const x = va(progres(T, 0, MONTEE_CHRONO_S));
  const affiche = Number((valeur * x).toFixed(decimales));
  const c = couleursDuFond(p.fond);
  const rayon = 320 * k;
  const circonference = 2 * Math.PI * rayon;
  const unite = sansBalises(p.textes?.[1] ?? UNITE_CHRONO);
  const boiteNombre = { x: boite.x + S * 0.17, y: boite.y + S * 0.2, largeur: S * 0.66, hauteur: S * 0.48 };
  const boiteUnite = { x: boite.x + S * 0.22, y: boite.y + S * 0.69, largeur: S * 0.56, hauteur: S * 0.13 };
  // La taille du nombre se règle sur la valeur finale : elle ne saute pas pendant la montée.
  const tailleNombre = ajuster(String(valeur), "anton", 340 * k, boiteNombre.largeur, 60 * k).taille;
  const tailleUnite = ajuster(enCapitales(unite), "anton", 80 * k, boiteUnite.largeur, 30 * k).taille;
  return {
    boite,
    depart,
    valeur: affiche,
    valeurDemandee: valeur,
    anneau: {
      centre: { x: boite.x + S / 2, y: boite.y + S / 2 },
      rayon,
      trait: 30 * k,
      circonference,
      decalage: circonference * (1 - x),
      piste: teinte(p.fond === "sombre" ? COULEURS_DUO.blanc : COULEURS_DUO.encre, 0.12),
      couleur: COULEURS_DUO.orangeVif,
      lueur: c.lueur,
    },
    nombre: { texte: String(affiche), boite: boiteNombre, taille: tailleNombre, couleur: c.accent, lueur: c.lueur, lueurLarge: c.lueurLarge, famille: famille("anton"), echelle: 1 + 0.16 * Math.sin(Math.PI * progres(T, MONTEE_CHRONO_S, 0.3)) },
    unite: { texte: unite, boite: boiteUnite, taille: tailleUnite, couleur: c.texte, famille: famille("anton") },
  };
}

/**
 * L7 · animations 1 et 2 (même compteur, même valeur). 1 : l'anneau s'ouvre en grandissant avant de se remplir, l'unité
 * monte une fois le compte fini. 2 : le compteur monte d'abord sur l'anneau vide, puis l'anneau se remplit d'un geste et
 * le nombre bat.
 */
function planChronoAnime(p: ContexteObjet, n: number) {
  const v4 = planChronoV4(p);
  const T = p.t - v4.depart;
  const anim = { numero: n, nom: ANIMS_CHRONO[n]!, cochage: false };
  const S = v4.boite.largeur;
  if (n === 1) {
    return {
      ...v4,
      anneau: { ...v4.anneau, mouvement: arrivee(progres(p.t, 0, Math.max(0.05, v4.depart)), { echelle: 0.7 }) },
      unite: { ...v4.unite, mouvement: arrivee(progres(T, MONTEE_CHRONO_S, 0.3), { dy: S * 0.05 }) },
      anim,
    };
  }
  const x = va(progres(T, MONTEE_CHRONO_S, REMPLISSAGE_APRES_S));
  const bat = 1 + 0.16 * Math.sin(Math.PI * progres(T, MONTEE_CHRONO_S + REMPLISSAGE_APRES_S, 0.3));
  return { ...v4, anneau: { ...v4.anneau, decalage: v4.anneau.circonference * (1 - x) }, nombre: { ...v4.nombre, echelle: bat }, anim };
}
