/**
 * RYTHME PRÉVU D'UN PLAN — le contrôle du plan compte COMME LA MESURE (revue passe 3 du 15/10, priorité 1).
 *
 * La mesure de référence est `dynamisme.py` (25 i/s, image réduite à 90 × 160 en gris) : un « pic » est une image où plus de
 * 0,6 % des pixels changent de plus de 40 niveaux, et qui est la plus forte de ses ± 2 voisines ; un « gros mouvement » est
 * un pic au-dessus de 5 % de l'image ; un « trou » est le temps entre deux pics. Avant ce module, le contrôle comptait
 * comme mouvement chaque sous-élément de carte (puce, icône, coche) : la vidéo 4 se croyait sans trou (0,69 s au plus)
 * alors que la mesure en trouvait 17 de plus de 0,7 s (1,20 s au plus) et 58,1 gros mouvements par minute.
 *
 * Ici, chaque événement du plan reçoit la SURFACE D'ÉCRAN qu'il change (en % de l'image) :
 *  - descente, changement de niveau et remontée de la prise : proportionnels au déplacement (la prise entière bouge) ;
 *  - entrée et sortie d'une carte, d'une fenêtre, d'un calque : leur emprise au rendu (géométrie de `cadrage.ts`) ;
 *  - sous-élément de carte : sa surface MESURÉE au rendu, par genre (`SURFACES_SOUS_ELEMENTS`) ;
 *  - changement de groupe de sous-titres : un petit pic (jamais un gros mouvement).
 * Les surfaces sont posées sur une grille de 25 i/s, puis on cherche les pics exactement comme `dynamisme.py`. Un pic
 * compte pour un gros mouvement selon une rampe (3 % → 0, 7 % → 1) : au rendu, un même genre d'élément tombe tantôt
 * au-dessus, tantôt au-dessous de 5 % (ex. pastille de calendrier : 4,9 % de médiane, 50 % au-dessus de 5 %).
 *
 * ÉTALONNAGE (15/10, `scripts/mesure-rythme.ts --etalonner`) sur les plans et les rendus des vidéos 3 et 4. Les constantes
 * géométriques sont des COPIES de `studio-rendu/.../cadrage.ts` et `charte.ts` (le moteur n'importe pas le rendu, qui tire
 * des composants React) : si le rendu change une taille, remesurer avec l'outil et mettre à jour ici.
 *
 * PUR : aucune entrée-sortie.
 */
