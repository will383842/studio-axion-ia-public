/**
 * PLAN D'UNE SCÈNE DU TABLEAU ANIMÉ (tâche TB-05, reprise visuelle) : fonctions PURES, sans React. Propriétés de
 * `TableauScene` → ce que fait le crayon, quand, où il est et comment il est incliné à chaque instant. Les composants
 * lisent ce plan ; les tests aussi.
 *
 *  - DÉTERMINISTE : aucun hasard, aucune horloge ; même scène = même plan, image par image.
 *  - Le crayon fait UNE chose à la fois : les actions de la scène s'enchaînent dans l'ordre des heures du calage
 *    (une action ne part jamais avant l'heure de son élément) ; si la scène est trop courte, les durées sont réduites
 *    d'un même facteur, et tout est écrit à la dernière image (la scène suivante de la page reprend cet état).
 *  - Une marque se pose dès que sa ligne est écrite (souligné, barré, surligné, mot important), avant la ligne
 *    suivante : le crayon ne revient jamais au-dessus d'un texte qu'il vient d'écrire.
 *  - Le crayon ne cache JAMAIS un texte déjà écrit : son corps part de la pointe vers le BAS à droite (la page encore
 *    vide) ; pour chaque action, l'inclinaison la plus proche de celle du repos qui ne touche aucun texte écrit, reste
 *    dans l'image et hors de la bande des sous-titres est retenue (`empreinteStylo`, calcul sur les boîtes).
 *  - Entre deux actions éloignées, le crayon se pose dans la marge droite, vide, et y bouge légèrement : il ne reste
 *    jamais immobile plus de 2 s.
 *  - Positions : celles de la mise en page (`mise-en-page-tableau/2`) ; un mot important est repéré avec la même
 *    mesure qu'elle (polices dessinées, `src/briques/stylo/mesure-ecriture.ts`).
 *
 * Valeurs supposées [à régler sur la première vidéo] : durées de `REGLAGES_TABLEAU`, position du repos en marge,
 * hauteur du crayon.
 */
import { MARGES_VIDEO, POLICES_VIDEO, TAILLES_VIDEO, TAILLE_PLANCHER_VIDEO } from "../habillage/charte-video";
import { APPROCHE_EM, INTERLIGNE } from "../motion/jetons";
import { COURBES_GESTES, adoucir, pointEntourer } from "../stylo/courbes";
import { empreinteStylo, polygoneDans, polygoneTouche } from "../stylo/empreinte";
import { largeurEcrite, motsEcrits, type PoliceEcriture } from "../stylo/mesure-ecriture";
import { STYLO_PAR_DEFAUT, STYLOS } from "../stylo/registre";
import type { Cible, Point } from "../stylo/types";
import type { ContenuPreuve, ElementPlace, GestePlace, NiveauMise, PagePlacee, ProprietesTableauScene, RectPx, TonPreuve } from "./types";

/* ------------------------------------------------------------------ */
/* Réglages                                                              */
/* ------------------------------------------------------------------ */

export const REGLAGES_TABLEAU = Object.freeze({
  fps: 25,
  /** Une ligne de toute la largeur du cadre s'écrit en 1 s ; une ligne courte jamais en moins de 0,45 s. */
  ligneSec: 1,
  ligneMinSec: 0.45,
  /** Marque d'une ligne (souligné, entouré, barré, surligné), par ligne visuelle ou par bloc (entouré). */
  marqueSec: 0.55,
  /** Soulignement d'un mot important. */
  importantSec: 0.4,
  /** Dessin : contour, puis teinte sable (≈ 1 s en tout). */
  contourSec: 0.7,
  teinteSec: 0.3,
  /** Cadre de la bulle de preuve, surlignage d'une ligne de résultat. */
  cadreBulleSec: 0.45,
  surligneSec: 0.4,
  /** Geste de la fiche (souligner, entourer, barrer, cocher, pointer). */
  gesteSec: 0.6,
  /** Changement de page : la page glisse d'un geste du crayon. */
  tournerSec: 0.3,
  /** Temps de déplacement du crayon entre deux actions. */
  deplacementSec: 0.12,
  /** Au-delà de cet écart entre deux actions, le crayon va se poser en marge. */
  seuilReposSec: 0.6,
  /** Trajet vers la marge (et retour). */
  trajetReposSec: 0.3,
  /** Plus forte réduction des durées quand la scène est courte. */
  reductionMin: 0.35,
  /** Hauteur du crayon, en fraction de la hauteur de l'image. */
  hauteurStylo: 0.14,
  /** Balancement du crayon posé en marge (px à 1080 de large) : il ne reste jamais immobile. */
  balancementPx: 7,
  /** Inclinaisons essayées (degrés, sens horaire ; 90 = corps à droite, 180 = corps en bas), de la préférée à la pire. */
  angles: Object.freeze([145, 135, 155, 125, 165, 115, 172, 105, 98, 90, 80, 70, 60, 50]),
  /** Inclinaison au repos, dans la marge droite. */
  angleRepos: 158,
});

/* ------------------------------------------------------------------ */
/* Texte : niveaux, mots placés                                          */
/* ------------------------------------------------------------------ */

/** Graisse et police d'un niveau (habillage `charte-video/1`). */
export function policeDe(niveau: NiveauMise): { famille: string; graisse: number } {
  const p = niveau === "titre" ? POLICES_VIDEO.titre : POLICES_VIDEO.texte;
  return { famille: p.famille, graisse: p.graisse };
}

/** Police mesurée d'un niveau : Montserrat ExtraBold (titre), Inter Bold (texte, légende). */
const policeEcriture = (niveau: NiveauMise): PoliceEcriture => (niveau === "titre" ? "titre" : "texte");

