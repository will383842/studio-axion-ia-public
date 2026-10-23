/**
 * FACE CAMÉRA ANIMÉE — sous-titres « nerveux » comme la référence : groupes (1 à 3 mots, ≤ 22 caractères, nombre +
 * unité sur la même plaque, aucun groupe < 0,18 s, ponctuation retirée) et pose du rendu (bornes de hauteur et de
 * largeur jamais dépassées au repos, petits mots ×0,81, mots forts ×1,15, plaque ≤ 0,045 H, aucun soulignement, mot qui
 * entre collé au précédent) et POSITION (cadrage.ts : sous le menton hors objet, sur le front sous une carte, jamais
 * entre les yeux et le menton). AUCUN rendu : fonctions pures et lecture du source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { schemaPlanFacecamAnimee, type CartePlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import {
  hauteurSousTitres,
  mentonAffiche,
  objetCourant,
  positionSousTitres,
  rectAnime,
  scene,
  SOUS_TITRES,
  transformPrise,
  yeuxAffiches,
} from "../../studio-rendu/compositions/interface-claire/cadrage";
import {
  caracteresAffiches,
  CARACTERES_PAR_GROUPE,
  DUREE_MIN_GROUPE_SEC,
  estMotLiaison,
  estPetitMot,
  etiquetteDoubleSousTitre,
  groupeDePetitsMots,
  groupesSousTitres,
  LETTRES_MOT_SEUL,
  MOTS_LIAISON,
} from "@/moteurs/montage-facecam-animee/realisateur/sous-titres";
import { estNombreDit, estUnite, nombreDeLettres, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { verifierPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import {
  apparitions,
  avanceEm,
  placeDuMot,
  echellesBornees,
  estLiaison,
  LIAISONS,
  HAUTEUR_SOUS_TITRES,
  LARGEUR_MAX_SOUS_TITRES,
  poserGroupe,
  STYLE_SOUS_TITRES,
} from "../../studio-rendu/compositions/interface-claire/SousTitres";

const FIXTURE = fileURLToPath(new URL("./fixtures/mots-img7747.json", import.meta.url));
const MOTS_7747: MotTranscrit[] = JSON.parse(readFileSync(FIXTURE, "utf8"));
const SOURCE = readFileSync(fileURLToPath(new URL("../../studio-rendu/compositions/interface-claire/SousTitres.tsx", import.meta.url)), "utf8");

/** Mots synthétiques : un toutes les `pas` secondes (durée 0,8 × pas). */
const suite = (textes: string[], pas = 0.4, depart = 0): MotTranscrit[] => textes.map((w, i) => ({ w, a: depart + i * pas, f: depart + i * pas + pas * 0.8 }));

const duree = (g: { mots: { a: number }[]; fin: number }) => g.fin - g.mots[0].a;
/** 1 à 3 mots ; 4 seulement quand un groupe de petits mots a été absorbé (deux petits mots au moins). */
const nombreDeMotsValide = (g: { mots: { w: string; fort?: boolean }[] }) =>
  g.mots.length >= 1 && (g.mots.length <= 3 || (g.mots.length === 4 && g.mots.filter((m) => estPetitMot(m.w, m.fort)).length >= 2));

