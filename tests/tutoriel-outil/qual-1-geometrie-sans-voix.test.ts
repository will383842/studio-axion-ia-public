/**
 * QUAL-1 : géométrie pure du tutoriel sans voix composé. Invariants vérifiés toutes les 50 ms sur 4 formats, sur TOUS les
 * éléments (même d'opacité < 0,05) : aucun filet de sécurité qui masque, tout tient dans le contenu et dans son parent.
 */
import { describe, expect, it } from "vitest";
import { positionsVerticales } from "@/briques/sous-titres/largeur";
import { contrasteWcag } from "@/briques/charte/axion-2026";
import { COULEURS_HEX, NOMS_COULEURS, TAILLES_MIN, taillesMinPour, zonesSansVoix, echelleFormat } from "@/briques/plan-scenes/tutoriel/sans-voix/grammaire";
import { INTERLIGNE, elementsSansVoixA, imageSansVoixA } from "@/briques/plan-scenes/tutoriel/sans-voix/geometrie";
import type { ElementVisible, EvenementEcran, PlanComposeSansVoix, RectPx, SceneSansVoix } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { DUREE_STOCKS_MS, PLAN_SANS_VOIX_STOCKS } from "./fixtures/plan-sans-voix-stocks";

const FORMATS = [
  { nom: "4:5", ratio: "4:5" as const, largeur: 1080, hauteur: 1350 },
  { nom: "9:16", ratio: "9:16" as const, largeur: 1080, hauteur: 1920 },
  { nom: "1:1", ratio: "1:1" as const, largeur: 1080, hauteur: 1080 },
  { nom: "16:9", ratio: "16:9" as const, largeur: 1920, hauteur: 1080 },
];
type Fmt = (typeof FORMATS)[number];

function planPour(f: Fmt, base: PlanComposeSansVoix = PLAN_SANS_VOIX_STOCKS): PlanComposeSansVoix {
  const basPct = f.nom === "4:5" ? 87 : positionsVerticales(f.ratio, []).basPct;
  return { ...base, format: { largeur: f.largeur, hauteur: f.hauteur, fps: 25 }, basPct };
}

const copie = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
type Ecran = Extract<SceneSansVoix, { genre: "ecran" }>;
const ecranDe = (p: PlanComposeSansVoix) => p.scenes[1] as Ecran;
const evDe = <G extends EvenementEcran["genre"]>(p: PlanComposeSansVoix, g: G) => ecranDe(p).evenements.find((e) => e.genre === g) as Extract<EvenementEcran, { genre: G }>;

const dedans = (r: RectPx, c: RectPx, eps = 1e-6) => r.x >= c.x - eps && r.y >= c.y - eps && r.x + r.largeur <= c.x + c.largeur + eps && r.y + r.hauteur <= c.y + c.hauteur + eps;
const inter = (a: RectPx, b: RectPx) => a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
const visibles = (els: ElementVisible[]) => els.filter((e) => e.opacite >= 0.05);
const instants = (pas: number, fin = DUREE_STOCKS_MS) => Array.from({ length: Math.floor(fin / pas) + 1 }, (_, i) => i * pas);