export interface MotPlace {
  texte: string;
  x: number;
  largeur: number;
}

/** Mots d'une ligne visuelle, placés avec la mesure de la mise en page (polices dessinées, approche comprise). */
export function motsPlaces(texte: string, x: number, taille: number, niveau: NiveauMise): MotPlace[] {
  return motsEcrits(texte, policeEcriture(niveau), taille, APPROCHE_EM[niveau]).map((m) => ({ texte: m.texte, x: x + m.x, largeur: m.largeur }));
}

/** Mot sans casse, sans accent, sans ponctuation (pour reconnaître un mot important). */
export const cleMotTableau = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** « 2026-10-09 » → « Testé le 09/10 ». */
export function dateTest(testeLe: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(testeLe);
  return m ? `Testé le ${m[3]}/${m[2]}` : `Testé le ${testeLe}`;
}

/* ------------------------------------------------------------------ */
/* Bulle de preuve : phrase testée, lignes de résultat, date             */
/* ------------------------------------------------------------------ */

export interface LigneBulle {
  texte: string;
  px: RectPx;
}

export interface DispositionBulle {
  /** Cadre de la bulle. */
  cadre: RectPx;
  /** Phrase testée (légende), au-dessus des lignes de résultat. */
  phrase: LigneBulle[];
  /** « Testé le JJ/MM » sous les lignes ; `null` s'il manque. */
  date: LigneBulle | null;
  tailleLegende: number;
  /** Ce qui n'a pas trouvé de place ou manque : nommé, jamais tu (le contrôle des propriétés le refuse). */
  omis: ("phrase" | "date")[];
  /** Étiquettes « Avant » / « Après » (mise en page `mise-en-page-tableau/2`). */
  etiquettes: (LigneBulle & { ton: TonPreuve })[];
  separateur?: { x: number; y: number; hauteur: number };
  queue?: RectPx;
  /** Bloc entouré par un geste « entourer » qui vise la bulle. */
  cercle?: RectPx;
}

/** Taille et interligne de la légende de la bulle, à défaut de mise en page. */
function legende(hauteurImage: number): { taille: number; interligne: number } {
  const taille = Math.max(Math.ceil(TAILLE_PLANCHER_VIDEO * hauteurImage), Math.round(TAILLES_VIDEO.legende * hauteurImage));
  return { taille, interligne: Math.ceil(taille * INTERLIGNE.legende) };
}

