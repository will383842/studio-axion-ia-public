/**
 * T-EXT-44 · motion du film de navigation (caméra, curseur, projecteur, volet) : calcul pur, sans IA, 0 €, aucun rendu.
 * Les données sont fictives (« Espace démo · Stocks », « exemple »).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ECHELLE_MAX, ECHELLE_MIN } from "../../../src/briques/motion/camera-couverture/courbes-camera";
import { DOSAGES } from "../../../src/briques/dosage-motion/types";
import { BORNES_CAMERA, MARGE_CADRE } from "../../../src/briques/schema-motion/camera";
import {
  AVANCE_CAMERA_MS,
  ARRIVEE_CURSEUR_MS,
  ENTREE_PROJECTEUR_MS,
  PAS_MESURE_MS,
  SANS_ZOOM_DEBUT_MS,
  clicA,
  curseurA,
  distanceVue,
  hautBandeSousTitresPct,
  mondeVersEcranPose,
  planMotionFilm,
  poseA,
  projecteurA,
  voletA,
  type CranFilm,
  type NavMotion,
  type PlanMotionFilm,
} from "../../../src/briques/plan-scenes/tutoriel/motion-film";

const F45 = { largeur: 1080, hauteur: 1350 };

/** Parcours de référence : pilote 05 « Espace démo · Stocks », 5 étapes, 4:5, un mot tous les 1,8 s (cibles fictives). */
function parcours(plus: Partial<NavMotion> = {}): NavMotion {
  return {
    largeur: 1080,
    hauteur: 1350,
    cibles: [
      { etapeId: "alertes-stock", zonePct: { x: 8, y: 14, largeur: 40, hauteur: 12 }, instantMs: 3000, finMs: 4800 },
      { etapeId: "tableau-stock", zonePct: { x: 6, y: 34, largeur: 88, hauteur: 30 }, instantMs: 4800, finMs: 6600 },
      { etapeId: "seuil", zonePct: { x: 30, y: 36, largeur: 64, hauteur: 10 }, instantMs: 6600, finMs: 8400 },
      { etapeId: "commande", zonePct: { x: 10, y: 62, largeur: 62, hauteur: 12 }, instantMs: 8400, finMs: 10200 },
      { etapeId: "historique", zonePct: { x: 50, y: 60, largeur: 44, hauteur: 12 }, instantMs: 10200, finMs: 12000 },
    ],
    ...plus,
  };
}

/** Deux zones éloignées (plus de 0,6 écran) dont les mots sont à 5 s. */
const eloignees = (plus: Partial<NavMotion> = {}): NavMotion => ({
  largeur: 1080,
  hauteur: 1350,
  cibles: [
    { etapeId: "a", zonePct: { x: 5, y: 8, largeur: 25, hauteur: 8 }, instantMs: 4000, finMs: 6000 },
    { etapeId: "b", zonePct: { x: 70, y: 55, largeur: 25, hauteur: 8 }, instantMs: 9000, finMs: 11000 },
  ],
  ...plus,
});
/** Deux zones proches (moins de 0,6 écran) dont les mots sont à 5 s. */
const proches = (): NavMotion => ({
  largeur: 1080,
  hauteur: 1350,
  cibles: [
    { etapeId: "a", zonePct: { x: 10, y: 20, largeur: 25, hauteur: 8 }, instantMs: 4000, finMs: 6000 },
    { etapeId: "b", zonePct: { x: 30, y: 30, largeur: 25, hauteur: 8 }, instantMs: 9000, finMs: 11000 },
  ],
});

const plan = (nav: NavMotion, f = F45): PlanMotionFilm => planMotionFilm(nav, f);
const finDe = (p: PlanMotionFilm) => Math.max(p.camera[p.camera.length - 1]!.tMs, p.curseur[p.curseur.length - 1]?.tMs ?? 0);