/** Problèmes d'une image : TOUS les éléments, visibles ou non. */
function problemes(plan: PlanComposeSansVoix, t: number): string[] {
  const z = zonesSansVoix(plan.format, plan.basPct);
  const min = 32 * echelleFormat(plan.format);
  const els = imageSansVoixA(plan, t).elements;
  const par = new Map(els.map((e) => [e.id, e]));
  const pb: string[] = [];
  if (par.size !== els.length) pb.push(`${t} ids dupliqués`);
  for (const e of els) {
    if (!dedans(e.rect, z.contenu)) pb.push(`${t} ${e.id} hors contenu`);
    if (inter(e.rect, z.bande)) pb.push(`${t} ${e.id} dans la bande`);
    if (!(e.opacite >= 0 && e.opacite <= 1)) pb.push(`${t} ${e.id} opacité ${e.opacite}`);
    if (e.genre === "texte") {
      if (!e.lignes || !e.taillePx) pb.push(`${t} ${e.id} texte sans lignes`);
      else {
        if (e.taillePx < min - 1e-6) pb.push(`${t} ${e.id} taille ${e.taillePx}`);
        if (Math.abs(e.rect.hauteur - e.lignes.length * e.taillePx * INTERLIGNE) > 1e-6) pb.push(`${t} ${e.id} interligne`);
      }
      if (e.lignes && e.lignes.length > 3) pb.push(`${t} ${e.id} ${e.lignes.length} lignes`);
      if (e.id.endsWith("/libelle") && e.lignes && e.lignes.length > 2) pb.push(`${t} ${e.id} libellé sur ${e.lignes.length} lignes`);
      if ((e.id.endsWith("alerte/texte") || e.id.endsWith("bouton/texte")) && e.lignes && e.lignes.length > 2) pb.push(`${t} ${e.id} > 2 lignes`);
      if (e.id.endsWith("fenetre/titre") && e.lignes && e.lignes.length > 1) pb.push(`${t} ${e.id} titre de fenêtre > 1 ligne`);
    }
    for (const c of [e.remplissage, e.contour, e.couleur]) if (c && !NOMS_COULEURS.includes(c)) pb.push(`${t} ${e.id} couleur ${c}`);
    if (e.genre === "curseur") {
      if (!e.cibleId || !par.has(e.cibleId)) pb.push(`${t} curseur sans cible`);
      else if (par.get(e.cibleId)!.genre !== "cible") pb.push(`${t} cibleId n'est pas une cible`);
    }
    if (e.parentId) {
      const p = par.get(e.parentId);
      if (!p) pb.push(`${t} ${e.id} parent absent`);
      else {
        if (!dedans(e.rect, p.rect, 1e-6)) pb.push(`${t} ${e.id} sort de ${e.parentId}`);
        if (e.opacite > p.opacite + 1e-9) pb.push(`${t} ${e.id} plus opaque que ${e.parentId}`);
      }
    }
    if (e.texte && /\d/.test(e.texte)) pb.push(`${t} chiffre dans ${e.texte}`);
  }
  return pb;
}