/** Coupe un texte de légende en rangées (mot entier) dans une largeur, avec la mesure des polices dessinées. */
function couperLegende(texte: string, taille: number, largeurMax: number): string[] {
  const rangees: string[] = [];
  let courante = "";
  for (const m of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${m}` : m;
    if (courante && largeurEcrite(essai, "texte", taille, APPROCHE_EM.legende) > largeurMax) {
      rangees.push(courante);
      courante = m;
    } else courante = essai;
  }
  if (courante) rangees.push(courante);
  return rangees;
}

/**
 * Bulle d'une mise en page `mise-en-page-tableau/2` : tout est à sa place réservée ; la phrase testée est coupée dans
 * sa zone si la mise en page ne l'a pas reçue (au plus le nombre de rangées réservées, sinon elle est nommée omise).
 */
export function bulleReservee(el: ElementPlace, contenu: ContenuPreuve | undefined): DispositionBulle {
  const b = el.bulle!;
  const omis: DispositionBulle["omis"] = [];
  let phrase: LigneBulle[] = b.phrase.map((l) => ({ texte: l.texte, px: l.px }));
  if (!phrase.length) {
    if (!contenu) omis.push("phrase");
    else {
      const z = b.zonePhrase.px;
      const rangees = couperLegende(`« ${contenu.phrase} »`, b.tailleLegende, z.largeur);
      const h = Math.floor(z.hauteur / b.rangeesPhrase);
      if (rangees.length > b.rangeesPhrase || rangees.some((r) => largeurEcrite(r, "texte", b.tailleLegende, APPROCHE_EM.legende) > z.largeur)) omis.push("phrase");
      else phrase = rangees.map((texte, i) => ({ texte, px: { x: z.x, y: z.y + i * h, largeur: Math.ceil(largeurEcrite(texte, "texte", b.tailleLegende, APPROCHE_EM.legende)), hauteur: h } }));
    }
  }
  const texteDate = b.date.texte || (contenu ? dateTest(contenu.testeLe) : "");
  if (!texteDate) omis.push("date");
  return {
    cadre: { ...el.px },
    phrase,
    date: texteDate ? { texte: texteDate, px: { ...b.date.px } } : null,
    tailleLegende: b.tailleLegende,
    omis,
    etiquettes: b.etiquettes.map((l) => ({ texte: l.texte, px: l.px, ton: l.ton ?? "avant" })),
    ...(b.separateur ? { separateur: b.separateur } : {}),
    queue: { ...b.queue.px },
    ...(b.cercle ? { cercle: { ...b.cercle.px } } : {}),
  };
}

/**
 * Dispose la bulle d'une mise en page `mise-en-page-tableau/1` (sans place réservée) autour de son rectangle : les
 * lignes de résultat restent EXACTEMENT où la mise en page les a posées ; la phrase testée s'écrit au-dessus et la date
 * au-dessous, dans la place libre (`libreHaut`, `libreBas`, en px) ; ce qui ne tient pas est omis et nommé dans `omis`.
 */
export function disposerBulle(el: Pick<ElementPlace, "px">, contenu: ContenuPreuve | undefined, hauteurImage: number, largeurImage: number, libreHaut: number, libreBas: number): DispositionBulle {
  const { taille, interligne } = legende(hauteurImage);
  const ecart = Math.round(MARGES_VIDEO.entreLignes * largeurImage);
  const r = el.px;
  const interieur = r.largeur - 2 * ecart;
  const omis: DispositionBulle["omis"] = [];
  let haut = r.y;
  let bas = r.y + r.hauteur;
  const phrase: LigneBulle[] = [];
  let date: LigneBulle | null = null;
  if (contenu) {
    const coupees = couperLegende(`« ${contenu.phrase} »`, taille, interieur);
    const besoin = coupees.length * interligne;
    if (coupees.length <= 2 && besoin <= libreHaut) {
      haut = r.y - besoin;
      coupees.forEach((texte, i) => phrase.push({ texte, px: { x: r.x + ecart, y: haut + Math.round(ecart / 2) + i * interligne, largeur: interieur, hauteur: interligne } }));
    } else omis.push("phrase");
    if (interligne <= libreBas) {
      date = { texte: dateTest(contenu.testeLe), px: { x: r.x + ecart, y: bas - Math.round(ecart / 2), largeur: interieur, hauteur: interligne } };
      bas += interligne;
    } else omis.push("date");
  }
  return { cadre: { x: r.x, y: haut, largeur: r.largeur, hauteur: bas - haut }, phrase, date, tailleLegende: taille, omis, etiquettes: [] };
}

/** Place libre au-dessus et au-dessous d'un élément de la page (dans le cadre, sans toucher un autre élément). */
export function placeLibre(page: PagePlacee, el: ElementPlace, cadre: RectPx, largeurImage: number): { haut: number; bas: number } {
  const garde = Math.round((MARGES_VIDEO.entreLignes * largeurImage) / 2);
  const r = el.px;
  const enFace = (o: RectPx) => Math.min(o.x + o.largeur, r.x + r.largeur) > Math.max(o.x, r.x);
  let plafond = cadre.y;
  let plancher = cadre.y + cadre.hauteur;
  for (const o of page.elements) {
    if (o.elementId === el.elementId || !enFace(o.px)) continue;
    if (o.px.y + o.px.hauteur <= r.y) plafond = Math.max(plafond, o.px.y + o.px.hauteur + garde);
    else if (o.px.y >= r.y + r.hauteur) plancher = Math.min(plancher, o.px.y - garde);
  }
  return { haut: Math.max(0, r.y - plafond), bas: Math.max(0, plancher - (r.y + r.hauteur)) };
}

/* ------------------------------------------------------------------ */
/* Actions du crayon                                                     */
/* ------------------------------------------------------------------ */

export type SorteAction = "ecrire" | "souligner" | "entourer" | "barrer" | "cocher" | "pointer" | "surligner" | "dessiner" | "cadre" | "tourner";

export interface Action {
  elementId: string;
  /**
   * Partie de l'élément : « ligne:i », « marque:i », « important:i », « contour », « teinte », « cadre », « phrase:i »,
   * « etiquette:i », « surligne:i », « date », « geste », « geste:i » (geste de la fiche ligne par ligne), « page ».
   */
  partie: string;
  sorte: SorteAction;
  cible: Cible;
  debut: number;
  duree: number;
  /** Inclinaison du crayon pendant l'action (degrés). */
  angle: number;
}

export type EtatElement = "deja" | "scene";

/** Un morceau de texte de la page, écrit par une partie d'action (ou déjà là). */
export interface MorceauTexte {
  elementId: string;
  partie: string;
  px: RectPx;
}

export interface PlanScene {
  largeur: number;
  hauteur: number;
  fps: number;
  /** Durée (s) et nombre d'images. */
  duree: number;
  images: number;
  /** Éléments et gestes visibles dans cette scène (déjà écrits ou écrits par elle) ; les autres n'existent pas encore. */
  etats: Record<string, EtatElement>;
  actions: Action[];
  /** Facteur appliqué aux durées (1 = durées de `REGLAGES_TABLEAU`). */
  reduction: number;
  /** Crayon posé en marge, et son inclinaison. */
  repos: Point;
  angleRepos: number;
  hauteurStylo: number;
  /** Largeur qui règle l'épaisseur des traits (largeur de référence du format ; l'image en 9:16). */
  largeurTrait: number;
  /** Identifiant du stylo. */
  stylo: string;
  /** Haut de la bande des sous-titres (rien en dessous). */
  basUtile: number;
  /** Disposition des bulles de preuve visibles. */
  bulles: Record<string, DispositionBulle>;
  /** Textes de la page visibles dans la scène, avec la partie qui les écrit. */
  textes: MorceauTexte[];
  /** Par action (« élément|partie ») : l'élément que le crayon a le droit de toucher (cible d'une marque), ou `null`. */
  exemptes: Record<string, string | null>;
}

const borne01 = (v: number) => Math.min(1, Math.max(0, v));
const ligneRect = (l: { px: RectPx }): Cible => ({ ...l.px });

/** Point d'un rectangle à arrondis, parcouru dans le sens horaire depuis le coin haut gauche (k de 0 à 1). */
export function pointCadre(c: Cible, k: number): Point {
  const p = 2 * (c.largeur + c.hauteur);
  let d = borne01(k) * p;
  if (d <= c.largeur) return { x: c.x + d, y: c.y };
  d -= c.largeur;
  if (d <= c.hauteur) return { x: c.x + c.largeur, y: c.y + d };
  d -= c.hauteur;
  if (d <= c.largeur) return { x: c.x + c.largeur - d, y: c.y + c.hauteur };
  d -= c.largeur;
  return { x: c.x, y: c.y + c.hauteur - d };
}

/** Surligner : la pointe passe au milieu de la ligne, de gauche à droite. */
const pointSurligner = (c: Cible, u: number): Point => ({ x: c.x + c.largeur * adoucir(u), y: c.y + c.hauteur * 0.55 });

/** Dessin : la pointe tourne autour du dessin pendant qu'il se trace. */
const pointDessiner = (c: Cible, u: number): Point => pointEntourer({ x: c.x + c.largeur * 0.2, y: c.y + c.hauteur * 0.2, largeur: c.largeur * 0.6, hauteur: c.hauteur * 0.6 }, adoucir(u));

/** Position de la pointe pendant une action (u de 0 à 1). */
export function pointAction(a: Pick<Action, "sorte" | "cible">, u: number, largeurImage: number, hauteurImage: number): Point {
  const v = borne01(u);
  switch (a.sorte) {
    case "ecrire":
      return COURBES_GESTES.ecrire(v, a.cible);
    case "surligner":
      return pointSurligner(a.cible, v);
    case "dessiner":
      return pointDessiner(a.cible, v);
    case "cadre":
      return pointCadre(a.cible, adoucir(v));
    case "tourner": {
      // La pointe pousse la page vers la gauche, de 80 % à 12 % de la largeur (le crayon reste dans l'image).
      const e = adoucir(v);
      return { x: largeurImage * (0.8 - 0.68 * e), y: hauteurImage * 0.42 };
    }
    default:
      return COURBES_GESTES[a.sorte](v, a.cible);
  }
}

/** Avancement (0 à 1) de la partie `partie` de l'élément `elementId` à l'instant `t` (s). */
export function avancement(plan: Pick<PlanScene, "etats" | "actions">, elementId: string, partie: string, t: number): number {
  const etat = plan.etats[elementId];
  if (!etat) return 0;
  if (etat === "deja") return 1;
  const a = plan.actions.find((x) => x.elementId === elementId && x.partie === partie);
  if (!a) return 1; // partie sans action : déjà là (accroche visible dès la première image)
  if (a.duree <= 0) return t >= a.debut ? 1 : 0;
  return borne01((t - a.debut) / a.duree);
}

/** L'élément a-t-il commencé à s'écrire à l'instant `t` ? */
export function commence(plan: PlanScene, elementId: string, t: number): boolean {
  const etat = plan.etats[elementId];
  if (!etat) return false;
  if (etat === "deja") return true;
  const premiere = plan.actions.filter((a) => a.elementId === elementId).reduce((m, a) => Math.min(m, a.debut), Infinity);
  return premiere === Infinity || t >= premiere;
}

/**
 * Textes ÉCRITS à l'instant `t` (boîtes en px) : ce qui est déjà là, et la part déjà dévoilée de ce qui s'écrit
 * (le bord suit la même courbe que le masque de `LigneEcrite`).
 */
export function textesEcrits(plan: Pick<PlanScene, "etats" | "actions" | "textes">, t: number): MorceauTexte[] {
  const res: MorceauTexte[] = [];
  for (const m of plan.textes) {
    const u = avancement(plan, m.elementId, m.partie, t);
    if (u <= 0) continue;
    const largeur = u >= 1 ? m.px.largeur : adoucir(u) * m.px.largeur;
    if (largeur > 0) res.push({ ...m, px: { ...m.px, largeur } });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Construction du plan                                                  */
/* ------------------------------------------------------------------ */

type Partie = Omit<Action, "debut" | "angle">;

interface Tache {
  heure: number;
  ordre: number;
  parties: Partie[];
}

const dureeLigne = (largeur: number, largeurCadre: number) => Math.max(REGLAGES_TABLEAU.ligneMinSec, (REGLAGES_TABLEAU.ligneSec * largeur) / Math.max(1, largeurCadre));

/** Boîtes des mots importants d'un élément de texte, par ligne visuelle (une par mot reconnu, dans l'ordre de lecture). */
function importantsParLigne(e: ElementPlace, importants: readonly string[] | undefined): Cible[][] {
  if (!importants?.length || !e.taillePx || !e.niveau) return e.lignes.map(() => []);
  const cles = new Set(importants.map(cleMotTableau).filter(Boolean));
  return e.lignes.map((l) => motsPlaces(l.texte, l.px.x, e.taillePx!, e.niveau!).filter((m) => cles.has(cleMotTableau(m.texte))).map((m) => ({ x: m.x, y: l.px.y, largeur: m.largeur, hauteur: l.px.hauteur })));
}

/** Boîtes des mots importants d'un élément de texte (une par mot reconnu, dans l'ordre de lecture). */
export function boitesImportantes(e: ElementPlace, importants: readonly string[] | undefined): Cible[] {
  return importantsParLigne(e, importants).flat();
}

/** Mots importants d'un élément : ceux de la mise en page (fiche), sinon ceux des propriétés. */
export const importantsDe = (e: ElementPlace, p: Pick<ProprietesTableauScene, "importants">): string[] | undefined => e.importants ?? p.importants[e.elementId];

const sorteMarque = (e: ElementPlace): SorteAction | null =>
  e.marque === "souligne" ? "souligner" : e.marque === "entoure" ? "entourer" : e.marque === "barre" ? "barrer" : e.marque === "surligne" ? "surligner" : null;

function tachesElement(e: ElementPlace, p: ProprietesTableauScene, bulle: DispositionBulle | undefined, ecritDesLeDebut: boolean, heure: number): Tache {
  const largeurCadre = p.cadre.px.largeur;
  const parties: Partie[] = [];
  const ecrire = (partie: string, l: { px: RectPx }, part = 1) => parties.push({ elementId: e.elementId, partie, sorte: "ecrire", cible: ligneRect(l), duree: dureeLigne(l.px.largeur * part, largeurCadre) });
  switch (e.type) {
    case "ligne": {
      // Ligne par ligne : écrire, puis ses mots importants et sa marque, avant la ligne suivante.
      const sorte = sorteMarque(e);
      const mots = importantsParLigne(e, importantsDe(e, p));
      let k = 0;
      e.lignes.forEach((l, i) => {
        if (!ecritDesLeDebut) ecrire(`ligne:${i}`, l);
        for (const b of mots[i]) parties.push({ elementId: e.elementId, partie: `important:${k++}`, sorte: "souligner", cible: b, duree: REGLAGES_TABLEAU.importantSec });
        if (sorte && sorte !== "entourer") parties.push({ elementId: e.elementId, partie: `marque:${i}`, sorte, cible: ligneRect(l), duree: REGLAGES_TABLEAU.marqueSec });
      });
      if (sorte === "entourer") parties.push({ elementId: e.elementId, partie: "marque:0", sorte: "entourer", cible: { ...e.px }, duree: REGLAGES_TABLEAU.marqueSec });
      break;
    }
    case "chiffre":
    case "mention":
      if (!ecritDesLeDebut) e.lignes.forEach((l, i) => ecrire(`ligne:${i}`, l));
      break;
    case "dessin":
      if (!ecritDesLeDebut) {
        parties.push({ elementId: e.elementId, partie: "contour", sorte: "dessiner", cible: { ...e.px }, duree: REGLAGES_TABLEAU.contourSec });
        parties.push({ elementId: e.elementId, partie: "teinte", sorte: "dessiner", cible: { ...e.px }, duree: REGLAGES_TABLEAU.teinteSec });
      }
      break;
    case "preuve":
      if (!ecritDesLeDebut && bulle) {
        parties.push({ elementId: e.elementId, partie: "cadre", sorte: "cadre", cible: { ...bulle.cadre }, duree: REGLAGES_TABLEAU.cadreBulleSec });
        bulle.phrase.forEach((l, i) => ecrire(`phrase:${i}`, l));
        // Bloc par bloc (avant, puis après) : étiquette, puis chaque ligne, surlignée aussitôt si elle est mise en valeur.
        const tons: (TonPreuve | undefined)[] = [...new Set(e.lignes.map((l) => l.ton))];
        for (const ton of tons) {
          bulle.etiquettes.forEach((et, k) => et.ton === ton && ecrire(`etiquette:${k}`, et));
          e.lignes.forEach((l, i) => {
            if (l.ton !== ton) return;
            ecrire(`ligne:${i}`, l);
            if (l.ton !== "avant") parties.push({ elementId: e.elementId, partie: `surligne:${i}`, sorte: "surligner", cible: ligneRect(l), duree: REGLAGES_TABLEAU.surligneSec });
          });
        }
        if (bulle.date) ecrire("date", bulle.date, 0.6);
      }
      break;
  }
  return { heure, ordre: e.ordre, parties };
}

function tacheGeste(g: GestePlace, page: PagePlacee, heure: number): Tache {
  const duree = g.geste === "pointer" ? REGLAGES_TABLEAU.gesteSec * 0.8 : REGLAGES_TABLEAU.gesteSec;
  const cible = page.elements.find((e) => e.elementId === g.cibleId);
  // Souligner ou barrer un texte : ligne par ligne, chaque trait sous (ou sur) sa ligne, jamais au-delà du dernier mot.
  if ((g.geste === "souligner" || g.geste === "barrer") && cible && cible.lignes.length && cible.type !== "preuve") {
    return { heure, ordre: g.ordre, parties: cible.lignes.map((l, i) => ({ elementId: g.elementId, partie: `geste:${i}`, sorte: g.geste, cible: ligneRect(l), duree: duree / Math.sqrt(cible.lignes.length) })) };
  }
  const zone = g.zone?.px ?? g.cible.px;
  return { heure, ordre: g.ordre, parties: [{ elementId: g.elementId, partie: "geste", sorte: g.geste, cible: { ...zone }, duree }] };
}

/** Enchaîne les tâches (jamais avant leur heure), durées multipliées par `f`. */
function enchainer(taches: Tache[], debutLibre: number, f: number): Action[] {
  const actions: Action[] = [];
  let curseur = debutLibre;
  for (const t of taches) {
    let depart = Math.max(t.heure, curseur);
    for (const p of t.parties) {
      const duree = p.duree * f;
      actions.push({ ...p, debut: depart, duree, angle: REGLAGES_TABLEAU.angles[0] });
      depart += duree + REGLAGES_TABLEAU.deplacementSec;
    }
    curseur = depart;
  }
  return actions;
}

/** Morceaux de texte d'un élément visible (lignes, et pour une bulle : phrase, étiquettes, date). */
function morceaux(e: ElementPlace, bulle: DispositionBulle | undefined): MorceauTexte[] {
  if (e.type === "dessin") return [];
  const res: MorceauTexte[] = e.lignes.map((l, i) => ({ elementId: e.elementId, partie: `ligne:${i}`, px: { ...l.px } }));
  if (bulle) {
    bulle.phrase.forEach((l, i) => res.push({ elementId: e.elementId, partie: `phrase:${i}`, px: { ...l.px } }));
    bulle.etiquettes.forEach((l, i) => res.push({ elementId: e.elementId, partie: `etiquette:${i}`, px: { ...l.px } }));
    if (bulle.date) res.push({ elementId: e.elementId, partie: "date", px: { ...bulle.date.px } });
  }
  return res;
}

/** Plan complet d'une scène. */
export function planifierScene(p: ProprietesTableauScene): PlanScene {
  const fps = p.fps || REGLAGES_TABLEAU.fps;
  const duree = Math.max(0, (p.scene.finMs - p.scene.debutMs) / 1000);
  const images = Math.max(1, Math.round(duree * fps));
  const derniere = (images - 1) / fps;
  const W = p.largeur;
  const H = p.hauteur;
  const heures = new Map(p.heures.map((h) => [h.elementId, (h.debutMs - p.scene.debutMs) / 1000]));
  const deja = new Set(p.dejaEcrits);

  const etats: Record<string, EtatElement> = {};
  for (const e of p.page.elements) {
    if (deja.has(e.elementId)) etats[e.elementId] = "deja";
    else if (e.sceneId === p.scene.id) etats[e.elementId] = "scene";
  }
  for (const g of p.page.gestes) {
    if (deja.has(g.elementId)) etats[g.elementId] = "deja";
    else if (g.sceneId === p.scene.id) etats[g.elementId] = "scene";
  }

  const bulles: Record<string, DispositionBulle> = {};
  for (const e of p.page.elements) {
    if (!etats[e.elementId] || e.type !== "preuve") continue;
    if (e.bulle) bulles[e.elementId] = bulleReservee(e, p.preuves[e.elementId]);
    else {
      const libre = placeLibre(p.page, e, p.cadre.px, W);
      bulles[e.elementId] = disposerBulle(e, p.preuves[e.elementId], H, W, libre.haut, libre.bas);
    }
  }

  // Tâches de la scène, dans l'ordre des heures (puis de la page).
  const transition = p.pagePrecedente ? REGLAGES_TABLEAU.tournerSec : 0;
  const taches: Tache[] = [];
  for (const e of p.page.elements) {
    if (etats[e.elementId] !== "scene") continue;
    const heure = Math.max(0, heures.get(e.elementId) ?? 0);
    const desLeDebut = p.scene.premiere && heure <= 0;
    taches.push(tachesElement(e, p, bulles[e.elementId], desLeDebut, heure));
  }
  for (const g of p.page.gestes) {
    if (etats[g.elementId] !== "scene") continue;
    taches.push(tacheGeste(g, p.page, Math.max(0, heures.get(g.elementId) ?? 0)));
  }
  taches.sort((a, b) => a.heure - b.heure || a.ordre - b.ordre);

  // Réduction : le plus grand facteur (pas de 5 %) pour que tout soit fini à la dernière image.
  const debutLibre = transition ? transition + REGLAGES_TABLEAU.deplacementSec : 0;
  let reduction = 1;
  let actions = enchainer(taches, debutLibre, reduction);
  const finDe = (as: Action[]) => as.reduce((m, a) => Math.max(m, a.debut + a.duree), 0);
  while (finDe(actions) > derniere && reduction > REGLAGES_TABLEAU.reductionMin + 1e-9) {
    reduction = Math.max(REGLAGES_TABLEAU.reductionMin, Math.round((reduction - 0.05) * 100) / 100);
    actions = enchainer(taches, debutLibre, reduction);
  }
  // Garde : rien ne dépasse la dernière image (tout y est écrit).
  actions = actions.map((a) => (a.debut >= derniere ? { ...a, debut: derniere, duree: 0 } : a.debut + a.duree > derniere ? { ...a, duree: derniere - a.debut } : a));
  if (transition) actions.unshift({ elementId: "page", partie: "page", sorte: "tourner", cible: { x: 0, y: 0, largeur: W, hauteur: H }, debut: 0, duree: transition, angle: REGLAGES_TABLEAU.angles[0] });

  const textes = p.page.elements.filter((e) => etats[e.elementId]).flatMap((e) => morceaux(e, bulles[e.elementId]));
  // Formats de sortie autres que le 9:16 : crayon et traits gardent la taille de la référence (même taille réelle).
  const ref = p.reference ?? { largeur: W, hauteur: H };
  const hauteurStylo = Math.round(REGLAGES_TABLEAU.hauteurStylo * ref.hauteur);
  const bande = p.bandeSousTitres.px;
  const base = { largeur: W, hauteur: H, fps, duree, images, etats, reduction, hauteurStylo, largeurTrait: ref.largeur, stylo: p.stylo, basUtile: bande.y, bulles, textes, exemptes: {} };

  // Inclinaison de chaque action : la plus proche de la préférée qui ne cache aucun texte écrit.
  actions = actions.map((a) => ({ ...a, angle: a.sorte === "tourner" ? a.angle : meilleurAngle({ ...base, actions }, a, p.page) }));
  const exemptes = Object.fromEntries(actions.map((a) => [`${a.elementId}|${a.partie}`, cibleDe(a, p.page)]));

  // Repos : dans la marge droite (vide), à la hauteur de ce qui s'écrit, le corps vers le bas, au-dessus de la bande.
  const cadre = p.cadre.px;
  const visibles = p.page.elements.filter((e) => etats[e.elementId]);
  const basEcrit = visibles.reduce((m, e) => Math.max(m, e.px.y + e.px.hauteur), cadre.y + cadre.hauteur * 0.25);
  const angleRepos = REGLAGES_TABLEAU.angleRepos;
  const descente = hauteurStylo * Math.abs(Math.cos((angleRepos * Math.PI) / 180)) + REGLAGES_TABLEAU.balancementPx * 2;
  const reposX = Math.round(cadre.x + cadre.largeur + Math.min(36, (W - cadre.x - cadre.largeur) * 0.25));
  // Formats de sortie autres que le 9:16 : la pointe au repos reste dans la zone sûre (le 9:16 garde sa place d'avant).
  const zs = p.zoneSure.px;
  const repos = { x: p.reference ? Math.min(reposX, zs.x + zs.largeur - 2) : reposX, y: Math.round(Math.max(cadre.y, Math.min(basEcrit, bande.y - descente))) };

  return { ...base, actions, repos, angleRepos, exemptes };
}

/** Empreinte du crayon (polygone) pour une pointe et une inclinaison ; `sansPointe` : le corps seul, sans le cône. */
export function empreinte(plan: Pick<PlanScene, "stylo" | "hauteurStylo">, pointe: Point, angle: number, sansPointe = false): Point[] {
  const s = Object.prototype.hasOwnProperty.call(STYLOS, plan.stylo) ? STYLOS[plan.stylo] : STYLOS[STYLO_PAR_DEFAUT];
  return empreinteStylo(s, pointe, plan.hauteurStylo, angle, sansPointe);
}

/** Élément qu'une action a le droit de toucher : la cible d'une marque (on marque ce qu'on vise). */
export function cibleDe(a: Pick<Action, "elementId" | "sorte">, page: Pick<PagePlacee, "gestes">): string | null {
  if (a.sorte === "ecrire" || a.sorte === "dessiner" || a.sorte === "cadre" || a.sorte === "tourner") return null;
  const g = page.gestes.find((x) => x.elementId === a.elementId);
  return g ? g.cibleId : a.elementId;
}

type PlanDefaut = Pick<PlanScene, "etats" | "actions" | "textes" | "stylo" | "hauteurStylo" | "largeur" | "hauteur" | "basUtile">;

/**
 * Défaut d'une position du crayon : texte écrit sous son CORPS (lourd ; le cône taillé, qui touche la page là où il
 * écrit, n'est pas compté), sortie de l'image, bande des sous-titres. Les textes des éléments `exemptes` (la cible
 * d'une marque en cours ou qu'il va marquer) ne sont pas comptés ; pendant l'écriture, la part déjà écrite l'est.
 */
export function defautStylo(plan: PlanDefaut, pointe: Point, angle: number, t: number, exemptes: readonly (string | null)[] = []): number {
  const corps = empreinte(plan, pointe, angle, true);
  const tout = empreinte(plan, pointe, angle);
  let d = 0;
  for (const m of textesEcrits(plan, t)) if (!exemptes.includes(m.elementId) && polygoneTouche(corps, m.px)) d += 100;
  if (!polygoneDans(tout, { x: 0, y: 0, largeur: plan.largeur, hauteur: plan.hauteur })) d += 10;
  if (tout.some((q) => q.y > plan.basUtile)) d += 6;
  return d;
}

function meilleurAngle(plan: Omit<PlanScene, "repos" | "angleRepos">, a: Action, page: PagePlacee): number {
  const exempte = [cibleDe(a, page)];
  const echantillons = a.duree > 0 ? Array.from({ length: 17 }, (_, i) => i / 16) : [1];
  let meilleur = REGLAGES_TABLEAU.angles[0];
  let min = Infinity;
  for (const angle of REGLAGES_TABLEAU.angles) {
    let d = 0;
    for (const u of echantillons) d += defautStylo(plan, pointAction(a, u, plan.largeur, plan.hauteur), angle, a.debut + u * a.duree, exempte);
    if (d < min) {
      min = d;
      meilleur = angle;
    }
    if (d === 0) break;
  }
  return meilleur;
}

/* ------------------------------------------------------------------ */
/* Position du crayon à chaque instant                                   */
/* ------------------------------------------------------------------ */

/** Balancement déterministe du crayon posé (jamais immobile). */
function balancement(t: number, largeurImage: number): Point {
  const a = (REGLAGES_TABLEAU.balancementPx * largeurImage) / 1080;
  return { x: a * Math.sin((2 * Math.PI * t) / 1.9), y: a * 0.7 * Math.sin((2 * Math.PI * t) / 2.7 + 1) };
}

const melange = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** Point à la fraction `k` (de la longueur) d'une ligne brisée. */
function surLigneBrisee(points: Point[], k: number): Point {
  const longueurs = points.slice(1).map((q, i) => Math.hypot(q.x - points[i].x, q.y - points[i].y));
  let reste = k * longueurs.reduce((x, y) => x + y, 0);
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) return melange(points[i], points[i + 1], longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1);
    reste -= longueurs[i];
  }
  return points[points.length - 1];
}

/** Calendriers de rotation pendant un trajet : régulière, à l'arrivée, au départ. */
const ROTATIONS: readonly ((k: number) => number)[] = [(k) => k, (k) => adoucir((k - 0.65) / 0.35), (k) => adoucir(k / 0.35)];

/**
 * Trajet de la pointe entre deux actions (ou vers le repos) : parmi quatre chemins — tout droit, par le bas (la page
 * encore vide), par la marge droite, par la marge droite puis le bas — et trois façons de tourner le crayon, le premier
 * dont le corps ne passe sur aucun texte écrit et qui reste dans l'image (sinon le moins mauvais). La cible de l'action
 * qui finit et de celle qui vient peut être touchée (le crayon s'y pose).
 */
function cheminTrajet(plan: PlanScene, a: Point, b: Point, angleA: number, angleB: number, t: number, exemptes: (string | null)[]): { c: Point[]; r: (k: number) => number; cout: number } {
  const ecrits = textesEcrits(plan, t).filter((m) => !exemptes.includes(m.elementId));
  const yMax = Math.max(a.y, b.y);
  const bas = Math.min(plan.basUtile, ecrits.filter((m) => m.px.x < Math.max(a.x, b.x) && m.px.x + m.px.largeur > Math.min(a.x, b.x) && m.px.y < yMax + 1).reduce((y, m) => Math.max(y, m.px.y + m.px.hauteur), yMax) + Math.round(plan.hauteur * 0.006));
  const droite = Math.min(plan.largeur - 2, ecrits.reduce((x, m) => Math.max(x, m.px.x + m.px.largeur), Math.max(a.x, b.x)) + Math.round(plan.largeur * 0.02));
  const chemins: Point[][] = [
    [a, b],
    [a, { x: a.x, y: bas }, { x: b.x, y: bas }, b],
    [a, { x: droite, y: a.y }, { x: droite, y: b.y }, b],
    [a, { x: droite, y: a.y }, { x: droite, y: bas }, { x: b.x, y: bas }, b],
  ];
  const image = { x: 0, y: 0, largeur: plan.largeur, hauteur: plan.hauteur };
  const cout = (c: Point[], r: (k: number) => number) => {
    let n = 0;
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const q = surLigneBrisee(c, u);
      const ang = angleA + (angleB - angleA) * r(u);
      const corps = empreinte(plan, q, ang, true);
      n += 100 * ecrits.filter((m) => polygoneTouche(corps, m.px)).length;
      const tout = empreinte(plan, q, ang);
      if (!polygoneDans(tout, image)) n += 10;
      if (tout.some((p) => p.y > plan.basUtile)) n += 6;
    }
    return n;
  };
  let choisi = { c: chemins[0], r: ROTATIONS[0] };
  let min = Infinity;
  recherche: for (const c of chemins)
    for (const r of ROTATIONS) {
      const n = cout(c, r);
      if (n < min) {
        min = n;
        choisi = { c, r };
      }
      if (n === 0) break recherche;
    }
  return { ...choisi, cout: min };
}

function trajet(plan: PlanScene, a: Point, b: Point, angleA: number, angleB: number, k: number, t: number, exemptes: (string | null)[]): { pointe: Point; angle: number } {
  const { c, r } = cheminTrajet(plan, a, b, angleA, angleB, t, exemptes);
  return { pointe: surLigneBrisee(c, k), angle: angleA + (angleB - angleA) * r(k) };
}

/** Position de la pointe ET inclinaison du crayon à l'instant `t` (s, horloge de la scène). */
export function poseStylo(plan: PlanScene, t: number): { pointe: Point; angle: number } {
  const W = plan.largeur;
  const H = plan.hauteur;
  const actions = plan.actions.filter((a) => a.duree > 0);
  const enCours = actions.find((a) => t >= a.debut && t < a.debut + a.duree);
  if (enCours) return { pointe: pointAction(enCours, (t - enCours.debut) / enCours.duree, W, H), angle: enCours.angle };
  const avant = actions.filter((a) => a.debut + a.duree <= t).at(-1);
  const apres = actions.find((a) => a.debut > t);
  const reposIci = (): Point => {
    const b = balancement(t, W);
    return { x: plan.repos.x + b.x, y: plan.repos.y + b.y };
  };
  const finAvant = avant ? pointAction(avant, 1, W, H) : null;
  const debutApres = apres ? pointAction(apres, 0, W, H) : null;
  const tFin = avant ? avant.debut + avant.duree : -Infinity;
  const tDebut = apres ? apres.debut : Infinity;
  const ex = (a: Action | undefined) => (a ? (plan.exemptes[`${a.elementId}|${a.partie}`] ?? null) : null);
  const tA = (k: number) => adoucir(k);
  if (finAvant && debutApres && avant && apres && tDebut - tFin <= REGLAGES_TABLEAU.seuilReposSec)
    return trajet(plan, finAvant, debutApres, avant.angle, apres.angle, tA((t - tFin) / (tDebut - tFin)), t, [ex(avant), ex(apres)]);
  const duree = REGLAGES_TABLEAU.trajetReposSec;
  // Repos en marge, sauf si l'aller ou le retour passerait sur un texte écrit : le crayon reste alors levé là où il a
  // fini (il y bouge légèrement), puis va droit à l'action suivante.
  const tMarge = avant ? avant.debut + avant.duree + 1e-6 : t;
  const allerLibre = !finAvant || !avant || cheminTrajet(plan, finAvant, plan.repos, avant.angle, plan.angleRepos, tMarge, [ex(avant)]).cout === 0;
  const retourLibre = !debutApres || !apres || cheminTrajet(plan, plan.repos, debutApres, plan.angleRepos, apres.angle, tMarge, [ex(apres)]).cout === 0;
  if (finAvant && avant && (!allerLibre || !retourLibre)) {
    const b = balancement(t - tFin, W);
    const b0 = balancement(0, W);
    // Il ne bouge que vers la gauche (la page) et de haut en bas : jamais plus près du bord droit qu'à la fin de l'action.
    const leve = { x: finAvant.x - Math.abs(b.x - b0.x) * 0.6, y: finAvant.y + (b.y - b0.y) * 0.6 };
    if (debutApres && apres && tDebut - t < duree) return trajet(plan, leve, debutApres, avant.angle, apres.angle, tA(1 - (tDebut - t) / duree), t, [ex(avant), ex(apres)]);
    return { pointe: leve, angle: avant.angle };
  }
  if (finAvant && avant && t - tFin < duree) return trajet(plan, finAvant, reposIci(), avant.angle, plan.angleRepos, tA((t - tFin) / duree), t, [ex(avant)]);
  if (debutApres && apres && tDebut - t < duree) return trajet(plan, reposIci(), debutApres, plan.angleRepos, apres.angle, tA(1 - (tDebut - t) / duree), t, [ex(apres)]);
  return { pointe: reposIci(), angle: plan.angleRepos };
}

/** Position de la pointe du crayon à l'instant `t` (s, horloge de la scène). */
export const positionStylo = (plan: PlanScene, t: number): Point => poseStylo(plan, t).pointe;

/** Plan d'une page PLEINE (tout déjà écrit) : la page précédente qui glisse quand une scène ouvre une nouvelle page. */
export function planPagePleine(p: ProprietesTableauScene, page: PagePlacee): PlanScene {
  const ids = [...page.elements.map((e) => e.elementId), ...page.gestes.map((g) => g.elementId)];
  return planifierScene({ ...p, page, dejaEcrits: ids, heures: [], pagePrecedente: null });
}