describe("sous-titres · groupes", () => {
  const groupes = groupesSousTitres(MOTS_7747);

  it("1 à 3 mots (4 après absorption de petits mots), ≤ 22 caractères, aucun groupe affiché moins de 0,18 s (prise IMG_7747)", () => {
    expect(groupes.length).toBeGreaterThan(80);
    for (const g of groupes) {
      expect(nombreDeMotsValide(g), g.mots.map((m) => m.w).join(" ")).toBe(true);
      expect(caracteresAffiches(g.mots)).toBeLessThanOrEqual(CARACTERES_PAR_GROUPE);
      expect(duree(g)).toBeGreaterThanOrEqual(DUREE_MIN_GROUPE_SEC - 1e-6);
    }
    // Les groupes se suivent sans se chevaucher.
    for (let i = 1; i < groupes.length; i++) expect(groupes[i - 1].fin).toBeLessThanOrEqual(groupes[i].mots[0].a + 1e-6);
  });

  it("ponctuation retirée, nombre + unité sur la même plaque (« 45 minutes »)", () => {
    const mots = groupes.flatMap((g) => g.mots);
    expect(mots.every((m) => !/[.,;:!?…«»"]/.test(m.w))).toBe(true);
    const plaques = mots.filter((m) => m.w === "45 minutes");
    expect(plaques).toHaveLength(2);
    expect(plaques.every((m) => m.fort)).toBe(true);
    expect(mots.some((m) => m.w === "45" || m.w === "minutes")).toBe(false);
  });

  it("un mot de plus de 12 lettres est seul ; un mot fort ferme son groupe", () => {
    for (const w of ["l'administratif", "accompagnement", "l'automatisation"]) {
      const g = groupes.find((x) => x.mots.some((m) => m.w === w));
      expect(g?.mots).toHaveLength(1);
    }
    const g0 = groupes[0];
    expect(g0.mots.map((m) => m.w)).toEqual(["Si", "votre", "entreprise"]);
    expect(g0.mots[2].fort).toBe(true);
    // Ailleurs que dans un groupe fondu (trop bref), le mot fort est le dernier — ou seuls de petits mots le suivent
    // (« un outil de plus », passe 4).
    const fortsAuMilieu = groupes.filter((g) => g.mots.some((m, k) => m.fort && k < g.mots.length - 1 && !g.mots.slice(k + 1).every((x) => estPetitMot(x.w, x.fort))));
    expect(fortsAuMilieu.length).toBeLessThanOrEqual(2);
  });

  it("cas synthétiques : « 2 millions », « 39 minutes. », limite de 22 caractères, mot long seul", () => {
    const a = groupesSousTitres(suite(["Vous", "perdez", "2", "millions", "d'euros."]));
    expect(a.flatMap((g) => g.mots).find((m) => m.w === "2 millions")).toMatchObject({ fort: true });
    const b = groupesSousTitres(suite(["en", "39", "minutes.", "Ensuite"]));
    expect(b[0].mots.map((m) => m.w)).toEqual(["en", "39 minutes"]);
    expect(b[1].mots.map((m) => m.w)).toEqual(["Ensuite"]);
    // « un » n'est pas un nombre : « un outil » reste deux mots.
    expect(groupesSousTitres(suite(["un", "outil"])).flatMap((g) => g.mots).map((m) => m.w)).toEqual(["un", "outil"]);
    // 22 caractères au plus : « transformation » (14 lettres) est seul, « parfaitement » (12) ne l'est pas forcément.
    const c = groupesSousTitres(suite(["la", "transformation", "parfaitement", "organisée"]));
    // (Seul un mot de liaison qui serait sinon seul à l'écran peut le précéder : « la transformation », revue passe 2.)
    expect(c.find((g) => g.mots.some((m) => m.w === "transformation"))?.mots.map((m) => m.w)).toEqual(["la", "transformation"]);
    for (const g of c) expect(caracteresAffiches(g.mots)).toBeLessThanOrEqual(22);
  });

  it("un mot éclair ponctué est fondu avec son voisin (aucun groupe < 0,18 s)", () => {
    const mots: MotTranscrit[] = [
      { w: "Un :", a: 1.0, f: 1.1 },
      { w: "où", a: 1.1, f: 1.3 },
      { w: "part", a: 1.3, f: 1.5 },
      { w: "votre", a: 1.5, f: 1.7 },
      { w: "temps", a: 1.7, f: 2.0 },
    ];
    const g = groupesSousTitres(mots);
    expect(g[0].mots[0].w).toBe("Un");
    expect(g.every((x) => duree(x) >= DUREE_MIN_GROUPE_SEC - 1e-6 && x.mots.length <= 3)).toBe(true);
  });

  it("outils de langue : nombres dits, unités, lettres", () => {
    expect(estNombreDit("45")).toBe(true);
    expect(estNombreDit("deux")).toBe(true);
    expect(estNombreDit("un")).toBe(false);
    expect(estUnite("minutes,")).toBe(true);
    expect(estUnite("outil")).toBe(false);
    for (const u of ["secondes", "seconde", "sec", "%", "euros."]) expect(estUnite(u)).toBe(true);
    expect(nombreDeLettres("l'administratif")).toBe(14);
    expect(LETTRES_MOT_SEUL).toBe(12);
  });
});

describe("sous-titres · rendu", () => {
  it("exporte les bornes HAUTEUR_SOUS_TITRES = 0,0563 (0,045 + 25 %, v3) et LARGEUR_MAX_SOUS_TITRES = 0,8", () => {
    expect(HAUTEUR_SOUS_TITRES).toBe(0.0563);
    expect(LARGEUR_MAX_SOUS_TITRES).toBe(0.8);
  });

  it("aucun groupe de la prise IMG_7747 ne dépasse les bornes (1080 × 1920 et 720 × 1280), le plus long compris", () => {
    const groupes = groupesSousTitres(MOTS_7747);
    const plusLong = [...groupes].sort((x, y) => avanceEm(y.mots.map((m) => m.w.toUpperCase()).join(" ")) - avanceEm(x.mots.map((m) => m.w.toUpperCase()).join(" ")))[0];
    for (const [L, H] of [[1080, 1920], [720, 1280]]) {
      const p = poserGroupe(plusLong.mots, L, H);
      expect(p.largeur).toBeLessThanOrEqual(LARGEUR_MAX_SOUS_TITRES * L + 1e-6);
      expect(p.hauteur).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES * H + 1e-6);
      groupes.forEach((g, i) => {
        const q = poserGroupe(g.mots, L, H, i);
        expect(q.largeur).toBeLessThanOrEqual(LARGEUR_MAX_SOUS_TITRES * L + 1e-6);
        expect(q.hauteur).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES * H + 1e-6);
      });
    }
  });

  it("bornes tenues aussi pendant les entrées (dépassement de la plaque + tressaillement au pire instant)", () => {
    const groupes = groupesSousTitres(MOTS_7747);
    for (const [L, H] of [[1080, 1920], [720, 1280]]) {
      groupes.forEach((g, i) => {
        const pose = poserGroupe(g.mots, L, H, i);
        const p = pose.mots[pose.mots.length - 1];
        const e = echellesBornees(pose, p, L, H, 1 + STYLE_SOUS_TITRES.pulsation.ampleur, 1.15);
        // Largeur visible : ligne agrandie, plus le débord du mot qui entre ; hauteur : le plus haut des deux.
        expect(e.ligne * (pose.largeur + (e.mot - 1) * p.largeur)).toBeLessThanOrEqual(LARGEUR_MAX_SOUS_TITRES * L + 1e-6);
        expect(e.ligne * Math.max(pose.hauteur, e.mot * p.hauteur)).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES * H + 1e-6);
        expect(e.ligne).toBeGreaterThanOrEqual(1);
        expect(e.mot).toBeGreaterThanOrEqual(1);
      });
    }
    // Groupe court : l'effet reste entier (aucun bridage inutile).
    const court = poserGroupe([{ w: "de", a: 0 }, { w: "vos", a: 0.2 }], 1080, 1920);
    expect(echellesBornees(court, court.mots[1], 1080, 1920, 1.04, 1.06)).toEqual({ ligne: 1.04, mot: 1.06 });
  });

  it("petits mots ×0,81 (≥ 70 % du mot fort), plaque au corps du texte (≤ 0,0563 H), base ≈ 0,08 L ; inclinaison de −2° à −4°", () => {
    const L = 1080;
    const H = 1920;
    const p = poserGroupe([{ w: "de", a: 0 }, { w: "vos", a: 0.2 }, { w: "devis", a: 0.4, fort: true }], L, H);
    expect(p.facteur).toBe(1);
    const base = L * STYLE_SOUS_TITRES.baseL;
    // Base 0,08 L : +25 % sur 0,064 L (demande du 16/10, v3).
    expect(base / L).toBeGreaterThanOrEqual(0.078);
    expect(base / L).toBeLessThanOrEqual(0.082);
    expect(p.mots[0].taille / base).toBeCloseTo(0.81, 5);
    // Petits mots ≥ 70 % du mot fort (lisibles : « UN », « ET »).
    expect(p.mots[0].taille / p.mots[2].taille).toBeGreaterThanOrEqual(0.7);
    expect(p.mots[1].taille / base).toBeCloseTo(1, 5);
    expect(p.mots[2].taille / base).toBeCloseTo(STYLE_SOUS_TITRES.fort, 5);
    expect(p.mots[2].hauteur).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES * H);
    for (const rang of [0, 1, 2, 3]) {
      const a = poserGroupe([{ w: "temps", a: 0, fort: true }], L, H, rang).mots[0].angle;
      expect(a).toBeLessThanOrEqual(-2);
      expect(a).toBeGreaterThanOrEqual(-4);
    }
    expect(poserGroupe([{ w: "temps", a: 0, fort: true }], L, H, 0).mots[0].angle).not.toBe(poserGroupe([{ w: "temps", a: 0, fort: true }], L, H, 1).mots[0].angle);
    // Texte visible (capitales + contour) entre 0,028 et 0,0425 H (0,034 H + 25 %, v3).
    const visible = (base * (0.7 + 2 * STYLE_SOUS_TITRES.contourEm)) / H;
    expect(visible).toBeGreaterThanOrEqual(0.028);
    expect(visible).toBeLessThanOrEqual(0.0425);
  });

  it("aucun soulignement : le mot en cours n'est distingué que par sa couleur ; 1re ligne « import React »", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(SOURCE.split(/\r?\n/)[0]).toBe('import React from "react";');
    expect(code).not.toMatch(/textDecoration|underline|borderBottom|souligne|trait\b/i);
    // Entrées (revue passe 3, comme la référence) : mot 40 % → 100 % en 4 images (0,16 s) ; plaque en ≤ 0,18 s.
    expect(STYLE_SOUS_TITRES.entreeMot.depart).toBeLessThanOrEqual(0.45);
    expect(STYLE_SOUS_TITRES.entreeMot.duree).toBeGreaterThanOrEqual(0.14);
    expect(STYLE_SOUS_TITRES.entreeMot.duree).toBeLessThanOrEqual(0.17);
    expect(STYLE_SOUS_TITRES.entreePlaque.duree).toBeLessThanOrEqual(0.18);
  });
});