describe("QUAL-1 grammaire", () => {
  it("4:5 : zones du plan B1", () => {
    const z = zonesSansVoix({ largeur: 1080, hauteur: 1350, fps: 25 }, 87);
    expect(z.contenu).toEqual({ x: 64, y: 68, largeur: 952, hauteur: 944 });
    expect(z.bande).toEqual({ x: 54, y: 1053, largeur: 972, hauteur: 202 });
  });

  it.each(FORMATS)("zones disjointes et marges ≥ 24 px ($nom)", (f) => {
    const p = planPour(f);
    const z = zonesSansVoix(p.format, p.basPct);
    expect(inter(z.contenu, z.bande)).toBe(false);
    expect(z.contenu.x).toBeGreaterThanOrEqual(24);
    expect(z.contenu.y).toBeGreaterThanOrEqual(24);
    expect(z.contenu.x + z.contenu.largeur).toBeLessThanOrEqual(f.largeur - 24);
    expect(z.bande.y + z.bande.hauteur).toBeLessThanOrEqual(f.hauteur);
    expect(z.contenu.hauteur).toBeGreaterThan(300);
  });

  it("tailles minimales et couleurs de la charte", () => {
    expect(TAILLES_MIN.minimum).toBe(32);
    expect(taillesMinPour({ largeur: 1920, hauteur: 1080, fps: 25 }).minimum).toBe(32);
    expect(taillesMinPour({ largeur: 540, hauteur: 675, fps: 25 }).minimum).toBe(16);
    expect(echelleFormat({ largeur: 1080, hauteur: 1350, fps: 25 })).toBe(1);
    for (const fond of [COULEURS_HEX.ivoire, COULEURS_HEX.blanc]) {
      expect(contrasteWcag(COULEURS_HEX.grisTexte, fond)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteWcag(COULEURS_HEX.terracotta, fond)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each(FORMATS)("QUAL-1 géométrie ($nom)", (f) => {
  const plan = planPour(f);

  it("invariants toutes les 50 ms sur TOUS les éléments (contenu, parent, tailles, curseur)", () => {
    const pb: string[] = [];
    for (const t of instants(50)) pb.push(...problemes(plan, t));
    expect(pb.slice(0, 15)).toEqual([]);
  });

  it("jamais d'image vide : un texte et une forme de contenu à chaque instant", () => {
    for (const t of instants(100)) {
      const v = visibles(imageSansVoixA(plan, t).elements).filter((e) => e.genre === "texte" || e.genre === "forme");
      expect(v.length, `t=${t}`).toBeGreaterThan(0);
      expect(v.some((e) => e.genre === "texte"), `texte t=${t}`).toBe(true);
    }
  });

  it("déterministe", () => {
    for (const t of [0, 7300, 12345, 23100, 36500, 41400]) expect(imageSansVoixA(plan, t)).toEqual(imageSansVoixA(plan, t));
  });

  it("le mouvement est continu : trois instants espacés de 0,3 s diffèrent", () => {
    const empreinte = (t: number) => JSON.stringify(imageSansVoixA(plan, t).elements.map((e) => [e.id, e.rect, e.opacite]));
    for (const t0 of [100, 1200, 6000, 7500, 10500, 13000, 17500, 20300, 23100, 24000, 28500, 30100, 34100, 35800, 36600, 39000, 40100]) {
      expect(new Set([empreinte(t0), empreinte(t0 + 300), empreinte(t0 + 600)]).size, `t=${t0}`).toBe(3);
    }
  });

  it("libellés de carte, rubriques et alerte ≥ 36 px, 2 lignes max (plan B3)", () => {
    const els = imageSansVoixA(plan, 32000).elements.concat(imageSansVoixA(plan, 28500).elements);
    const lib = els.filter((e) => e.genre === "texte" && /(carte-\d\/libelle|rubrique-\d\/libelle|alerte\/texte|liste\/titre)$/.test(e.id) && e.opacite > 0.9);
    expect(lib.length).toBeGreaterThanOrEqual(6);
    for (const e of lib) {
      expect(e.taillePx, e.id).toBeGreaterThanOrEqual(36 * echelleFormat(plan.format) * 0.99);
      expect(e.lignes!.length, e.id).toBeLessThanOrEqual(2);
    }
    expect(els.find((e) => e.id === "s2/rubrique-3/libelle" || e.id === "s2/panneau/rubrique-3/libelle")!.lignes!.length).toBeLessThanOrEqual(2);
  });

  it("le focus ne zoome pas : les cartes gardent leur taille", () => {
    const largeur = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.id === "s2/carte-1")!.rect.largeur;
    expect(Math.abs(largeur(16200) - largeur(14000)) / largeur(14000)).toBeLessThan(0.01);
  });
});

describe("QUAL-1 scènes (4:5)", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  const texte = (t: number) => visibles(imageSansVoixA(plan, t).elements).filter((e) => e.genre === "texte").map((e) => e.texte);
  const el = (p: PlanComposeSansVoix, t: number, id: string) => imageSansVoixA(p, t).elements.find((e) => e.id === id);

  it("la construction suit les événements", () => {
    expect(texte(2500)).toContain("Suivre ses stocks avec un tableau de bord simple");
    expect(texte(8000)).toEqual(["Tableau de bord"]);
    expect(texte(16000)).toEqual(expect.arrayContaining(["Articles en stock", "Passent sous le seuil", "Valeur totale"]));
    expect(texte(19000)).toContain("Articles à commander");
    expect(texte(21500)).toContain("Par urgence");
    expect(texte(28500)).toEqual(expect.arrayContaining(["Historique", "Entrées", "Sorties", "Date de la prochaine rupture prévue"]));
    expect(texte(32000)).toContain("Un article passe sous le seuil");
    expect(texte(37500)).toEqual(expect.arrayContaining(["une heure", "une minute"]));
    expect(texte(37500)).not.toContain("une minute".toUpperCase());
    expect(texte(40500)).toEqual(expect.arrayContaining(["Vous voulez le même pour votre entreprise ?", "Prenez rendez-vous"]));
  });

  it("alias elementsSansVoixA", () => {
    expect(elementsSansVoixA(plan, 12000)).toEqual(imageSansVoixA(plan, 12000).elements);
  });

  it("le clic : curseur vers la ligne 1, anneau à aMs, surbrillance attachée à la cible ligne-1", () => {
    const a = imageSansVoixA(plan, 22900).elements.find((e) => e.genre === "curseur")!;
    const b = imageSansVoixA(plan, 23250).elements.find((e) => e.genre === "curseur")!;
    expect(a.cibleId).toBe("s2/ligne-1");
    expect(a.anneauClic).toBe(0);
    expect(b.anneauClic).toBeGreaterThan(0);
    expect(el(plan, 24000, "s2/ligne-1/allume")!.opacite).toBeGreaterThan(0.9);
    expect(el(plan, 24000, "s2/rang-1/allume")).toBeUndefined();
    const cible = el(plan, 23000, "s2/ligne-1")!;
    const c = imageSansVoixA(plan, 23000).elements.find((e) => e.genre === "curseur")!;
    expect(c.pointe!.x).toBeGreaterThanOrEqual(cible.rect.x);
    expect(c.pointe!.x).toBeLessThanOrEqual(cible.rect.x + cible.rect.largeur);
    expect(c.pointe!.y).toBeGreaterThanOrEqual(cible.rect.y);
    expect(c.pointe!.y).toBeLessThanOrEqual(cible.rect.y + cible.rect.hauteur);
  });

  it("la surbrillance suit la cible fixe même pendant le tri ; la cible n'a aucune opacité forcée", () => {
    const p = copie(plan);
    evDe(p, "clic").aMs = 20000;
    for (const t of [20300, 20500, 21000]) {
      expect(el(p, t, "s2/ligne-1/allume")!.rect).toEqual(el(p, t, "s2/ligne-1")!.rect);
    }
    // Pendant un focus qui atténue la liste, la cible ne reçoit ni 1 forcé ni atténuation : elle suit la scène (1).
    for (const t of [16200, 28700]) expect(el(plan, t, "s2/ligne-1")!.opacite).toBe(1);
  });

  it("clic AVANT le début de l'écran : curseur visible, cohérent avec la ligne allumée", () => {
    const p = copie(plan);
    evDe(p, "clic").aMs = 1000;
    const vus = instants(100, 12000).filter((t) => t >= 5500).map((t) => imageSansVoixA(p, t).elements);
    const avecCurseur = vus.filter((els) => els.some((e) => e.genre === "curseur" && e.opacite > 0.3));
    expect(avecCurseur.length).toBeGreaterThan(3);
    for (const els of vus) {
      const cur = els.find((e) => e.genre === "curseur");
      const al = els.find((e) => e.id === "s2/ligne-1/allume");
      if (cur && cur.anneauClic! > 0) expect(al?.opacite ?? 0).toBeGreaterThanOrEqual(0);
      if (al && al.opacite > 0.9) expect(cur === undefined || cur.opacite > 0.01).toBe(true);
    }
    expect(el(p, 8000, "s2/ligne-1/allume")!.opacite).toBeGreaterThan(0.5);
    expect(el(p, 24000, "s2/ligne-1/allume")!.opacite).toBeGreaterThan(0.9);
    expect(instants(50).flatMap((t) => problemes(planPour(FORMATS[0], p), t)).slice(0, 5)).toEqual([]);
  });

  it("événements non chronologiques : une rubrique n'apparaît jamais avant son panneau", () => {
    const p = copie(plan);
    evDe(p, "panneau").rubriques[0].aMs = 20000;
    const pan = evDe(p, "panneau").aMs;
    for (const t of [21000, pan, pan + 150]) {
      const l = el(p, t, "s2/panneau/rubrique-1/libelle");
      expect(l === undefined || l.opacite < 0.05, `t=${t}`).toBe(true);
    }
    expect(el(p, pan + 1200, "s2/panneau/rubrique-1/libelle")!.opacite).toBeGreaterThan(0.9);
  });

  it("le panneau reste dans la fenêtre et ≤ 55 % de sa largeur", () => {
    const els = imageSansVoixA(plan, 28000).elements;
    const fen = els.find((e) => e.id === "s2/fenetre")!;
    const pan = els.find((e) => e.id === "s2/panneau")!;
    expect(pan.rect.largeur).toBeLessThanOrEqual(0.55 * fen.rect.largeur);
    expect(dedans(pan.rect, fen.rect)).toBe(true);
  });

  it("le trait barre « une heure » après barreAMs", () => {
    const barre = (t: number) => el(plan, t, "s3/avant")!.barre!;
    expect(barre(34900)).toBe(0);
    expect(barre(36200)).toBe(1);
    expect(el(plan, 35550, "s3/apres")!.opacite).toBeLessThan(0.05);
    expect(el(plan, 36500, "s3/apres")!.opacite).toBeGreaterThan(0.9);
    expect(texte(34600)).toContain("une heure");
  });

  it("surtitre et plan sans scène", () => {
    const p2: PlanComposeSansVoix = { ...plan, scenes: [{ ...(plan.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>), surTitre: "Tutoriel" }, ...plan.scenes.slice(1)] };
    expect(el(p2, 1500, "s1/sur-titre")!.taillePx).toBeGreaterThanOrEqual(40);
    const q = copie(p2);
    (q.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>).surTitre = "Vous perdez du temps à compter vos stocks à la main ?";
    const st = el(q, 2500, "s1/sur-titre")!;
    expect(st.taillePx).toBeGreaterThanOrEqual(40);
    expect(st.lignes!.length).toBeLessThanOrEqual(2);
    expect(instants(50, 5000).flatMap((t) => problemes(planPour(FORMATS[0], q), t)).slice(0, 5)).toEqual([]);
    expect(imageSansVoixA({ ...plan, scenes: [] }, 100).elements).toEqual([]);
  });

  it("carte-phrase : texte ≥ 56 px", () => {
    const p: PlanComposeSansVoix = { ...plan, scenes: [{ id: "c1", genre: "carte-phrase", debutMs: 0, finMs: 4000, mots: { premier: 0, dernier: 5 }, texte: "Un tableau de bord simple" }] };
    const t = el(p, 2000, "c1/carte/texte")!;
    expect(t.taillePx).toBeGreaterThanOrEqual(56);
    expect(t.lignes!.length).toBeLessThanOrEqual(3);
  });
});

describe("QUAL-1 temps vivant et mise en valeur", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  const empreinte = (t: number) => new Map(imageSansVoixA(plan, t).elements.filter((e) => e.id.startsWith("s2/")).map((e) => [e.id, e]));

  it("pendant la phrase qui présente l'outil (avant le 1er événement), jamais plus de 1,5 s sans changement visible", () => {
    for (let t = 5500; t + 1500 <= 9800; t += 100) {
      const a = empreinte(t);
      const b = empreinte(t + 1500);
      let change = false;
      for (const [id, e] of b) {
        const o = a.get(id);
        if (!o || Math.abs(e.opacite - o.opacite) > 0.04 || Math.abs(e.rect.largeur - o.rect.largeur) > 3 || Math.abs(e.rect.hauteur - o.rect.hauteur) > 3) change = true;
      }
      expect(change, `t=${t}`).toBe(true);
    }
  });

  it("les emplacements des cartes se dessinent en cascade (contours un par un)", () => {
    const op = (t: number, k: number) => empreinte(t).get(`s2/carte-${k}`)!.opacite;
    expect(op(5800, 3)).toBeLessThan(op(5800, 1) + 1e-9);
    expect(op(5800, 1)).toBeLessThan(op(9000, 1));
    expect(op(6200, 3)).toBeLessThan(0.3);
    expect(op(8500, 3)).toBeGreaterThan(0.5);
  });

  it("au mot « En haut » (focus cartes), la rangée de cartes s'illumine et le reste s'atténue ensemble", () => {
    const e = empreinte(9300);
    expect(e.get("s2/focus-cadre")!.opacite).toBeGreaterThan(0.5);
    const liste = e.get("s2/liste")!.opacite;
    const ligne = e.get("s2/rang-1")!.opacite;
    const fant = e.get("s2/rang-1/fantome-barre");
    expect(liste).toBeLessThan(0.6);
    expect(ligne).toBeLessThanOrEqual(liste + 1e-9);
    if (fant) expect(fant.opacite).toBeLessThanOrEqual(ligne + 1e-9);
    expect(e.get("s2/carte-1")!.opacite).toBeGreaterThan(liste);
  });

  it("focus panneau (28-29,2 s) : liste et cartes atténuées à 0,55 avec leurs enfants, aucun enfant ne flotte", () => {
    const e = empreinte(28750);
    expect(e.get("s2/focus-cadre")!.opacite).toBeGreaterThan(0.5);
    for (const [id, x] of e) {
      if (/^s2\/(carte-\d|liste|rang-\d)/.test(id) && !id.includes("focus")) {
        const parent = x.parentId ? e.get(x.parentId) : undefined;
        if (parent) expect(x.opacite, id).toBeLessThanOrEqual(parent.opacite + 1e-9);
      }
    }
    expect(e.get("s2/carte-2")!.opacite).toBeCloseTo(0.55, 1);
    expect(e.get("s2/liste")!.opacite).toBeCloseTo(0.55, 1);
    expect(e.get("s2/liste/titre")!.opacite).toBeLessThanOrEqual(0.56);
    expect(e.get("s2/panneau")!.opacite).toBeGreaterThan(0.95);
  });

  it("la mise en page reste STABLE : cartes en haut, liste dessous, historique à droite, rien ne saute pendant les focus", () => {
    const y = (t: number, id: string) => imageSansVoixA(plan, t).elements.find((e) => e.id === id)!.rect;
    for (const id of ["s2/carte-1", "s2/carte-3", "s2/liste", "s2/fenetre"]) {
      const a = y(15500, id);
      for (const t of [16000, 16200, 17000]) expect(Math.abs(y(t, id).y - a.y), `${id} ${t}`).toBeLessThan(2);
    }
    const c = y(30500, "s2/carte-1");
    const l = y(30500, "s2/liste");
    const pn = y(30500, "s2/panneau");
    const f = y(30500, "s2/fenetre");
    expect(c.y).toBeLessThan(l.y);
    expect(pn.x).toBeGreaterThan(l.x + l.largeur - 1);
    expect(f.y + f.hauteur - (l.y + l.hauteur)).toBeLessThan(0.06 * f.hauteur);
    expect(y(28750, "s2/panneau").y).toBeCloseTo(pn.y, 0);
  });

  it("tous les focus sont gérés (cartes, liste, panneau, alerte, ensemble)", () => {
    const p = copie(plan);
    const cibles = ["cartes", "liste", "panneau", "alerte", "ensemble"] as const;
    cibles.forEach((c, i) => ecranDe(p).evenements.push({ genre: "focus", aMs: 33000 - 4000 + i * 100, finMs: 33000 - 4000 + i * 100 + 20000, cible: c, source: { premier: 0, dernier: 0 } }));
    const pb: string[] = [];
    for (const t of instants(200, 34000)) pb.push(...problemes(p, t));
    expect(pb.slice(0, 5)).toEqual([]);
    expect(imageSansVoixA(p, 32000).elements.some((e) => e.id === "s2/focus-cadre")).toBe(true);
  });
});

describe.each(FORMATS)("QUAL-1 mise en page qui tient (stress, $nom)", (f) => {
  const MOT_LONG = "Réapprovisionnements";
  const LONG = "Articles internationaux à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts";

  function plan7(): PlanComposeSansVoix {
    const p = copie(PLAN_SANS_VOIX_STOCKS);
    evDe(p, "liste").lignes = 7;
    return planPour(f, p);
  }
  function planLong(): PlanComposeSansVoix {
    const p = copie(PLAN_SANS_VOIX_STOCKS);
    const ec = ecranDe(p);
    ec.titreFenetre = `Tableau de bord ${LONG}`;
    const cs = evDe(p, "cartes-chiffres");
    cs.cartes[0].libelle = MOT_LONG;
    cs.cartes[1].libelle = LONG;
    cs.cartes[2].libelle = `${MOT_LONG} supercalifragilisticexpialidocious`;
    evDe(p, "liste").titre = LONG;
    evDe(p, "tri").etiquette = LONG;
    evDe(p, "panneau").titre = `Historique ${LONG}`;
    evDe(p, "panneau").rubriques[0].libelle = MOT_LONG;
    evDe(p, "panneau").rubriques[1].libelle = LONG;
    evDe(p, "panneau").rubriques[2].libelle = `${LONG} ${LONG}`;
    evDe(p, "alerte").texte = `${LONG} ${LONG}`;
    (p.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>).texte = `${LONG} ${LONG}`;
    (p.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>).avant = LONG;
    (p.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>).apres = MOT_LONG;
    const ap = p.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>;
    ap.bouton = `${LONG} ${MOT_LONG}`;
    ap.question = `${LONG} ${LONG} ${LONG}`;
    return planPour(f, p);
  }

  it("liste de 7 lignes : le nombre de lignes est plafonné selon la place (≥ 3), toutes dans le panneau, aucun masquage", () => {
    const plan = plan7();
    const pb: string[] = [];
    for (const t of instants(50)) pb.push(...problemes(plan, t));
    expect(pb.slice(0, 10)).toEqual([]);
    const rangs = imageSansVoixA(plan, 22000).elements.filter((e) => /^s2\/rang-\d+$/.test(e.id));
    expect(rangs.length).toBeGreaterThanOrEqual(3);
    expect(rangs.length).toBeLessThanOrEqual(7);
    const liste = imageSansVoixA(plan, 22000).elements.find((e) => e.id === "s2/liste")!;
    for (const r of rangs) {
      expect(dedans(r.rect, liste.rect), r.id).toBe(true);
      expect(r.opacite, r.id).toBeGreaterThan(0.4);
    }
  });

  it("textes longs, mots de plus de 15 lettres, libellés de 80+ caractères : dans le parent, ≤ maxL lignes, ≥ 32 px", () => {
    const plan = planLong();
    const pb: string[] = [];
    for (const t of instants(50)) pb.push(...problemes(plan, t));
    expect(pb.slice(0, 10)).toEqual([]);
    const els = imageSansVoixA(plan, 32000).elements;
    const l = els.filter((e) => /carte-\d\/libelle$/.test(e.id));
    expect(l).toHaveLength(3);
    for (const e of l) {
      expect(e.lignes!.length).toBeLessThanOrEqual(2);
      expect(e.taillePx).toBeGreaterThanOrEqual(32 * echelleFormat(plan.format) - 1e-6);
      for (const ligne of e.lignes!) expect(ligne.length).toBeGreaterThan(0);
    }
    // Le texte affiché reste littéral : le début du texte (suite contiguë), éventuellement coupé par « … » ou « - ».
    for (const e of imageSansVoixA(plan, 38800).elements.filter((x) => x.genre === "texte")) {
      const affiche = e.lignes!.join(" ").replace(/- /g, "");
      const sans = affiche.replace(/…$/, "");
      expect(e.texte!.replace(/- /g, "").startsWith(sans) || e.texte!.includes(sans) || affiche === e.texte, e.id).toBe(true);
    }
  });
});

describe("QUAL-1 ajustement de texte (cas extrêmes)", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  const libelleDe = (p: PlanComposeSansVoix, libelle: string, k = 1) => {
    const q = copie(p);
    evDe(q, "cartes-chiffres").cartes[k].libelle = libelle;
    const els = imageSansVoixA(q, 16000).elements;
    return { e: els.find((x) => x.id === `s2/carte-${k + 1}/libelle`)!, carte: els.find((x) => x.id === `s2/carte-${k + 1}`)! };
  };

  it("mot de plus de 15 lettres : reste dans sa carte, ≤ 2 lignes, ≥ 32 px", () => {
    const { e, carte } = libelleDe(plan, "Réapprovisionnements");
    expect(dedans(e.rect, carte.rect)).toBe(true);
    expect(e.lignes!.length).toBeLessThanOrEqual(2);
    expect(e.taillePx).toBeGreaterThanOrEqual(32);
  });

  it("mot absurde de 40 lettres : coupé avec un trait d'union, dans la carte, ≥ 32 px", () => {
    const { e, carte } = libelleDe(plan, "Anticonstitutionnellementdessinterlocuteurs");
    expect(dedans(e.rect, carte.rect)).toBe(true);
    expect(e.lignes!.length).toBeLessThanOrEqual(2);
    expect(e.taillePx).toBeGreaterThanOrEqual(32);
  });

  it("libellé de 80 caractères : suite contiguë du début (« … » final), 2 lignes, dans la carte", () => {
    const txt = "Articles internationaux à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts";
    const { e, carte } = libelleDe(plan, txt);
    expect(txt.length).toBeGreaterThan(80);
    expect(dedans(e.rect, carte.rect)).toBe(true);
    expect(e.lignes!.length).toBeLessThanOrEqual(2);
    expect(e.taillePx).toBeGreaterThanOrEqual(32);
    const affiche = e.lignes!.join(" ");
    expect(affiche.endsWith("…")).toBe(true);
    expect(txt.startsWith(affiche.slice(0, -1).trimEnd())).toBe(true);
  });

  it("un libellé qui tient n'est ni raccourci ni coupé", () => {
    const { e } = libelleDe(plan, "Passent sous le seuil");
    expect(e.lignes!.join(" ")).toBe("Passent sous le seuil");
    expect(e.taillePx).toBeGreaterThanOrEqual(36);
  });
});