describe("caméra : arrivée en avance, zone entière, bornes", () => {
  it("arrive sur chaque zone entre 200 et 300 ms avant son mot", () => {
    const nav = parcours();
    const p = plan(nav);
    for (const c of nav.cibles) {
      const avant = c.instantMs - AVANCE_CAMERA_MS;
      // À 300 ms avant le mot elle n'est pas encore sur la pose ; à 200 ms avant elle y est (et n'en bouge plus jusqu'au mot).
      const pose200 = poseA(p, c.instantMs - 200);
      const pose0 = poseA(p, c.instantMs);
      expect(pose200.zoom, c.etapeId).toBeCloseTo(pose0.zoom, 3);
      expect(pose200.cx, c.etapeId).toBeCloseTo(pose0.cx, 1);
      expect(pose200.cy, c.etapeId).toBeCloseTo(pose0.cy, 1);
      const cle = p.camera.find((k) => Math.abs(k.tMs - avant) <= 50 && Math.abs(k.zoom - pose0.zoom) < 1e-6);
      expect(cle, `${c.etapeId} : une image clé d'arrivée à ${avant} ms`).toBeDefined();
    }
    expect(p.alertes).toEqual([]);
  });

  it("garde la zone ENTIÈRE avec la marge du schéma, au-dessus de la bande des sous-titres (72 % par défaut)", () => {
    const nav = parcours();
    const p = plan(nav);
    const m = MARGE_CADRE * F45.largeur;
    for (const c of nav.cibles) {
      const z = c.zonePct!;
      const pose = poseA(p, c.instantMs);
      const hg = mondeVersEcranPose(pose, F45, { x: (z.x / 100) * 1080, y: (z.y / 100) * 1350 });
      const bd = mondeVersEcranPose(pose, F45, { x: ((z.x + z.largeur) / 100) * 1080, y: ((z.y + z.hauteur) / 100) * 1350 });
      expect(hg.x, c.etapeId).toBeGreaterThanOrEqual(m - 1);
      expect(bd.x, c.etapeId).toBeLessThanOrEqual(F45.largeur - m + 1);
      expect(hg.y, c.etapeId).toBeGreaterThanOrEqual(0);
      expect(bd.y, c.etapeId).toBeLessThanOrEqual(0.72 * F45.hauteur - m + 1);
    }
  });

  it("une bande de sous-titres plus haute remonte la limite ; une zone qui ne peut pas être remontée est signalée", () => {
    const nav = parcours({ hautSousTitresPct: 60 });
    const p = plan(nav);
    let au = 0;
    for (const c of nav.cibles) {
      const z = c.zonePct!;
      const bd = mondeVersEcranPose(poseA(p, c.instantMs), F45, { x: ((z.x + z.largeur) / 100) * 1080, y: ((z.y + z.hauteur) / 100) * 1350 });
      if (bd.y <= 0.6 * F45.hauteur + 1) au++;
      else expect(p.alertes.join(" "), c.etapeId).toContain(`« ${c.etapeId} » passe sous les sous-titres`);
    }
    expect(au).toBeGreaterThanOrEqual(3);
  });
  it("le zoom reste dans [1 ; 1,6] sur toute la durée, aux trois formats", () => {
    for (const f of [F45, { largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1080 }]) {
      const p = plan(parcours(), f);
      for (let t = 0; t <= finDe(p) + 500; t += 20) {
        const z = poseA(p, t).zoom;
        expect(z).toBeGreaterThanOrEqual(ECHELLE_MIN - 1e-9);
        expect(z).toBeLessThanOrEqual(ECHELLE_MAX + 1e-9);
      }
    }
    expect(ECHELLE_MAX).toBe(BORNES_CAMERA.zoomMax);
  });

  it("aucun zoom avant 400 ms, même si le premier mot est très tôt", () => {
    const nav: NavMotion = { largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "t", zonePct: { x: 10, y: 10, largeur: 20, hauteur: 8 }, instantMs: 600, finMs: 2600 }] };
    const p = plan(nav);
    for (let t = 0; t <= SANS_ZOOM_DEBUT_MS; t += 20) expect(poseA(p, t).zoom, String(t)).toBe(1);
    expect(p.alertes.join(" ")).toContain("trop tard");
  });

  it("à chaque pose tenue (au mot de chaque cible), la vue ne sort pas de la page quand elle y tient (4:5, 9:16, 1:1)", () => {
    for (const f of [F45, { largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1080 }]) {
      const nav = parcours();
      const p = plan(nav, f);
      const e = Math.min(f.largeur / 1080, f.hauteur / 1350);
      const page = { x: (f.largeur - 1080 * e) / 2, y: (f.hauteur - 1350 * e) / 2, largeur: 1080 * e, hauteur: 1350 * e };
      for (const c of nav.cibles) {
        const pose = poseA(p, c.instantMs);
        const vx = f.largeur / pose.zoom;
        const vy = f.hauteur / pose.zoom;
        if (vx < page.largeur - 1e-6) {
          expect(pose.cx - vx / 2, `${f.hauteur} ${c.etapeId}`).toBeGreaterThanOrEqual(page.x - 1e-6);
          expect(pose.cx + vx / 2, `${f.hauteur} ${c.etapeId}`).toBeLessThanOrEqual(page.x + page.largeur + 1e-6);
        }
        if (vy < page.hauteur - 1e-6) {
          expect(pose.cy - vy / 2, `${f.hauteur} ${c.etapeId}`).toBeGreaterThanOrEqual(page.y - 1e-6);
          expect(pose.cy + vy / 2, `${f.hauteur} ${c.etapeId}`).toBeLessThanOrEqual(page.y + page.hauteur + 1e-6);
        }
      }
    }
  });
});

