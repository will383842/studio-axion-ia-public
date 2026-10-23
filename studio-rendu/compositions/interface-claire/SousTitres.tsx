import React from "react";
/**
 * Sous-titres mot à mot, à la manière de la référence : petits et NERVEUX. La phrase se construit (1 à 3 mots) ;
 * le mot EN COURS est orange (rien d'autre : aucun soulignement) et redevient ivoire à l'arrivée du suivant ; les mots
 * FORTS sont sur une plaque orange (texte ivoire, contour et ombre dure encre, légèrement inclinée) ; les petits mots
 * sont un peu plus petits (×0,81). Le groupe ENTRE d'un pop (toute la ligne 50 % → 100 % en 0,16 s) et disparaît d'un
 * coup (coupe sèche). Le mot qui entre grandit depuis son bord GAUCHE (collé au mot précédent), de 40 % à 100 % en
 * 4 images, et sa PLACE grandit avec lui : la ligne, centrée, se recentre image après image au lieu de sauter d'un coup,
 * comme dans la référence (revue passe 3 : la bande des sous-titres bougeait 1,7 % des pixels hors objet contre 3,0 %
 * dans la référence). L'espace entre les mots reste normal pendant l'entrée (« ONT ⎵⎵⎵ RETROUVÉ » corrigé). Un mot de LIAISON (« EN », « ET », « LA », « QUI »…)
 * n'apparaît jamais seul : il surgit en même temps que le mot qui le suit dans le groupe (revue passe 2).
 *
 * Taille (revue passe 2) : hauteur colorée médiane visée 0,031 H comme la référence (mesure `st.py` : la plaque orange,
 * inclinaison comprise, et le mot en cours orange). Base 0,064 L, plaque au même corps que le texte, plaque serrée.
 *
 * Position verticale fournie par la mise en page (`y` = CENTRE du bloc, en px). Bornes garanties au repos (réduction
 * automatique) ET pendant les entrées (`echellesBornees` plafonne dépassements et tressaillement) : hauteur ≤ HAUTEUR_SOUS_TITRES × H, largeur ≤ LARGEUR_MAX_SOUS_TITRES × L, plaque (bord et ombre)
 * comprise ; seule l'inclinaison de 2 à 4° des plaques soulève leurs extrémités de quelques pixels.
 */
import { interpolate, Easing } from "remotion";
import { COULEURS, POLICES } from "./charte";

export type MotSousTitre = { w: string; a: number; fort?: boolean };
export type GroupeSousTitre = { mots: MotSousTitre[]; fin: number };

/**
 * Hauteur maximale du bloc (plaque, contour et ombre compris), en fraction de la hauteur de l'image.
 * 16/10 (v3) : +25 % (0,045 → 0,0563) pour des sous-titres plus lisibles sur téléphone. La bande reste hors des yeux : `cadrage.ts`
 * lit cette constante pour placer la ligne, et `regles-v3.ts` (V5) la contrôle sur chaque élément.
 */
export const HAUTEUR_SOUS_TITRES = 0.0563;
/** Largeur maximale du bloc, en fraction de la largeur de l'image. */
export const LARGEUR_MAX_SOUS_TITRES = 0.8;

/** Style (fractions de la largeur de l'image ou de la taille du mot, « em »). */
export const STYLE_SOUS_TITRES = Object.freeze({
  /** Police de base : 8 % de la largeur depuis le 16/10 (+25 % sur 6,4 %) ; capitales ≈ 0,031 H en 1080 × 1920. */
  baseL: 0.08,
  /** Mot fort : même corps que le texte, c'est la plaque qui le distingue (à ×1,15 la plaque montait à 0,041 H). */
  fort: 1,
  /** Petits mots : 0,81 de la base (≥ 70 % du mot fort) — à 0,62, « UN », « ET » étaient illisibles (revue finale). */
  petit: 0.81,
  /** Contour encre visible (em) — tracé deux fois plus large, la moitié intérieure étant recouverte par le remplissage. */
  contourEm: 0.08,
  /** Ombre dure encre (em). */
  ombreEm: 0.04,
  /** Espace entre deux mots (fraction de la taille de base). */
  espace: 0.24,
  /** Plaque : hauteur de ligne, marges, bord (em), coins (em). */
  plaqueLigneEm: 0.74,
  plaquePadYEm: 0.01,
  plaquePadXEm: 0.16,
  plaqueBordEm: 0.05,
  plaqueCoinsEm: 0.18,
  /** Inclinaisons alternées des plaques (degrés). */
  inclinaisons: [-2, -2.8] as readonly number[],
  /**
   * Mot en cours : 40 % → 100 % en 0,16 s (4 images), léger dépassement. Plaque : 40 % → 100 % en 0,18 s, dépassement
   * 10-15 %. Revue passe 3 (planche image par image de la référence : « ÉQUIPE » part de ≈ 45 % et grandit sur 4-5
   * images ; à 60 % en 0,11 s, le mot était posé en moins de 3 images).
   */
  entreeMot: { depart: 0.4, duree: 0.16, force: 2.2 },
  entreePlaque: { depart: 0.4, duree: 0.18, force: 2.6 },
  /**
   * Entrée du GROUPE : toute la ligne 50 % → 100 % en 0,16 s (4 images), dépassement plafonné par les bornes. Revue
   * passe 3 : à 70 % en 0,12 s, la zone sous-titres ne bougeait que 3,0 % contre 4,4 % dans la référence.
   */
  entreeGroupe: { depart: 0.5, duree: 0.16, force: 2 },
  /** À chaque mot qui arrive, la ligne entière tressaille (+5 % → 0 en 0,08 s) : la référence ne reste jamais immobile. */
  pulsation: { ampleur: 0.05, duree: 0.08 },
});

