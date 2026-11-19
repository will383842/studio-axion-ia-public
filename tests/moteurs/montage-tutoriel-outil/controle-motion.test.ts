/**
 * T-EXT-44 · contrôle du motion du film (pur, 0 €, aucun rendu) : un plan propre passe, un plan trafiqué donne le bon code, une fois.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlerMotionFilm, type CodeDefautMotion } from "../../../src/briques/plan-scenes/tutoriel/controle-motion";
import { planMotionFilm, type NavMotion, type PlanMotionFilm } from "../../../src/briques/plan-scenes/tutoriel/motion-film";

const F45 = { largeur: 1080, hauteur: 1350 };

const nav = (plus: Partial<NavMotion> = {}): NavMotion => ({
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
});
const unSeul = (): NavMotion => ({ largeur: 1080, hauteur: 1350, cibles: [{ etapeId: "a", zonePct: { x: 10, y: 20, largeur: 30, hauteur: 10 }, instantMs: 4000, finMs: 6000 }] });

const propre = (n: NavMotion = nav()) => planMotionFilm(n, F45);
/** Copie profonde : on trafique la copie, jamais le plan retenu par le calcul. */
const copie = (p: PlanMotionFilm): PlanMotionFilm => JSON.parse(JSON.stringify(p));
const fois = (r: ReturnType<typeof controlerMotionFilm>, code: CodeDefautMotion) => r.defauts.filter((d) => d.code === code);

describe("un plan propre", () => {
  it("passe : aucun défaut, quel que soit le cran", () => {
    for (const cran of [undefined, "aucun", "sobre", "equilibre", "dynamique"] as const) {
      const n = nav({ cran });
      const r = controlerMotionFilm(propre(n), { nav: n, format: F45 });
      expect(r, String(cran)).toEqual({ ok: true, defauts: [] });
    }
  });
  it("passe aussi avec le volet, aux autres formats, et avec une bande de sous-titres plus haute", () => {
    for (const f of [{ largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1080 }]) {
      const n = nav({ basculeMs: 6000 });
      const r = controlerMotionFilm(planMotionFilm(n, f), { nav: n, format: f });
      expect(r.defauts.filter((d) => d.code !== "SOUS_LES_SOUS_TITRES"), `${f.hauteur}`).toEqual([]);
    }
    const n = nav({ hautSousTitresPct: 78 });
    expect(controlerMotionFilm(propre(n), { nav: n, format: F45 }).ok).toBe(true);
  });
  it("une zone qui ne peut pas passer au-dessus des sous-titres est nommée", () => {
    const n = nav({ cibles: [{ etapeId: "bas", zonePct: { x: 10, y: 80, largeur: 40, hauteur: 15 }, instantMs: 4000, finMs: 6000 }] });
    const r = controlerMotionFilm(propre(n), { nav: n, format: F45 });
    expect(r.ok).toBe(false);
    expect(fois(r, "SOUS_LES_SOUS_TITRES")).toHaveLength(1);
    expect(fois(r, "SOUS_LES_SOUS_TITRES")[0]!.message).toContain("sous les sous-titres");
  });
});