describe("sous-titres · le mot qui entre reste collé au précédent", () => {
  it("origine de l'agrandissement au bord GAUCHE pour un mot en cours qui n'est pas le premier (« ONT ⎵⎵⎵ RETROUVÉ »)", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toMatch(/courant && k > 0 \? "0% 50%"/);
    expect((code.match(/transformOrigin: origine/g) ?? []).length).toBe(2);
  });
});

/* ------------------------------------------------------------------ Position (cadrage.ts) ------------------------------------------------------------------ */

const plan = (prise: PlanFacecamAnimee["prise"], extra: Partial<PlanFacecamAnimee>, duree = 30): PlanFacecamAnimee => ({
  version: "plan-facecam-animee/1",
  charte: "interface-claire/1",
  duree,
  fps: 25,
  largeur: 1080,
  hauteur: 1920,
  prise,
  groupes: [],
  cartes: [],
  fenetres: [],
  calques: [],
  zooms: [],
  mouvements: [],
  fin: { debut: duree - 2, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
  sons: [],
  ...extra,
});
const carte = (debut: number, fin: number): CartePlan => ({ debut, fin, titre: "Boîte mail", icone: "mail", entree: "chute", contenu: { type: "liste", lignes: [0, 1, 2].map((i) => ({ texte: `Ligne ${i}`, icone: "mail", a: debut + 0.2 * i })) } });
const objets: Partial<PlanFacecamAnimee> = {
  zooms: [
    [1, 2, 1.5],
    [2.2, 3, 1.2],
    [9, 10, 1.35],
  ],
  mouvements: [
    { debut: 3.2, fin: 4, type: "zoom-rapide", echelle: 1.5 },
    { debut: 4.1, fin: 5, type: "decale-gauche", echelle: 1.4 },
    { debut: 15, fin: 16, type: "recul", echelle: 1.4 },
  ],
  cartes: [carte(5.2, 8), carte(8.1, 8.9), carte(17, 19)],
  fenetres: [
    { debut: 11, fin: 13, media: "images/fenetre-1.jpg", recherche: "mains qui tapent au clavier" },
    { debut: 13.2, fin: 14.5, media: "images/fenetre-2.jpg", recherche: "réunion", cadrage: "au-dessus" },
  ],
  calques: [
    { type: "etiquette", debut: 0.3, fin: 0.9, texte: "Votre entreprise avance", fond: "orange" },
    { type: "compteur", debut: 20, fin: 21.5, de: 0, a: 45, suffixe: " min", legende: "En visio", fond: "encre" },
  ],
};
const PLANS_POSITION: [string, PlanFacecamAnimee][] = [
  // Prise large réelle de Will (détecteur YuNet, 14/10) : yeux 0,302, centre 0,41, largeur 0,39.
  ["prise large", plan({ src: "prise-large.mp4", finSec: 30, yeux: 0.302, centreX: 0.41, largeurVisage: 0.39 }, objets)],
  // Prise serrée de la vidéo 1 (visage 0,47 L, yeux 0,333).
  ["prise serrée", plan({ src: "prise.mp4", finSec: 30, yeux: 0.333, centreX: 0.37, largeurVisage: 0.47 }, objets)],
  // Cas extrême : visage bas et large, zooms au maximum (le menton sort presque du cadre).
  ["cas extrême", plan({ src: "prise.mp4", finSec: 30, yeux: 0.45, centreX: 0.6, largeurVisage: 0.5 }, objets)],
];
const instants = (p: PlanFacecamAnimee) => Array.from({ length: Math.floor(p.fin.debut * p.fps) }, (_, i) => i / p.fps);

describe.each(PLANS_POSITION)("sous-titres · position · %s", (_nom, p) => {
  const sc = scene(p);
  const demi = hauteurSousTitres() / 2;
  const visageCache = (t: number) => {
    const o = objetCourant(sc, t);
    return o?.genre === "fenetre-visage" && rectAnime(o, t, p).phase === "pose";
  };

  it("plan valide", () => {
    expect(schemaPlanFacecamAnimee.safeParse(p).success).toBe(true);
  });

  it("à CHAQUE image où le visage se voit, la bande est au-dessus des yeux (− 0,03) ou sous le menton : jamais sur les yeux, la bouche ni le menton", () => {
    let vus = 0;
    for (const t of instants(p)) {
      const y = positionSousTitres(sc, t);
      expect(y - demi, `t = ${t.toFixed(2)}`).toBeGreaterThanOrEqual(-1e-9);
      expect(y + demi, `t = ${t.toFixed(2)}`).toBeLessThanOrEqual(1 + 1e-9);
      if (visageCache(t)) continue;
      vus++;
      const yeux = yeuxAffiches(sc, t);
      const menton = mentonAffiche(sc, t);
      const dessus = y + demi <= yeux - SOUS_TITRES.gardeYeux + 1e-9;
      const dessous = y - demi >= menton - 1e-9;
      expect(dessus || dessous, `t = ${t.toFixed(2)} : bande ${(y - demi).toFixed(3)}-${(y + demi).toFixed(3)}, yeux ${yeux.toFixed(3)}, menton ${menton.toFixed(3)}`).toBe(true);
    }
    expect(vus).toBeGreaterThan(200);
  });

  it("hors objet : SOUS LE MENTON (haut de la bande = menton + 0,03 quand il tient), jamais plus haut que 0,64", () => {
    let n = 0;
    for (const t of instants(p)) {
      if (objetCourant(sc, t)) continue;
      const y = positionSousTitres(sc, t);
      const menton = mentonAffiche(sc, t);
      const vise = Math.max(SOUS_TITRES.hors, menton + SOUS_TITRES.margeMenton + demi);
      if (vise <= SOUS_TITRES.max) {
        n++;
        expect(y, `t = ${t.toFixed(2)}`).toBeCloseTo(vise, 9);
        expect(y - demi).toBeGreaterThanOrEqual(menton + SOUS_TITRES.margeMenton - 1e-9);
      }
      if (y > yeuxAffiches(sc, t)) expect(y).toBeGreaterThanOrEqual(SOUS_TITRES.hors - 1e-9);
    }
    expect(n).toBeGreaterThan(50);
  });

  it("sous une carte posée : sur le FRONT, comme la référence (centre 0,06 à 0,12 H au-dessus des yeux, sous la carte)", () => {
    let n = 0;
    for (const t of instants(p)) {
      const o = objetCourant(sc, t);
      if (!o || o.genre !== "carte" || rectAnime(o, t, p).phase !== "pose" || t < o.debut + 0.3) continue;
      n++;
      const y = positionSousTitres(sc, t);
      const ecart = yeuxAffiches(sc, t) - y;
      expect(y - demi, `t = ${t.toFixed(2)}`).toBeGreaterThanOrEqual(o.rect.y1);
      expect(ecart, `t = ${t.toFixed(2)}`).toBeGreaterThanOrEqual(0.06);
      expect(ecart, `t = ${t.toFixed(2)}`).toBeLessThanOrEqual(0.12);
    }
    expect(n).toBeGreaterThan(40);
  });
});

describe("sous-titres · position · suit le visage", () => {
  it("AUCUN zoom (décision de Will du 15/10) : les zooms du plan n'ont aucun effet ; seule la taille du visage fait descendre les sous-titres", () => {
    const large = scene(PLANS_POSITION[0][1]);
    const serre = scene(PLANS_POSITION[1][1]);
    // Même prise sans aucun zoom ni mouvement dans le plan : positions IDENTIQUES à chaque image (le rendu les ignore).
    const sansZoom = scene(plan(PLANS_POSITION[1][1].prise, { ...objets, zooms: [], mouvements: [] }));
    for (const t of instants(PLANS_POSITION[1][1])) {
      expect(transformPrise(serre, t).echelle, `t = ${t.toFixed(2)}`).toBe(1);
      expect(transformPrise(serre, t).tx, `t = ${t.toFixed(2)}`).toBe(0);
      expect(positionSousTitres(serre, t), `t = ${t.toFixed(2)}`).toBeCloseTo(positionSousTitres(sansZoom, t), 12);
    }
    // t = 1,8 s (zoom ×1,5 dans le plan, ignoré), sans objet : un visage bas et large (0,50 L) met les sous-titres plus
    // bas que la prise large (0,39 L, plancher 0,64), toujours sous le menton.
    const bas = scene(PLANS_POSITION[2][1]);
    expect(objetCourant(bas, 1.8)).toBeNull();
    expect(positionSousTitres(large, 1.8)).toBeCloseTo(SOUS_TITRES.hors, 9);
    const yb = positionSousTitres(bas, 1.8);
    expect(yb).toBeGreaterThan(0.7);
    expect(yb - hauteurSousTitres() / 2).toBeGreaterThanOrEqual(mentonAffiche(bas, 1.8) + SOUS_TITRES.margeMenton - 1e-9);
  });

  it("coefficient du menton ≥ ce que mesure le détecteur YuNet (bas du visage − yeux = 0,87-0,89 largeur de visage en médiane)", () => {
    expect(SOUS_TITRES.menton).toBeGreaterThanOrEqual(0.89);
    expect(SOUS_TITRES.menton).toBeLessThanOrEqual(1.05);
  });
});

/* ------------------------------------------------------------------ Revue passe 2 ------------------------------------------------------------------ */

describe("sous-titres · mots de liaison (revue passe 2 : « EN », « ET », « LA », « QUI » seuls)", () => {
  const groupes = groupesSousTitres(MOTS_7747);
  const textes = groupes.map((g) => g.mots.map((m) => m.w).join(" "));

  it("même liste côté réalisateur et côté rendu ; accents gardés, élision jugée après l'apostrophe", () => {
    expect([...LIAISONS]).toEqual([...MOTS_LIAISON]);
    for (const w of ["en", "Et", "la", "QUI", "qu'à", "d'un", "votre"]) {
      expect(estMotLiaison(w), w).toBe(true);
      expect(estLiaison(w), w).toBe(true);
    }
    for (const w of ["là", "où", "temps", "l'IA", "45", "deux", "c'est"]) {
      expect(estMotLiaison(w), w).toBe(false);
      expect(estLiaison(w), w).toBe(false);
    }
  });

  it("AUCUN groupe fait d'un seul mot de liaison (prise IMG_7747 et cas synthétiques)", () => {
    expect(groupes.filter((g) => g.mots.length === 1 && estMotLiaison(g.mots[0].w)).map((g) => g.mots[0].w)).toEqual([]);
    for (const textesSynth of [
      ["Un", "problème", "de", "travail"],
      ["Et", "vous", "comprendrez"],
      ["la", "fuite."],
      ["Pour", "vous."],
      ["à", "l'automatisation"],
      ["Vous", "avez", "une", "fuite."],
    ]) {
      const gs = groupesSousTitres(suite(textesSynth));
      expect(gs.filter((g) => g.mots.length === 1 && estMotLiaison(g.mots[0].w)), textesSynth.join(" ")).toEqual([]);
    }
  });

  it("le mot de liaison passe au groupe suivant : « un problème » + « de travail », « qu'à partir », « votre temps »…", () => {
    for (const attendu of ["un problème", "de travail", "qu'à partir", "votre temps", "Vous avez une fuite", "un outil de plus", "leur après-midi", "du temps"]) {
      expect(textes, attendu).toContain(attendu);
    }
    // Il en reste peu en fin de groupe (ponctuation, mot long qui suit, groupe suivant plein) : 6 au plus sur la prise (14 avant).
    const finLiaison = groupes.filter((g) => g.mots.length > 1 && estMotLiaison(g.mots[g.mots.length - 1].w));
    expect(finLiaison.length).toBeLessThanOrEqual(6);
    // Les règles de base tiennent toujours.
    for (const g of groupes) {
      expect(nombreDeMotsValide(g)).toBe(true);
      expect(caracteresAffiches(g.mots)).toBeLessThanOrEqual(CARACTERES_PAR_GROUPE);
      expect(g.fin - g.mots[0].a).toBeGreaterThanOrEqual(DUREE_MIN_GROUPE_SEC - 1e-6);
    }
    for (let i = 1; i < groupes.length; i++) expect(groupes[i - 1].fin).toBeLessThanOrEqual(groupes[i].mots[0].a + 1e-6);
  });

  it("à l'écran, un mot de liaison surgit AVEC le mot qui le suit (« EN ONE-TO-ONE », « DE LA FUITE ») — jamais seul", () => {
    expect(apparitions([{ w: "en", a: 22.88 }, { w: "one-to-one", a: 23.1, fort: true }])).toEqual([22.88, 22.88]);
    expect(apparitions([{ w: "de", a: 1 }, { w: "la", a: 1.1 }, { w: "fuite", a: 1.25, fort: true }])).toEqual([1, 1, 1]);
    expect(apparitions([{ w: "vous", a: 1 }, { w: "avez", a: 1.2 }, { w: "une", a: 1.4 }])).toEqual([1, 1.2, 1.4]);
    // Blanc de plus de 0,6 s : le mot suivant n'est pas avancé.
    expect(apparitions([{ w: "et", a: 1 }, { w: "lui", a: 1.8 }])).toEqual([1, 1.8]);
    // Sur toute la prise : à aucun instant le seul mot visible d'un groupe de plusieurs mots n'est un mot de liaison.
    let seuls = 0;
    for (const g of groupes) {
      const q = apparitions(g.mots);
      const premiers = g.mots.filter((_, k) => q[k] === q[0]);
      if (premiers.length === 1 && g.mots.length > 1 && estLiaison(premiers[0].w)) seuls++;
    }
    expect(seuls).toBe(0);
  });
});

describe("sous-titres · taille et pop (revue passe 2)", () => {
  it("hauteur colorée (plaque orange inclinaison comprise, mot orange) : médiane ≤ 0,0425 H (0,034 H avant l'agrandissement de 25 %, v3), aucune au-delà de la borne", () => {
    const L = 1080;
    const H = 1920;
    const S = STYLE_SOUS_TITRES;
    const hauteurs: number[] = [];
    groupesSousTitres(MOTS_7747).forEach((g, i) => {
      const pose = poserGroupe(g.mots, L, H, i);
      for (const m of pose.mots) {
        if (m.fort) {
          const orange = m.taille * (S.plaqueLigneEm + 2 * S.plaquePadYEm);
          const largeurOrange = m.largeur - 2 * m.taille * S.plaqueBordEm;
          const rad = (Math.abs(m.angle) * Math.PI) / 180;
          hauteurs.push((orange * Math.cos(rad) + largeurOrange * Math.sin(rad)) / H);
        } else hauteurs.push((m.taille * 0.7) / H);
      }
    });
    const tri = [...hauteurs].sort((a, b) => a - b);
    expect(tri[Math.floor(tri.length / 2)]).toBeLessThanOrEqual(0.0425);
    expect(tri[Math.floor(tri.length / 2)]).toBeGreaterThanOrEqual(0.022);
    expect(tri[tri.length - 1]).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES);
  });

  it("pop d'entrée de chaque groupe : la ligne part de 50 % en 4 images (revue passe 3 ; une échelle < 1 n'est pas bridée), et les bornes tiennent au pic", () => {
    expect(STYLE_SOUS_TITRES.entreeGroupe.depart).toBeLessThanOrEqual(0.5);
    expect(STYLE_SOUS_TITRES.entreeGroupe.duree).toBeLessThanOrEqual(0.17);
    const court = poserGroupe([{ w: "de", a: 0 }, { w: "vos", a: 0.2 }], 1080, 1920);
    expect(echellesBornees(court, court.mots[1], 1080, 1920, 0.7, 1).ligne).toBe(0.7);
    groupesSousTitres(MOTS_7747).forEach((g, i) => {
      const pose = poserGroupe(g.mots, 1080, 1920, i);
      const e = echellesBornees(pose, undefined, 1080, 1920, 1.12 * (1 + STYLE_SOUS_TITRES.pulsation.ampleur), 1);
      expect(e.ligne * pose.largeur).toBeLessThanOrEqual(LARGEUR_MAX_SOUS_TITRES * 1080 + 1e-6);
      expect(e.ligne * pose.hauteur).toBeLessThanOrEqual(HAUTEUR_SOUS_TITRES * 1920 + 1e-6);
    });
  });
});

