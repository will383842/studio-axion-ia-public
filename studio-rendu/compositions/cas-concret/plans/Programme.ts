/**
 * PLAN de l'objet `programme` (R5) : une feuille de programme de biais — un bandeau, puis des titres de modules qui
 * entrent un à un. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce.
 * PUR : ni `remotion` ni React. Textes fournis par `textes` : un titre de module par texte (quatre au plus).
 */
import { couperTexte, largeurTexte, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, couleursDuFond, doux, famille, graisse, progres, type ProprietesObjet } from "./commun";
import { animDe, arrivee, surgie, type AvecAnim } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; lignes: string[]; tient: boolean };

/** Nombre de modules affichés au plus. */
export const MODULES_MAX = 4;
/** Instants (s depuis le début de l'écran) : premier module, pas entre deux modules, durée d'une entrée. */
export const TEMPS_PROGRAMME = Object.freeze({ premier: 0.5, pas: 0.35, duree: 0.35 });

/** Pose un texte dans une boîte : sur `lignesMax` lignes au plus, à la taille voulue réduite (jusqu'à 60 %) pour qu'il tienne. */
function poser(texte: string | undefined, boite: BoitePx, voulue: number, lignesMax = 1): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const interligne = 1.2;
  const reglage = { police: "inter-gras" as const, approche: 0, capitales: false };
  const tient = (s: number) => {
    const l = couperTexte(t, reglage, s, boite.largeur);
    return l.length <= lignesMax && l.length * s * interligne <= boite.hauteur + 0.01 && l.every((x) => largeurTexte(x, "inter-gras", s) <= boite.largeur);
  };
  const depart = Math.min(voulue, boite.hauteur / (interligne * lignesMax));
  let taille = depart;
  while (taille > depart * 0.6 && !tient(taille)) taille = Math.max(depart * 0.6, taille - 1);
  return { texte: t, boite, taille, lignes: couperTexte(t, reglage, taille, boite.largeur), tient: tient(taille) };
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_PROGRAMME = Object.freeze(["", "modules depuis la gauche, puces qui surgissent", "modules qui se déplient"]);

export function planProgramme(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planProgrammeAnime(p, image, n) : planProgrammeV4(p, image);
}

/** Le plan de la v4 (animation n° 0). */
function planProgrammeV4(p: ProprietesObjet, image?: number) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const titres = (p.textes ?? []).map((x) => sansBalises(x).trim()).filter(Boolean).slice(0, MODULES_MAX);
  const n = Math.max(1, titres.length);
  const bandeau: BoitePx = { x: 0, y: 0, largeur: w, hauteur: h * 0.14 };
  const marge = w * 0.07;
  const zone: BoitePx = { x: marge, y: bandeau.hauteur + h * 0.05, largeur: w - 2 * marge, hauteur: h - bandeau.hauteur - h * 0.09 };
  const pas = zone.hauteur / MODULES_MAX;
  const hauteurRang = Math.min(pas * 0.82, h * 0.15, w * 0.2);
  const rond = hauteurRang * 0.62;
  const modules = titres.map((titre, i) => {
    const x = progres(t, TEMPS_PROGRAMME.premier + i * TEMPS_PROGRAMME.pas, TEMPS_PROGRAMME.duree);
    const rang: BoitePx = { x: zone.x, y: zone.y + i * pas + (pas - hauteurRang) / 2, largeur: zone.largeur, hauteur: hauteurRang };
    const zoneTexte: BoitePx = { x: rang.x + rond * 1.7, y: rang.y, largeur: rang.largeur - rond * 1.7 - w * 0.02, hauteur: rang.hauteur };
    return {
      boite: rang,
      puce: { x: rang.x + rond * 0.2, y: rang.y + (rang.hauteur - rond) / 2, diametre: rond, couleur: COULEURS_DUO.orangeVif },
      texte: poser(titre, zoneTexte, hauteurRang * 0.5, 2),
      fond: COULEURS_DUO.ivoire,
      opacite: c01(x * 2.5),
      decalageX: (1 - doux(x)) * w * 0.12,
    };
  });
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    rayon: Math.min(w, h) * 0.07,
    fiche: COULEURS_DUO.blanc,
    ombre: c.ombre,
    bandeau: { boite: bandeau, couleur: COULEURS_DUO.encre, accent: { x: w * 0.07, y: bandeau.hauteur * 0.4, largeur: w * 0.22, hauteur: bandeau.hauteur * 0.2, couleur: COULEURS_DUO.orangeVif } },
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras"), couleur: COULEURS_DUO.encre },
    rayonRang: hauteurRang * 0.3,
    modules,
    nombre: n,
    textes: modules.filter((m) => m.opacite > 0).map((m) => m.texte?.texte).filter((x): x is string => !!x),
  };
}

/**
 * L7 · animations 1 et 2 (mêmes titres de modules). 1 : les modules entrent depuis la gauche et leur puce surgit une
 * fois la rangée posée. 2 : le trait du bandeau s'étire, puis chaque module se déplie de haut en bas.
 */
function planProgrammeAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  const v4 = planProgrammeV4(p, image);
  const anim = { numero: n, nom: ANIMS_PROGRAMME[n]!, cochage: false };
  const debut = (i: number) => TEMPS_PROGRAMME.premier + i * TEMPS_PROGRAMME.pas;
  if (n === 1) {
    const modules = v4.modules.map((m, i) => ({ ...m, decalageX: -m.decalageX, puce: { ...m.puce, mouvement: surgie(progres(t, debut(i) + TEMPS_PROGRAMME.duree, 0.3)) } }));
    return { ...v4, modules, anim };
  }
  const modules = v4.modules.map((m, i) => {
    const mouvement = arrivee(progres(t, 0.4 + i * 0.25, 0.3), { echelleY: 0, origine: "50% 0%" });
    return { ...m, opacite: mouvement.opacite, decalageX: 0, mouvement: { ...mouvement, opacite: 1 } };
  });
  const a = v4.bandeau.accent;
  return { ...v4, bandeau: { ...v4.bandeau, accent: { ...a, largeur: a.largeur * doux(progres(t, 0, 0.4)) } }, modules, textes: modules.filter((m) => m.opacite > 0).map((m) => m.texte?.texte).filter((x): x is string => !!x), anim };
}