describe("un plan trafiqué : le bon code, une fois", () => {
  const verifier = (p: PlanMotionFilm, n: NavMotion, code: CodeDefautMotion) => {
    const r = controlerMotionFilm(p, { nav: n, format: F45 });
    expect(r.ok, code).toBe(false);
    expect(fois(r, code), code).toHaveLength(1);
    expect(fois(r, code)[0]!.message, code).toMatch(/[a-zéèêà]/);
    return r;
  };

  it("VITESSE : un mouvement raccourci", () => {
    const n = nav();
    const p = copie(propre(n));
    // La montée vers la première zone (1,7 s) est ramenée à 0,45 s : même arrivée, trois fois trop vite.
    p.camera[1]!.tMs = p.camera[2]!.tMs - 450;
    const r = verifier(p, n, "VITESSE");
    expect(fois(r, "VITESSE")[0]!.tMs).toBeGreaterThanOrEqual(p.camera[1]!.tMs);
  });

  it("A_COUP : un saut de la caméra, sans dépasser la vitesse permise", () => {
    const n = unSeul();
    const p = copie(propre(n));
    const repos = p.camera[0]!;
    // 0,02 écran en 20 ms : 1 écran/s (permis), mais un départ et un arrêt instantanés.
    p.camera.splice(1, 0, { ...repos, tMs: 500 }, { ...repos, tMs: 520, cx: repos.cx + 0.02 * F45.largeur });
    const r = verifier(p, n, "A_COUP");
    expect(fois(r, "VITESSE")).toHaveLength(0);
  });

  it("ZOOM_HORS_BORNES : un zoom de 1,8", () => {
    const n = unSeul();
    const p = copie(propre(n));
    p.camera.forEach((k) => {
      if (k.zoom > 1.2) k.zoom = 1.8;
    });
    verifier(p, n, "ZOOM_HORS_BORNES");
  });

  it("ZONE_COUPEE : la caméra arrive à côté de la zone", () => {
    const n = unSeul();
    const p = copie(propre(n));
    p.camera.forEach((k) => {
      if (k.zoom > 1.2) k.cx = 1000;
    });
    const r = verifier(p, n, "ZONE_COUPEE");
    expect(fois(r, "ZONE_COUPEE")[0]!.tMs).toBe(4000);
  });

  it("SOUS_LES_SOUS_TITRES : une zone qui passe sous la bande", () => {
    const n = unSeul();
    const p = copie(propre(n));
    p.geometrie.hautSousTitresPct = 20;
    const r = verifier(p, n, "SOUS_LES_SOUS_TITRES");
    expect(fois(r, "SOUS_LES_SOUS_TITRES")[0]!.tMs).toBe(4000);
  });

  it("CLIC_DECALE : un clic à 120 ms du mot", () => {
    const n = nav();
    const p = copie(propre(n));
    p.clics[1]!.tMs += 120;
    const r = verifier(p, n, "CLIC_DECALE");
    expect(fois(r, "CLIC_DECALE")[0]!.message).toContain("tableau-stock");
  });

  it("CLIC_DECALE : un clic manquant", () => {
    const n = nav();
    const p = copie(propre(n));
    p.clics.splice(2, 1);
    verifier(p, n, "CLIC_DECALE");
  });

  it("un clic à 60 ms du mot reste permis (au plus 80 ms)", () => {
    const n = nav();
    const p = copie(propre(n));
    p.clics[1]!.tMs += 60;
    expect(fois(controlerMotionFilm(p, { nav: n, format: F45 }), "CLIC_DECALE")).toHaveLength(0);
  });

  it("CURSEUR_HORS_CADRE : le curseur sort de l'image", () => {
    const n = unSeul();
    const p = copie(propre(n));
    const i = p.curseur.findIndex((c) => c.tMs >= 500);
    for (let k = i; k < i + 8; k++) {
      p.curseur[k]!.x = 140;
      p.curseur[k]!.y = 50;
    }
    verifier(p, n, "CURSEUR_HORS_CADRE");
  });

  it("DEUX_PROJECTEURS : deux zones éclairées en même temps", () => {
    const n = nav();
    const p = copie(propre(n));
    p.projecteurs[1]!.debutMs = p.projecteurs[0]!.finMs - 300;
    verifier(p, n, "DEUX_PROJECTEURS");
  });
});

describe("pureté de controle-motion.ts", () => {
  it("imports relatifs seulement, aucun import du moteur, messages en français sans montant", () => {
    const t = readFileSync("src/briques/plan-scenes/tutoriel/controle-motion.ts", "utf8");
    for (const l of t.split("\n").filter((x) => /^\s*import\b/.test(x))) expect(l, l).toMatch(/from "\.\.?\//);
    expect(t).not.toMatch(/from "@\//);
    expect(t).not.toMatch(/€|\beuros?\b/i);
    expect(t).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