describe("caméra : respiration, vitesse, profils", () => {
  it("respire (retour à 1) entre deux zones éloignées dont les mots sont à plus de 1,2 s", () => {
    const p = plan(eloignees());
    expect(Math.min(...Array.from({ length: 200 }, (_, k) => poseA(p, 6500 + k * 10).zoom))).toBeLessThan(1.01);
  });
  it("ne respire pas entre deux zones proches, ni entre deux zones éloignées dont les mots sont à moins de 1,2 s", () => {
    const pp = plan(proches());
    for (let t = 4300; t <= 9000; t += 20) expect(poseA(pp, t).zoom).toBeGreaterThan(1.3);
    const serre = plan(eloignees({ cibles: [eloignees().cibles[0]!, { ...eloignees().cibles[1]!, instantMs: 5000, finMs: 7000 }] }));
    for (let t = 4300; t <= 4800; t += 20) expect(poseA(serre, t).zoom).toBeGreaterThan(1.3);
  });
  it("la vitesse ne dépasse jamais 1,2 écran/s ; le retard va dans les alertes, jamais dans la vitesse", () => {
    const serre = plan(eloignees({ cibles: [eloignees().cibles[0]!, { ...eloignees().cibles[1]!, instantMs: 4600, finMs: 6600 }] }));
    expect(serre.alertes.length).toBeGreaterThan(0);
    expect(serre.alertes.join(" ")).toContain("trop tard");
    for (const p of [serre, plan(parcours()), plan(eloignees())]) {
      for (let t = PAS_MESURE_MS; t <= finDe(p) + 500; t += PAS_MESURE_MS) {
        const v = distanceVue(poseA(p, t - PAS_MESURE_MS), poseA(p, t), F45) / (PAS_MESURE_MS / 1000);
        expect(v, String(t)).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-6);
      }
    }
  });
  it("part plus tôt, jamais plus vite : un mouvement plus long commence plus tôt", () => {
    const court = plan({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "p", zonePct: { x: 30, y: 30, largeur: 40, hauteur: 12 }, instantMs: 6000, finMs: 7000 }] });
    const long = plan({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "p", zonePct: { x: 2, y: 4, largeur: 14, hauteur: 6 }, instantMs: 6000, finMs: 7000 }] });
    const depart = (p: PlanMotionFilm) => p.camera.find((k, i, a) => i > 0 && a[i - 1]!.tMs < k.tMs && (k.zoom !== a[0]!.zoom || k.cx !== a[0]!.cx || k.cy !== a[0]!.cy))!;
    expect(depart(long).tMs).toBeLessThanOrEqual(depart(court).tMs);
    expect(long.camera.find((k) => k.zoom > 1.5)!.tMs).toBe(6000 - AVANCE_CAMERA_MS);
  });
  it("trois profils : accostage pour un rapprochement, travelling à zoom égal, poussée lente pour une tenue de plus de 2,5 s", () => {
    const p = plan(parcours());
    expect(p.camera.find((k) => k.zoom > 1.5)!.profil).toBe("accostage");
    expect(p.camera.some((k) => k.profil === "travelling")).toBe(true);
    const tenue = plan({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "t", zonePct: { x: 20, y: 20, largeur: 30, hauteur: 10 }, instantMs: 4000, finMs: 8000 }] });
    expect(tenue.camera.some((k) => k.profil === "poussee-lente")).toBe(true);
    // La poussée reste lente (3 % au plus) et ne perd jamais la zone entière.
    const avant = poseA(tenue, 4500).zoom;
    const apres = poseA(tenue, 7700).zoom;
    expect(apres).toBeGreaterThan(avant);
    expect(apres / avant).toBeLessThanOrEqual(1.031);
  });
  it("deux cibles consécutives sur la même zone : une seule tenue, la caméra ne bouge pas", () => {
    const z = { x: 20, y: 20, largeur: 30, hauteur: 10 };
    const p = plan({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "a", zonePct: z, instantMs: 4000, finMs: 5000 }, { etapeId: "b", zonePct: z, instantMs: 5000, finMs: 6000 }] });
    const a = poseA(p, 4500);
    const b = poseA(p, 5500);
    expect(b.zoom).toBeCloseTo(a.zoom, 6);
    expect(p.projecteurs).toHaveLength(1);
  });
});

