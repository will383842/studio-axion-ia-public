/**
 * LES 15 FAMILLES D'ANIMATION (retour de Will sur la vidéo 5, 15/10 : « c'est presque toujours les mêmes choses qui
 * reviennent… il faut beaucoup plus de types d'animations ou de motions design différents ») — PUR.
 *
 * fenêtre, étiquette (tous les calques : étiquette, compteur, étiquette qui glisse, tuile, rangée de logos) et carte,
 * plus les 12 familles « motion » (`FAMILLES_MOTION`, rendu dans `studio-rendu/.../interface-claire/motion/`).
 * Une APPARITION = un objet du plan, rangé dans sa famille ; c'est sur la suite des apparitions que portent les règles de
 * diversité R1 à R7 du directeur artistique (`regles.ts`).
 *
 * Le visage : « couvert » (fenêtre sur-le-visage, mot géant, écran partagé, volet), « poussé » (carte, fenêtre au-dessus,
 * étiquette : la prise descend), sinon « à sa place ». Un objet couvre le visage ENTIER ou RIEN (décision de Will).
 */
import { CADRAGE_FENETRE_DEFAUT, FAMILLES_MOTION, type FamilleMotion, type MotionPlan, type PlaceEcran, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

export const FAMILLES = ["fenetre", "etiquette", "carte", ...FAMILLES_MOTION] as const;
export type Famille = (typeof FAMILLES)[number];

export interface FicheFamille {
  id: Famille;
  nom: string;
  quandUtiliser: string;
  /** Effet sur le visage de Will (« selon-cadrage » : la fenêtre sur-le-visage couvre, au-dessus pousse). */
  visage: "couvert" | "entier" | "pousse" | "selon-cadrage";
  /** Objet plein écran (R1e : jamais avant 10 s). */
  pleinEcran: boolean;
  /** Plafond pour une vidéo de 90 s (R4b ; ramené à la durée hors de 80 à 95 s). */
  plafond90: number;
  /** Permise dans les 4 premières secondes (R1b). */
  ouverture: boolean;
  /** Bruitages PROPRES à la famille (R6 : chaque famille a son son ; les whoosh sont réservés à ce qui traverse le cadre). */
  sons: readonly string[];
  /** L'objet entre ou sort du cadre (il a droit au whoosh). */
  traverseCadre: boolean;
  /** Place par défaut à l'écran (R4c : une même place 2 fois de suite au plus). */
  place: PlaceEcran;
  /** Entrée par défaut (R4c). */
  entree: string;
  /** L'objet bouge en continu tant qu'il est là (le temps dessous ne fait pas de trou, comme une mini-vidéo). */
  continu: boolean;
  /** Surface d'écran changée (% de l'image) à l'entrée, et par sous-élément (estimations ; DA : ≥ 5 % par sous-élément). */
  surfaceEntree: number;
  surfaceSousElement: number;
}

const F = (x: FicheFamille) => x;

/** Le catalogue (l'ordre : les 3 familles d'avant, puis les 12 motions). */
export const CATALOGUE_FAMILLES: Readonly<Record<Famille, FicheFamille>> = Object.freeze({
  fenetre: F({ id: "fenetre", nom: "Fenêtre (mini-vidéo ou photo)", quandUtiliser: "Une action concrète ou un lieu dits (taper, appeler, signer, atelier, bureau le soir…) : on montre la scène.", visage: "selon-cadrage", pleinEcran: false, plafond90: 6, ouverture: false, sons: ["drop_004", "minimize_004"], traverseCadre: true, place: "centre", entree: "droite", continu: false, surfaceEntree: 0, surfaceSousElement: 4 }),
  etiquette: F({ id: "etiquette", nom: "Étiquette (et compteur, rôle qui glisse, tuile, logos)", quandUtiliser: "Le mot fort, un rôle, un outil, un chiffre dit (compteur), une négation (barrée).", visage: "pousse", pleinEcran: false, plafond90: 5, ouverture: true, sons: ["maximize_004", "tick_001"], traverseCadre: false, place: "haut", entree: "pop", continu: false, surfaceEntree: 0, surfaceSousElement: 1.5 }),
  carte: F({ id: "carte", nom: "Carte (frise, liste, grille, calendrier, chat…)", quandUtiliser: "Une énumération, une question, un processus : la carte se remplit mot après mot. Chaque contenu une fois par vidéo.", visage: "pousse", pleinEcran: false, plafond90: 5, ouverture: false, sons: ["drop_002"], traverseCadre: true, place: "haut", entree: "chute", continu: false, surfaceEntree: 0, surfaceSousElement: 0 }),
  "mot-geant": F({ id: "mot-geant", nom: "Mot géant cinétique plein écran", quandUtiliser: "La phrase choc ou le basculement du script (fuite, stop, gratuit). Au plus un par tranche de 30 s, jamais avant 10 s.", visage: "couvert", pleinEcran: true, plafond90: 3, ouverture: false, sons: ["maximize_008"], traverseCadre: false, place: "plein", entree: "eclat", continu: false, surfaceEntree: 75, surfaceSousElement: 12 }),
  "ecran-partage": F({ id: "ecran-partage", nom: "Écran partagé avant / après", quandUtiliser: "Une opposition dite par Will : avant/après, sans/avec, eux/vous, soirées/week-end. Deux par vidéo au plus.", visage: "couvert", pleinEcran: true, plafond90: 2, ouverture: false, sons: ["select_001"], traverseCadre: true, place: "plein", entree: "balayage", continu: false, surfaceEntree: 70, surfaceSousElement: 7 }),
  telephone: F({ id: "telephone", nom: "Téléphone dont l'écran s'anime", quandUtiliser: "Quand Will parle d'e-mail, de relance, de rendez-vous, de visio, de message ou de lien en commentaire.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: false, sons: ["click_001"], traverseCadre: false, place: "droite", entree: "monte", continu: false, surfaceEntree: 14, surfaceSousElement: 5.5 }),
  "carte-france": F({ id: "carte-france", nom: "Carte de France qui s'allume", quandUtiliser: "« Partout en France », « à distance », « en visio », « des entreprises comme la vôtre ». Jamais de nom de ville.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: false, sons: ["select_002"], traverseCadre: false, place: "gauche", entree: "fondu", continu: false, surfaceEntree: 16, surfaceSousElement: 5.5 }),
  "pile-notifications": F({ id: "pile-notifications", nom: "Pile de notifications", quandUtiliser: "Une énumération de tâches ou de sollicitations (devis, relances, appels) pour montrer la surcharge, à la place d'une carte « liste ».", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: false, sons: ["drop_001"], traverseCadre: false, place: "droite", entree: "descend", continu: false, surfaceEntree: 12, surfaceSousElement: 6 }),
  "chiffre-eclate": F({ id: "chiffre-eclate", nom: "Chiffre qui éclate", quandUtiliser: "Seulement pour un nombre prononcé dans la phrase (« 45 minutes », « un, deux, trois »). Interdit pour un nombre que Will n'a pas dit.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: true, sons: ["maximize_006"], traverseCadre: false, place: "gauche", entree: "eclat", continu: false, surfaceEntree: 12, surfaceSousElement: 6 }),
  "trait-dessine": F({ id: "trait-dessine", nom: "Soulignement ou encadré dessiné autour d'un mot du sous-titre", quandUtiliser: "Pour mettre l'accent sur le mot fort d'une phrase sans rien poser par-dessus. C'est la respiration entre deux objets lourds, et elle est permise dès 1 s.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: true, sons: ["click_003"], traverseCadre: false, place: "bas", entree: "dessin", continu: false, surfaceEntree: 6, surfaceSousElement: 6 }),
  volet: F({ id: "volet", nom: "Volet de transition coloré", quandUtiliser: "Pour changer de partie dans le script (problème, puis solution, puis offre, puis appel). Deux par vidéo au plus.", visage: "couvert", pleinEcran: true, plafond90: 2, ouverture: false, sons: ["minimize_006"], traverseCadre: true, place: "plein", entree: "balayage", continu: false, surfaceEntree: 80, surfaceSousElement: 10 }),
  ruban: F({ id: "ruban", nom: "Ruban défilant de mots-clés", quandUtiliser: "Un passage riche en mots-clés (offre, interventions, domaines) que l'on montrerait sinon avec une carte « frise ».", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: false, sons: ["tick_002"], traverseCadre: false, place: "bas", entree: "glisse-droite", continu: true, surfaceEntree: 10, surfaceSousElement: 6 }),
  horloge: F({ id: "horloge", nom: "Horloge qui s'emballe et minuteur", quandUtiliser: "Le temps qui file, les soirées, les journées sans fin, ou une durée annoncée.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: true, sons: ["tick_004"], traverseCadre: false, place: "gauche", entree: "pop", continu: true, surfaceEntree: 12, surfaceSousElement: 6 }),
  jauge: F({ id: "jauge", nom: "Jauge et cadran de niveau", quandUtiliser: "Une charge, un niveau, une urgence ou une priorité, à la place d'une carte « graphique » ou « statuts ».", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: false, sons: ["drop_003"], traverseCadre: false, place: "droite", entree: "monte", continu: false, surfaceEntree: 12, surfaceSousElement: 6 }),
  bulles: F({ id: "bulles", nom: "Bulles de questions qui flottent", quandUtiliser: "Les questions posées (« par où commencer ? »), les doutes du dirigeant, les objections.", visage: "entier", pleinEcran: false, plafond90: 3, ouverture: true, sons: ["click_002"], traverseCadre: false, place: "haut", entree: "monte", continu: false, surfaceEntree: 10, surfaceSousElement: 6 }),
});

export const estFamilleMotion = (f: string): f is FamilleMotion => (FAMILLES_MOTION as readonly string[]).includes(f);

/* ---------------- Seuils de diversité (R1 à R7, directeur artistique du 15/10) ---------------- */

/** Seuils pour une vidéo de 80 à 95 s ; ramenés à la minute (à la durée) en dehors. */
export const DIVERSITE = Object.freeze({
  dureeRef: 90,
  plageRef: [80, 95] as const,
  /** R1 : ouverture sur le visage entier (référence : 1er objet sur le visage à 5,0 s, 1re carte à 12,3 s). */
  rienAvantSec: 0.8,
  ouvertureSec: 4,
  premiereCouvertureSec: 5,
  premiereCarteSec: 8,
  premierPleinEcranSec: 10,
  /** R2 : temps de visage. */
  couvertMax: 0.3,
  enPlaceMin: 0.45,
  fenetreCouvertureSec: 10,
  couvertDansFenetreMax: 0.5,
  visageEntreCouverturesSec: 1,
  /** R3 : enchaînements. */
  suiteMemeFamille: 5,
  memeFamilleDansSuiteMax: 2,
  coupleRevientApres: 6,
  /** R4 : plafonds. */
  partFamilleMax: 0.2,
  trancheMotGeantSec: 30,
  memePlaceDeSuiteMax: 2,
  partFenetresSurVisageMax: 0.5,
  partFenetresEtiquetteMax: 0.5,
  /** R5 : variété. */
  fenetre60Sec: 60,
  famillesPar60Min: 7,
  fenetre20Sec: 20,
  famillesPar20Min: 4,
  famillesVideoMin: 10,
  famillesNouvellesMin: 6,
  intervalleMoyenMin: 1,
  intervalleMoyenMax: 2.5,
  sansEvenementMaxSec: 3,
  debutsEcartMinSec: 0.4,
  /** R6 : bruitages. */
  partSonMax: 0.3,
  /** R7 : historique. */
  premiereFamilleVideos: 3,
  couplesDebutSec: 20,
  couplesPartagesMax: 0.5,
  absentesDeLaPrecedenteMin: 3,
});

/** Facteur de durée : 1 pour une vidéo de 80 à 95 s, sinon durée / 90 (« ramené à la minute »). */
export const facteurDuree = (duree: number) => (duree >= DIVERSITE.plageRef[0] && duree <= DIVERSITE.plageRef[1] ? 1 : duree / DIVERSITE.dureeRef);
/** Un seuil « pour 90 s » ramené à la durée (au moins 1). */
export const ramene = (seuil90: number, duree: number) => Math.max(1, Math.round(seuil90 * facteurDuree(duree)));
/** Plafond d'une famille pour cette durée (R4b), diminué de 1 si la famille a atteint son plafond dans la vidéo précédente (R7d). */
export function plafondFamille(f: Famille, duree: number, precedente?: { comptesFamilles?: Readonly<Record<string, number>>; duree?: number }): number {
  const cap = ramene(CATALOGUE_FAMILLES[f].plafond90, duree);
  const avant = precedente?.comptesFamilles?.[f];
  if (avant !== undefined && precedente?.duree !== undefined && avant >= ramene(CATALOGUE_FAMILLES[f].plafond90, precedente.duree)) return Math.max(0, cap - 1);
  return cap;
}

/* ---------------- Apparitions ---------------- */

export interface Apparition {
  famille: Famille;
  debut: number;
  fin: number;
  /** « carte 2 (liste) », « motion 4 (horloge) »… */
  nom: string;
  /** Type fin : contenu d'une carte, type de calque, famille d'une motion, « video » / « photo » d'une fenêtre. */
  type: string;
  couvre: boolean;
  pousse: boolean;
  plein: boolean;
  place: PlaceEcran;
  entree: string;
}

const PLACES_CALQUES: Record<string, PlaceEcran> = { etiquette: "haut", compteur: "haut", logos: "haut", glisse: "droite", tuile: "gauche" };

/** Les apparitions du plan (cartes, fenêtres, calques, motions), triées par début. */
export function apparitionsDuPlan(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques"> & { motions?: readonly MotionPlan[] }): Apparition[] {
  const r: Apparition[] = [];
  plan.cartes.forEach((c, i) => r.push({ famille: "carte", debut: c.debut, fin: c.fin, nom: `carte ${i + 1} (${c.contenu.type})`, type: c.contenu.type, couvre: false, pousse: true, plein: false, place: "haut", entree: c.entree }));
  plan.fenetres.forEach((f, i) => {
    const visage = (f.cadrage ?? CADRAGE_FENETRE_DEFAUT) === "sur-le-visage";
    r.push({ famille: "fenetre", debut: f.debut, fin: f.fin, nom: `fenêtre ${i + 1}`, type: f.video ? "video" : "photo", couvre: visage, pousse: !visage, plein: false, place: visage ? "centre" : "haut", entree: f.entree ?? "droite" });
  });
  plan.calques.forEach((c, i) => r.push({ famille: "etiquette", debut: c.debut, fin: c.fin, nom: `calque ${i + 1} (${c.type})`, type: c.type, couvre: false, pousse: true, plein: false, place: PLACES_CALQUES[c.type] ?? "haut", entree: c.type === "glisse" ? "glisse-gauche" : "pop" }));
  (plan.motions ?? []).forEach((m, i) => {
    const fiche = CATALOGUE_FAMILLES[m.famille];
    r.push({ famille: m.famille, debut: m.debut, fin: m.fin, nom: `motion ${i + 1} (${m.famille})`, type: m.famille, couvre: fiche.visage === "couvert", pousse: false, plein: fiche.pleinEcran, place: m.place ?? fiche.place, entree: m.entree ?? fiche.entree });
  });
  return r.sort((x, y) => x.debut - y.debut || x.fin - y.fin);
}

/** Bruitage → sa « famille de son » (« drop_002 » → « drop », « whoosh-in » → « whoosh ») pour le plafond de 30 % (R6). */
export const familleDeSon = (son: string) => son.replace(/[-_](in|out|\d+)$/i, "").replace(/[-_]\d+$/, "");

/** La famille qui possède un son (R6 : chaque famille a son bruitage propre) ; null pour un whoosh ou l'écran de fin. */
export function familleDuSon(son: string): Famille | null {
  for (const f of FAMILLES) if (CATALOGUE_FAMILLES[f].sons.includes(son)) return f;
  return null;
}