/**
 * Mots de LIAISON : jamais seuls à l'écran, ils surgissent avec le mot suivant du groupe. Même liste que `MOTS_LIAISON`
 * de `realisateur/sous-titres.ts` (test) ; minuscules, accents gardés, forme élidée jugée après l'apostrophe.
 */
export const LIAISONS: readonly string[] = Object.freeze(
  (
    "le la les l un une des de du d au aux a à en et ou mais que qu qui quoi ce cet cette ces se sa son ses leur leurs vos votre " +
    "notre nos mon ma mes ton ta tes par pour sur sous dans avec sans chez vers je j on il ils elle elles ne n y"
  ).split(/\s+/),
);
const ENSEMBLE_LIAISONS = new Set(LIAISONS);
export function estLiaison(w: string): boolean {
  const s = w.toLowerCase().replace(/[.,;:!?…«»"“”()]/g, "").trim();
  if (!s || /\d/.test(s)) return false;
  return ENSEMBLE_LIAISONS.has(s) || ENSEMBLE_LIAISONS.has(s.replace(/^(jusqu|lorsqu|puisqu|qu|l|d|n|s|c|j|m|t)['’]/, ""));
}

/**
 * Instant où chaque mot du groupe APPARAÎT : le sien, sauf qu'un mot de liaison qui n'est pas le dernier emmène avec lui
 * le mot suivant (« EN » + « ONE-TO-ONE » surgissent ensemble au début de « en »). Une chaîne (« DE LA FUITE ») apparaît
 * d'un bloc. Le mot suivant n'est avancé que de 0,6 s au plus (au-delà, la liaison reste seule un instant).
 */
export function apparitions(mots: readonly MotSousTitre[]): number[] {
  const r = mots.map((m) => m.a);
  for (let k = 0; k + 1 < mots.length; k++) if (estLiaison(mots[k].w) && mots[k + 1].a - r[k] <= 0.6) r[k + 1] = Math.min(r[k + 1], r[k]);
  return r;
}

/** Petits mots (×0,81 : lisibles, mais plus petits que les autres). */
const PETITS = new Set(["de", "du", "des", "en", "et", "le", "la", "les", "un", "une", "à", "ce", "qui", "que", "je", "d'", "l'"]);

/** Avances de Montserrat ExtraBold (fraction de em), lettres capitales et chiffres — lues dans la police embarquée. */
const AVANCES: Record<string, number> = {
  A: 0.786, B: 0.769, C: 0.73, D: 0.826, E: 0.672, F: 0.642, G: 0.77, H: 0.806, I: 0.339, J: 0.557, K: 0.752, L: 0.61, M: 0.954,
  N: 0.806, O: 0.846, P: 0.737, Q: 0.846, R: 0.74, S: 0.647, T: 0.635, U: 0.786, V: 0.766, W: 1.184, X: 0.737, Y: 0.693, Z: 0.679,
  "0": 0.685, "1": 0.405, "2": 0.599, "3": 0.603, "4": 0.7, "5": 0.607, "6": 0.649, "7": 0.632, "8": 0.669, "9": 0.649,
  " ": 0.291, "'": 0.242, "’": 0.283, "-": 0.388, "%": 0.897, "€": 0.819, ".": 0.283, ",": 0.283, Œ: 1.142, Æ: 1.099,
};

/** Largeur du texte en majuscules, en em (accents ramenés à leur lettre ; inconnu = large). */
export function avanceEm(texte: string): number {
  let s = 0;
  for (const c of texte) s += AVANCES[c] ?? AVANCES[c.normalize("NFD").charAt(0)] ?? 0.9;
  return s;
}

const estPetit = (w: string) => PETITS.has(w.toLowerCase());

export interface MotPose {
  texte: string;
  taille: number;
  fort: boolean;
  /** Boîte au repos (px), bord et ombre compris, avant l'inclinaison des plaques. */
  largeur: number;
  hauteur: number;
  angle: number;
}

/**
 * Mise en place d'un groupe : tailles, boîtes et facteur de réduction pour tenir dans les bornes. `rangFort` = rang du
 * premier mot fort du groupe dans la vidéo (alternance des inclinaisons).
 */
export function poserGroupe(mots: readonly MotSousTitre[], largeurImage: number, hauteurImage = (largeurImage * 16) / 9, rangFort = 0) {
  const S = STYLE_SOUS_TITRES;
  const base = largeurImage * S.baseL;
  let rang = rangFort;
  const naturels = mots.map((m) => {
    const texte = m.w.toUpperCase();
    const avance = avanceEm(texte);
    if (m.fort) {
      const t = base * S.fort;
      const l = t * (avance + 2 * S.plaquePadXEm + 2 * S.plaqueBordEm);
      const h = t * (S.plaqueLigneEm + 2 * S.plaquePadYEm + 2 * S.plaqueBordEm);
      // Plaque très allongée : inclinaison minimale, pour que ses coins ne débordent pas.
      const voulu = S.inclinaisons[rang++ % S.inclinaisons.length];
      const angle = l > 5 * h ? -Math.min(2, Math.abs(voulu)) : voulu;
      // Boîte de la plaque (bord et ombre compris) avant inclinaison : c'est elle qui occupe la ligne. L'inclinaison
      // (2 à 4°) ne fait que soulever ses extrémités de quelques pixels.
      const ombre = t * S.ombreEm;
      return { texte, taille: t, fort: true, largeur: l + ombre, hauteur: h + ombre, angle };
    }
    const t = estPetit(m.w) ? base * S.petit : base;
    const largeur = t * (avance + 2 * S.contourEm + S.ombreEm);
    const hauteur = t * (0.7 + 2 * S.contourEm + S.ombreEm);
    return { texte, taille: t, fort: false, largeur, hauteur, angle: 0 };
  });
  const espace = base * S.espace;
  const largeurNat = naturels.reduce((s, m) => s + m.largeur, 0) + espace * Math.max(0, naturels.length - 1);
  const hauteurNat = Math.max(...naturels.map((m) => m.hauteur));
  const facteur = Math.min(1, (LARGEUR_MAX_SOUS_TITRES * largeurImage) / largeurNat, (HAUTEUR_SOUS_TITRES * hauteurImage) / hauteurNat);
  const poses: MotPose[] = naturels.map((m) => ({ ...m, taille: m.taille * facteur, largeur: m.largeur * facteur, hauteur: m.hauteur * facteur }));
  return { mots: poses, espace: espace * facteur, facteur, largeur: largeurNat * facteur, hauteur: hauteurNat * facteur };
}

/**
 * Échelles plafonnées pour que le bloc ne sorte JAMAIS des bornes, même pendant les entrées : `ligne` = tressaillement
 * de toute la ligne, `mot` = entrée du mot `p` (le débord d'un mot agrandi s'ajoute à la largeur de la ligne).
 */
export function echellesBornees(
  pose: { largeur: number; hauteur: number },
  p: { largeur: number; hauteur: number } | undefined,
  largeurImage: number,
  hauteurImage: number,
  ligne: number,
  mot: number,
) {
  const lMax = LARGEUR_MAX_SOUS_TITRES * largeurImage;
  const hMax = HAUTEUR_SOUS_TITRES * hauteurImage;
  // Une échelle < 1 (pop d'entrée du groupe) passe telle quelle ; au-delà de 1, plafonnée par les bornes.
  const l = Math.min(ligne, Math.max(1, Math.min(lMax / pose.largeur, hMax / pose.hauteur)));
  if (!p || mot <= 1) return { ligne: l, mot };
  const m = Math.max(1, Math.min(mot, hMax / (l * p.hauteur), 1 + (lMax / l - pose.largeur) / p.largeur));
  return { ligne: l, mot: m };
}

/**
 * Place occupée dans la ligne par le mot qui entre (fraction de sa largeur) : elle suit sa taille jusqu'à 100 %, jamais
 * au-delà (le dépassement ne pousse pas les voisins). Appliquée par une marge droite négative, exacte une fois le mot posé.
 */
export const placeDuMot = (echelle: number) => Math.max(0, Math.min(1, echelle));

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const entree = (t: number, a: number, e: { depart: number; duree: number; force: number }) =>
  interpolate(t, [a, a + e.duree], [e.depart, 1], { ...BORNE, easing: Easing.out(Easing.back(e.force)) });

export function SousTitres({ t, groupes, y, largeurImage, hauteurImage }: { t: number; groupes: GroupeSousTitre[]; y: number; largeurImage: number; hauteurImage?: number }) {
  const i = groupes.findIndex((x) => t >= x.mots[0].a && t < x.fin);
  if (i < 0) return null;
  const g = groupes[i];
  // Rang du premier mot fort de ce groupe dans la vidéo (inclinaisons alternées d'une plaque à l'autre).
  let rangFort = 0;
  for (let k = 0; k < i; k++) rangFort += groupes[k].mots.filter((m) => m.fort).length;
  const pose = poserGroupe(g.mots, largeurImage, hauteurImage, rangFort);
  const S = STYLE_SOUS_TITRES;
  // Un mot de liaison surgit avec le mot qui le suit : chaque mot porte son instant d'apparition `a` (≤ son début dit).
  const quand = apparitions(g.mots);
  const visibles = g.mots.map((m, k) => ({ m: { ...m, a: quand[k] }, p: pose.mots[k], k })).filter((x) => t >= x.m.a);
  const enCours = visibles[visibles.length - 1];
  // Coupe sèche : le groupe disparaît d'un coup à sa fin (aucune image de sortie).
  const pulsation = enCours ? S.pulsation.ampleur * (1 - interpolate(t, [enCours.m.a, enCours.m.a + S.pulsation.duree], [0, 1], BORNE)) : 0;
  const H = hauteurImage ?? (largeurImage * 16) / 9;
  const entreeEnCours = enCours ? entree(t, enCours.m.a, enCours.p.fort ? S.entreePlaque : S.entreeMot) : 1;
  // Pop d'entrée du groupe (toute la ligne), puis tressaillement à chaque mot.
  const pop = entree(t, quand[0], S.entreeGroupe);
  // Bornes tenues même pendant les entrées : seul le mot en cours peut dépasser 100 %, dans la limite des bornes.
  const ech = echellesBornees(pose, enCours?.p, largeurImage, H, pop * (1 + pulsation), entreeEnCours);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: largeurImage,
        top: y,
        transform: `translateY(-50%) scale(${ech.ligne})`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: pose.espace,
      }}
    >
      {visibles.map(({ m, p, k }) => {
        const texte = p.texte;
        const courant = enCours !== undefined && enCours.k === k;
        // Le mot qui entre grandit depuis son bord gauche (collé au précédent) ; seul en tête de groupe, depuis son centre.
        const origine = courant && k > 0 ? "0% 50%" : "50% 50%";
        // Sa place grandit avec lui (la ligne se recentre progressivement) : marge droite négative tant qu'il est < 100 %.
        const recul = (e: number) => (courant && k > 0 ? -(1 - placeDuMot(e)) * p.largeur : 0);
        if (p.fort) {
          const e = courant ? ech.mot : Math.min(1, entree(t, m.a, S.entreePlaque));
          return (
            <div
              key={`${m.a}-${k}`}
              style={{
                transform: `rotate(${p.angle}deg) scale(${e})`,
                transformOrigin: origine,
                marginRight: recul(e),
                background: COULEURS.orange,
                border: `${p.taille * S.plaqueBordEm}px solid ${COULEURS.encre}`,
                borderRadius: p.taille * S.plaqueCoinsEm,
                boxShadow: `${p.taille * S.ombreEm}px ${p.taille * S.ombreEm}px 0 ${COULEURS.encre}`,
                padding: `${p.taille * S.plaquePadYEm}px ${p.taille * S.plaquePadXEm}px`,
                fontFamily: POLICES.titre,
                fontSize: p.taille,
                lineHeight: S.plaqueLigneEm,
                whiteSpace: "nowrap",
                color: COULEURS.ivoire,
                WebkitTextStroke: `${p.taille * 0.06}px ${COULEURS.encre}`,
                paintOrder: "stroke fill",
                textShadow: `${p.taille * S.ombreEm}px ${p.taille * S.ombreEm}px 0 ${COULEURS.encre}`,
              }}
            >
              {texte}
            </div>
          );
        }
        const e = courant ? ech.mot : 1;
        return (
          <span
            key={`${m.a}-${k}`}
            style={{
              display: "inline-block",
              transform: `scale(${e})`,
              transformOrigin: origine,
              marginRight: recul(e),
              fontFamily: POLICES.titre,
              fontSize: p.taille,
              lineHeight: 0.9,
              whiteSpace: "nowrap",
              color: courant ? COULEURS.orange : COULEURS.ivoire,
              WebkitTextStroke: `${p.taille * 2 * S.contourEm}px ${COULEURS.encre}`,
              paintOrder: "stroke fill",
              textShadow: `${p.taille * S.ombreEm}px ${p.taille * S.ombreEm}px 0 ${COULEURS.encre}`,
            }}
          >
            {texte}
          </span>
        );
      })}
    </div>
  );
}