describe("curseur : arc, arrivée avant le clic, clic sur le mot, repos", () => {
  const nav = parcours();
  const p = plan(nav);
  const monde = (pct: { x: number; y: number }) => ({ x: (pct.x / 100) * 1080, y: (pct.y / 100) * 1350 });
  const echantillon = (t: number) => p.curseur.find((c) => c.tMs === t)!;

  it("un clic par cible, à 40 ms du début du mot au plus", () => {
    expect(p.clics).toHaveLength(nav.cibles.length);
    nav.cibles.forEach((c, i) => expect(Math.abs(p.clics[i]!.tMs - c.instantMs)).toBeLessThanOrEqual(40));
  });

  it("trace un arc : le point du milieu n'est pas sur le segment droit, côté alterné d'une étape à l'autre", () => {
    const cotes: number[] = [];
    for (let j = 1; j <= 2; j++) {
      const de = monde(p.clics[j - 1]!);
      const vers = monde(p.clics[j]!);
      const t0 = p.clics[j - 1]!.tMs + 160;
      const t1 = p.clics[j]!.tMs - ARRIVEE_CURSEUR_MS;
      // Les échantillons du mouvement lui-même (ni au repos au départ, ni à l'arrivée).
      const mid = p.curseur.filter((c) => c.tMs >= t0 && c.tMs <= t1 && Math.hypot(c.x - p.clics[j - 1]!.x, c.y - p.clics[j - 1]!.y) > 1e-6 && Math.hypot(c.x - p.clics[j]!.x, c.y - p.clics[j]!.y) > 1e-6);
      expect(mid.length, `étape ${j}`).toBeGreaterThan(5);
      const milieu = monde(mid[Math.floor(mid.length / 2)]!);
      const long = Math.hypot(vers.x - de.x, vers.y - de.y);
      // Distance signée du point du milieu à la droite de→vers.
      const signe = ((vers.x - de.x) * (milieu.y - de.y) - (vers.y - de.y) * (milieu.x - de.x)) / long;
      expect(Math.abs(signe), `étape ${j}`).toBeGreaterThan(0.03 * long);
      cotes.push(Math.sign(signe));
    }
    expect(cotes[0]).toBe(-cotes[1]!);
  });

  it("arrive 150 ms avant le clic et reste immobile jusqu'au clic, puis jusqu'au départ suivant", () => {
    p.clics.forEach((c) => {
      const arrivee = echantillon(c.tMs - ARRIVEE_CURSEUR_MS);
      for (let t = c.tMs - ARRIVEE_CURSEUR_MS; t <= c.tMs + 160; t += PAS_MESURE_MS) {
        const k = p.curseur.find((x) => x.tMs === t);
        if (!k) continue;
        expect(Math.hypot(k.x - arrivee.x, k.y - arrivee.y), `${c.tMs} → ${t}`).toBeLessThan(0.05);
      }
      // La pointe du clic est celle du plan (à côté du centre de la zone, dans la zone).
      expect(Math.hypot(arrivee.x - c.x, arrivee.y - c.y)).toBeLessThan(0.05);
    });
  });

  it("la pointe est décalée de 2 % vers le bas et la droite du centre de la zone, sans quitter la zone", () => {
    nav.cibles.forEach((c, i) => {
      const z = c.zonePct!;
      expect(p.clics[i]!.x).toBeGreaterThan(z.x + z.largeur / 2);
      expect(p.clics[i]!.y).toBeGreaterThan(z.y + z.hauteur / 2);
      expect(p.clics[i]!.x).toBeLessThanOrEqual(z.x + z.largeur);
      expect(p.clics[i]!.y).toBeLessThanOrEqual(z.y + z.hauteur);
    });
  });

  it("jamais hors du cadre de la caméra, sur toute la durée et aux trois formats", () => {
    for (const f of [F45, { largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1080 }]) {
      const q = plan(nav, f);
      const e = Math.min(f.largeur / 1080, f.hauteur / 1350);
      const page = { x: (f.largeur - 1080 * e) / 2, y: (f.hauteur - 1350 * e) / 2, largeur: 1080 * e, hauteur: 1350 * e };
      for (const c of q.curseur) {
        const s = mondeVersEcranPose(poseA(q, c.tMs), f, { x: page.x + (c.x / 100) * page.largeur, y: page.y + (c.y / 100) * page.hauteur });
        expect(s.x, `${f.hauteur} ${c.tMs}`).toBeGreaterThanOrEqual(-0.5);
        expect(s.x, `${f.hauteur} ${c.tMs}`).toBeLessThanOrEqual(f.largeur + 0.5);
        expect(s.y, `${f.hauteur} ${c.tMs}`).toBeGreaterThanOrEqual(-0.5);
        expect(s.y, `${f.hauteur} ${c.tMs}`).toBeLessThanOrEqual(f.hauteur + 0.5);
      }
    }
  });

  it("absent avant son départ et après la dernière cible ; pression de 160 ms et anneau de 400 ms", () => {
    expect(curseurA(p, 100)).toBeNull();
    expect(curseurA(p, finDe(p) + 1000)).toBeNull();
    expect(curseurA(p, 3000)).not.toBeNull();
    expect(clicA(p, 2900)).toEqual({ pression: 0, anneau: 0 });
    expect(clicA(p, p.clics[0]!.tMs + 80).pression).toBeGreaterThan(0.99);
    expect(clicA(p, p.clics[0]!.tMs + 200).pression).toBe(0);
    expect(clicA(p, p.clics[0]!.tMs + 200).anneau).toBeCloseTo(0.5);
    expect(clicA(p, p.clics[0]!.tMs + 420).anneau).toBe(0);
  });
});

