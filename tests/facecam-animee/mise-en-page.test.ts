/**
 * FACE CAMÉRA ANIMÉE — MISE EN PAGE (retours de Will du 14/10, cahier des charges de l'architecte) : fonctions PURES de
 * `studio-rendu/compositions/interface-claire/cadrage.ts`, vérifiées image par image (25 i/s) sur le plan de la 1re
 * vidéo (plan-rendu.json, copié ici sans sous-titres ni sons) et deux plans d'essai (prise large réelle, cas extrême).
 *  - les sous-titres ne touchent JAMAIS les yeux ;
 *  - un objet couvre TOUT le visage ou RIEN (objets posés ; les 4 à 6 images d'entrée et de sortie sont du mouvement) ;
 *  - aucune étiquette ne descend sous le haut des cheveux, aucune ne sort du cadre ;
 *  - jamais de bord noir, quel que soit le zoom ou le décalage ;
 *  - descente franche (≥ 0,20 H, 90 % en ≤ 4 images, dépassement ≤ 8 %), recul simultané, remontée après la sortie.
 */
import { describe, expect, it } from "vitest";
import { CADRAGE_FENETRE_DEFAUT, PRISE_DEFAUTS, schemaPlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CalquePlan, CartePlan, FenetrePlan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import {
  boiteVisageAffichee,
  CADRAGE_FENETRE_PAR_DEFAUT,
  couverture,
  DESCENTE,
  hauteurBande,
  hauteurSousTitres,
  largeurEtiquetteFenetre,
  mesurerCalque,
  objetCourant,
  positionSousTitres,
  PRISE_PAR_DEFAUT,
  rectAnime,
  scene,
  tailleEtiquetteFenetre,
  transformPrise,
  yeuxAffiches,
} from "../../studio-rendu/compositions/interface-claire/cadrage";

/** Plan de la 1re vidéo mise en scène par le réalisateur (14/10), sans sous-titres ni sons (inutiles à la mise en page). */
const PLAN_RENDU = JSON.parse(String.raw`{"version":"plan-facecam-animee/1","charte":"interface-claire/1","duree":93,"fps":25,"largeur":1080,"hauteur":1920,"prise":{"src":"prise.mp4","finSec":91.1},"groupes":[],"cartes":[{"debut":9.6,"fin":15.5,"titre":"Vos soirées","icone":"horloge","entree":"chute","contenu":{"type":"liste","lignes":[{"texte":"Soirées sur les devis","icone":"document","a":9.98},{"texte":"Relances à la main","icone":"mail","a":11.12},{"texte":"Chiffres trop tard","icone":"graphique","a":12.14}],"badge":{"texte":"Pas la charge normale","icone":"cadenas","a":14.12}}},{"debut":19.85,"fin":27.3,"titre":"Chez Axion-IA","icone":"etincelles","entree":"glisse","contenu":{"type":"frise","etapes":[{"texte":"Former les équipes","icone":"former","a":20.22},{"texte":"Accompagner","icone":"utilisateur","a":21.8},{"texte":"Auditer","icone":"loupe","a":23.92},{"texte":"Automatiser","icone":"eclair","a":25.3}],"puces":[{"etape":1,"texte":"Dirigeants en one-to-one","a":22.5},{"etape":2,"texte":"Des entreprises","a":24.34}],"badge":{"texte":"Ce qui coûte du temps","a":26.62}}},{"debut":27.4,"fin":31.5,"titre":"Partout, le même réflexe","icone":"globe","entree":"surgit","contenu":{"type":"grille","colonnes":2,"vignettes":[{"a":27.5,"legende":"Petites structures","contenu":{"type":"fiche","lignes":3,"icone":"batiment","iconeA":27.78}},{"a":28.5,"legende":"En croissance","contenu":{"type":"fiche","lignes":4,"icone":"tendance","iconeA":28.98}},{"a":29.62,"legende":"Groupes","contenu":{"type":"fiche","lignes":5,"icone":"reseau"}},{"a":30.02,"legende":"Partout","contenu":{"type":"texte","titre":"Partout","pastille":"Même réflexe"}}]}},{"debut":43.7,"fin":50.5,"titre":"Un dirigeant","icone":"utilisateur","entree":"chute","contenu":{"type":"statuts","avant":{"texte":"Avant","icone":"horloge"},"apres":{"texte":"Après","icone":"coche"},"lignes":[{"nom":"Où partait le temps","a":44.08,"bascule":45.34,"apres":{"texte":"Trouvé","icone":"loupe"}},{"nom":"Recrutement","detail":"Pas de recrutement","a":46.2,"bascule":46.42,"apres":{"texte":"Évité","icone":"coche"}},{"nom":"Ses équipes","detail":"Leur après-midi","a":47.5,"bascule":48.62,"apres":{"texte":"Retrouvé","icone":"coeur"}},{"nom":"Lui","detail":"Son week-end","a":49.46,"bascule":49.94,"apres":{"texte":"Retrouvé","icone":"coeur"}}]}},{"debut":59.5,"fin":67.3,"titre":"Le diagnostic fuite","icone":"loupe","entree":"glisse","contenu":{"type":"frise","etapes":[{"texte":"Où part votre temps ?","icone":"horloge","a":59.8},{"texte":"Ce qui change en premier","icone":"eclair","a":61.86},{"texte":"Vos besoins pour avancer","icone":"boussole","a":64.62}],"puces":[{"etape":0,"texte":"Votre temps","a":60.9},{"etape":1,"texte":"En premier","a":63.76},{"etape":2,"texte":"Pour avancer","a":66.8}]}},{"debut":67.5,"fin":71.3,"titre":"Ou peut-être","icone":"plus","entree":"surgit","contenu":{"type":"grille","colonnes":3,"vignettes":[{"a":67.86,"legende":"Accompagnement","contenu":{"type":"fiche","lignes":3,"icone":"utilisateur","iconeA":68.44}},{"a":69.34,"legende":"Audit complet","contenu":{"type":"fiche","lignes":4,"icone":"loupe","iconeA":69.52}},{"a":70.16,"legende":"Automatisation","contenu":{"type":"fiche","lignes":3,"icone":"eclair"}}]}},{"debut":73.45,"fin":76,"titre":"Vos priorités","icone":"graphique","entree":"chute","contenu":{"type":"graphique","baseA":73.5,"barres":[{"hauteur":0.9,"a":74.04,"accent":true},{"hauteur":0.65,"a":74.24},{"hauteur":0.4,"a":75}],"pastilles":[{"texte":"Claires","icone":"coche","a":74.74},{"texte":"Classées","icone":"graphique","a":75.14}],"mention":"Illustration"}},{"debut":88,"fin":90.72,"titre":"Diagnostic gratuit","icone":"calendrier","entree":"surgit","contenu":{"type":"commentaire","champ":{"indication":"Réservez votre appel","a":88.1},"saisie":{"texte":"Diagnostic","debut":89.34,"fin":90.1},"bouton":{"texte":"Réserver","a":90.16},"commentaire":{"auteur":"Vous","a":90.16},"notification":{"titre":"Axion-IA","texte":"Votre appel diagnostic gratuit","a":90.16}}}],"fenetres":[{"debut":15.8,"fin":18.9,"media":"images/fenetre-1.jpg","recherche":"horloge murale dans un bureau vide le soir","entree":"droite","etiquette":{"texte":"Chaque jour","a":17.2}},{"debut":37.1,"fin":39.8,"media":"images/fenetre-2.jpg","recherche":"robinet qui fuit goutte à goutte","entree":"bas","etiquette":{"texte":"Trouver la fuite","a":38.32}},{"debut":40,"fin":43.4,"media":"images/fenetre-3.jpg","recherche":"dirigeant débordé par la paperasse au bureau","entree":"zoom","noirEtBlancA":41.1,"etiquette":{"texte":"Recruter ?","a":41.32}},{"debut":81.9,"fin":85.3,"media":"images/fenetre-4.jpg","recherche":"sablier qui s'écoule sur un bureau","entree":"droite","etiquette":{"texte":"Du temps vous échappe","a":82.4}}],"calques":[{"type":"etiquette","debut":0.72,"fin":1.9,"texte":"Votre entreprise avance","fond":"orange","icones":[{"nom":"tendance","a":1.28}]},{"type":"etiquette","debut":1.98,"fin":3.7,"texte":"Vos journées","fond":"ivoire","icones":[{"nom":"horloge","a":1.98}],"sousTexte":"N'en finissent plus"},{"type":"etiquette","debut":4.1,"fin":5.4,"texte":"Un problème de travail","fond":"encre","barreA":4.78},{"type":"etiquette","debut":6.1,"fin":8,"texte":"Une fuite","fond":"orange","icones":[{"nom":"horloge","a":6.1}]},{"type":"etiquette","debut":33.58,"fin":37,"texte":"Un outil de plus","fond":"ivoire","icones":[{"nom":"ecran","a":33.96},{"nom":"utilisateur","a":35.18}],"barreA":36.3,"sousTexte":"Une embauche de plus"},{"type":"etiquette","debut":51.98,"fin":53.6,"texte":"Commencer par là","fond":"encre","icones":[{"nom":"boussole","a":51.98}]},{"type":"etiquette","debut":53.72,"fin":55.3,"texte":"Le diagnostic fuite","fond":"orange","icones":[{"nom":"loupe","a":53.78}]},{"type":"etiquette","debut":55.48,"fin":56.9,"texte":"Diagnostic gratuit","fond":"ivoire","icones":[{"nom":"etoile","a":56.24}]},{"type":"compteur","debut":56.94,"fin":58.8,"de":0,"a":45,"dureeDefilement":1.2,"suffixe":" min","legende":"En visio","fond":"encre"},{"type":"glisse","debut":58.82,"fin":59.75,"texte":"Notre équipe","icone":"utilisateurs"},{"type":"etiquette","debut":72.38,"fin":73.4,"texte":"Un miracle","fond":"orange","barreA":72.86,"sousTexte":"En 45 minutes"},{"type":"etiquette","debut":78.02,"fin":79.5,"texte":"L'IA rapporte","fond":"encre","icones":[{"nom":"euro","a":78.02}]},{"type":"etiquette","debut":80.08,"fin":81.7,"texte":"La bonne fuite","fond":"ivoire","icones":[{"nom":"loupe","a":80.18}]}],"zooms":[[5.42,8.16,1.2],[8.16,9.55,1.1],[18,19.8,1.15],[31.86,33.5,1.18],[42.48,43.6,1.12],[50.92,52.5,1.22],[71.36,72.38,1.2],[76.24,77.68,1.1],[77.68,80,1.25],[84.6,86.4,1.15],[86.4,88,1.08]],"fin":{"debut":90.72,"marque":"Axion-IA","adresse":"axion-ia.com","motCle":"DIAGNOSTIC","tuiles":["former","boussole","loupe","eclair"],"appel":"Le lien en commentaire"},"sons":[],"pastilles":false}`) as PlanFacecamAnimee;

const base = (prise: PlanFacecamAnimee["prise"], duree: number): Omit<PlanFacecamAnimee, "cartes" | "fenetres" | "calques" | "zooms"> => ({
  version: "plan-facecam-animee/1",
  charte: "interface-claire/1",
  duree,
  fps: 25,
  largeur: 1080,
  hauteur: 1920,
  prise,
  groupes: [],
  mouvements: [],
  fin: { debut: duree - 2, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
  sons: [],
});
const liste = (debut: number, fin: number, n = 3): CartePlan => ({ debut, fin, titre: "Boîte mail", icone: "mail", entree: "chute", contenu: { type: "liste", lignes: Array.from({ length: n }, (_, i) => ({ texte: `Ligne ${i + 1}`, icone: "mail", a: debut + 0.2 * i })) } });
const frise = (debut: number, fin: number): CartePlan => ({ debut, fin, titre: "Agenda du dirigeant", icone: "calendrier", entree: "glisse", contenu: { type: "frise", etapes: [0, 1, 2, 3].map((i) => ({ texte: `Étape ${i}`, icone: "horloge", a: debut + 0.3 * i })) } });
const grille = (debut: number, fin: number): CartePlan => ({ debut, fin, titre: "Partout", icone: "image", entree: "surgit", contenu: { type: "grille", colonnes: 2, vignettes: Array.from({ length: 6 }, (_, i) => ({ a: debut + 0.1 * i, legende: `V${i}`, contenu: { type: "image" as const } })) } });
const fenetre = (debut: number, fin: number, extra: Partial<FenetrePlan> = {}): FenetrePlan => ({ debut, fin, media: "images/fenetre-1.jpg", recherche: "horloge", ...extra });

/** Prise LARGE réelle de Will (mesurée au détecteur de visages le 14/10 : yeux 0,302, centre 0,41, largeur 0,39). */
const PLAN_LARGE: PlanFacecamAnimee = {
  ...base({ src: "prise-large.mp4", finSec: 40, yeux: 0.302, centreX: 0.41, largeurVisage: 0.39 }, 40),
  zooms: [
    [0.3, 0.7, 1.5],
    [9.5, 10.4, 1.2],
    [28.6, 29.5, 1.45],
  ],
  mouvements: [
    { debut: 1.5, fin: 2.4, type: "zoom-rapide", echelle: 1.5 },
    { debut: 2.4, fin: 3.0, type: "recul", echelle: 1.4 },
    { debut: 3.1, fin: 3.9, type: "decale-gauche", echelle: 1.4 },
    { debut: 3.9, fin: 4.6, type: "decale-droite", echelle: 1.3 },
    { debut: 30.0, fin: 31.0, type: "decale-droite", echelle: 1.5 },
  ],
  cartes: [liste(5, 8), frise(8.2, 9.4), grille(20, 22.5), liste(22.6, 24, 5)],
  fenetres: [
    fenetre(12, 14.5, { etiquette: { texte: "Trouver la fuite", a: 12.5 } }),
    fenetre(14.7, 16.5, { cadrage: "au-dessus", video: true, depuisSec: 2, etiquette: { texte: "Recruter ?", a: 15 } }),
    fenetre(24.1, 26, { cadrage: "sur-le-visage", entree: "bas" }),
  ],
  calques: [
    { type: "etiquette", debut: 0.72, fin: 1.4, texte: "Votre entreprise avance", fond: "orange", icones: [{ nom: "tendance", a: 1.0 }] },
    { type: "etiquette", debut: 17, fin: 18.2, texte: "Vos journées", sousTexte: "N'en finissent plus", icones: [{ nom: "horloge", a: 17 }] },
    { type: "compteur", debut: 18.3, fin: 19.8, de: 0, a: 45, suffixe: " min", legende: "En visio", fond: "encre" },
    { type: "glisse", debut: 26.5, fin: 27.4, texte: "Notre équipe", icone: "utilisateurs" },
    { type: "tuile", debut: 27.5, fin: 28.4, icone: "etincelles", legende: "Axion-IA" },
    { type: "logos", debut: 32, fin: 33.5, logos: ["mail", "calendrier", "loupe"].map((icone, i) => ({ icone, a: 32 + 0.2 * i })) },
  ],
};

/** Cas extrême : visage bas et décalé, large ; grandes cartes ; zooms et décalages au maximum. */
const PLAN_EXTREME: PlanFacecamAnimee = {
  ...base({ src: "prise.mp4", finSec: 30, yeux: 0.45, centreX: 0.68, largeurVisage: 0.5 }, 30),
  zooms: [
    [0.2, 1.0, 1.5],
    [12, 13, 1.5],
  ],
  mouvements: [
    { debut: 1.0, fin: 2.0, type: "decale-gauche", echelle: 1.5 },
    { debut: 2.0, fin: 2.6, type: "zoom-rapide", echelle: 1.5 },
    { debut: 13, fin: 14, type: "decale-droite", echelle: 1.25 },
  ],
  cartes: [grille(3, 5), liste(5.1, 7, 5), frise(15, 16)],
  fenetres: [fenetre(8, 10), fenetre(10.2, 11.5, { cadrage: "au-dessus" }), fenetre(16.1, 18)],
  calques: [
    { type: "etiquette", debut: 19, fin: 20.5, texte: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM", sousTexte: "WWWWWWWWWWWWWWWWWWWWWWWW", icones: [0, 1, 2, 3].map((i) => ({ nom: "loupe", a: 19 + 0.1 * i })) },
    { type: "compteur", debut: 21, fin: 22.5, de: 0, a: 99999999, prefixe: "+€€€", suffixe: " ressource", legende: "WWWWWWWWWWWWWWWWWWWW" },
  ],
};

const PLANS: [string, PlanFacecamAnimee][] = [
  ["plan de la 1re vidéo", PLAN_RENDU],
  ["prise large", PLAN_LARGE],
  ["cas extrême", PLAN_EXTREME],
];
const images = (p: PlanFacecamAnimee) => Array.from({ length: Math.floor(p.fin.debut * p.fps) }, (_, i) => i / p.fps);

describe("mise en page · contrat", () => {
  it("les plans d'essai sont valides et les valeurs par défaut sont celles du domaine", () => {
    for (const [nom, p] of PLANS) expect(schemaPlanFacecamAnimee.safeParse(p).success, nom).toBe(true);
    expect(PRISE_PAR_DEFAUT).toEqual(PRISE_DEFAUTS);
    expect(CADRAGE_FENETRE_PAR_DEFAUT).toBe(CADRAGE_FENETRE_DEFAUT);
    expect(hauteurSousTitres()).toBeGreaterThan(0.02);
    expect(hauteurSousTitres()).toBeLessThan(0.1);
  });
});

describe.each(PLANS)("mise en page · %s", (_nom, plan) => {
  const sc = scene(plan);

  it("les sous-titres ne chevauchent JAMAIS [yeux ± 0,03], à chaque image", () => {
    const demi = hauteurSousTitres() / 2;
    for (const t of images(plan)) {
      const y = positionSousTitres(sc, t);
      const yeux = yeuxAffiches(sc, t);
      expect(Math.abs(y - yeux), `t = ${t.toFixed(2)} s`).toBeGreaterThanOrEqual(demi + 0.03 - 1e-9);
      expect(y + demi).toBeLessThanOrEqual(1);
    }
  });

  it("TOUT OU RIEN : un objet posé couvre 0 % ou 100 % du visage ; une étiquette reste au-dessus des cheveux", () => {
    let poses = 0;
    for (const t of images(plan)) {
      const visage = boiteVisageAffichee(sc, t, "front");
      const cheveux = boiteVisageAffichee(sc, t, "cheveux");
      for (const o of sc.objets) {
        if (t < o.debut || t >= o.fin) continue;
        const { rect, phase } = rectAnime(o, t, plan);
        if (phase !== "pose") continue;
        poses++;
        const c = couverture(rect, o.genre === "fenetre-visage" ? cheveux : visage);
        expect(c < 0.005 || c > 0.995, `${o.genre} n° ${o.index}, t = ${t.toFixed(2)} s : ${(c * 100).toFixed(1)} %`).toBe(true);
        if (o.genre === "fenetre-visage") expect(c, `fenêtre n° ${o.index} t = ${t.toFixed(2)}`).toBeGreaterThan(0.995);
        if (o.genre === "calque") expect(rect.y1, `calque n° ${o.index} t = ${t.toFixed(2)}`).toBeLessThanOrEqual(cheveux.y0 + 1e-9);
      }
    }
    expect(poses).toBeGreaterThan(0);
  });

  it("aucun bord noir : la prise couvre toujours la largeur, le bas, et le haut découvert est sous la bande ivoire", () => {
    for (const t of images(plan)) {
      const { echelle, tx, ty } = transformPrise(sc, t);
      expect(echelle).toBeGreaterThanOrEqual(1);
      expect(echelle).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(tx).toBeLessThanOrEqual(1e-9);
      expect(tx + echelle).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(ty + echelle).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(ty).toBeLessThanOrEqual(hauteurBande(sc, t) + 1e-9);
    }
  });

  it("cartes : 0,81 L, de 0,13 H à au moins 0,465 H ; fenêtre « sur-le-visage » par défaut", () => {
    for (const c of sc.cartes) {
      expect(c.rect.x1 - c.rect.x0).toBeCloseTo(0.81, 6);
      expect(c.rect.y0).toBeCloseTo(0.13, 6);
      expect(c.rect.y1).toBeGreaterThanOrEqual(0.465 - 1e-9);
    }
    plan.fenetres.forEach((f, i) => expect(sc.fenetres[i].genre).toBe(f.cadrage === "au-dessus" ? "fenetre-dessus" : "fenetre-visage"));
    for (const f of sc.fenetres.filter((x) => x.genre === "fenetre-visage")) {
      expect(f.rect.y1).toBeLessThanOrEqual(0.72 + 1e-9);
      expect(f.rect.x1 - f.rect.x0).toBeGreaterThanOrEqual(0.81 - 1e-9);
      // Référence : ≈ 0,81 L × 0,56 H (tolérance ± 0,03 tant que le visage tient dedans).
      if (plan !== PLAN_EXTREME) expect(Math.abs(f.rect.y1 - f.rect.y0 - 0.56)).toBeLessThanOrEqual(0.03);
    }
    for (const f of sc.fenetres.filter((x) => x.genre === "fenetre-dessus")) {
      expect(f.rect.x1 - f.rect.x0).toBeCloseTo(0.81, 6);
      expect(f.rect.y1 - f.rect.y0).toBeCloseTo(0.3, 6);
    }
  });

  it("descente : 90 % en ≤ 4 images, dépassement ≤ 8 %, échelle revenue à 1 ; la prise ne descend pas sous une fenêtre « sur-le-visage »", () => {
    const fps = plan.fps;
    for (const o of sc.objets) {
      const milieu = (o.debut + o.fin) / 2;
      if (o.fin - o.debut < 0.6) continue;
      if (o.genre === "fenetre-visage") {
        expect(transformPrise(sc, milieu).ty).toBeCloseTo(0, 6);
        expect(transformPrise(sc, milieu).echelle).toBeCloseTo(1, 6);
        continue;
      }
      const avant = yeuxAffiches(sc, o.debut - 0.5 / fps);
      const pendant = yeuxAffiches(sc, milieu);
      // Carte ou fenêtre : recul (échelle 1). Étiquette : les zooms continuent, la descente en tient compte.
      if (o.genre !== "calque") expect(transformPrise(sc, milieu).echelle).toBeCloseTo(1, 6);
      const ecart = pendant - avant;
      if (ecart < 0.03) continue; // enchaîné sur un objet plus bas : pas de nouvelle descente
      const k = [1, 2, 3, 4].find((i) => yeuxAffiches(sc, o.debut + i / fps) - avant >= 0.9 * ecart);
      expect(k, `${o.genre} n° ${o.index}`).toBeDefined();
      const pic = Math.max(...[1, 2, 3, 4, 5, 6].map((i) => yeuxAffiches(sc, o.debut + i / fps)));
      expect(pic - pendant).toBeLessThanOrEqual(0.08 * ecart + 1e-9);
    }
  });
});

describe("mise en page · prise large (mesures de la référence)", () => {
  const sc = scene(PLAN_LARGE);

  it("pendant une carte : yeux entre 0,55 et 0,62 H, visage de 0,36 à 0,40 L (recul), descente ≥ 0,20 H", () => {
    for (const c of sc.cartes) {
      const t = (c.debut + c.fin) / 2;
      const y = yeuxAffiches(sc, t);
      expect(y).toBeGreaterThanOrEqual(0.55);
      expect(y).toBeLessThanOrEqual(0.62);
      const v = boiteVisageAffichee(sc, t);
      const largeur = (v.x1 - v.x0) / 1.2;
      expect(largeur).toBeGreaterThanOrEqual(0.36);
      expect(largeur).toBeLessThanOrEqual(0.4);
      expect(y - PLAN_LARGE.prise.yeux!).toBeGreaterThanOrEqual(0.2);
    }
  });

  it("deux objets à moins de 0,3 s : la prise ne remonte pas entre les deux ; sinon elle remonte 1 à 2 images après la sortie", () => {
    // Carte 0 (5 → 8) puis carte 1 (8,2 → 9,4) : 0,2 s d'écart, la prise reste en bas.
    for (let t = 8; t < 8.2; t += 0.02) expect(yeuxAffiches(sc, t)).toBeGreaterThan(0.55);
    // Fenêtre au-dessus (14,7 → 16,5) puis étiquette à 17 (0,5 s) : remontée 1 à 2 images après la sortie, en 3-4 images.
    const bas = yeuxAffiches(sc, 16.4);
    expect(yeuxAffiches(sc, 16.5 + 1 / 25)).toBeCloseTo(bas, 6);
    expect(yeuxAffiches(sc, 16.5 + 6 / 25)).toBeCloseTo(PLAN_LARGE.prise.yeux!, 3);
  });

  it("décision de Will du 15/10 : AUCUN zoom ni mouvement de cadrage, même si le plan en contient (échelle 1, aucun décalage)", () => {
    // Ce plan contient des zooms coupés à 1,5 et les 4 types de mouvements : le rendu les ignore tous.
    expect(PLAN_LARGE.zooms.length + (PLAN_LARGE.mouvements ?? []).length).toBeGreaterThan(0);
    for (const [, p] of PLANS) {
      const s = scene(p);
      for (let t = 0; t < p.duree; t += 1 / p.fps) {
        const { echelle, tx } = transformPrise(s, t);
        expect(echelle, `t = ${t.toFixed(2)}`).toBe(1);
        expect(tx, `t = ${t.toFixed(2)}`).toBe(0);
      }
    }
    // Visage seul (zoom coupé à 0,5 s, zoom rapide à 1,8 s, décalés à 3,5 et 4,3 s) : les yeux restent à leur place.
    for (const t of [0.5, 1.8, 3.5, 4.3]) expect(yeuxAffiches(sc, t)).toBeCloseTo(0.302, 6);
  });
});

describe("mise en page · étiquettes jamais hors cadre", () => {
  const W = 1080;
  const H = 1920;
  const longs: CalquePlan[] = [
    { type: "etiquette", debut: 0, fin: 1, texte: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM", sousTexte: "WWWWWWWWWWWWWWWWWWWWWWWW", icones: [0, 1, 2, 3].map((i) => ({ nom: "loupe", a: i })) },
    { type: "etiquette", debut: 0, fin: 1, texte: "Votre entreprise avance", fond: "orange", icones: [{ nom: "tendance", a: 0.5 }] },
    { type: "glisse", debut: 0, fin: 1, texte: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW", icone: "loupe" },
    { type: "compteur", debut: 0, fin: 1, de: 0, a: 99999999, prefixe: "WWWW", suffixe: "WWWWWWWWWW", legende: "WWWWWWWWWWWWWWWWWWWW" },
    { type: "logos", debut: 0, fin: 1, logos: Array.from({ length: 6 }, () => ({ icone: "loupe", a: 0 })) },
    { type: "tuile", debut: 0, fin: 1, icone: "loupe", legende: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" },
  ];
  it.each(longs.map((c) => [c.type, c] as const))("%s : marge ≥ 0,04 L posée, jamais hors cadre au sommet du « pop »", (_t, c) => {
    const { rect } = mesurerCalque(c, W, H);
    expect(rect.x0).toBeGreaterThanOrEqual(0.04 - 1e-9);
    expect(rect.x1).toBeLessThanOrEqual(0.96 + 1e-9);
    expect(rect.y0).toBeGreaterThanOrEqual(0);
    const cx = (rect.x0 + rect.x1) / 2;
    const demi = ((rect.x1 - rect.x0) / 2) * 1.1;
    expect(cx - demi).toBeGreaterThanOrEqual(-1e-9);
    expect(cx + demi).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("« VOTRE ENTREPRISE AVANCE » (coupée à t = 1,0 s sur la 1re vidéo) tient dans le cadre", () => {
    const sc = scene(PLAN_RENDU);
    const i = PLAN_RENDU.calques.findIndex((c) => c.type === "etiquette" && c.texte === "Votre entreprise avance");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(sc.calques[i].rect.x0).toBeGreaterThanOrEqual(0.04);
    expect(sc.calques[i].rect.x1).toBeLessThanOrEqual(0.96);
  });

  it("étiquette posée sur une fenêtre : GRANDE, 0,70 à 0,78 de la largeur de la fenêtre", () => {
    const l = 0.81 * W;
    for (const texte of ["Chaque jour", "Trouver la fuite", "Recruter ?", "Du temps vous échappe", "Des milliers d'euros"]) {
      const taille = tailleEtiquetteFenetre(texte, l, W);
      const r = largeurEtiquetteFenetre(texte, taille, W) / l;
      expect(r, texte).toBeGreaterThanOrEqual(0.7 - 1e-6);
      expect(r, texte).toBeLessThanOrEqual(0.78);
    }
  });

  it("objet courant : la carte ou la fenêtre la plus récente, jamais un calque", () => {
    const sc = scene(PLAN_LARGE);
    expect(objetCourant(sc, 6)?.genre).toBe("carte");
    expect(objetCourant(sc, 13)?.genre).toBe("fenetre-visage");
    expect(objetCourant(sc, 15.5)?.genre).toBe("fenetre-dessus");
    expect(objetCourant(sc, 17.5)).toBeNull();
    expect(DESCENTE.max).toBe(0.42);
  });
});