/* ------------------------------------------------------------------ Revue passe 3 (passe 4 du spécialiste) ------------------------------------------------------------------ */

describe("sous-titres · jamais un groupe de 1 ou 2 petits mots (revue passe 3 : « ET CE », « ALORS » seuls)", () => {
  const groupes = groupesSousTitres(MOTS_7747);
  const textes = groupes.map((g) => g.mots.map((m) => m.w).join(" "));

  it("petit mot = liaison ou mot-outil, jamais un nombre ni un mot fort", () => {
    for (const w of ["Alors,", "et", "ce", "plus", "pas", "est", "je", "lui"]) expect(estPetitMot(w), w).toBe(true);
    for (const w of ["fuite", "45", "deux", "partout", "vois", "colmater"]) expect(estPetitMot(w), w).toBe(false);
    expect(estPetitMot("temps", true)).toBe(false);
    expect(groupeDePetitsMots([{ w: "Et" }, { w: "ce" }])).toBe(true);
    expect(groupeDePetitsMots([{ w: "Alors" }])).toBe(true);
    expect(groupeDePetitsMots([{ w: "Et" }, { w: "ce" }, { w: "qui" }])).toBe(false);
    expect(groupeDePetitsMots([{ w: "Vous" }, { w: "fuite", fort: true }])).toBe(false);
  });

  it("prise IMG_7747 : AUCUN groupe de 1 ou 2 petits mots ; « Alors on vous propose », « un outil de plus », « et lui son week-end »", () => {
    expect(groupes.filter((g) => groupeDePetitsMots(g.mots)).map((g) => g.mots.map((m) => m.w).join(" "))).toEqual([]);
    for (const attendu of ["Alors on vous propose", "un outil de plus", "une embauche de plus", "et lui son week-end", "Vous avez une fuite"]) expect(textes, attendu).toContain(attendu);
    // Jamais par-dessus une fin de phrase : « son week-end. » et « Alors » restent séparés.
    expect(textes.some((t) => /week-end Alors/.test(t))).toBe(false);
  });

  it("cas synthétiques : vers l'avant (« Alors, » / « Et ce »), vers l'arrière (« de plus, »), jamais à travers un point", () => {
    const t = (mots: MotTranscrit[]) => groupesSousTitres(mots).map((g) => g.mots.map((m) => m.w).join(" "));
    // « Alors, » ouvre la proposition qui suit.
    expect(t(suite(["C'est", "fini.", "Alors,", "on", "vous", "propose"]))).toContain("Alors on vous propose");
    // « de plus, » ferme la proposition précédente.
    expect(t(suite(["un", "outil", "de", "plus,", "une", "embauche"]))).toContain("un outil de plus");
    // Un point bloque la fusion vers l'avant : « plus. » ne rejoint pas « Vous ».
    const fin = t(suite(["Elles", "durent", "plus.", "Vous", "avez", "une", "fuite."]));
    expect(fin.some((x) => /plus Vous/.test(x))).toBe(false);
    for (const textesSynth of [
      ["Et", "ce", "qui", "suit", "est", "pour", "vous."],
      ["Alors", "on", "vous", "propose", "de", "commencer."],
      ["Ce", "n'est", "pas", "la", "charge", "normale."],
    ]) {
      const gs = groupesSousTitres(suite(textesSynth));
      expect(gs.filter((g) => groupeDePetitsMots(g.mots)), textesSynth.join(" ")).toEqual([]);
      for (const g of gs) {
        expect(nombreDeMotsValide(g)).toBe(true);
        expect(caracteresAffiches(g.mots)).toBeLessThanOrEqual(CARACTERES_PAR_GROUPE);
        expect(duree(g)).toBeGreaterThanOrEqual(DUREE_MIN_GROUPE_SEC - 1e-6);
      }
    }
  });

  it("un groupe absorbé ne finit jamais sur un mot de liaison emprunté (« ce n'est pas la » | « charge » interdit)", () => {
    expect(textes).not.toContain("ce n'est pas la");
    expect(textes).not.toContain("tout ce qui leur");
  });
});