import { CADRAGE_FENETRE_DEFAUT, PRISE_DEFAUTS, type CalquePlan, type CartePlan, type MotionPlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { CATALOGUE_FAMILLES } from "./familles";
import { instantsMotion } from "./sons";

/** Seuils de la mesure (`dynamisme.py`) et du contrôle. */
export const MESURE_RYTHME = Object.freeze({
  fps: 25,
  /** Un pic : plus de 0,6 % de l'image change. */
  seuilPic: 0.6,
  /** Un gros mouvement : plus de 5 % de l'image. */
  seuilGros: 5,
  /** Rampe du gros mouvement : en dessous de 3 % jamais, au-dessus de 7 % toujours (variation du rendu autour de 5 %). */
  rampeGros: [3, 7] as const,
  /** Un événement prévu fait un pic SÛR au-dessus de 1 % (de 0,6 à 1 %, il n'est vu qu'une fois sur deux). */
  picSur: 1,
  /** Pics voisins : la mesure garde l'image la plus forte de ± 2 images. */
  voisinage: 2,
});

/* ---------------- Géométrie (copies du rendu) ---------------- */

const G = Object.freeze({
  /** Carte : 0,81 L, haut à 0,13 H, hauteur 0,335 H au moins, bas à 0,50 H au plus (cadrage.ts, CARTE). */
  carteL: 0.81,
  carteY: 0.13,
  carteHMin: 0.335,
  carteBasMax: 0.5,
  /** Fenêtre « sur-le-visage » 0,81 L × 0,57 H ; « au-dessus » 0,81 L × 0,30 H, bas à 0,43 H. */
  fenetreVisage: 0.81 * 0.57,
  fenetreDessus: 0.81 * 0.3,
  fenetreDessusBas: 0.43,
  /** Fin : panneau de 0,13 à 0,47 H. */
  finBas: 0.47,
  /** Descente (cadrage.ts, DESCENTE). */
  yeuxSousObjet: 0.12,
  descenteMax: 0.42,
  minCalque: 0.06,
  margeCalque: 0.01,
  cheveux: 0.2,
  enchainement: 0.3,
  imagesRetard: 1.5,
  /** Étiquette : corps 0,058 L, centre à 0,085 H, marge 0,04 L, dépassement du pop 1,1 (cadrage.ts). */
  etiquetteCorps: 0.058,
  etiquetteY: 0.085,
  etiquetteDispo: 1 / 1.1,
  compteurCorps: 0.08,
  glisseCorps: 0.034,
  logoCote: 0.11,
  tuileCote: 0.12,
  /** Durées d'animation (charte.ts, TEMPS). */
  sortieCarte: 0.12,
  entreeFenetre: 0.22,
  sortieFenetre: 0.17,
  pop: 0.17,
  defilementCompteur: 1.5,
  defilementVif: 0.7,
});

/* ---------------- Surfaces (étalonnées sur les vidéos 3 et 4) ---------------- */

/**
 * Coefficients : % de l'image qui change, rapporté à la surface géométrique de l'objet (contraste : un objet plein,
 * contourné et ombré, sur la prise, change presque tous ses pixels ; son pop d'échelle déborde un peu).
 */
export const COEFFICIENTS_SURFACE = Object.freeze({
  /** Prise : % par unité de déplacement (fraction de H). Étiquette avec descente de 0,06 H : ≈ 20 % mesurés. */
  prise: 330,
  priseMax: 55,
  /** Entrée et sortie de carte (la carte vole : un peu plus que son emprise ; sortie en 0,12 s). */
  carteEntree: 1,
  carteSortie: 0.7,
  /** Entrée et sortie de fenêtre (glisse et s'incline). */
  fenetreEntree: 0.9,
  fenetreSortie: 0.6,
  /** Calques posés sur la prise : pop d'échelle + texte contrasté. */
  calque: 1.6,
  /** Sortie d'un calque sans remontée de la prise (mesure : 1,1 à 2,2 % de l'image) : la moitié de son entrée. */
  calqueSortie: 0.5,
  /** Somme de plusieurs événements dans la même image : plafond. */
  plafond: 80,
});

/** Durées des animations (charte.ts, TEMPS ; cadrage.ts, DESCENTE). */
const T = Object.freeze({ image: 1 / 25, entreeCarte: 0.16, sortieCarte: 0.12, entreeFenetre: 0.22, sortieFenetre: 0.17, pop: 0.17, sortieCalque: 0.12, descente: 0.12, remontee: 0.14, sousElement: 0.12 });
/** Part de la surface comptée aux images d'une animation autres que la plus forte. */
const ETALEMENT = 0.6;
/** Icône qui surgit dans une étiquette. */
export const SURFACE_ICONE_ETIQUETTE = 1.5;

/** Étiquette posée sur une fenêtre (mesure : 4,0 % de médiane, 36 % au-dessus de 5 %). */
export const SURFACE_ETIQUETTE_FENETRE = 4;
/** Changement de groupe de sous-titres (mesure : 2,1 % de médiane, 81 % de pics visibles). */
export const SURFACE_SOUS_TITRE = 2;
/** Mot qui s'ajoute dans un groupe (mesure : 0,9 à 1,3 %) et disparition d'un groupe suivi d'un blanc (≈ 1 %). */
export const SURFACE_MOT = 1.2;
export const SURFACE_FIN_GROUPE = 1;

/**
 * Sous-éléments de cartes : % de l'image MESURÉ au rendu (médianes des vidéos 3 et 4), par genre « type.champ ». Une puce
 * de frise (0,7 %), une icône de vignette (2,4 %), une coche (1,3 %) ne font PAS de gros mouvement ; une ligne de liste
 * (6,2 %), une étape de frise (7,3 %), une vignette de grille (6,5 %) en font un.
 * Les genres jamais rendus dans une vidéo mesurée ont une estimation prudente d'après leur taille (marquée « estimé »).
 */
export const SURFACES_SOUS_ELEMENTS: Readonly<Record<string, number>> = Object.freeze({
  "frise.etapes.a": 7.3,
  "frise.puces.a": 0.7,
  "frise.cocheA": 0.3,
  "frise.badge.a": 0.5,
  "grille.vignettes.a": 6.5,
  "grille.vignettes.contenu.iconeA": 2.4,
  "liste.lignes.a": 6.2,
  "liste.cocheA": 1.3,
  "liste.badge.a": 2.1,
  "liste.entete.a": 1.7,
  "calendrier.pastilles.a": 4.9,
  "calendrier.rangee.a": 3, // estimé
  "graphique.baseA": 3, // estimé
  "graphique.barres.a": 4.9,
  "graphique.pastilles.a": 5.3,
  "statuts.lignes.a": 2,
  "statuts.lignes.bascule": 5.8,
  "commentaire.publication.a": 4, // estimé
  "commentaire.champ.a": 5.5,
  "commentaire.saisie.debut": 1.7,
  "commentaire.saisie.fin": 0.9,
  "commentaire.bouton.a": 2.1,
  "commentaire.commentaire.a": 3.9,
  "commentaire.commentaire.jaimeA": 1, // estimé
  "commentaire.notification.a": 4, // estimé
  "chat.message.a": 3, // estimé
  "chat.reponse.a": 4, // estimé
  "chat.puces.a": 2.5, // estimé
  "calcul.avant.a": 4, // estimé
  "calcul.apres.a": 4, // estimé
  "calcul.avant.lignes.a": 2.5, // estimé
  "calcul.apres.lignes.a": 2.5, // estimé
  "calcul.avant.totalA": 2.5, // estimé
  "calcul.apres.totalA": 2.5, // estimé
  "calcul.avant.barreA": 1.5, // estimé
  "calcul.apres.barreA": 1.5, // estimé
  "calcul.barreTotalAvantA": 1.5, // estimé
  "calcul.badge.a": 2, // estimé
  "logos.compteur.a": 3, // estimé
  "logos.tuiles.a": 2, // estimé
  "logos.cadenas.a": 3, // estimé
});
/** Genre inconnu : estimation prudente (un petit élément). */
export const SURFACE_SOUS_ELEMENT_DEFAUT = 2;

/** Genre d'un sous-élément : « liste.lignes.a » pour « contenu.lignes[2].a » d'une carte liste. */
export const genreSousElement = (type: string, chemin: string) => `${type}.${chemin.replace(/^contenu\./, "").replace(/\[\d+\]/g, "")}`;
export const surfaceSousElement = (type: string, chemin: string) => SURFACES_SOUS_ELEMENTS[genreSousElement(type, chemin)] ?? SURFACE_SOUS_ELEMENT_DEFAUT;

/* ---------------- Sous-titres (copie de SousTitres.tsx : mots de liaison) ---------------- */

const LIAISONS = new Set(
  "le la les l un une des de du d au aux a à en et ou mais que qu qui quoi ce cet cette ces se sa son ses leur leurs vos votre notre nos mon ma mes ton ta tes par pour sur sous dans avec sans chez vers je j on il ils elle elles ne n y".split(" "),
);
function estLiaison(w: string): boolean {
  const s = w.toLowerCase().replace(/[.,;:!?…«»"“”()]/g, "").trim();
  if (!s || /\d/.test(s)) return false;
  return LIAISONS.has(s) || LIAISONS.has(s.replace(/^(jusqu|lorsqu|puisqu|qu|l|d|n|s|c|j|m|t)['’]/, ""));
}
/** Instant où chaque mot APPARAÎT : un mot de liaison emmène le suivant (≤ 0,6 s), comme `apparitions` du rendu. */
function apparitions(mots: readonly { w: string; a: number }[]): number[] {
  const r = mots.map((m) => m.a);
  for (let k = 0; k + 1 < mots.length; k++) if (estLiaison(mots[k].w) && mots[k + 1].a - r[k] <= 0.6) r[k + 1] = Math.min(r[k + 1], r[k]);
  return r;
}

/* ---------------- Événements prévus ---------------- */

export interface EvenementPrevu {
  /** Instant (s) de l'image où le changement est le plus fort. */
  t: number;
  /** Part de l'image qui change (%) à cette image la plus forte. */
  surface: number;
  /**
   * Durée de l'animation (s) : le changement s'étale sur ses images (60 % de la surface aux autres images). Deux
   * mouvements qui se touchent forment UN seul pic, comme à la mesure (sortie d'une carte suivie d'une étiquette).
   */
  duree: number;
  /** « entrée carte 3 », « descente de la prise », « liste.lignes.a (carte 2) »… */
  quoi: string;
}

const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Largeur estimée (fraction du corps) d'un texte en capitales (copie de `largeurTexte`, charte.ts). */
function largeurTexte(texte: string, espacement = 0): number {
  let s = 0;
  for (const c of texte.toUpperCase()) {
    if (/\s/.test(c)) s += 0.3;
    else if (/[MWÆŒ]/.test(c)) s += 1.0;
    else if (/[IJ1|!]/.test(c)) s += 0.38;
    else if (/[.,:;'’()«»\-]/.test(c)) s += 0.4;
    else if (/[?]/.test(c)) s += 0.62;
    else if (/\d/.test(c)) s += 0.72;
    else s += 0.78;
    s += espacement;
  }
  return s;
}

/** Emprise d'un calque en fraction de l'image (largeur × hauteur), d'après `mesurerCalque` (cadrage.ts). */
export function aireCalque(c: CalquePlan, ratio: number): number {
  // ratio = largeur / hauteur de l'image (9/16) : une longueur en L vaut `ratio` fois la même en H.
  const reduit = (l: number) => Math.min(1, G.etiquetteDispo / Math.max(l, 1e-6));
  switch (c.type) {
    case "etiquette": {
      const nb = c.icones?.length ?? 0;
      // Marges intérieures 2 × 0,38, contour 2 × ≈ 0,08 du corps ; icônes 1,6 + 0,35 ; texte espacé de 0,5 px (≈ 0,008 corps).
      const l = 0.76 + 0.16 + nb * 1.95 + Math.max(largeurTexte(c.texte, 0.008), c.sousTexte ? largeurTexte(c.sousTexte) * 0.62 : 0);
      const h = Math.max(nb ? 1.6 : 0, 1.02 + (c.sousTexte ? 0.63 : 0)) + 0.42 + 0.16;
      const corps = G.etiquetteCorps * Math.min(1, reduit(l * G.etiquetteCorps));
      return l * corps * h * corps * ratio;
    }
    case "compteur": {
      const texte = `${c.prefixe ?? ""}${Math.round(Math.max(Math.abs(c.de), Math.abs(c.a)))}${c.suffixe ?? ""}`;
      const l = 0.8 + Math.max(largeurTexte(texte), c.legende ? largeurTexte(c.legende) * 0.34 : 0) + 0.1;
      const h = 1 + (c.legende ? 0.42 : 0) + 0.36 + 0.1;
      const corps = G.compteurCorps * Math.min(1, reduit(l * G.compteurCorps));
      return l * corps * h * corps * ratio;
    }
    case "glisse": {
      const l = 1.1 + (c.icone ? 1.2 : 0) + largeurTexte(c.texte) + 0.2;
      const corps = G.glisseCorps * Math.min(1, reduit(l * G.glisseCorps));
      return l * corps * 1.95 * corps * ratio;
    }
    case "logos": {
      const n = c.logos.length;
      const cote = Math.min(G.logoCote, G.etiquetteDispo / (n + (n - 1) * 0.22));
      return cote * cote * ratio * 1.1;
    }
    case "tuile":
      return G.tuileCote * G.tuileCote * 1.6 * ratio;
  }
}

/** Aire d'UN logo d'une rangée (chaque logo surgit sur son mot). */
const aireLogo = (n: number, ratio: number) => {
  const cote = Math.min(G.logoCote, G.etiquetteDispo / (n + (n - 1) * 0.22));
  return cote * cote * ratio * 1.1;
};

/** Hauteur d'une carte (fraction de H) : au moins 0,335, bas à 0,50 au plus. Sans la mise en page du contenu, on prend la moyenne mesurée. */
const hauteurCarte = (yeux: number) => borne(0.35, G.carteHMin, Math.min(G.carteBasMax, yeux + G.descenteMax - G.yeuxSousObjet) - G.carteY);

const CLES_INSTANT = new Set(["a", "cocheA", "iconeA", "baseA", "totalA", "barreA", "barreTotalAvantA", "bascule", "jaimeA", "debut", "fin"]);
function instantsContenu(x: unknown, chemin: string, out: { chemin: string; a: number }[]) {
  if (Array.isArray(x)) return x.forEach((v, i) => instantsContenu(v, `${chemin}[${i}]`, out));
  if (!x || typeof x !== "object") return;
  for (const [cle, v] of Object.entries(x)) {
    const c = `${chemin}.${cle}`;
    if (typeof v === "number") {
      if (CLES_INSTANT.has(cle)) out.push({ chemin: c, a: v });
    } else if (v && typeof v === "object") instantsContenu(v, c, out);
  }
}

/** Ce que le modèle lit d'un plan (un plan complet convient ; le réalisateur par règles en passe un provisoire). */
export type PlanRythme = Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques" | "groupes" | "duree"> & {
  fin: { debut: number };
  prise: { yeux?: number };
  motions?: readonly MotionPlan[];
} & Partial<Pick<PlanFacecamAnimee, "largeur" | "hauteur" | "fps">>;

/**
 * Niveaux de la prise (descente) dans le temps, comme `preparerScene` (cadrage.ts) : objets enchaînés à moins de 0,3 s
 * = la prise ne remonte pas entre eux ; elle remonte 1,5 image après la fin du dernier. Rend les CHANGEMENTS de niveau.
 */
export function changementsDeNiveau(plan: PlanRythme): { t: number; de: number; vers: number }[] {
  const yeux = plan.prise.yeux ?? PRISE_DEFAUTS.yeux;
  const sous = (bas: number) => borne(bas + G.yeuxSousObjet - yeux, 0, G.descenteMax);
  const ratio = (plan.largeur ?? 1080) / (plan.hauteur ?? 1920);
  const objets: { debut: number; fin: number; cible: number }[] = [
    ...plan.cartes.map((c) => ({ debut: c.debut, fin: c.fin, cible: sous(G.carteY + hauteurCarte(yeux)) })),
    ...plan.fenetres.map((f) => ({ debut: f.debut, fin: f.fin, cible: (f.cadrage ?? CADRAGE_FENETRE_DEFAUT) === "sur-le-visage" ? 0 : sous(G.fenetreDessusBas) })),
    ...plan.calques.map((c) => {
      // Bas du calque ≈ centre + demi-hauteur (pop compris) ; la descente est d'au moins 0,06 H.
      const h = c.type === "logos" ? G.logoCote * ratio : c.type === "tuile" ? G.tuileCote * ratio * 1.6 : c.type === "compteur" ? G.compteurCorps * ratio * 1.9 : G.etiquetteCorps * ratio * 1.55;
      const bas = (c.type === "tuile" ? 0.05 + h : c.type === "glisse" ? 0.06 + h : G.etiquetteY + (h / 2) * 1.1);
      return { debut: c.debut, fin: c.fin, cible: borne(Math.max(G.minCalque, bas + G.margeCalque + G.cheveux - yeux), 0, G.descenteMax) };
    }),
  ].filter((o) => o.debut < plan.fin.debut && o.fin > o.debut);
  if (plan.fin.debut < plan.duree) objets.push({ debut: plan.fin.debut, fin: plan.duree + 1, cible: sous(G.finBas) });
  objets.sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  const retard = G.imagesRetard / (plan.fps ?? MESURE_RYTHME.fps);
  const tenues: { debut: number; jusqua: number; cible: number }[] = [];
  let i = 0;
  while (i < objets.length) {
    const seg = [objets[i]];
    let finSeg = objets[i].fin;
    let j = i + 1;
    while (j < objets.length && objets[j].debut <= finSeg + G.enchainement) {
      seg.push(objets[j]);
      finSeg = Math.max(finSeg, objets[j].fin);
      j++;
    }
    seg.forEach((o, k) => tenues.push({ debut: o.debut, cible: o.cible, jusqua: o.fin >= finSeg ? finSeg + retard : Math.max(o.fin, seg[k + 1]?.debut ?? o.fin) }));
    i = j;
  }
  const niveau = (t: number) => Math.max(0, ...tenues.filter((x) => t >= x.debut && t < x.jusqua).map((x) => x.cible));
  const instants = [...new Set(tenues.flatMap((x) => [x.debut, x.jusqua]))].sort((a, b) => a - b);
  const r: { t: number; de: number; vers: number }[] = [];
  let avant = 0;
  for (const t of instants) {
    const apres = niveau(t);
    if (Math.abs(apres - avant) > 1e-6) r.push({ t, de: avant, vers: apres });
    avant = apres;
  }
  return r;
}

/** Tous les événements visuels prévus du plan, avec la surface d'écran qu'ils changent. */
export function evenementsPrevus(plan: PlanRythme): EvenementPrevu[] {
  const K = COEFFICIENTS_SURFACE;
  const ratio = (plan.largeur ?? 1080) / (plan.hauteur ?? 1920);
  const yeux = plan.prise.yeux ?? PRISE_DEFAUTS.yeux;
  const aireCarte = G.carteL * hauteurCarte(yeux) * 100;
  const ev: EvenementPrevu[] = [];
  const horizon = Math.min(plan.fin.debut, plan.duree);
  const pose = (t: number, surface: number, duree: number, quoi: string) => ev.push({ t, surface, duree, quoi });
  // Prise : chaque changement de niveau (descente en 3 images, remontée en 3,5), le plus fort à la 2ᵉ image.
  for (const c of changementsDeNiveau(plan)) {
    const d = Math.abs(c.vers - c.de);
    const monte = c.vers < c.de;
    pose(c.t + T.image, Math.min(K.priseMax, K.prise * d), monte ? T.remontee : T.descente, `${monte ? "remontée" : "descente"} de la prise (${d.toFixed(2)} H)`);
  }
  plan.cartes.forEach((c: CartePlan, i) => {
    if (c.debut >= horizon) return;
    pose(c.debut + T.image, aireCarte * K.carteEntree, T.entreeCarte, `entrée carte ${i + 1} (${c.contenu.type})`);
    pose(c.fin - T.image / 2, aireCarte * K.carteSortie, T.sortieCarte, `sortie carte ${i + 1}`);
    const sous: { chemin: string; a: number }[] = [];
    instantsContenu(c.contenu, "contenu", sous);
    for (const s of sous) pose(s.a + T.image, surfaceSousElement(c.contenu.type, s.chemin), T.sousElement, `${genreSousElement(c.contenu.type, s.chemin)} (carte ${i + 1})`);
  });
  plan.fenetres.forEach((f, i) => {
    if (f.debut >= horizon) return;
    const aire = ((f.cadrage ?? CADRAGE_FENETRE_DEFAUT) === "sur-le-visage" ? G.fenetreVisage : G.fenetreDessus) * 100;
    pose(f.debut + T.image * 1.5, aire * K.fenetreEntree, T.entreeFenetre, `entrée fenêtre ${i + 1}`);
    pose(f.fin - T.image, aire * K.fenetreSortie, T.sortieFenetre, `sortie fenêtre ${i + 1}`);
    if (f.etiquette) pose(f.etiquette.a + T.image, SURFACE_ETIQUETTE_FENETRE, T.pop, `étiquette de la fenêtre ${i + 1}`);
  });
  plan.calques.forEach((c, i) => {
    if (c.debut >= horizon) return;
    const nom = `calque ${i + 1} (${c.type})`;
    const aire = aireCalque(c, ratio) * 100 * K.calque;
    if (c.type === "logos") {
      c.logos.forEach((l, k) => pose((k === 0 ? c.debut : l.a) + T.image, aireLogo(c.logos.length, ratio) * 100 * K.calque, T.pop, `logo ${k + 1} du ${nom}`));
    } else pose(c.debut + T.image, aire, T.pop, `entrée ${nom}`);
    pose(c.fin - T.image, aire * K.calqueSortie, T.sortieCalque, `sortie ${nom}`);
    if (c.type === "etiquette") c.icones?.forEach((x, k) => pose(x.a + T.image, SURFACE_ICONE_ETIQUETTE, T.pop, `icône ${k + 1} du ${nom}`));
  });
  // Motions (15/10) : entrée et sortie selon leur emprise, chaque sous-élément selon sa famille (DA : ≥ 5 % de l'image).
  // ESTIMATIONS d'après la taille prévue des composants (`familles.ts`) : à étalonner sur le premier rendu mesuré.
  (plan.motions ?? []).forEach((m, i) => {
    if (m.debut >= horizon) return;
    const fiche = CATALOGUE_FAMILLES[m.famille];
    const nom = `motion ${i + 1} (${m.famille})`;
    pose(m.debut + T.image, fiche.surfaceEntree, T.pop, `entrée ${nom}`);
    pose(m.fin - T.image, fiche.surfaceEntree * K.fenetreSortie, T.sortieCalque, `sortie ${nom}`);
    for (const a of instantsMotion(m)) if (Math.abs(a - m.debut) > 0.06) pose(a + T.image, fiche.surfaceSousElement, T.sousElement, `${m.famille} (motion ${i + 1})`);
  });
  if (plan.fin.debut < plan.duree) pose(plan.fin.debut + T.image, G.carteL * (G.finBas - G.carteY) * 100 * K.carteEntree, T.entreeCarte, "entrée de l'écran de fin");
  ev.push(...evenementsSousTitres(plan.groupes));
  return ev.filter((e) => e.t >= 0 && e.t <= plan.duree).sort((a, b) => a.t - b.t);
}

const cacheSousTitres = new WeakMap<object, EvenementPrevu[]>();
/**
 * Sous-titres mot à mot : le groupe entre d'un pop, chaque mot suivant s'ajoute (la ligne tressaille), le groupe
 * disparaît s'il reste un blanc avant le suivant. Calculé une fois par liste de groupes.
 */
function evenementsSousTitres(groupesPlan: PlanRythme["groupes"]): EvenementPrevu[] {
  const deja = cacheSousTitres.get(groupesPlan);
  if (deja) return deja;
  const ev: EvenementPrevu[] = [];
  const pose = (t: number, surface: number, quoi: string) => ev.push({ t, surface, duree: 0, quoi });
  const groupes = [...groupesPlan].filter((g) => g.mots.length).sort((a, b) => a.mots[0].a - b.mots[0].a);
  groupes.forEach((g, k) => {
    pose(g.mots[0].a, SURFACE_SOUS_TITRE, "nouveau groupe de sous-titres");
    const app = apparitions(g.mots);
    const vus = new Set([app[0]]);
    for (const a of app) {
      if (vus.has(a)) continue;
      vus.add(a);
      pose(a, SURFACE_MOT, "mot de sous-titre");
    }
    const suivant = groupes[k + 1]?.mots[0].a ?? Infinity;
    if (suivant - g.fin > T.image * 2) pose(g.fin, SURFACE_FIN_GROUPE, "fin de groupe de sous-titres");
  });
  cacheSousTitres.set(groupesPlan, ev);
  return ev;
}

/**
 * Ce qui BOUGE en continu sans être un événement daté (le temps passé dessous ne compte pas dans un trou) : les
 * MINI-VIDÉOS (fenêtres `video`), le DÉFILEMENT d'un compteur (70 % de sa durée, la fin ralentie exclue) et l'écran de
 * fin (animé jusqu'au bout). Les CARTES n'en font PLUS partie : leurs sous-éléments comptent selon leur surface.
 */
export function couvertureContinue(plan: Pick<PlanFacecamAnimee, "fenetres" | "calques" | "duree"> & { fin: { debut: number }; motions?: readonly MotionPlan[] }): { debut: number; fin: number }[] {
  const compteurs = plan.calques.flatMap((c) => (c.type === "compteur" && c.de !== c.a ? [{ debut: c.debut, fin: Math.min(c.fin, c.debut + (c.dureeDefilement ?? G.defilementCompteur) * G.defilementVif) }] : []));
  // Motions qui bougent en continu (ruban qui défile, horloge qui s'emballe) : comme une mini-vidéo.
  const continues = (plan.motions ?? []).filter((m) => CATALOGUE_FAMILLES[m.famille].continu).map((m) => ({ debut: m.debut, fin: m.fin }));
  return [...plan.fenetres.filter((f) => f.video).map((f) => ({ debut: f.debut, fin: f.fin })), ...compteurs, ...continues, ...(plan.fin.debut < plan.duree ? [{ debut: plan.fin.debut, fin: plan.duree }] : [])];
}

export interface PicPrevu {
  t: number;
  surface: number;
  /** Probabilité (0 à 1) que la mesure y voie un gros mouvement (rampe 3 % → 7 %). */
  gros: number;
  quoi: string[];
}

export interface RythmePrevu {
  /** Gros mouvements prévus (somme des probabilités) et par minute (sur toute la durée, comme `dynamisme.py`). */
  gros: number;
  grosParMinute: number;
  pics: PicPrevu[];
  /** Trous entre pics sûrs (> 1 %), le temps sous ce qui bouge en continu déduit : [durée, début, fin]. */
  trous: [number, number, number][];
  plusLongTrouSec: number;
}

const rampe = (s: number) => borne((s - MESURE_RYTHME.rampeGros[0]) / (MESURE_RYTHME.rampeGros[1] - MESURE_RYTHME.rampeGros[0]), 0, 1);

/** Temps hors des intervalles couverts sur [a, b]. */
function horsCouverture(iv: readonly { debut: number; fin: number }[], a: number, b: number): number {
  let t = Math.max(0, b - a);
  const morceaux = iv.map((c) => [Math.max(a, c.debut), Math.min(b, c.fin)] as const).filter(([x, y]) => y > x).sort((x, y) => x[0] - y[0]);
  let fin = a;
  for (const [x, y] of morceaux) {
    const debut = Math.max(x, fin);
    if (y > debut) t -= y - debut;
    fin = Math.max(fin, y);
  }
  return t;
}

/**
 * RYTHME PRÉVU : ce que `dynamisme.py` mesurera sur le rendu de ce plan (gros mouvements par minute, trous). Les
 * événements sont posés image par image (somme plafonnée), puis les pics sont cherchés comme la mesure (± 2 images).
 */
export function rythmePrevu(plan: PlanRythme): RythmePrevu {
  const M = MESURE_RYTHME;
  const n = Math.max(1, Math.ceil(plan.duree * M.fps));
  const z = new Float64Array(n);
  const quoi = new Map<number, string[]>();
  for (const e of evenementsPrevus(plan)) {
    const pic = Math.round(e.t * M.fps);
    const debut = Math.round((e.t - T.image) * M.fps);
    const fin = Math.max(pic, Math.round((e.t - T.image + e.duree) * M.fps) - 1);
    for (let i = Math.max(0, debut); i <= Math.min(n - 1, fin); i++) z[i] = Math.min(COEFFICIENTS_SURFACE.plafond, z[i] + e.surface * (i === pic ? 1 : ETALEMENT));
    if (pic >= 0 && pic < n) quoi.set(pic, [...(quoi.get(pic) ?? []), e.quoi]);
  }
  const pics: PicPrevu[] = [];
  for (let i = 0; i < n; i++) {
    if (z[i] <= M.seuilPic) continue;
    let max = true;
    for (let k = Math.max(0, i - M.voisinage); k <= Math.min(n - 1, i + M.voisinage); k++) if (z[k] > z[i]) max = false;
    if (max) pics.push({ t: i / M.fps, surface: Math.round(z[i] * 10) / 10, gros: rampe(z[i]), quoi: quoi.get(i) ?? [] });
  }
  const gros = pics.reduce((s, p) => s + p.gros, 0);
  const couverts = couvertureContinue(plan);
  const points = [0, ...pics.filter((p) => p.surface >= M.picSur).map((p) => p.t), plan.duree];
  const trous: [number, number, number][] = [];
  for (let k = 1; k < points.length; k++) trous.push([horsCouverture(couverts, points[k - 1], points[k]), points[k - 1], points[k]]);
  return {
    gros: Math.round(gros * 10) / 10,
    grosParMinute: Math.round((gros / Math.max(plan.duree, 1e-6)) * 60 * 10) / 10,
    pics,
    trous,
    plusLongTrouSec: Math.round(Math.max(0, ...trous.map(([d]) => d)) * 100) / 100,
  };
}