describe("projecteur", () => {
  it("n'éclaire qu'une zone à la fois (jamais deux en même temps), entrée en 250 ms, sortie en 200 ms", () => {
    const p = plan(parcours());
    expect(p.projecteurs).toHaveLength(5);
    for (let i = 1; i < p.projecteurs.length; i++) expect(p.projecteurs[i]!.debutMs).toBeGreaterThanOrEqual(p.projecteurs[i - 1]!.finMs);
    const p0 = p.projecteurs[0]!;
    expect(p0.debutMs).toBe(3000 - ENTREE_PROJECTEUR_MS);
    expect(projecteurA(p, p0.debutMs + 1)!.opacite).toBeLessThan(0.5);
    expect(projecteurA(p, 3000)!.opacite).toBe(1);
    expect(projecteurA(p, p0.finMs - 10)!.opacite).toBeLessThan(0.2);
    expect(projecteurA(p, 100)).toBeNull();
    expect(projecteurA(p, 20000)).toBeNull();
  });
});

describe("volet « avant → maintenant »", () => {
  it("n'existe qu'avec `basculeMs` : 500 ms, sans texte", () => {
    expect(plan(parcours()).volets).toEqual([]);
    const p = plan(parcours({ basculeMs: 6000 }));
    expect(p.volets).toEqual([{ tMs: 6000, dureeMs: 500 }]);
    expect(voletA(p, 5999)).toBeNull();
    expect(voletA(p, 6000)!.progres).toBe(0);
    expect(voletA(p, 6250)!.progres).toBeGreaterThan(0.3);
    expect(voletA(p, 6500)!.progres).toBe(1);
    expect(voletA(p, 6501)).toBeNull();
    expect(JSON.stringify(p.volets)).not.toMatch(/[A-Za-zÀ-ÿ]{2,}\s[A-Za-zÀ-ÿ]/);
  });
  it("le curseur est caché pendant le volet", () => {
    const p = plan(parcours({ basculeMs: 6000 }));
    expect(curseurA(p, 5980)).not.toBeNull();
    expect(curseurA(p, 6100)).toBeNull();
    expect(curseurA(p, 6600)).not.toBeNull();
  });
});