describe("étiquette ≠ sous-titre (revue passe 3 : « UNE FUITE », « SON WEEK-END », « LEUR APRÈS-MIDI » doublaient le sous-titre)", () => {
  const groupes = groupesSousTitres(MOTS_7747);
  // Instants de la prise IMG_7747 (vidéo 4).
  const instant = (w: string) => MOTS_7747.find((m) => m.w.replace(/[.,]/g, "") === w)!.a;

  it("les trois doublons de la vidéo 4 sont détectés, petits mots compris (« Une fuite », « Son week-end », « Leur après-midi »)", () => {
    expect(etiquetteDoubleSousTitre("Une fuite", 5.42, 6.8, groupes)).toBe("une fuite");
    const we = instant("week-end");
    expect(etiquetteDoubleSousTitre("Son week-end", we - 0.3, we + 0.8, groupes)).not.toBeNull();
    const am = instant("après-midi");
    expect(etiquetteDoubleSousTitre("Leur après-midi", am - 0.3, am + 0.8, groupes)).not.toBeNull();
    // Racine sur 5 lettres : « Former les équipes » double « on forme les équipes ».
    expect(etiquetteDoubleSousTitre("Former les équipes", 20.1, 21.6, groupes)).not.toBeNull();
    expect(etiquetteDoubleSousTitre("Charge normale", 13.6, 15.6, groupes)).not.toBeNull();
  });

  it("une étiquette qui COMPLÈTE passe : mot-clé seul, autre ordre, autres mots, ou hors de l'instant", () => {
    // Un mot seul = le nom de la chose (mot-clé), permis.
    expect(etiquetteDoubleSousTitre("Fuite", 5.42, 6.8, groupes)).toBeNull();
    // Catégorie / numéro / résultat : ne double pas.
    expect(etiquetteDoubleSousTitre("Outil 1/3", 33.4, 34.6, groupes)).toBeNull();
    expect(etiquetteDoubleSousTitre("Temps perdu", 15.8, 17.2, groupes)).toBeNull();
    // Mêmes mots, mais pas affichés pendant l'étiquette.
    expect(etiquetteDoubleSousTitre("Une fuite", 10, 11, groupes)).toBeNull();
    // Ordre différent : « Devis le soir » sur « le soir … les devis ».
    const g = groupesSousTitres(suite(["Le", "soir,", "vous", "tapez", "les", "devis."]));
    expect(etiquetteDoubleSousTitre("Devis le soir", 0, 2.4, g)).toBeNull();
    expect(etiquetteDoubleSousTitre("Les devis", 0, 2.4, g)).toBe("les devis");
  });

  it("verifierPlan refuse l'étiquette (calque ou fenêtre) qui double le sous-titre, avec un message qui dit quoi faire ; barrée, chiffre, glisse, tuile : permis", () => {
    const mots = suite(["Vous", "avez", "une", "fuite.", "Pas", "de", "logiciel", "en", "plus.", "En", "45", "minutes."], 0.4);
    const base = {
      version: "plan-facecam-animee/1",
      charte: "interface-claire/1",
      duree: 8,
      fps: 25,
      largeur: 1080,
      hauteur: 1920,
      prise: { src: "prise.mp4", finSec: 8 },
      groupes: groupesSousTitres(mots),
      cartes: [],
      fenetres: [],
      zooms: [],
      fin: { debut: 7, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
      sons: [],
    };
    const doublons = (calques: unknown[]) => verifierPlan({ ...base, calques }, mots).erreurs.filter((e) => e.includes("répète mot pour mot"));
    const e = doublons([{ type: "etiquette", debut: 0.8, fin: 1.9, texte: "Une fuite" }]);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("Calque 1 (étiquette) : l'étiquette « Une fuite » répète mot pour mot le sous-titre affiché au même moment (« une fuite »)");
    expect(e[0]).toContain("COMPLÉTER");
    // Barrée (la négation est le complément), chiffre dit, rôle qui glisse, tuile : jamais refusés pour doublon.
    expect(doublons([{ type: "etiquette", debut: 1.6, fin: 3.4, texte: "Logiciel en plus", barreA: 2.4 }])).toEqual([]);
    expect(doublons([{ type: "etiquette", debut: 3.6, fin: 4.8, texte: "45 minutes" }])).toEqual([]);
    expect(doublons([{ type: "glisse", debut: 0.8, fin: 1.9, texte: "Une fuite", icone: "loupe" }])).toEqual([]);
    expect(doublons([{ type: "etiquette", debut: 0.8, fin: 1.9, texte: "Fuite repérée" }])).toEqual([]);
    // Étiquette posée sur une fenêtre : contrôlée de son instant « a » à la fin de la fenêtre.
    const f = verifierPlan(
      { ...base, calques: [], fenetres: [{ debut: 0.4, fin: 2.2, media: "fenetre-1", recherche: "plombier qui répare une fuite sous un évier", illustre: "une fuite", video: true, etiquette: { texte: "Une fuite", a: 0.8 } }] },
      mots,
    ).erreurs.filter((x) => x.includes("répète mot pour mot"));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/^Fenêtre 1 :/);
  });
});

describe("sous-titres · la place du mot qui entre grandit avec lui (revue passe 3 : la ligne se recentre image après image)", () => {
  it("place = taille du mot, bornée à [0 ; 1] (le dépassement ne pousse pas les voisins) ; marge droite négative dans le rendu", () => {
    expect(placeDuMot(0.4)).toBe(0.4);
    expect(placeDuMot(1.12)).toBe(1);
    expect(placeDuMot(-0.1)).toBe(0);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect((code.match(/marginRight: recul\(e\)/g) ?? []).length).toBe(2);
    // Seul le mot EN COURS qui n'est pas le premier se retire (le premier entre avec le pop du groupe, centré).
    expect(code).toMatch(/courant && k > 0 \? -\(1 - placeDuMot\(e\)\) \* p\.largeur : 0/);
  });
});