describe("dosage : les quatre crans", () => {
  it("les crans sont ceux du dosage commun", () => {
    const crans: readonly CranFilm[] = ["aucun", "sobre", "equilibre", "dynamique"];
    expect([...crans]).toEqual([...DOSAGES]);
  });
  it("aucun : caméra fixe à 1, aucun projecteur ni volet, curseur et clics seuls", () => {
    const p = plan(parcours({ cran: "aucun", basculeMs: 6000 }));
    for (let t = 0; t <= finDe(p) + 500; t += 20) expect(poseA(p, t).zoom).toBe(1);
    expect(p.camera).toHaveLength(1);
    expect(p.projecteurs).toEqual([]);
    expect(p.volets).toEqual([]);
    expect(p.clics).toHaveLength(5);
    expect(p.curseur.length).toBeGreaterThan(0);
  });
  it("sobre : caméra et curseur, ni projecteur ni volet", () => {
    const p = plan(parcours({ cran: "sobre", basculeMs: 6000 }));
    expect(Math.max(...p.camera.map((k) => k.zoom))).toBeGreaterThan(1.3);
    expect(p.projecteurs).toEqual([]);
    expect(p.volets).toEqual([]);
    expect(p.clics).toHaveLength(5);
  });
  it("équilibré, dynamique ou absent : tout, et jamais au-delà des bornes", () => {
    const sorties = (["equilibre", "dynamique", undefined] as const).map((cran) => plan(parcours({ cran, basculeMs: 6000 })));
    for (const p of sorties) {
      expect(p.projecteurs).toHaveLength(5);
      expect(p.volets).toHaveLength(1);
      expect(Math.max(...p.camera.map((k) => k.zoom))).toBeLessThanOrEqual(ECHELLE_MAX);
    }
    expect(JSON.stringify(sorties[0])).toBe(JSON.stringify(sorties[1]));
    expect(JSON.stringify(sorties[0])).toBe(JSON.stringify(sorties[2]));
  });
});

describe("déterminisme et robustesse", () => {
  it("même entrée deux fois : sorties identiques", () => {
    const a = JSON.stringify(planMotionFilm(parcours({ basculeMs: 6000 }), F45));
    const b = JSON.stringify(planMotionFilm(JSON.parse(JSON.stringify(parcours({ basculeMs: 6000 }))), { ...F45 }));
    expect(b).toBe(a);
  });
  it("entrée illisible : un plan vide et une alerte, jamais d'exception", () => {
    expect(() => planMotionFilm({ largeur: 0, hauteur: 1350, cibles: [] }, F45)).not.toThrow();
    expect(planMotionFilm({ largeur: Number.NaN, hauteur: 1350, cibles: [] }, F45).alertes.length).toBe(1);
    expect(planMotionFilm({ largeur: 1080, hauteur: 1350, cibles: [] }, F45).camera).toHaveLength(1);
    const sansZone = planMotionFilm({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "x", instantMs: 1000, finMs: 2000 }] }, F45);
    expect(sansZone.clics).toEqual([]);
    expect(sansZone.curseur).toEqual([]);
    expect(poseA(sansZone, 5000).zoom).toBe(1);
  });
  it("la bande des sous-titres se lit depuis `positions.basPct`", () => {
    expect(hautBandeSousTitresPct(82)).toBe(75);
    expect(hautBandeSousTitresPct(Number.NaN)).toBeUndefined();
    expect(hautBandeSousTitresPct(0)).toBeUndefined();
  });
});

describe("parcours de référence « avec will-dc » (pilote 05 Stocks, 4:5 1080 × 1350, un mot tous les 1,8 s)", () => {
  const p = plan(parcours());
  const cle = (k: { tMs: number; cx: number; cy: number; zoom: number; profil: string }) => [k.tMs, Math.round(k.cx), Math.round(k.cy), Math.round(k.zoom * 100) / 100, k.profil];

  it("images clés de la caméra, point par point", () => {
    expect(p.camera.map(cle)).toEqual([
      [0, 540, 675, 1, "travelling"],
      [1050, 540, 675, 1, "travelling"],
      [2750, 338, 422, 1.6, "accostage"],
      [3150, 338, 422, 1.6, "accostage"],
      [4550, 540, 704, 1.05, "travelling"],
      [5070, 540, 704, 1.05, "travelling"],
      [6350, 670, 685, 1.44, "accostage"],
      [6830, 670, 685, 1.44, "accostage"],
      [8150, 443, 895, 1.48, "accostage"],
      [8510, 443, 895, 1.48, "accostage"],
      [9950, 743, 928, 1.6, "accostage"],
      [12000, 743, 928, 1.6, "accostage"],
      [13420, 540, 675, 1, "travelling"],
    ]);
    expect(p.alertes).toEqual([]);
  });
  it("clics, projecteurs et volet", () => {
    expect(p.clics.map((c) => [c.tMs, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10])).toEqual([
      [3000, 30, 22],
      [4800, 52, 51],
      [6600, 64, 43],
      [8400, 43, 70],
      [10200, 74, 68],
    ]);
    expect(p.projecteurs.map((x) => [x.debutMs, x.finMs])).toEqual([
      [2750, 4550],
      [4550, 6350],
      [6350, 8150],
      [8150, 9950],
      [9950, 12000],
    ]);
    expect(p.volets).toEqual([]);
  });
  it("le curseur part avant le premier clic et s'arrête après la dernière cible", () => {
    expect(p.curseur[0]!.tMs).toBeLessThan(3000 - ARRIVEE_CURSEUR_MS);
    expect(p.curseur[p.curseur.length - 1]!.tMs).toBe(12000);
  });
});

describe("pureté de motion-film.ts", () => {
  const texte = readFileSync("src/briques/plan-scenes/tutoriel/motion-film.ts", "utf8");
  it("imports relatifs seulement, aucun import du moteur, aucune valeur hexadécimale, aucun mot de couleur interdite", () => {
    const imports = texte.split("\n").filter((l) => /^\s*import\b/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l, l).toMatch(/from "\.\.?\//);
    expect(texte).not.toMatch(/from "@\//);
    expect(texte).not.toMatch(/moteurs\//);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(texte).not.toMatch(/\b(blue|yellow|green|bleu|jaune)\b/i);
  });
  it("réutilise les règles de caméra du schéma et les courbes de caméra communes", () => {
    expect(texte).toContain("camera-couverture/courbes-camera");
    expect(texte).toContain("schema-motion/camera");
  });
});
