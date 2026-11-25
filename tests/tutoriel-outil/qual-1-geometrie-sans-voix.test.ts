/**
 * QUAL-1 : géométrie pure du tutoriel sans voix composé. Invariants vérifiés toutes les 50 ms sur 4 formats, sur TOUS les
 * éléments (même d'opacité < 0,05) : aucun filet de sécurité qui masque, tout tient dans le contenu et dans son parent.
 */
import { describe, expect, it } from "vitest";
import { positionsVerticales } from "@/briques/sous-titres/largeur";
import { contrasteWcag } from "@/briques/charte/axion-2026";
import { COULEURS_HEX, NOMS_COULEURS, OPACITE_ATTENUEE, TAILLES_MIN, taillesMinPour, zonesSansVoix, echelleFormat } from "@/briques/plan-scenes/tutoriel/sans-voix/grammaire";
import { INTERLIGNE, elementsSansVoixA, imageSansVoixA, pictogrammesCartes } from "@/briques/plan-scenes/tutoriel/sans-voix/geometrie";
import type { ElementVisible, EvenementEcran, PlanComposeSansVoix, RectPx, SceneSansVoix } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { DUREE_STOCKS_MS, PLAN_SANS_VOIX_REEL, PLAN_SANS_VOIX_STOCKS } from "./fixtures/plan-sans-voix-stocks";

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
      if (e.id.endsWith("bouton/texte") && e.lignes && e.lignes.length > 2) pb.push(`${t} ${e.id} > 2 lignes`);
      if (e.id.endsWith("alerte/texte") && e.lignes && e.lignes.length > 3) pb.push(`${t} ${e.id} > 3 lignes`);
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
    const rep = plan.scenes.find((sc) => sc.genre === "repere")!;
    for (const t of instants(100)) {
      const v = visibles(imageSansVoixA(plan, t).elements).filter((e) => e.genre === "texte" || e.genre === "forme");
      expect(v.length, `t=${t}`).toBeGreaterThan(0);
      // Carte + horloge qui tourne dans les 600 premières ms du repère (le premier mot dit y monte juste après) : forme, pas de vide.
      if (t >= rep.debutMs && t < rep.debutMs + 600) continue;
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

  it("le focus ne zoome pas : les cartes gardent leur taille (relative à la fenêtre)", () => {
    const largeur = (t: number) => {
      const els = imageSansVoixA(plan, t).elements;
      return els.find((e) => e.id === "s2/carte-1")!.rect.largeur / els.find((e) => e.id === "s2/fenetre")!.rect.largeur;
    };
    expect(Math.abs(largeur(16200) - largeur(14000)) / largeur(14000)).toBeLessThan(0.01);
  });
});

describe("QUAL-1 scènes (4:5)", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  const texte = (t: number) => visibles(imageSansVoixA(plan, t).elements).filter((e) => e.genre === "texte").map((e) => e.texte);
  const el = (p: PlanComposeSansVoix, t: number, id: string) => imageSansVoixA(p, t).elements.find((e) => e.id === id);

  it("la construction suit les événements", () => {
    expect(texte(2500)).toContain("Suivre ses stocks avec un tableau de bord simple");
    // Dès l'entrée de la fenêtre : titre, cartes avec leurs libellés et liste (vidéo sans voix) ; l'étiquette et l'historique attendent leur mot.
    expect(texte(8000)).toEqual(expect.arrayContaining(["Tableau de bord", "Articles en stock", "Passent sous le seuil", "Valeur totale", "Articles à commander"]));
    expect(texte(8000)).not.toContain("Par urgence");
    expect(texte(8000)).not.toContain("Historique");
    expect(texte(16000)).toEqual(expect.arrayContaining(["Articles en stock", "Passent sous le seuil", "Valeur totale"]));
    expect(texte(19000)).toContain("Articles à commander");
    expect(texte(21500)).toContain("Par urgence");
    expect(texte(28500)).toEqual(expect.arrayContaining(["Historique", "Entrées", "Sorties", "Date de la prochaine rupture prévue"]));
    expect(texte(33000)).toContain("Un article passe sous le seuil");
    expect(texte(33000)).toContain("Tableau de bord");
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
    for (const t of [20600, 20800, 21000]) {
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

  it("événements non chronologiques : une rubrique n'est jamais ALLUMÉE (noire) avant son panneau ; le panneau entre rempli (libellés grisés)", () => {
    const p = copie(plan);
    evDe(p, "panneau").rubriques[0].aMs = 20000;
    const pan = evDe(p, "panneau").aMs;
    for (const t of [21000, pan, pan + 150]) {
      const l = el(p, t, "s2/panneau/rubrique-1/libelle");
      expect(l === undefined || l.couleur !== "noir", `t=${t}`).toBe(true);
    }
    expect(el(p, pan + 1200, "s2/panneau/rubrique-1/libelle")!.opacite).toBeGreaterThan(0.9);
  });

  it("le panneau reste dans la fenêtre et prend ≥ 70 % de sa largeur (tour 12 : changement de plan)", () => {
    const els = imageSansVoixA(plan, 28000).elements;
    const fen = els.find((e) => e.id === "s2/fenetre")!;
    const pan = els.find((e) => e.id === "s2/panneau")!;
    expect(pan.rect.largeur).toBeGreaterThanOrEqual(0.7 * fen.rect.largeur);
    expect(dedans(pan.rect, fen.rect)).toBe(true);
  });

  it("repère : « une heure » apparaît à barreAMs et se barre aussitôt ; « une minute » à apresAMs ; l'ordre suit le temps", () => {
    const barre = (t: number) => el(plan, t, "s3/avant")?.barre ?? 0;
    const op = (p: PlanComposeSansVoix, t: number, id: string) => el(p, t, id)?.opacite ?? 0;
    // Fixture : apresAMs 35600 < barreAMs 36400 : « une minute » d'abord.
    expect(op(plan, 34100, "s3/apres")).toBeLessThan(0.05);
    expect(op(plan, 36000, "s3/apres")).toBeGreaterThan(0.9);
    expect(op(plan, 36200, "s3/avant")).toBeLessThan(0.05);
    expect(op(plan, 37000, "s3/avant")).toBeGreaterThan(0.9);
    expect(barre(36450)).toBeLessThan(0.3);
    expect(barre(37200)).toBe(1);
    expect(texte(35900)).toContain("une minute");
    expect(texte(35900)).not.toContain("une heure");
    // Ordre inverse : « une heure » (barrée) d'abord, puis « une minute ».
    const q = copie(plan);
    const r = q.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>;
    r.barreAMs = 35200;
    r.apresAMs = 36400;
    expect(op(q, 36000, "s3/avant")).toBeGreaterThan(0.9);
    expect(op(q, 36000, "s3/apres")).toBeLessThan(0.05);
    expect(op(q, 37200, "s3/apres")).toBeGreaterThan(0.9);
    expect((el(q, 36000, "s3/avant")!.barre ?? 0)).toBe(1);
  });

  it("surtitre et plan sans scène", () => {
    const p2: PlanComposeSansVoix = { ...plan, scenes: [{ ...(plan.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>), surTitre: "Tutoriel" }, ...plan.scenes.slice(1)] };
    expect(el(p2, 1500, "s1/sur-titre")!.taillePx).toBeGreaterThanOrEqual(36);
    const q = copie(p2);
    (q.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>).surTitre = "Vous perdez du temps à compter vos stocks à la main ?";
    const st = el(q, 2500, "s1/sur-titre")!;
    expect(st.taillePx).toBeGreaterThanOrEqual(36);
    expect(st.graisse).toBeLessThanOrEqual(600);
    expect(st.lignes!.length).toBeLessThanOrEqual(3);
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

  it("les cartes arrivent en cascade rapide avec leurs libellés (fenêtre construite en ≈ 1,5 s)", () => {
    const op = (t: number, k: number) => empreinte(t).get(`s2/carte-${k}`)!.opacite;
    // Fenêtre visible à 5000 + 130 ms ; cascade de 20 ms par carte, chacune monte en 170 ms.
    expect(op(5230, 3)).toBeLessThan(op(5230, 1) + 1e-9);
    expect(op(5230, 1)).toBeLessThan(op(6700, 1));
    expect(op(5140, 3)).toBeLessThan(0.3);
    expect(op(6700, 3)).toBeGreaterThan(0.9);
    const lib = (t: number) => ["1", "2", "3"].map((k) => empreinte(t).get(`s2/carte-${k}/libelle`)!.opacite);
    expect(Math.min(...lib(6900))).toBeGreaterThan(0.9);
    expect(empreinte(6900).get("s2/liste/titre")!.opacite).toBeGreaterThan(0.9);
    expect(empreinte(6900).get("s2/rang-4")!.opacite).toBeGreaterThan(0.5);
  });

  it("au mot « En haut » (focus cartes), la rangée de cartes s'illumine et le reste s'atténue ensemble", () => {
    const e = empreinte(9300);
    expect(e.get("s2/focus-cadre")!.opacite).toBeGreaterThan(0.5);
    const liste = e.get("s2/liste")!.opacite;
    const ligne = e.get("s2/rang-1")!.opacite;
    const fant = e.get("s2/rang-1/fantome-barre");
    expect(liste).toBeLessThan(0.8);
    expect(ligne).toBeLessThanOrEqual(liste + 1e-9);
    if (fant) expect(fant.opacite).toBeLessThanOrEqual(ligne + 1e-9);
    expect(e.get("s2/carte-1")!.opacite).toBeGreaterThan(liste);
  });

  it("focus panneau (28-29,2 s) : liste et cartes atténuées à 0,75 avec leurs enfants, aucun enfant ne flotte", () => {
    const e = empreinte(28750);
    expect(e.get("s2/focus-cadre")!.opacite).toBeGreaterThan(0.5);
    for (const [id, x] of e) {
      if (/^s2\/(carte-\d|liste|rang-\d)/.test(id) && !id.includes("focus")) {
        const parent = x.parentId ? e.get(x.parentId) : undefined;
        if (parent) expect(x.opacite, id).toBeLessThanOrEqual(parent.opacite + 1e-9);
      }
    }
    expect(e.get("s2/carte-2")!.opacite).toBeCloseTo(0.75, 1);
    expect(e.get("s2/liste")!.opacite).toBeCloseTo(0.75, 1);
    expect(e.get("s2/rang-1")!.opacite).toBeLessThanOrEqual(0.76); // la liste est repliée en bande : seule la ligne 1 reste
    expect(e.get("s2/panneau")!.opacite).toBeGreaterThan(0.95);
  });

  it("la mise en page reste STABLE : cartes en haut, liste dessous, historique à droite, rien ne saute pendant les focus", () => {
    // Positions relatives à la fenêtre (la caméra bouge tout le groupe d'un bloc).
    const y = (t: number, id: string) => {
      const els = imageSansVoixA(plan, t).elements;
      const r = els.find((e) => e.id === id)!.rect;
      const f = els.find((e) => e.id === "s2/fenetre")!.rect;
      const k = f.largeur / plan.format.largeur;
      return { ...r, y: (r.y - f.y) / k, x: (r.x - f.x) / k, largeur: r.largeur / k, hauteur: r.hauteur / k };
    };
    // (la tuile citée à 15 680 ms grandit : tour 12, testée à part)
    for (const id of ["s2/carte-1", "s2/liste"]) {
      const a = y(15500, id);
      for (const t of [16000, 16200, 17000]) expect(Math.abs(y(t, id).y - a.y), `${id} ${t}`).toBeLessThan(3);
    }
    const c = y(28750, "s2/carte-1");
    const l = y(28750, "s2/liste");
    const pn = y(28750, "s2/panneau");
    const f = y(28750, "s2/fenetre");
    expect(c.y).toBeLessThan(l.y);
    expect(pn.x).toBeGreaterThan(l.x + l.largeur - 1);
    expect(f.y + f.hauteur - (l.y + l.hauteur)).toBeLessThan(0.06 * f.hauteur);
    expect(Math.abs(y(28750, "s2/panneau").y - pn.y)).toBeLessThan(3);
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
    // LITTÉRALITÉ : la source de chaque texte (texteSource, sinon texte ; U+00A0 → espace) est une chaîne du plan, et les mots
    // affichés (césures recollées) sont les premiers mots de cette source, à une frontière de mot.
    const chaines = new Set<string>();
    const marche = (o: unknown) => {
      if (typeof o === "string") chaines.add(o);
      else if (Array.isArray(o)) o.forEach(marche);
      else if (o && typeof o === "object") Object.values(o).forEach(marche);
    };
    marche(plan.scenes);
    for (const t of [1500, 8000, 16000, 22000, 28500, 32000, 36500, 38800, 40500]) {
      for (const e of imageSansVoixA(plan, t).elements.filter((x) => x.genre === "texte")) {
        const source = (e.texteSource ?? e.texte!).split("\u00a0").join(" ");
        expect(chaines.has(source), `${e.id} source « ${source} »`).toBe(true);
        const mots: string[] = [];
        let coupe = "";
        for (const l of e.lignes!) for (const m of l.split(/[ \u00a0]+/).filter(Boolean)) {
          if (e.cesure && m.endsWith("-") && m.length > 3) coupe += m.slice(0, -1);
          else {
            mots.push(coupe + m);
            coupe = "";
          }
        }
        if (e.tronque) {
          const dernier = mots.pop()!;
          expect(dernier.endsWith("…"), `${e.id} fini par …`).toBe(true);
          const reste = dernier.slice(0, -1);
          expect(reste.length, `${e.id} jamais « … » seul`).toBeGreaterThan(0);
          expect(/[,;:.]$/.test(reste), `${e.id} pas de ponctuation avant …`).toBe(false);
          mots.push(reste);
        }
        const ref = source.split(/ +/).filter(Boolean);
        expect(mots.length, e.id).toBeGreaterThan(0);
        expect(mots.map((m) => m.replace(/[?!:;»,.]+$/, "")), e.id).toEqual(ref.slice(0, mots.length).map((m) => m.replace(/[?!:;»,.]+$/, "")));
      }
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

/* ------------------------------------------------------------------ */
/* Tour 4 : transitions, mouvement, construction, clic, toast, tiroir, remplissage, coupe de ligne, troncature */
/* ------------------------------------------------------------------ */

const texteVisible = (els: ElementVisible[], seuil: number) => els.filter((e) => e.genre === "texte" && e.opacite > seuil);
const sceneDe = (id: string) => id.split("/")[0];

describe.each(FORMATS)("QUAL-1 transitions sans texte superposé ($nom)", (f) => {
  const plan = planPour(f);
  it("entre deux scènes, jamais deux textes de scènes différentes à plus de 0,15 d'opacité", () => {
    for (const sc of plan.scenes.slice(1)) {
      for (let t = sc.debutMs - 100; t <= sc.debutMs + 900; t += 10) {
        const scenes = new Set(texteVisible(imageSansVoixA(plan, t).elements, 0.15).map((e) => sceneDe(e.id)));
        expect(scenes.size, `t=${t} ${[...scenes]}`).toBeLessThanOrEqual(1);
      }
    }
  });
  it("TOUS les passages : la sortante est à ≤ 0,15 au plus tard 150 ms après la frontière, l'entrante est lisible (textes ≥ 0,85) avant 350 ms, sans texte superposé", () => {
    const ids = plan.scenes.map((x) => x.id);
    for (let i = 1; i < plan.scenes.length; i++) {
      const b = plan.scenes[i].debutMs;
      const op = (t: number, scene: string) => Math.max(0, ...texteVisible(imageSansVoixA(plan, t).elements, 0).filter((e) => sceneDe(e.id) === scene).map((e) => e.opacite));
      expect(op(b + 150, ids[i - 1]), `sortante ${ids[i - 1]} à +150 ms`).toBeLessThanOrEqual(0.15);
      expect(op(b + 260, ids[i - 1]), `sortante ${ids[i - 1]} à +260 ms`).toBe(0);
      // Premier texte de l'entrante : à pleine lisibilité avant +350 ms.
      expect(op(b + 350, ids[i]), `entrante ${ids[i]} à +350 ms`).toBeGreaterThanOrEqual(0.85);
      // L'entrante ne montre aucun texte (> 0,02) tant que la sortante est à plus de 0,15.
      for (let t = b; t <= b + 400; t += 10) if (op(t, ids[i]) > 0.02) expect(op(t, ids[i - 1]), `t=${t - b} ms`).toBeLessThanOrEqual(0.15);
    }
  });
  it("tous les textes principaux d'une scène écran entrante (fenêtre, libellés des cartes, titre de liste, lignes) sont lisibles avant +350 ms", () => {
    const b = plan.scenes[1].debutMs;
    const e = imageSansVoixA(plan, b + 350).elements.filter((x) => x.genre === "texte" && sceneDe(x.id) === "s2" && /(fenetre\/titre|carte-\d\/libelle|liste\/titre)$/.test(x.id));
    expect(e.length).toBeGreaterThanOrEqual(5);
    for (const x of e) expect(x.opacite, x.id).toBeGreaterThanOrEqual(0.85);
  });
});

describe.each(FORMATS)("QUAL-1 mouvement continu et caméra ($nom)", (f) => {
  const plan = planPour(f);
  const mouvement = (t: number) => {
    const a = new Map(imageSansVoixA(plan, t).elements.map((e) => [e.id, e]));
    for (const e of imageSansVoixA(plan, t + 300).elements) {
      const o = a.get(e.id);
      if (!o) return true;
      if (Math.abs(e.rect.x - o.rect.x) > 0.5 || Math.abs(e.rect.y - o.rect.y) > 0.5 || Math.abs(e.rect.largeur - o.rect.largeur) > 0.5 || Math.abs(e.rect.hauteur - o.rect.hauteur) > 0.5 || Math.abs(e.opacite - o.opacite) > 0.01) return true;
    }
    return false;
  };
  it("deux images à 0,3 s d'écart diffèrent visiblement partout, sauf ≤ 10 % des instants", () => {
    const ts = instants(100, DUREE_STOCKS_MS - 300);
    const fixes = ts.filter((t) => !mouvement(t));
    expect(fixes.length / ts.length, `fixes: ${fixes.slice(0, 12)}`).toBeLessThanOrEqual(0.1);
  });
  it("caméra par zones (échelle 1 → ≤ 1,08), la fenêtre reste dans le contenu", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const base = 0.931 * z.largeur;
    let maxE = 0;
    let minE = 9;
    for (let t = 6000; t <= 33000; t += 250) {
      const fen = imageSansVoixA(plan, t).elements.find((e) => e.id === "s2/fenetre")!.rect;
      const e = fen.largeur / base;
      maxE = Math.max(maxE, e);
      minE = Math.min(minE, e);
      expect(dedans(fen, z), `t=${t}`).toBe(true);
    }
    expect(minE).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(maxE).toBeLessThanOrEqual(1.035 * 1.08 + 1e-6);
    expect(maxE).toBeGreaterThan(1.02);
  });
  it("la fenêtre occupe ≥ 95 % de la largeur et ≥ 90 % de la hauteur du contenu pendant la scène écran", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    for (let t = 5600; t <= 33900; t += 100) {
      const fen = imageSansVoixA(plan, t).elements.find((e) => e.id === "s2/fenetre")!.rect;
      // Tour 11 : 93 % (formats hauts, marge pour la caméra dirigée) ou 95 % (formats compacts) de la largeur.
      expect(fen.largeur / z.largeur, `t=${t}`).toBeGreaterThanOrEqual(0.93);
      expect(fen.hauteur / z.hauteur, `t=${t}`).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe("QUAL-1 construction et élément nouveau (4:5)", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  it("la fenêtre est construite en ≈ 1,5 s : cartes, libellés, titre et lignes de liste visibles", () => {
    const els = imageSansVoixA(plan, 5000 + 1700).elements;
    const op = (id: string) => els.find((e) => e.id === id)!.opacite;
    for (const id of ["s2/fenetre", "s2/carte-1", "s2/carte-2", "s2/carte-3", "s2/carte-3/libelle", "s2/liste", "s2/liste/titre"]) expect(op(id), id).toBeGreaterThan(0.9);
    for (const id of ["s2/rang-1", "s2/rang-4"]) expect(op(id), id).toBeGreaterThan(0.7);
  });
  it("jamais plus de 1,5 s sans élément nouveau pendant la scène écran", () => {
    const vu = new Map<string, number>();
    for (let t = 5000; t <= 34000; t += 50) {
      for (const e of imageSansVoixA(plan, t).elements) if (e.id.startsWith("s2/") && e.opacite >= 0.12 && !vu.has(e.id)) vu.set(e.id, t);
    }
    const nouveaux = [...new Set(vu.values())].sort((a, b) => a - b).filter((t) => t >= 6500);
    const bornes = [6500, ...nouveaux, 34000];
    for (let i = 0; i + 1 < bornes.length; i++) expect(bornes[i + 1] - bornes[i], `entre ${bornes[i]} et ${bornes[i + 1]}`).toBeLessThanOrEqual(1500);
  });
  it("chaque carte s'illumine au mot : contour terracotta + barre qui pousse", () => {
    const el = (t: number, id: string) => imageSansVoixA(plan, t).elements.find((e) => e.id === id);
    expect(el(9900, "s2/carte-1/allume")).toBeUndefined();
    expect(el(10600, "s2/carte-1/allume")!.opacite).toBeGreaterThan(0.9);
    expect(el(10600, "s2/carte-1/allume")!.contour).toBe("terracotta");
    expect(el(12000, "s2/carte-2/allume")).toBeUndefined();
    const b = (t: number) => el(t, "s2/carte-1/valeur")!.rect.largeur;
    expect(b(10300)).toBeGreaterThan(b(10150) + 5);
    expect(b(11500)).toBeGreaterThan(b(10300));
  });
});

describe.each(FORMATS)("QUAL-1 clic, toast, tiroir et remplissage ($nom)", (f) => {
  const plan = planPour(f);
  const planReel = planPour(f, PLAN_SANS_VOIX_REEL);
  const els = (t: number, p = plan) => imageSansVoixA(p, t).elements;
  const dansPt = (p: { x: number; y: number }, r: RectPx) => p.x >= r.x && p.x <= r.x + r.largeur && p.y >= r.y && p.y <= r.y + r.hauteur;

  it("clic de la liste : trajet visible ≥ 1 s en arc, la ligne s'enfonce (0,97 pendant ≥ 300 ms avant l'ouverture de l'historique), pointe sur la ligne", () => {
    const tc = 23000;
    const cur = (t: number) => els(t).find((e) => e.genre === "curseur");
    expect(cur(tc - 800)!.opacite).toBeGreaterThan(0.5);
    expect(cur(tc - 1000)).toBeUndefined();
    const pts = [-850, -650, -450, -250, 0].map((d) => cur(tc + d)!.pointe!);
    // Tour 10 : le curseur apparaît ≤ 1 s avant le clic et part à ≤ 300 px de sa cible.
    expect(Math.hypot(pts[0].x - pts[4].x, pts[0].y - pts[4].y), "départ proche de la cible").toBeLessThanOrEqual(300 * echelleFormat(plan.format));
    for (let i = 1; i < pts.length; i++) expect(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y), `étape ${i}`).toBeGreaterThan(8);
    const cible = (t: number) => els(t).find((e) => e.id === "s2/ligne-1")!.rect;
    expect(dansPt(cur(tc)!.pointe!, cible(tc))).toBe(true);
    expect(dansPt(cur(tc + 800)!.pointe!, cible(tc + 800))).toBe(true);
    expect(cur(tc + 100)!.anneauClic).toBeGreaterThan(0);
    const larg = (t: number) => els(t).find((e) => e.id === "s2/rang-1")!.rect.largeur / els(t).find((e) => e.id === "s2/fenetre")!.rect.largeur;
    expect(larg(tc + 100) / larg(tc - 300)).toBeCloseTo(0.97, 2);
    // L'appui tient ≥ 300 ms (0,97) AVANT que l'historique ne s'ouvre ; l'anneau terracotta est pleinement visible dès tc + 250.
    expect(larg(tc + 100) / larg(tc + 520)).toBeCloseTo(0.97, 2);
    expect(larg(tc + 340) / larg(tc - 300)).toBeCloseTo(0.97, 2);
    expect(larg(tc + 520) / larg(tc - 300)).toBeCloseTo(1, 2);
    for (const t of [tc + 250, tc + 400, tc + 550]) expect(els(t).find((e) => e.id === "s2/ligne-1/allume")!.opacite, `anneau t=${t}`).toBeGreaterThan(0.9);
    const ouvert = (t: number) => els(t).find((e) => e.id === "s2/panneau")?.opacite ?? 0;
    expect(ouvert(tc + 450)).toBeLessThan(0.02);
    expect(ouvert(tc + 1200)).toBeGreaterThan(0.5);
    expect(els(tc + 100).find((e) => e.id === "s2/ligne-1/allume")!.contour).toBe("terracotta");
    expect(els(tc + 100).find((e) => e.id === "s2/ligne-1/allume-fond")!.remplissage).toBe("terracotta");
    const curseur = cur(tc)!;
    expect(curseur.rect.hauteur / curseur.rect.largeur).toBeCloseTo(50 / 34, 2);
  });

  it("appel final : pointe dans le bas-centre du bouton (≥ 12 px des bords, hors du texte), survol 300 ms avant, enfoncé (0,96) puis il respire", () => {
    const tc = 39500; // clic à ≈ début de scène + 1,5 s (tour 8)
    const sc = echelleFormat(plan.format);
    // Tour 10 : le curseur s'efface ≤ 400 ms après le clic.
    expect(els(tc + 450).find((x) => x.genre === "curseur")).toBeUndefined();
    for (const t of [tc, tc + 100, tc + 250]) {
      const e = els(t);
      const bouton = e.find((x) => x.id === "s4/bouton")!;
      const texte = e.find((x) => x.id === "s4/bouton/texte")!;
      const pointe = e.find((x) => x.genre === "curseur")!.pointe!;
      const r = bouton.rect;
      expect(dansPt(pointe, r), `pointe dans le bouton t=${t}`).toBe(true);
      expect(dansPt(pointe, texte.rect), `pointe hors du texte t=${t}`).toBe(false);
      expect(pointe.y, `sous le texte t=${t}`).toBeGreaterThan(texte.rect.y + texte.rect.hauteur);
      expect(r.y + r.hauteur - pointe.y, `bas t=${t}`).toBeGreaterThanOrEqual(12 * sc);
      expect(Math.min(pointe.x - r.x, r.x + r.largeur - pointe.x), `côtés t=${t}`).toBeGreaterThanOrEqual(12 * sc);
      expect(Math.abs(pointe.x - (r.x + r.largeur / 2)), `centre t=${t}`).toBeLessThan(4 * sc);
      expect(texte.taillePx!).toBeGreaterThanOrEqual(46 * sc);
    }
    // Survol : un voile blanc léger (bouton plus clair) entre tc-300 et le clic, absent avant.
    const voile = (t: number) => els(t).find((x) => x.id === "s4/bouton/survol")?.opacite ?? 0;
    expect(voile(tc - 600)).toBe(0);
    expect(voile(tc - 100)).toBeGreaterThan(0.03);
    expect(voile(tc - 100)).toBeLessThan(0.15);
    // Appui : 0,96 puis il reste enfoncé et respire entre 0,96 et 0,975 ; anneau terracotta au clic.
    const rapport = (t: number) => els(t).find((x) => x.id === "s4/bouton")!.rect.largeur / els(t).find((x) => x.id === "s4/question")!.rect.largeur;
    expect(rapport(tc + 300) / rapport(tc - 200)).toBeLessThan(0.97);
    expect(rapport(tc + 300) / rapport(tc - 200)).toBeGreaterThan(0.94);
    for (const t of [tc + 1000, tc + 1500]) expect(rapport(t) / rapport(tc - 200), `t=${t}`).toBeLessThan(0.98);
    expect(els(tc + 150).find((x) => x.id === "s4/anneau")!.contour).toBe("terracotta");
    expect(els(tc + 50).find((x) => x.genre === "curseur")!.anneauClic).toBeGreaterThan(0);
    // Le curseur apparaît au plus 1,2 s avant le clic et BOUGE sans arrêt jusqu'au clic.
    const cur = (t: number) => els(t).find((x) => x.genre === "curseur");
    expect(cur(tc - 1300)).toBeUndefined();
    expect(cur(tc - 600)!.opacite).toBeGreaterThan(0.9);
    for (let t = tc - 1050; t < tc; t += 40) {
      const a = cur(t)!.pointe!;
      const b = cur(t + 40)!.pointe!;
      expect(Math.hypot(a.x - b.x, a.y - b.y), `mouvement t=${t}`).toBeGreaterThan(1.5);
    }
  });

  it("le groupe question + bouton + marque + site est centré (centre optique, un peu au-dessus du milieu) et occupe ≥ 70 % du contenu en portrait", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const s = echelleFormat(plan.format);
    const e = els(41300);
    const q = e.find((x) => x.id === "s4/question")!;
    const si = e.find((x) => x.id === "s4/site")!;
    if (f.nom === "4:5" || f.nom === "9:16") expect(q.lignes!.length).toBe(2);
    const haut = q.rect.y;
    const bas = si.rect.y + si.rect.hauteur;
    // Mesuré hors caméra (échelle ≤ 1,035 autour du centre du contenu) : tolérance de 40 px.
    expect(Math.abs((haut + bas) / 2 - (z.y + 0.47 * z.hauteur))).toBeLessThan(40 * s);
    expect((bas - haut) / z.hauteur, "occupation de la hauteur").toBeGreaterThanOrEqual(f.nom === "4:5" || f.nom === "9:16" ? 0.7 : 0.55);
    // Sans marque ni site (plan réel) : question + bouton restent centrés.
    const sans = copie(plan);
    delete (sans.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>).marque;
    delete (sans.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>).site;
    const e2 = els(40000, sans);
    const b2 = e2.find((x) => x.id === "s4/bouton")!;
    const q2 = e2.find((x) => x.id === "s4/question")!;
    expect(Math.abs((q2.rect.y + b2.rect.y + b2.rect.hauteur) / 2 - (z.y + 0.47 * z.hauteur))).toBeLessThan(40 * s);
  });

  it("fin : marque (ExtraBold noir ≥ 56 px) entre le bouton et le site, filet terracotta dessous, site noir ≥ 40 px, visibles DÈS L'ENTRÉE de la scène (avant le clic)", () => {
    const s = echelleFormat(plan.format);
    // Tour 8 : marque et site sont là DÈS L'ENTRÉE de la scène (≤ 600 ms après le début), avant le clic.
    const av = els(38000 + 600);
    for (const id of ["s4/marque", "s4/site"]) expect(av.find((x) => x.id === id)?.opacite ?? 0, `${id} avant le clic`).toBeGreaterThan(0.5);
    const e = els(41350);
    const b = e.find((x) => x.id === "s4/bouton")!;
    const m = e.find((x) => x.id === "s4/marque")!;
    const fl = e.find((x) => x.id === "s4/marque/filet")!;
    const si = e.find((x) => x.id === "s4/site")!;
    expect(m.texte).toBe("Axion IA");
    expect(m.graisse).toBe(800);
    expect(m.couleur).toBe("noir");
    expect(m.taillePx!).toBeGreaterThanOrEqual((f.nom === "1:1" || f.nom === "16:9" ? 56 : 72) * s * 0.99);
    expect(m.opacite).toBeGreaterThan(0.95);
    expect(m.rect.y).toBeGreaterThan(b.rect.y + b.rect.hauteur);
    expect(fl.remplissage).toBe("terracotta");
    expect(fl.rect.y).toBeGreaterThanOrEqual(m.rect.y + m.rect.hauteur - 1e-6);
    expect(fl.rect.largeur).toBeGreaterThan(60 * s);
    expect(si.texte).toBe("axion-ia.com");
    expect(si.couleur).toBe("noir");
    expect(si.taillePx!).toBeGreaterThanOrEqual(40 * s * 0.99);
    expect(si.rect.y).toBeGreaterThanOrEqual(fl.rect.y + fl.rect.hauteur - 1e-6);
  });

  it("fin : le curseur entre à pleine opacité par le bord du contenu et file droit vers le bas-centre du bouton, sans fantôme", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const s = echelleFormat(plan.format);
    const tc = 39500; // clic à ≈ début de scène + 1,5 s (tour 8)
    let premier: ElementVisible | undefined;
    for (let t = 37900; t <= tc; t += 20) {
      const c = els(t).find((x) => x.genre === "curseur");
      if (!c || c.opacite < 0.001) continue;
      premier ??= c;
      expect(c.opacite, `opacité t=${t}`).toBeGreaterThan(0.999);
    }
    expect(premier, "curseur visible avant le clic").toBeDefined();
    // Au premier instant : à ≤ 100 px du bord droit du contenu (jamais au milieu du vide).
    const reste = z.x + z.largeur - (premier!.pointe!.x + premier!.rect.largeur);
    expect(reste).toBeLessThan(100 * s);
    expect(reste).toBeGreaterThanOrEqual(0);
    // Trajet droit : les points du trajet restent alignés (écart à la droite départ-arrivée ≤ 8 px).
    const pts: { x: number; y: number }[] = [];
    for (let t = tc - 1000; t <= tc; t += 50) {
      const e = els(t);
      const c = e.find((x) => x.genre === "curseur");
      const bt = e.find((x) => x.id === "s4/bouton")!.rect;
      // Relatif au bouton : la caméra (dérive lente) n'entre pas dans la mesure.
      if (c && c.opacite > 0.99) pts.push({ x: c.pointe!.x - bt.x, y: c.pointe!.y - bt.y });
    }
    const a = pts[0];
    const b = pts[pts.length - 1];
    for (const p of pts) {
      const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);
      expect(d, "droit").toBeLessThan(8 * s);
    }
    // Appui visible : 0,96 et anneau.
    const f0 = els(tc - 400).find((x) => x.id === "s4/bouton")!.rect.largeur;
    const f1 = els(tc + 300).find((x) => x.id === "s4/bouton")!.rect.largeur;
    expect(f1 / f0).toBeLessThan(0.975);
    expect(els(tc + 150).find((x) => x.id === "s4/anneau-pointe")).toBeDefined();
  });

  it("alerte en deux temps : condition montrée dès aMs, toast au déclencheur puis fixe jusqu'à la sortie ; le titre ne disparaît jamais", () => {
    for (const [nom, p, t0, fin, decl] of [["fixture", plan, 30000, 34000, 32400], ["réel", planReel, 28928, 33803, 32085]] as const) {
      let vu = 0;
      for (let t = t0; t <= fin + 240; t += 20) {
        const e = els(t, p);
        const barre = e.find((x) => x.id === "s2/fenetre")!;
        // La barre n'est JAMAIS vide : le titre reste lisible (opacité pleine) pendant toute la scène écran.
        const titre = e.find((x) => x.id === "s2/fenetre/titre")!;
        if (t <= fin) expect(titre.opacite, `${nom} titre t=${t}`).toBeGreaterThan(0.95);
        const boite = e.find((x) => x.id === "s2/alerte" && x.opacite > 0.05);
        if (t < decl - 30) expect(boite, `${nom} pas de toast avant le déclencheur t=${t}`).toBeUndefined();
        if (t >= decl + 460 && t <= fin) {
          expect(boite, `${nom} toast présent t=${t}`).toBeDefined();
          expect(boite!.opacite, `${nom} toast plein t=${t}`).toBeGreaterThan(0.99);
          expect(e.find((x) => x.id === "s2/alerte/texte")!.opacite).toBeGreaterThan(0.99);
        }
        if (!boite) continue;
        vu++;
        const autres = e.filter((x) => x.genre === "texte" && x.opacite > 0.05 && !x.id.startsWith("s2/alerte"));
        for (const o of autres) expect(inter(boite.rect, o.rect), `${nom} t=${t} ${o.id}`).toBe(false);
        for (const x of e.filter((y) => y.id.startsWith("s2/alerte/"))) expect(dedans(x.rect, boite.rect, 1e-6), `${nom} t=${t} ${x.id}`).toBe(true);
        const filet = e.find((x) => x.id === "s2/fenetre/filet")!.rect;
        expect(boite.rect.y + boite.rect.hauteur, `${nom} t=${t} dans la barre`).toBeLessThanOrEqual(filet.y + 1e-6);
        expect(boite.rect.y).toBeGreaterThanOrEqual(barre.rect.y - 20);
      }
      expect(vu, nom).toBeGreaterThan(20);
      // Depuis aMs : la carte pulse et la ligne la plus URGENTE (rang 1, en haut après le tri) vire au terracotta.
      const e = els(t0 + 600, p);
      expect(e.find((x) => x.id === "s2/pulse-carte")!.contour).toBe("terracotta");
      expect(e.find((x) => x.id === "s2/pulse-carte")!.opacite).toBeGreaterThan(0.5);
      const fond = e.filter((x) => /^s2\/rang-\d+\/alerte-fond$/.test(x.id));
      expect(fond).toHaveLength(1);
      expect(fond[0].remplissage).toBe("terracotta");
      expect(fond[0].id, `${nom} la ligne en alerte est la plus urgente`).toBe("s2/rang-1/alerte-fond");
      const haut = e.filter((x) => /^s2\/rang-\d+$/.test(x.id)).sort((a, b) => a.rect.y - b.rect.y)[0];
      expect(haut.id, `${nom} rang 1 en haut de la liste`).toBe("s2/rang-1");
    }
    const e = els(33700, planReel);
    expect(e.find((x) => x.id === "s2/alerte")!.ombre).toBe(true);
    expect(e.find((x) => x.id === "s2/alerte/texte")!.taillePx!).toBeGreaterThanOrEqual(40 * echelleFormat(plan.format) * 0.99);
    for (const k of [1, 2, 3]) expect(e.find((x) => x.id === `s2/carte-${k}/libelle`)!.opacite, `carte ${k}`).toBeGreaterThan(0.7);
    // Le toast part avec l'écran : à 0,3 s de la fin il est encore plein, il s'efface seulement avec toute la scène.
    expect(els(33800 - 100, planReel).find((x) => x.id === "s2/alerte")!.opacite).toBeGreaterThan(0.99);
  });

  it("déclencheurAMs fourni : le toast part là ; alerte tardive : le titre reste, le toast reste lisible jusqu'à la sortie", () => {
    const p = copie(plan);
    evDe(p, "alerte").declencheurAMs = 31000;
    expect(els(30900, p).find((x) => x.id === "s2/alerte")).toBeUndefined();
    expect(els(31600, p).find((x) => x.id === "s2/alerte")!.opacite).toBeGreaterThan(0.99);
    const q = copie(plan);
    evDe(q, "alerte").aMs = 33500;
    for (let t = 33000; t <= 33990; t += 20) {
      const e = els(t, q);
      expect(e.find((x) => x.id === "s2/fenetre/titre")!.opacite, `titre t=${t}`).toBeGreaterThan(0.95);
    }
    expect(els(33900, q).find((x) => x.id === "s2/alerte")!.opacite).toBeGreaterThan(0.99);
  });

  it("pastille du toast : jambage du « p » dans la pastille (marge ≥ 0,3 × la taille au-dessus et au-dessous)", () => {
    for (const p of [plan, planReel]) {
      const e = els(p === plan ? 33500 : 33700, p);
      const boite = e.find((x) => x.id === "s2/alerte")!;
      const t = e.find((x) => x.id === "s2/alerte/texte")!;
      const taille = t.taillePx!;
      expect(t.rect.y - boite.rect.y, "haut").toBeGreaterThanOrEqual(0.3 * taille);
      expect(boite.rect.y + boite.rect.hauteur - (t.rect.y + t.rect.hauteur), "bas").toBeGreaterThanOrEqual(0.3 * taille);
      expect(t.rect.y + t.rect.hauteur + 0.25 * taille).toBeLessThanOrEqual(boite.rect.y + boite.rect.hauteur);
    }
  });

  it("transition écran → repère : tout l'écran, toast compris, est à ≤ 0,15 avant que le moindre texte du repère n'apparaisse", () => {
    for (const p of [plan, planReel]) {
      const fin = p.scenes[1].finMs;
      for (let t = fin - 200; t <= fin + 900; t += 10) {
        const e = els(t, p);
        const suivant = e.filter((x) => x.id.startsWith("s3/") && x.genre === "texte" && x.opacite > 0.02);
        const ecran = e.filter((x) => x.id.startsWith("s2/"));
        if (suivant.length) expect(Math.max(0, ...ecran.map((x) => x.opacite)), `t=${t}`).toBeLessThanOrEqual(0.15);
      }
      expect(Math.max(0, ...els(fin + 250, p).filter((x) => x.id.startsWith("s2/")).map((x) => x.opacite))).toBe(0);
    }
  });

  it("Historique : le panneau glisse depuis la droite (≥ 60 px), mini-barres qui poussent, rubriques ≥ 40 px", () => {
    const s = echelleFormat(plan.format);
    const pos = (t: number) => {
      const e = els(t);
      const fen = e.find((x) => x.id === "s2/fenetre")!.rect;
      const k = fen.largeur / (0.951 * zonesSansVoix(plan.format, plan.basPct).contenu.largeur);
      return (e.find((x) => x.id === "s2/panneau")!.rect.x - fen.x) / k;
    };
    expect(pos(23600) - pos(24400)).toBeGreaterThanOrEqual(60 * s - 1);
    expect(pos(24400)).toBeLessThanOrEqual(pos(25000) + 1);
    const haut = (t: number) => Math.max(0, ...els(t).filter((x) => /rubrique-1\/colonne-\d$/.test(x.id)).map((x) => x.rect.hauteur));
    // Mini-histogrammes : ≥ 26 px de haut (colonne la plus haute) ou absents (formats trop courts : les libellés gardent ≥ 36 px).
    if (haut(28500) > 0) {
      expect(haut(28500)).toBeGreaterThan(haut(25300) + 10 * s);
      expect(haut(28500)).toBeGreaterThanOrEqual(26 * s);
    } else expect(f.nom).toBe("1:1");
    const rub = els(28500).filter((x) => /rubrique-\d\/libelle$/.test(x.id));
    expect(rub).toHaveLength(3);
    for (const r of rub) expect(r.taillePx!, r.id).toBeGreaterThanOrEqual((f.nom === "1:1" || f.nom === "16:9" ? 36 : 40) * s * 0.99);
  });

  it("textes agrandis : libellés de carte ~42 px, titre de liste 44 px, « Par urgence » ≥ 36 px", () => {
    const s = echelleFormat(plan.format);
    const e = els(22000);
    const lib = e.filter((x) => /carte-\d\/libelle$/.test(x.id));
    expect(lib).toHaveLength(3);
    const compact = f.nom === "1:1" || f.nom === "16:9";
    for (const x of lib) expect(x.taillePx!, x.id).toBeGreaterThanOrEqual((compact ? 38 : 40) * s);
    expect(e.find((x) => x.id === "s2/liste/titre")!.taillePx!).toBeGreaterThanOrEqual((compact ? 40 : 44) * s * 0.99);
    expect(e.find((x) => x.id === "s2/liste/etiquette/texte")!.taillePx!).toBeGreaterThanOrEqual(36 * s * 0.99);
  });

  it("repère : carte avant / après ≥ 70 % du contenu, horloge ≥ 160 px dont l'aiguille tourne, 88 px barré puis 120 px noir", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const s = echelleFormat(plan.format);
    const e = els(37500);
    const carte = e.find((x) => x.id === "s3/carte")!.rect;
    expect(carte.largeur / z.largeur).toBeGreaterThanOrEqual(0.7);
    expect(carte.hauteur / z.hauteur).toBeGreaterThanOrEqual(0.7);
    const h = e.find((x) => x.id === "s3/carte/horloge")!;
    expect(h.rect.largeur).toBeGreaterThanOrEqual(160 * s);
    const tour = (t: number) => els(t).find((x) => x.id === "s3/carte/horloge")!.progression!;
    expect(Math.abs(tour(36500) - tour(36000))).toBeGreaterThan(0.012);
    const av = e.find((x) => x.id === "s3/avant")!;
    const ap = e.find((x) => x.id === "s3/apres")!;
    expect(av.taillePx!).toBeGreaterThanOrEqual(80 * s);
    expect(ap.taillePx!).toBeGreaterThanOrEqual(110 * s);
    // Le contenu (horloge → filet) occupe ≥ 75 % de la hauteur de la carte et y est centré verticalement.
    const fl = e.find((x) => x.id === "s3/carte/filet")!.rect;
    const haut = h.rect.y;
    const bas = fl.y + fl.hauteur;
    expect((bas - haut) / carte.hauteur, "occupation de la carte").toBeGreaterThanOrEqual(0.75);
    expect(Math.abs((haut + bas) / 2 - (carte.y + carte.hauteur / 2))).toBeLessThan(20 * s);
    expect(ap.graisse).toBe(800);
    expect(ap.couleur).toBe("noir");
    expect(av.barre).toBe(1);
    expect(e.find((x) => x.id === "s3/carte/filet")!.remplissage).toBe("terracotta");
  });

  it("focus des cartes : le cadre terracotta englobe les cartes avec ≥ 6 px de marge", () => {
    const e = els(9600);
    const cadre = e.find((x) => x.id === "s2/focus-cadre")!.rect;
    for (const k of [1, 2, 3]) {
      const c = e.find((x) => x.id === `s2/carte-${k}`)!.rect;
      expect(c.x - cadre.x, `gauche ${k}`).toBeGreaterThanOrEqual(6);
      expect(c.y - cadre.y, `haut ${k}`).toBeGreaterThanOrEqual(6);
      expect(cadre.x + cadre.largeur - (c.x + c.largeur), `droite ${k}`).toBeGreaterThanOrEqual(6);
      expect(cadre.y + cadre.hauteur - (c.y + c.hauteur), `bas ${k}`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe.each(FORMATS)("QUAL-1 coupe de ligne ($nom)", (f) => {
  const plan = planPour(f);
  const PONCT = /^[  ]*[?!:;»…]/;
  it("« Vous voulez le même / pour votre entreprise ? » : 2 lignes équilibrées, « ? » attaché au mot précédent", () => {
    const q = imageSansVoixA(plan, 40000).elements.find((e) => e.id === "s4/question")!;
    // En largeur (16:9) la question tient sur une ligne ; ailleurs elle se coupe en deux lignes équilibrées.
    expect(q.lignes).toEqual(f.nom === "16:9" ? ["Vous voulez le même pour votre entreprise ?"] : ["Vous voulez le même", "pour votre entreprise ?"]);
  });
  it("aucune ligne de texte ne commence par une ponctuation haute, partout et à tout instant", () => {
    const p = copie(plan);
    (p.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>).surTitre = "Vous perdez du temps à compter vos stocks à la main ? Voici : le tableau !";
    for (const t of instants(500)) for (const e of imageSansVoixA(p, t).elements) if (e.genre === "texte") for (const l of e.lignes!) expect(PONCT.test(l), `${e.id} « ${l} »`).toBe(false);
  });
  it("une phrase longue avec « ? » final n'a jamais le point seul sur sa ligne ni un seul mot court en dernière ligne", () => {
    for (const phrase of ["Voulez-vous vraiment suivre tous vos stocks avec un tableau de bord simple et clair ?", "Prêt à gagner du temps dès demain ?", "Un article passe sous le seuil : que faire ?"]) {
      const p = copie(plan);
      (p.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>).question = phrase;
      const q = imageSansVoixA(p, 40000).elements.find((e) => e.id === "s4/question")!;
      const l = q.lignes!;
      for (const x of l) expect(PONCT.test(x), x).toBe(false);
      if (l.length > 1) expect(l[l.length - 1].split(/[  ]/).filter(Boolean).length, l.join("|")).toBeGreaterThan(1);
    }
  });
});

describe.each(FORMATS)("QUAL-1 texte sans coupe de mot ($nom)", (f) => {
  const libelle = (txt: string) => {
    const p = copie(PLAN_SANS_VOIX_STOCKS);
    evDe(p, "cartes-chiffres").cartes[1].libelle = txt;
    return imageSansVoixA(planPour(f, p), 16000).elements.find((e) => e.id === "s2/carte-2/libelle")!;
  };
  it("« Taux de transformation » ne se coupe pas : la disposition s'adapte (cartes en lignes pleine largeur)", () => {
    const e = libelle("Taux de transformation");
    expect(e.tronque).toBeUndefined();
    expect(e.lignes!.join(" ")).toBe("Taux de transformation");
    expect(e.lignes!.some((l) => l.endsWith("-"))).toBe(false);
    expect(e.taillePx!).toBeGreaterThanOrEqual(32);
  });
  it("un libellé trop long est raccourci À UNE FRONTIÈRE DE MOT, signalé (tronque + texteSource), jamais au milieu d'un mot", () => {
    const source = "Articles internationaux à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts de la région et des filiales étrangères associées";
    const e = libelle(source);
    expect(e.tronque).toBe(true);
    expect(e.texteSource).toBe(source);
    const affiche = e.lignes!.join(" ");
    expect(affiche.endsWith("…")).toBe(true);
    const mots = affiche.slice(0, -1).split(" ").filter(Boolean);
    expect(mots).toEqual(source.split(" ").slice(0, mots.length));
  });
  it("un mot très long est coupé par un trait d'union avec ≥ 3 lettres de chaque côté", () => {
    const e = libelle("Anticonstitutionnellementdessinterlocuteurs");
    const l = e.lignes!;
    for (const x of l.filter((y) => y.endsWith("-"))) expect(x.replace(/-$/, "").length).toBeGreaterThanOrEqual(3);
    expect(l.length).toBeLessThanOrEqual(2);
  });
});

describe.each(FORMATS)("QUAL-1 rubriques de l'historique qui tiennent ($nom)", (f) => {
  const rubriques = (libelles: string[]) => {
    const p = copie(PLAN_SANS_VOIX_STOCKS);
    const pan = evDe(p, "panneau");
    pan.rubriques = libelles.map((libelle, k) => ({ libelle, aMs: 24500 + k * 700, source: { premier: 63, dernier: 63 } }));
    return planPour(f, p);
  };
  const LONG2 = ["Date de la prochaine rupture prévue", "Quantité entrée depuis le dernier inventaire complet", "Quantité sortie depuis la dernière commande reçue"];
  const SIX = ["Entrées", "Sorties", "Date de la prochaine rupture prévue", "Fournisseur habituel", "Dernier prix d'achat", "Niveau de stock minimal"];
  for (const [nom, libs] of [["3 libellés sur 2 lignes", LONG2], ["6 rubriques", SIX]] as const) {
    it(`${nom} : tout reste dans le panneau et dans le contenu`, () => {
      const plan = rubriques([...libs]);
      const pb: string[] = [];
      for (let t = 22000; t <= 34000; t += 100) pb.push(...problemes(plan, t));
      expect(pb.slice(0, 8)).toEqual([]);
      const e = imageSansVoixA(plan, 31000).elements;
      const lib = e.filter((x) => /panneau\/rubrique-\d\/libelle$/.test(x.id));
      expect(lib.length).toBeGreaterThanOrEqual(1);
      for (const x of lib) expect(x.lignes!.length, x.id).toBeLessThanOrEqual(2);
      const pan = e.find((x) => x.id === "s2/panneau")!.rect;
      for (const x of e.filter((y) => y.id.startsWith("s2/panneau/"))) expect(dedans(x.rect, pan), x.id).toBe(true);
      // Mini-graphiques : lisibles (≥ 24 px de haut) ou absents, jamais des tirets.
      const cols = e.filter((x) => /rubrique-\d\/colonne-\d$/.test(x.id) && x.rect.hauteur > 0.5);
      if (cols.length) expect(Math.max(...cols.map((c) => c.rect.hauteur))).toBeGreaterThanOrEqual(24 * echelleFormat(plan.format) * 0.6);
    });
  }
});

/* ------------------------------------------------------------------ */
/* Tour 5 : jamais plus de 1,5 s sans élément nouveau, dans TOUS les formats et sur les textes longs                      */
/* ------------------------------------------------------------------ */

function ecartsSansNouveau(plan: PlanComposeSansVoix, debut: number, fin: number): { ecart: number; entre: string }[] {
  const vu = new Map<string, number>();
  for (let t = debut - 1500; t <= fin; t += 50) {
    for (const e of imageSansVoixA(plan, t).elements) if (e.id.startsWith("s2/") && e.opacite >= 0.12 && !vu.has(e.id)) vu.set(e.id, t);
  }
  const nouveaux = [...new Set(vu.values())].sort((a, b) => a - b).filter((t) => t >= debut);
  const bornes = [debut, ...nouveaux, fin];
  const r: { ecart: number; entre: string }[] = [];
  for (let i = 0; i + 1 < bornes.length; i++) r.push({ ecart: bornes[i + 1] - bornes[i], entre: `${bornes[i]}-${bornes[i + 1]}` });
  return r;
}

describe.each(FORMATS)("QUAL-1 jamais plus de 1,5 s sans élément nouveau ($nom)", (f) => {
  const LONG = "Articles internationaux à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts";
  it("fixture et plan réel", () => {
    for (const base of [PLAN_SANS_VOIX_STOCKS, PLAN_SANS_VOIX_REEL]) {
      const p = planPour(f, base);
      const sc = p.scenes[1];
      const pire = ecartsSansNouveau(p, sc.debutMs + 1500, sc.finMs).sort((a, b) => b.ecart - a.ecart)[0];
      expect(pire.ecart, pire.entre).toBeLessThanOrEqual(1500);
    }
  });
  it("plan à libellés longs", () => {
    const q = copie(PLAN_SANS_VOIX_STOCKS);
    const cs = evDe(q, "cartes-chiffres");
    cs.cartes[1].libelle = LONG;
    cs.cartes[2].libelle = "Taux de transformation";
    evDe(q, "liste").titre = LONG;
    const p = planPour(f, q);
    const sc = p.scenes[1];
    const pire = ecartsSansNouveau(p, sc.debutMs + 1500, sc.finMs).sort((a, b) => b.ecart - a.ecart)[0];
    expect(pire.ecart, pire.entre).toBeLessThanOrEqual(1500);
  });
  it("6 rubriques : seules les rubriques montrées comptent comme jalons", () => {
    const q = copie(PLAN_SANS_VOIX_STOCKS);
    evDe(q, "panneau").rubriques = ["Entrées", "Sorties", "Date de la prochaine rupture prévue", "Fournisseur habituel", "Dernier prix d'achat", "Niveau de stock minimal"].map((libelle, k) => ({ libelle, aMs: 25200 + k * 800, source: { premier: 63, dernier: 63 } }));
    const p = planPour(f, q);
    const sc = p.scenes[1];
    const pire = ecartsSansNouveau(p, sc.debutMs + 1500, sc.finMs).sort((a, b) => b.ecart - a.ecart)[0];
    expect(pire.ecart, pire.entre).toBeLessThanOrEqual(1500);
  });
});

/* ------------------------------------------------------------------ */
/* Tour 5 : contraste des états atténués, titre, repère, appel long, curseur, césure, coût                                */
/* ------------------------------------------------------------------ */

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const melange = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [0, 1, 2].map((i) => a[i] * k + b[i] * (1 - k)) as [number, number, number];
const versHex = (c: [number, number, number]) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

/** Fond effectif d'un texte : formes à remplissage qui le contiennent, empilées par z, chacune mêlée selon son opacité. */
function fondEffectif(els: ElementVisible[], texte: ElementVisible): [number, number, number] {
  const cx = texte.rect.x + texte.rect.largeur / 2;
  const cy = texte.rect.y + texte.rect.hauteur / 2;
  let fond = rgb(COULEURS_HEX.ivoire);
  for (const e of els.filter((x) => x.genre === "forme" && x.remplissage && x.z < texte.z && x.opacite >= 0.05).sort((a, b) => a.z - b.z)) {
    const r = e.rect;
    if (cx >= r.x && cx <= r.x + r.largeur && cy >= r.y && cy <= r.y + r.hauteur) fond = melange(rgb(COULEURS_HEX[e.remplissage!]), fond, e.opacite);
  }
  return fond;
}

describe("QUAL-1 contraste des textes, états atténués compris", () => {
  it("tout texte visible et STABLE (hors fondu) a un contraste effectif ≥ 4,5:1 à chaque instant (opacité comprise)", () => {
    const pb: string[] = [];
    const avecSite = copie(PLAN_SANS_VOIX_STOCKS);
    (avecSite.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>).site = "studio-axion.fr";
    for (const f of FORMATS) for (const [nom, base] of [["fixture", PLAN_SANS_VOIX_STOCKS], ["réel", PLAN_SANS_VOIX_REEL], ["avec site", avecSite]] as const) {
      const plan = planPour(f, base);
      // (t = 0 est exclu : l'image 0 ms porte un plancher d'opacité 0,3 pour n'être jamais vide ; elle s'éclaircit dès 40 ms.)
      for (let t = 200; t <= plan.dureeMs; t += f === FORMATS[0] ? 100 : 250) {
        const a = imageSansVoixA(plan, t - 100).elements;
        const e = imageSansVoixA(plan, t).elements;
        const c = imageSansVoixA(plan, t + 100).elements;
        const op = (l: ElementVisible[], id: string) => l.find((x) => x.id === id)?.opacite ?? -1;
        for (const x of e.filter((y) => y.genre === "texte" && y.opacite >= 0.05)) {
          // « stable » : l'opacité ne bouge pas de plus de 0,02 sur ±100 ms (un fondu d'entrée ou de sortie passe par toutes les valeurs).
          if (Math.abs(op(a, x.id) - x.opacite) > 0.02 || Math.abs(op(c, x.id) - x.opacite) > 0.02) continue;
          const fond = fondEffectif(e, x);
          const texteEff = melange(rgb(COULEURS_HEX[x.couleur!]), fond, x.opacite);
          const k = contrasteWcag(versHex(texteEff), versHex(fond));
          if (k < 4.5) pb.push(`${f.nom} ${nom} t=${t} ${x.id} op=${x.opacite.toFixed(2)} contraste ${k.toFixed(2)}`);
        }
      }
    }
    expect(pb.slice(0, 8)).toEqual([]);
  });
  it("le focus n'atténue qu'à 0,75 : « Articles à commander » (liste atténuée, 9,6-15 s) reste lisible", () => {
    const plan = planPour(FORMATS[0], PLAN_SANS_VOIX_REEL);
    const e = imageSansVoixA(plan, 12000).elements;
    const titre = e.find((x) => x.id === "s2/liste/titre")!;
    expect(titre.opacite).toBeLessThan(0.9);
    const fond = fondEffectif(e, titre);
    expect(contrasteWcag(versHex(melange(rgb(COULEURS_HEX.noir), fond, titre.opacite)), versHex(fond))).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(FORMATS)("QUAL-1 scène titre : illustration large et vivante ($nom)", (f) => {
  const plan = planPour(f);
  const els = (t: number) => imageSansVoixA(plan, t).elements;
  it("la pile de cases fait ≥ 75 % de la largeur du contenu (formats portrait et carré)", () => {
    if (f.nom === "16:9" || f.nom === "1:1") return; // pas de place pour l'illustration (≥ 150 px de haut) en 1:1 et 16:9
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const pile = els(3000).find((e) => e.id === "s1/pile");
    expect(pile, "illustration présente").toBeDefined();
    expect(pile!.rect.largeur / z.largeur).toBeGreaterThanOrEqual(0.75);
  });
  it("les cases se cochent et se barrent une à une, l'horloge tourne", () => {
    if (f.nom === "16:9" || f.nom === "1:1") return;
    const vus = (t: number) => els(t).filter((e) => /^s1\/pile\/coche-\d$/.test(e.id) && e.rect.largeur > 2).length;
    const lignes = els(3000).filter((e) => /^s1\/pile\/case-\d$/.test(e.id)).length;
    expect(lignes, "≥ 5 lignes").toBeGreaterThanOrEqual(5);
    expect(vus(1300)).toBeLessThan(vus(2500));
    expect(vus(2500), "se cochent une à une").toBeLessThan(lignes);
    expect(vus(4600)).toBe(lignes);
    const tour = (t: number) => els(t).find((e) => e.id === "s1/pile/horloge")!.progression!;
    expect(Math.abs(tour(2400) - tour(1700))).toBeGreaterThan(0.01);
  });
});

describe.each(FORMATS)("QUAL-1 repère : mouvement continu, ordre du temps ($nom)", (f) => {
  for (const [nom, base] of [["fixture", PLAN_SANS_VOIX_STOCKS], ["réel", PLAN_SANS_VOIX_REEL]] as const) {
    it(`${nom} : jamais deux images à 0,3 s d'écart identiques (aiguille, zoom 1 → 1,06, filet)`, () => {
      const plan = planPour(f, base);
      const sc = plan.scenes[2];
      const empreinte = (t: number) => imageSansVoixA(plan, t).elements.filter((e) => e.id.startsWith("s3/")).map((e) => [e.id, e.rect.x, e.rect.y, e.rect.largeur, e.rect.hauteur, e.opacite, e.progression ?? 0, e.barre ?? 0]);
      for (let t = sc.debutMs + 300; t + 300 < sc.finMs; t += 100) {
        expect(JSON.stringify(empreinte(t)) !== JSON.stringify(empreinte(t + 300)), `t=${t}`).toBe(true);
        const a = imageSansVoixA(plan, t).elements.find((e) => e.id === "s3/carte/horloge");
        const b = imageSansVoixA(plan, t + 300).elements.find((e) => e.id === "s3/carte/horloge");
        if (a && b && a.opacite > 0.9) expect(Math.abs(a.progression! - b.progression!) > 0.006, `aiguille t=${t}`).toBe(true);
      }
      // Zoom du contenu : l'horloge grossit de ≈ 6 % entre l'entrée et la fin.
      const h = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.id === "s3/carte/horloge")!.rect.largeur;
      expect(h(sc.finMs - 20) / h(sc.debutMs + 800)).toBeGreaterThan(1.03);
    });
    it(`${nom} : le premier groupe dit apparaît le premier, « une heure » est barrée dès son arrivée`, () => {
      const plan = planPour(f, base);
      const sc = plan.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>;
      const op = (t: number, id: string) => imageSansVoixA(plan, t).elements.find((e) => e.id === id)?.opacite ?? 0;
      const premier = sc.apresAMs <= sc.barreAMs ? "s3/apres" : "s3/avant";
      const second = premier === "s3/apres" ? "s3/avant" : "s3/apres";
      const tSecond = Math.max(sc.apresAMs, sc.barreAMs);
      expect(op(sc.debutMs + 100, premier)).toBeLessThan(0.05);
      expect(op(tSecond - 50, second)).toBeLessThan(0.05);
      expect(op(tSecond - 50, premier)).toBeGreaterThan(0.9);
      const bar = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.id === "s3/avant")?.barre ?? 0;
      const tAvant = Math.max(sc.barreAMs, sc.debutMs + 550);
      expect(bar(tAvant - 50)).toBe(0);
      expect(bar(tAvant + 800)).toBe(1);
      const tApres = imageSansVoixA(plan, sc.finMs - 20).elements.find((e) => e.id === "s3/apres")!;
      const tAv = imageSansVoixA(plan, sc.finMs - 20).elements.find((e) => e.id === "s3/avant")!;
      expect(tApres.taillePx!).toBeGreaterThan(tAv.taillePx!);
      expect(tApres.graisse).toBe(800);
      expect(tApres.couleur).toBe("noir");
      expect(tAv.couleur).toBe("grisTexte");
    });
  }
});

describe.each(FORMATS)("QUAL-1 curseur de l'écran : au plus 1,2 s avant le clic, toujours en mouvement ($nom)", (f) => {
  it("apparaît ≤ 1,2 s avant le clic, bouge sans arrêt, jamais d'attente dans un coin", () => {
    for (const base of [PLAN_SANS_VOIX_STOCKS, PLAN_SANS_VOIX_REEL]) {
      const plan = planPour(f, base);
      const ev = (plan.scenes[1] as Ecran).evenements.find((e) => e.genre === "clic")!;
      const tc = Math.max(ev.aMs, plan.scenes[1].debutMs + 1600);
      const cur = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.genre === "curseur");
      expect(cur(tc - 1050), "pas de curseur 1,05 s avant (tour 10 : ≤ 1 s)").toBeUndefined();
      for (let t = tc - 880; t < tc; t += 40) {
        const a = cur(t)!.pointe!;
        const b = cur(t + 40)!.pointe!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `t=${t}`).toBeGreaterThan(1.5);
      }
    }
  });
});

describe.each(FORMATS)("QUAL-1 appel long (6 s) : site, clic, pas de figement ($nom)", (f) => {
  const SITE = "axion-ia.com";
  const long = () => {
    const q = copie(PLAN_SANS_VOIX_STOCKS);
    const ap = q.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>;
    ap.finMs = 44000;
    ap.site = SITE;
    q.dureeMs = 44000;
    return planPour(f, q);
  };
  const plan = long();
  const els = (t: number) => imageSansVoixA(plan, t).elements;
  it("le site s'affiche sous le bouton dès l'entrée de la scène (≤ 600 ms, ≥ 40 px, noir)", () => {
    const s = echelleFormat(plan.format);
    expect(els(38000 + 600).find((e) => e.id === "s4/site")?.opacite ?? 0).toBeGreaterThan(0.5);
    const site = els(41500).find((e) => e.id === "s4/site")!;
    const b = els(41500).find((e) => e.id === "s4/bouton")!;
    expect(site.texte).toBe(SITE);
    expect(site.taillePx!).toBeGreaterThanOrEqual(40 * s * 0.99);
    expect(site.couleur).toBe("noir");
    expect(site.rect.y).toBeGreaterThan(b.rect.y + b.rect.hauteur);
    expect(site.opacite).toBeGreaterThan(0.9);
    expect(els(43500).find((e) => e.id === "s4/site")!.opacite).toBeGreaterThan(0.9);
  });
  it("les invariants tiennent sur toute la durée", () => {
    const pb: string[] = [];
    for (let t = 37000; t <= 44000; t += 50) pb.push(...problemes(plan, t));
    expect(pb.slice(0, 8)).toEqual([]);
  });
  it("la caméra et le bouton bougent pendant les 2 dernières secondes (aucun figement)", () => {
    const empreinte = (t: number) => els(t).map((e) => [e.id, e.rect.x, e.rect.y, e.rect.largeur, e.rect.hauteur, e.opacite]);
    for (let t = 42000; t + 300 <= 44000; t += 100) {
      const a = new Map(empreinte(t).map((x) => [x[0] as string, x as number[]]));
      let bouge = 0;
      for (const x of empreinte(t + 300)) {
        const o = a.get(x[0] as string);
        if (!o) continue;
        const d = Math.max(Math.abs(x[1] as number - o[1]), Math.abs(x[2] as number - o[2]), Math.abs(x[3] as number - o[3]), Math.abs(x[4] as number - o[4]));
        if (d > 0.3 || Math.abs((x[5] as number) - o[5]) > 0.01) bouge++;
      }
      expect(bouge, `t=${t}`).toBeGreaterThan(0);
    }
  });
});

describe("QUAL-1 césure, littéralité et coût", () => {
  it("un « - » réel du texte n'est jamais supprimé ; jamais « , … » ni « … » seul ; `cesure` signalée", () => {
    const p = copie(PLAN_SANS_VOIX_STOCKS);
    const cs = evDe(p, "cartes-chiffres");
    cs.cartes[0].libelle = "Stock - alerte";
    cs.cartes[1].libelle = "Anticonstitutionnellementdessinterlocuteurs";
    cs.cartes[2].libelle = "Articles internationaux, à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts, de la région et des filiales étrangères associées";
    const els = imageSansVoixA(planPour(FORMATS[0], p), 16000).elements;
    const l = (k: number) => els.find((e) => e.id === `s2/carte-${k}/libelle`)!;
    expect(l(1).lignes!.join(" ")).toBe("Stock - alerte");
    expect(l(2).cesure).toBe(true);
    expect(l(1).cesure).toBeUndefined();
    expect(l(3).tronque).toBe(true);
    const aff = l(3).lignes!.join(" ");
    expect(aff.endsWith("…")).toBe(true);
    expect(/,…$/.test(aff)).toBe(false);
    expect(aff.length).toBeGreaterThan(3);
    expect(l(3).texte!.includes(" - ")).toBe(false);
    for (const e of els.filter((x) => x.genre === "texte")) expect((e as unknown as { coupe?: unknown }).coupe).toBeUndefined();
  });

  it("coût : fixture < 2 ms par image en moyenne, plan à textes longs < 10 ms", () => {
    const moyenne = (plan: PlanComposeSansVoix) => {
      for (let t = 0; t < 41000; t += 400) imageSansVoixA(plan, t);
      const n = 400;
      const d0 = performance.now();
      for (let i = 0; i < n; i++) imageSansVoixA(plan, (i * 103) % 41000);
      return (performance.now() - d0) / n;
    };
    const LONG = "Articles internationaux à réapprovisionner d'urgence avant la fermeture annuelle des entrepôts";
    const q = copie(PLAN_SANS_VOIX_STOCKS);
    ecranDe(q).titreFenetre = `Tableau de bord ${LONG}`;
    const cs = evDe(q, "cartes-chiffres");
    cs.cartes.forEach((c) => (c.libelle = LONG));
    evDe(q, "liste").titre = LONG;
    evDe(q, "panneau").rubriques.forEach((r) => (r.libelle = `${LONG} ${LONG}`));
    expect(moyenne(planPour(FORMATS[0]))).toBeLessThan(2);
    expect(moyenne(planPour(FORMATS[0], q))).toBeLessThan(10);
  });
});

/* ------------------------------------------------------------------ */
/* Tour 6 : alerte, cartes remplies ensemble, squelette, clic, écran final, horloges, vie de chaque scène                    */
/* ------------------------------------------------------------------ */

describe.each(FORMATS)("QUAL-1 tour 6 ($nom)", (f) => {
  const plan = planPour(f);
  const sc = echelleFormat(plan.format);
  const els = (t: number, p = plan) => imageSansVoixA(p, t).elements;
  const dansPt = (p: { x: number; y: number }, r: RectPx) => p.x >= r.x && p.x <= r.x + r.largeur && p.y >= r.y && p.y <= r.y + r.hauteur;

  it("squelette : contours des cartes, de la liste et de toutes ses lignes visibles ≤ 600 ms après l'entrée de la fenêtre", () => {
    const t = 5250 + 600;
    const e = els(t);
    for (const id of ["s2/fenetre", "s2/carte-1", "s2/carte-2", "s2/carte-3", "s2/liste"]) expect(e.find((x) => x.id === id)!.opacite, id).toBeGreaterThan(0.85);
    const rangs = e.filter((x) => /^s2\/rang-\d+$/.test(x.id));
    expect(rangs.length).toBeGreaterThanOrEqual(3);
    for (const r of rangs) expect(r.opacite, r.id).toBeGreaterThan(0.6);
  });

  it("avant / après : le premier texte arrive avec la carte (≤ 200 ms) ; l'horloge a un accent terracotta", () => {
    const r = plan.scenes[2];
    const a0 = r.debutMs + 250;
    const txt = (t: number) => Math.max(0, ...els(t).filter((x) => x.id.startsWith("s3/") && x.genre === "texte").map((x) => x.opacite));
    expect(txt(a0 + 40)).toBeLessThan(txt(a0 + 560));
    expect(txt(a0 + 200)).toBeGreaterThan(0.15);
    expect(txt(a0 + 600)).toBeGreaterThan(0.9);
    const h = els(a0 + 900).find((x) => x.id === "s3/carte/horloge");
    if (h) expect(h.couleur).toBe("terracotta");
  });

  it("écran final : groupe agrandi et centré, curseur par en dessous (jamais sur un texte), pointe à ≈ 30 % du bas, anneau, halo, bouton qui respire", () => {
    const tc = 39500; // clic à ≈ début de scène + 1,5 s (tour 8)
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const e0 = els(39000); // avant le clic (bouton non enfoncé)
    const q = e0.find((x) => x.id === "s4/question")!;
    const b = e0.find((x) => x.id === "s4/bouton")!;
    expect(q.taillePx!).toBeGreaterThanOrEqual(64 * sc * 0.99);
    expect(e0.find((x) => x.id === "s4/bouton/texte")!.taillePx!).toBeGreaterThanOrEqual(60 * sc * 0.99);
    // (Le centrage du groupe complet est testé plus haut : « le groupe question + bouton + marque + site est centré ».)
    expect(z.hauteur).toBeGreaterThan(0);
    expect(b.rect.hauteur).toBeGreaterThan(0);
    expect(q.rect.y).toBeGreaterThan(z.y);
    // Le curseur ne passe jamais sur un texte visible : ni sa pointe, ni sa boîte.
    for (let t = tc - 1200; t <= 41300; t += 20) {
      const e = els(t);
      const c = e.find((x) => x.genre === "curseur");
      if (!c || c.opacite < 0.05) continue;
      for (const x of e.filter((y) => y.genre === "texte" && y.opacite > 0.05)) expect(inter(c.rect, x.rect), `t=${t} ${x.id}`).toBe(false);
    }
    const fin = els(tc + 60);
    const bf = fin.find((x) => x.id === "s4/bouton")!.rect;
    const p = fin.find((x) => x.genre === "curseur")!.pointe!;
    const reste = (bf.y + bf.hauteur - p.y) / bf.hauteur;
    expect(reste, "pointe à 15–32 % du bas").toBeGreaterThan(0.15);
    expect(reste).toBeLessThan(0.32);
    expect(Math.abs(p.x - (bf.x + bf.largeur / 2))).toBeLessThan(6 * sc);
    // Anneau à la pointe et anneau du bouton au clic ; halo ensuite ; le bouton respire (largeur variable après tc + 600).
    expect(els(tc + 150).find((x) => x.id === "s4/anneau-pointe")!.contour).toBe("ivoire");
    expect(els(tc + 150).find((x) => x.id === "s4/anneau")).toBeDefined();
    expect(els(tc + 1500).find((x) => x.id === "s4/halo")).toBeDefined();
    const larg = (t: number) => els(t).find((x) => x.id === "s4/bouton")!.rect.largeur / els(t).find((x) => x.id === "s4/question")!.rect.largeur;
    const ls = [1000, 1300, 1600, 1900, 2200].map((d) => larg(tc + d));
    expect(Math.max(...ls) - Math.min(...ls)).toBeGreaterThan(0.004);
    // Tour 10 : le curseur s'est effacé (≤ 400 ms après le clic) et la marque a grandi (≈ 1,04) ; les 4 dernières secondes ne sont pas figées.
    expect(els(tc + 1500).find((x) => x.genre === "curseur")).toBeUndefined();
    const marque = (t: number) => els(t).find((x) => x.id === "s4/marque");
    if (marque(tc - 200)) expect(marque(tc + 1000)!.taillePx! / marque(tc - 200)!.taillePx!).toBeGreaterThan(1.03);
  });

  it("clic de la liste : le curseur ne passe jamais sur un texte (cartes, titre de liste) et la pointe vise la position COURANTE de ligne-1, même juste après le tri", () => {
    const p = copie(plan);
    evDe(p, "clic").aMs = evDe(p, "tri").aMs + 300;
    for (const pl of [plan, p]) {
      const tc = Math.max(evDe(pl, "clic").aMs, pl.scenes[1].debutMs + 1600);
      for (let t = tc - 1300; t <= tc + 1600; t += 20) {
        const e = els(t, pl);
        const c = e.find((x) => x.genre === "curseur");
        if (!c || c.opacite < 0.05) continue;
        for (const x of e.filter((y) => y.genre === "texte" && y.opacite > 0.05 && y.id.startsWith("s2/"))) expect(inter(c.rect, x.rect), `t=${t} ${x.id}`).toBe(false);
        if (t >= tc) expect(dansPt(c.pointe!, e.find((x) => x.id === "s2/ligne-1")!.rect), `t=${t} pointe dans ligne-1`).toBe(true);
      }
    }
  });

  it("chaque scène vit : jamais 1,5 s sans changement visible (opacité, progression, barre, anneau ou nouvel élément)", () => {
    const sig = (t: number, pref: string) => new Map(els(t).filter((e) => e.id.startsWith(pref)).map((e) => [e.id, e]));
    for (const sceneI of plan.scenes) {
      const pref = `${sceneI.id}/`;
      for (let t = sceneI.debutMs + 700; t + 1500 <= sceneI.finMs; t += 100) {
        const a = sig(t, pref);
        const b = sig(t + 1500, pref);
        let change = false;
        for (const [id, e] of b) {
          const o = a.get(id);
          if (!o || Math.abs(e.opacite - o.opacite) > 0.04 || Math.abs((e.progression ?? 0) - (o.progression ?? 0)) > 0.01 || Math.abs((e.barre ?? 0) - (o.barre ?? 0)) > 0.01) change = true;
        }
        for (const id of a.keys()) if (!b.has(id)) change = true;
        expect(change, `${sceneI.id} t=${t}`).toBe(true);
      }
    }
  });

  it("l'appel avec site : le site ≥ 36 px sur 2 lignes au besoin, jamais plus petit", () => {
    const p = copie(plan);
    (p.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>).site = "studio-axion.fr ".repeat(6).trim();
    const si = els(41300, p).find((x) => x.id === "s4/site")!;
    expect(si.taillePx!).toBeGreaterThanOrEqual(36 * sc * 0.99);
    expect(si.lignes!.length).toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* Tour 7                                                              */
/* ------------------------------------------------------------------ */

/** Angle (degrés, depuis midi, sens horaire) d'une aiguille de progression `p`. */
const angleDe = (p: number) => ((p * 360) % 360 + 360) % 360;
/** Écart angulaire (0..180) entre deux directions. */
const ecartAngle = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe.each(FORMATS)("QUAL-1 tour 7 : horloges, toast, transitions, ouverture, écran, fin ($nom)", (f) => {
  const plan = planPour(f);
  const reel = planPour(f, PLAN_SANS_VOIX_REEL);
  const sc = echelleFormat(plan.format);
  const els = (t: number, p = plan) => imageSansVoixA(p, t).elements;

  it("horloges (tour 9) : petite aiguille FIXE à 300° (contrat) ; grande aiguille ≥ 60° de la petite à tout instant ; icône statique à 0,25 tour (3 h)", () => {
    const h = (t: number, id: string, p = plan) => els(t, p).find((x) => x.id === id);
    const HEURE = 300;
    const hist = h(26000, "s2/panneau/horloge")!;
    expect(hist.progression).toBeCloseTo(0.25, 9);
    expect(h(34000 - 400, "s2/panneau/horloge")!.progression).toBe(hist.progression);
    expect(ecartAngle(angleDe(hist.progression!), HEURE), "icône statique").toBeGreaterThanOrEqual(60);
    for (const [p, debut, fin] of [[plan, plan.scenes[2].debutMs, plan.scenes[2].finMs + 150], [reel, reel.scenes[2].debutMs, reel.scenes[2].finMs + 150]] as const) {
      for (let t = debut; t <= fin; t += 20) {
        const g = h(t, "s3/carte/horloge", p);
        if (!g) continue;
        const a = angleDe(g.progression!);
        expect(ecartAngle(a, HEURE), `t=${t} aiguille ${a.toFixed(0)}°`).toBeGreaterThanOrEqual(60);
        expect(ecartAngle(a, HEURE), `t=${t} jamais une droite`).toBeLessThan(175);
      }
    }
    // L'horloge de l'ouverture suit la même règle.
    for (let t = 0; t <= plan.scenes[0].finMs + 150; t += 50) {
      const g = h(t, "s1/pile/horloge");
      if (!g) continue;
      expect(ecartAngle(angleDe(g.progression!), HEURE), `ouverture t=${t}`).toBeGreaterThanOrEqual(60);
    }
  });

  it("toast : ≥ 16 px du filet de la barre, ≥ 16 px du bord droit de la carte, ≥ 24 px du titre, à tout instant", () => {
    for (const [nom, p, t0, fin] of [["fixture", plan, 30000, 34000], ["réel", reel, 32085, 33803]] as const) {
      for (let t = t0; t <= fin; t += 10) {
        const e = els(t, p);
        const a = e.find((x) => x.id === "s2/alerte" && x.opacite > 0.05);
        if (!a) continue;
        const filet = e.find((x) => x.id === "s2/fenetre/filet")!.rect;
        const fen = e.find((x) => x.id === "s2/fenetre")!.rect;
        const titre = e.find((x) => x.id === "s2/fenetre/titre")!.rect;
        expect(filet.y - (a.rect.y + a.rect.hauteur), `${nom} t=${t} filet`).toBeGreaterThanOrEqual(16 * sc - 1e-6);
        expect(fen.x + fen.largeur - (a.rect.x + a.rect.largeur), `${nom} t=${t} bord`).toBeGreaterThanOrEqual(16 * sc - 1e-6);
        expect(a.rect.x - (titre.x + titre.largeur), `${nom} t=${t} titre`).toBeGreaterThanOrEqual(24 * sc - 1e-6);
      }
    }
  });

  it("toast : entrée avec un petit rebond doux (dépassement ≤ 6 px, 300 ms), puis immobile et opaque jusqu'à la sortie de la scène", () => {
    const decl = 32400;
    const ys: number[] = [];
    // Position relative à la fenêtre (la caméra dérive doucement : on la retire de la mesure).
    const rel = (t: number) => {
      const e = els(t);
      const a = e.find((x) => x.id === "s2/alerte");
      return a ? a.rect.y - e.find((x) => x.id === "s2/fenetre")!.rect.y : NaN;
    };
    for (let t = decl - 100; t <= decl + 600; t += 10) ys.push(rel(t));
    const repos = rel(decl + 700);
    const valides = ys.filter((y) => !Number.isNaN(y));
    const depasse = Math.max(...valides.map((y) => y - repos));
    expect(depasse, "dépasse le repos vers le bas").toBeGreaterThan(1 * sc);
    expect(depasse, "dépassement").toBeLessThanOrEqual(6 * sc);
    // Fin du rebond à 300 ms : ensuite plus aucun mouvement (relativement à la fenêtre : < 0,5 px en 100 ms).
    for (let t = decl + 320; t <= 33800; t += 100) {
      expect(Math.abs(rel(t + 100) - rel(t)), `t=${t}`).toBeLessThan(0.5 * sc);
    }
    for (let t = decl + 160; t <= 33880; t += 20) expect(els(t).find((x) => x.id === "s2/alerte")!.opacite, `opacité t=${t}`).toBeGreaterThan(0.99);
    expect(els(decl - 20).find((x) => x.id === "s2/alerte")).toBeUndefined();
  });

  it("toast : la ligne concernée (terracotta) PULSE 2 fois en phase avec l'arrivée du toast", () => {
    const decl = 32400;
    const fond = (t: number) => els(t).find((x) => /^s2\/rang-\d+\/alerte-fond$/.test(x.id))?.opacite ?? 0;
    const serie: number[] = [];
    for (let t = decl - 100; t <= decl + 1200; t += 10) serie.push(fond(t));
    // Compte les sommets de l'intensité (maxima locaux nets) pendant la fenêtre de pulsation : exactement 2.
    let sommets = 0;
    for (let i = 8; i < serie.length - 8; i++) if (serie[i] > serie[i - 8] + 0.04 && serie[i] > serie[i + 8] + 0.04 && serie[i] >= serie[i - 1] && serie[i] > serie[i + 1]) sommets++;
    expect(sommets).toBe(2);
    expect(Math.max(...serie)).toBeGreaterThan(fond(decl - 200) + 0.2);
    // Un anneau terracotta s'élargit pendant chaque pulsation et reste dans la liste (parent).
    let anneaux = 0;
    for (let t = decl; t <= decl + 900; t += 10) {
      const e = els(t);
      const r = e.find((x) => /^s2\/rang-\d+\/pulse$/.test(x.id));
      if (r) {
        anneaux++;
        expect(r.contour).toBe("terracotta");
        expect(dedans(r.rect, e.find((x) => x.id === "s2/liste")!.rect), `anneau dans la liste t=${t}`).toBe(true);
      }
    }
    expect(anneaux).toBeGreaterThan(60);
    expect(els(decl + 1000).find((x) => /^s2\/rang-\d+\/pulse$/.test(x.id))).toBeUndefined();
  });

  it("ouverture : la carte occupe ≥ 85 % de la largeur du contenu et descend jusqu'au bas du contenu, ≥ 5 lignes cochées une à une, horloge à droite", () => {
    if (f.nom === "16:9" || f.nom === "1:1") return;
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    const e = els(4000);
    const pile = e.find((x) => x.id === "s1/pile")!.rect;
    expect(pile.largeur / z.largeur).toBeGreaterThanOrEqual(0.85);
    expect(z.y + z.hauteur - (pile.y + pile.hauteur), "bas de la carte").toBeLessThan(110 * sc);
    const cases = e.filter((x) => /^s1\/pile\/case-\d$/.test(x.id));
    expect(cases.length).toBeGreaterThanOrEqual(5);
    for (const c of cases) expect(c.rect.hauteur, c.id).toBeGreaterThanOrEqual(50 * sc);
    const h = e.find((x) => x.id === "s1/pile/horloge")!.rect;
    expect(h.x + h.largeur / 2).toBeGreaterThan(pile.x + 0.7 * pile.largeur);
  });

  it("écran : dès l'entrée de la fenêtre (≤ 1,2 s) mini-graphiques et lignes de liste sont DESSINÉS en gris neutre ; les cartes s'allument ensuite au mot (terracotta)", () => {
    const tS = plan.scenes[1].debutMs + 130;
    const aC = evDe(plan, "cartes-chiffres").aMs;
    const e = els(tS + 1200);
    for (const k of [1, 2, 3]) {
      const base = e.find((x) => x.id === `s2/carte-${k}/valeur-base`)!;
      expect(base.rect.largeur, `barre carte ${k}`).toBeGreaterThan(20 * sc);
      expect(base.remplissage).toBe("grisTexte");
      expect(e.find((x) => x.id === `s2/carte-${k}/valeur`)!.opacite, `carte ${k} pas encore allumée`).toBeLessThan(0.05);
      expect(e.find((x) => x.id === `s2/carte-${k}/allume`)?.opacite ?? 0).toBeLessThan(0.05);
    }
    const col = (k: number) => e.filter((x) => new RegExp(`^s2/carte-${k}/col-\\d+$`).test(x.id) && x.opacite > 0.15);
    if (col(1).length > 0) {
      for (const k of [1, 2, 3]) {
        expect(col(k).length, `colonnes carte ${k}`).toBeGreaterThanOrEqual(6);
        expect(col(k).length, `colonnes carte ${k} ≤ 8 (fenêtre qui glisse)`).toBeLessThanOrEqual(8);
        expect(Math.min(...col(k).filter((x) => x.rect.largeur > 11.9 * sc).map((x) => x.rect.hauteur)), `barre carte ${k}`).toBeGreaterThanOrEqual(26 * sc - 0.01);
        for (const c of col(k)) expect(c.remplissage).toBe("grisTexte");
      }
    } else expect(f.nom).toBe("1:1");
    // Lignes de la liste : barres pleines (grises) dès l'entrée, avant le mot de la liste.
    const rangs = e.filter((x) => /^s2\/rang-\d+$/.test(x.id));
    expect(rangs.length).toBeGreaterThanOrEqual(3);
    for (const r of rangs) {
      const b = e.find((x) => x.id === `${r.id}/barre`)!;
      expect(b.rect.largeur, `${r.id} barre`).toBeGreaterThan(40 * sc);
      expect(b.remplissage).toBe("grisTexte");
      expect(b.opacite).toBeGreaterThan(0.2);
    }
    // Puis chaque carte s'allume sur son mot.
    for (const [k, c] of evDe(plan, "cartes-chiffres").cartes.entries()) {
      expect(els(c.aMs - 60).find((x) => x.id === `s2/carte-${k + 1}/allume`)?.opacite ?? 0, `avant le mot ${k + 1}`).toBeLessThan(0.05);
      const apres = els(c.aMs + 800).find((x) => x.id === `s2/carte-${k + 1}/allume`)!;
      expect(apres.contour).toBe("terracotta");
      expect(apres.opacite).toBeGreaterThan(0.9);
    }
    expect(aC).toBeGreaterThan(tS + 1200);
  });

  it("écran : deux images à 0,3 s d'écart (10,4 s / 10,7 s) diffèrent visiblement, plan fixture et plan réel", () => {
    for (const p of [plan, reel]) {
      for (const [t0, t1] of [[10400, 10700], [10000, 10300], [10700, 11000]]) {
        const a = new Map(els(t0, p).filter((x) => x.id.startsWith("s2/")).map((x) => [x.id, x]));
        let diff = 0;
        for (const x of els(t1, p).filter((y) => y.id.startsWith("s2/"))) {
          const o = a.get(x.id);
          if (!o || Math.abs(x.opacite - o.opacite) > 0.03 || Math.abs(x.rect.hauteur - o.rect.hauteur) > 1.5 || Math.abs(x.rect.largeur - o.rect.largeur) > 1.5) diff++;
        }
        expect(diff, `${t0}/${t1}`).toBeGreaterThanOrEqual(f.nom === "1:1" ? 3 : 8);
      }
    }
  });
});

describe.each(FORMATS)("QUAL-1 tour 8 : accroche, fin, sélection, listes, mouvement, avant / après ($nom)", (f) => {
  const plan = planPour(f);
  const reel = planPour(f, PLAN_SANS_VOIX_REEL);
  const sc = echelleFormat(plan.format);
  const z = zonesSansVoix(plan.format, plan.basPct).contenu;
  const els = (t: number, p: PlanComposeSansVoix = plan) => imageSansVoixA(p, t).elements;
  const par = (t: number, id: string, p: PlanComposeSansVoix = plan) => els(t, p).find((e) => e.id === id);
  const portrait = f.nom === "4:5" || f.nom === "9:16";

  it("accroche (tour 11) : la question vient EN PREMIER mais plus petite (≈ 70 %, graisse ≤ 600), ≥ 28 px d'espace, le titre domine (≥ 52 px)", () => {
    const q = reel.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>;
    expect(q.surTitre).toBeDefined();
    const sur = par(1500, "s1/sur-titre", reel)!;
    const titre = par(1500, "s1/titre", reel)!;
    expect(sur.graisse).toBeLessThanOrEqual(600);
    expect(titre.taillePx!).toBeGreaterThanOrEqual(52 * sc * 0.99);
    expect(sur.taillePx! / titre.taillePx!).toBeGreaterThan(0.6);
    expect(sur.taillePx! / titre.taillePx!).toBeLessThan(0.8);
    expect(titre.rect.y - (sur.rect.y + sur.rect.hauteur)).toBeGreaterThanOrEqual(28 * sc * 0.99);
    expect(sur.rect.y).toBeLessThan(titre.rect.y);
    // La question est lisible avant la phrase titre.
    expect(par(300, "s1/sur-titre", reel)!.opacite).toBeGreaterThan(par(300, "s1/titre", reel)!.opacite + 0.2);
    // Aucun texte de l'écran d'ouverture n'est plus petit que le titre, la question comprise.
    for (const e of els(2000, reel).filter((x) => x.genre === "texte")) expect(e.taillePx!).toBeGreaterThanOrEqual(36 * sc * 0.99);
  });

  it("ouverture : les traits qui barrent commencent APRÈS la case (x ≥ bord droit de la case + 12 px)", () => {
    for (let k = 1; k <= 5; k++) {
      const trait = els(4000, reel).find((e) => e.id === `s1/pile/trait-${k}`);
      const bord = els(4000, reel).find((e) => e.id === `s1/pile/case-${k}`)!;
      if (!trait) continue;
      expect(trait.rect.x, `trait ${k}`).toBeGreaterThanOrEqual(bord.rect.x + bord.rect.largeur + 12 * sc * 0.97);
    }
  });

  it("fin : marque et site visibles dès l'entrée (≤ 600 ms), clic à ≈ début + 1,5 s, pointe jamais sur le texte, groupe qui remplit le contenu", () => {
    const reelFin = copie(reel);
    Object.assign(reelFin.scenes[3], { marque: "Axion IA", site: "axion-ia.com" });
    for (const p of [plan, reelFin]) {
      const sc4 = p.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>;
      const d = sc4.debutMs;
      for (const id of ["s4/marque", "s4/site"]) expect(par(d + 600, id, p)?.opacite ?? 0, id).toBeGreaterThan(0.5);
      const tc = Math.min(sc4.clicAMs, d + 1500);
      expect(par(tc + 150, "s4/anneau", p), "anneau au clic précoce").toBeDefined();
      expect(par(tc - 200, "s4/anneau", p)).toBeUndefined();
      for (let t = d; t <= sc4.finMs; t += 40) {
        const e = els(t, p);
        const c = e.find((x) => x.genre === "curseur");
        if (!c) continue;
        for (const x of e.filter((y) => y.genre === "texte" && y.opacite > 0.05)) expect(inter(c.rect, x.rect), `t=${t} ${x.id}`).toBe(false);
      }
      // Le bouton « respire » après le clic.
      const l = (t: number) => par(t, "s4/bouton", p)!.rect.largeur / par(t, "s4/question", p)!.rect.largeur;
      expect(Math.abs(l(tc + 1300) - l(tc + 2100))).toBeGreaterThan(0.002);
    }
    const e = els(41300);
    const hautG = Math.min(...["s4/question", "s4/site"].map((id) => e.find((x) => x.id === id)!.rect.y));
    const si = e.find((x) => x.id === "s4/site")!;
    const mq = e.find((x) => x.id === "s4/marque")!;
    const bt = e.find((x) => x.id === "s4/bouton")!;
    expect((si.rect.y + si.rect.hauteur - hautG) / z.hauteur, "groupe").toBeGreaterThanOrEqual(portrait ? 0.82 : 0.6);
    // Pas de grand vide sous le bouton : l'écart entre le bouton et la marque reste raisonnable, la marque ≥ 72 px en portrait.
    expect(mq.rect.y - (bt.rect.y + bt.rect.hauteur), "écart bouton / marque").toBeLessThan(0.2 * z.hauteur);
    if (portrait) expect(mq.taillePx!).toBeGreaterThanOrEqual(72 * sc * 0.99);
  });

  it("sélection : UNE seule ligne à la fois (ligne 1 au clic, puis seulement la ligne de l'alerte) ; la carte pulse 2 fois ; plus de pastille au bout du toast", () => {
    const ev = ecranDe(plan).evenements;
    const clic = ev.find((e) => e.genre === "clic")!;
    const al = ev.find((e) => e.genre === "alerte")!;
    const lignesAllumees = (t: number) => els(t).filter((e) => /^s2\/(ligne-1\/allume-fond|rang-\d+\/alerte-fond)$/.test(e.id) && e.opacite > 0.12).map((e) => e.id);
    expect(lignesAllumees(clic.aMs + 600)).toEqual(["s2/ligne-1/allume-fond"]);
    expect(lignesAllumees(al.aMs + 500).length, "une seule").toBe(1);
    expect(lignesAllumees(al.aMs + 500)[0]).toMatch(/rang-\d+\/alerte-fond/);
    expect(lignesAllumees(al.aMs + 500)[0]).not.toContain("ligne-1");
    expect(par(clic.aMs + 600, "s2/ligne-1/allume-fond")!.remplissage).toBe("terracotta");
    expect(par(al.aMs + 600, "s2/ligne-1/allume-fond")?.opacite ?? 0).toBeLessThan(0.05);
    // Carte « Passent sous le seuil » : contour terracotta, deux pulsations (marge qui grandit puis revient, deux fois).
    const marge = (t: number) => {
      const c = par(t, "s2/pulse-carte")!;
      const k = par(t, "s2/carte-2")!;
      return k.rect.x - c.rect.x;
    };
    const m = Array.from({ length: 36 }, (_, i) => marge(al.aMs + 50 + i * 40));
    let pics = 0;
    for (let i = 1; i + 1 < m.length; i++) if (m[i] > m[i - 1] + 1e-6 && m[i] >= m[i + 1] && m[i] > m[0] + 2 * sc) pics++;
    expect(pics).toBe(2);
    expect(par(al.aMs + 600, "s2/pulse-carte")!.contour).toBe("terracotta");
    // Plus de pastille orpheline au bout du toast.
    const decl = al.declencheurAMs ?? al.aMs + 0.6 * (ecranDe(plan).finMs - al.aMs);
    expect(par(decl + 500, "s2/alerte/pastille")).toBeUndefined();
    // La ligne en alerte est la plus urgente (rang 1, en haut après le tri).
    expect(lignesAllumees(al.aMs + 500)[0]).toBe("s2/rang-1/alerte-fond");
  });

  it("listes : barres grisTexte à pleine opacité, titre → lignes ≤ 24 px, avant et après le tri", () => {
    for (const p of [plan, reel]) {
      for (const t of [12000, 19000, 22500]) {
        const e = els(t, p);
        const titre = e.find((x) => x.id === "s2/liste/titre")!;
        const r1 = e.filter((x) => /^s2\/rang-\d+$/.test(x.id)).sort((a, b) => a.rect.y - b.rect.y)[0];
        expect(r1.rect.y - (titre.rect.y + titre.rect.hauteur), `écart titre / lignes t=${t}`).toBeLessThanOrEqual(24 * sc * 1.04 + 1);
        for (const b of e.filter((x) => /^s2\/rang-\d+\/barre$/.test(x.id))) {
          // Pleine opacité ; seule la mise en valeur d'un `focus` (cartes) atténue la liste, à 0,75 au plus bas.
          expect(b.opacite, b.id).toBeGreaterThan(t === 12000 ? 0.7 : 0.95);
          expect(b.remplissage).toBe("grisTexte");
        }
      }
    }
  });

  it("mouvement 6-21 s : le mini-graphique d'une carte reçoit une colonne neuve toutes les 0,8 s ; toute fenêtre de 1 s change", () => {
    const ids = (t: number) => new Set(els(t).filter((e) => /^s2\/(carte-1\/col-|rang-1\/mini-)\d+$/.test(e.id) && e.opacite > 0.12).map((e) => e.id));
    for (const t of [8000, 12000, 16000, 20000]) {
      const a = ids(t);
      const b = ids(t + 850);
      expect([...b].some((i) => !a.has(i)), `colonne neuve après ${t}`).toBe(true);
    }
    // Les colonnes glissent vers la gauche (même id, x plus petit).
    const col = (t: number) => els(t).filter((e) => /^s2\/(carte-1\/col-|rang-1\/mini-)\d+$/.test(e.id));
    const a = col(12000 + 200);
    const b = col(12000 + 500);
    const commun = a.filter((x) => b.some((y) => y.id === x.id && y.rect.x < x.rect.x - 0.2));
    expect(commun.length).toBeGreaterThan(2);
    // Jamais 1 s sans changement visible (6-21 s).
    for (let t = 6200; t + 1000 <= 21000; t += 100) {
      const x = new Map(els(t).filter((e) => e.id.startsWith("s2/")).map((e) => [e.id, e]));
      let ch = false;
      for (const e of els(t + 1000)) {
        const o = x.get(e.id);
        if (e.id.startsWith("s2/") && (!o || Math.abs(e.rect.x - o.rect.x) > 1 || Math.abs(e.rect.largeur - o.rect.largeur) > 1 || Math.abs(e.opacite - o.opacite) > 0.04)) ch = true;
      }
      expect(ch, `t=${t}`).toBe(true);
    }
  });

  it("tri : les lignes se réordonnent d'au moins une hauteur de ligne en 500 ms (plan réel compris)", () => {
    for (const p of [plan, reel]) {
      const tri = (ecranDe(p).evenements.find((e) => e.genre === "tri")!).aMs;
      const a = els(tri - 20, p).filter((e) => /^s2\/rang-\d+$/.test(e.id));
      const b = els(tri + 520, p).filter((e) => /^s2\/rang-\d+$/.test(e.id));
      let maxD = 0;
      for (const r of a) maxD = Math.max(maxD, Math.abs(b.find((x) => x.id === r.id)!.rect.y - r.rect.y));
      expect(maxD, "glissé vertical").toBeGreaterThanOrEqual(a[0].rect.hauteur);
      // Pendant la glissade, une ligne bouge à chaque image.
      const mid = els(tri + 250, p).find((e) => e.id === "s2/rang-2")!.rect.y;
      expect(mid).not.toBeCloseTo(a.find((e) => e.id === "s2/rang-2")!.rect.y, 0);
    }
  });

  const larg = (t: number) => par(t, "s2/fenetre")!.rect.largeur;
  it("caméra de l'écran : par zones (échelle 1 → 1,055), la largeur de la fenêtre reste dans le contenu, rien n'en sort", () => {
    const sce = ecranDe(plan);
    const contenu = zonesSansVoix(plan.format, plan.basPct).contenu;
    for (let t = sce.debutMs + 300; t < sce.finMs - 300; t += 500) {
      const w = larg(t);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(contenu.largeur);
      expect(problemes(plan, t)).toEqual([]);
    }
  });

  it("avant / après : « une minute » visible ≤ 150 ms après l'entrée de la carte, « une heure » à son instant, bloc centré sur ce qui est affiché", () => {
    for (const p of [plan, reel]) {
      const r = p.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>;
      const entree = r.debutMs + 130;
      const pre = r.apresAMs < r.barreAMs ? "apres" : "avant";
      const second = pre === "apres" ? "avant" : "apres";
      expect(par(entree + 150, `s3/${pre}`, p)?.opacite ?? 0).toBeGreaterThan(0.5);
      const instant2 = Math.max(Math.max(r.apresAMs, r.barreAMs), entree + 400);
      expect(par(instant2 - 60, `s3/${second}`, p)?.opacite ?? 0).toBeLessThan(0.05);
      expect(par(instant2 + 400, `s3/${second}`, p)!.opacite).toBeGreaterThan(0.9);
      // Pas de place réservée : avant l'arrivée de l'autre groupe, le bloc affiché (horloge, texte, filet) est centré dans la carte.
      const e = els(instant2 - 80, p).filter((x) => x.id.startsWith("s3/") && x.id !== "s3/carte" && !x.id.endsWith("/reflet") && x.opacite > 0.2);
      const haut = Math.min(...e.map((x) => x.rect.y));
      const bas = Math.max(...e.map((x) => x.rect.y + x.rect.hauteur));
      const k = par(instant2, "s3/carte", p)!.rect;
      expect(Math.abs((haut + bas) / 2 - (k.y + k.hauteur / 2)), "centré").toBeLessThan(0.06 * k.hauteur);
    }
    // Pas de saut : le texte déjà là ne bouge jamais de plus de 40 px entre deux images (25 i/s) à l'arrivée du second.
    const r = reel.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>;
    const inst = Math.max(r.apresAMs, r.barreAMs);
    for (let t = inst - 200; t < inst + 700; t += 40) {
      const a = par(t, "s3/apres", reel)!.rect.y;
      const b = par(t + 40, "s3/apres", reel)!.rect.y;
      expect(Math.abs(a - b), `saut t=${t}`).toBeLessThan(40 * sc);
    }
  });
});

describe.each(FORMATS)("QUAL-1 tour 8 : titre long + alerte, fin du plan réel ($nom)", (f) => {
  it("titre de fenêtre long : le toast est COMPLET (aucun mot coupé) et ne recouvre jamais le titre, de l'alerte à la sortie", () => {
    for (const titreFenetre of ["Suivi des stocks et des commandes fournisseurs", "Tableau de bord de suivi des stocks, des commandes et des livraisons fournisseurs"]) {
      const q = copie(PLAN_SANS_VOIX_STOCKS);
      ecranDe(q).titreFenetre = titreFenetre;
      const p = planPour(f, q);
      for (let t = 30000; t < 34000; t += 100) {
        const e = imageSansVoixA(p, t).elements;
        const titre = e.find((x) => x.id === "s2/fenetre/titre")!;
        const toast = e.find((x) => x.id === "s2/alerte" && x.opacite > 0.05);
        if (t > 32600) expect(toast, `toast t=${t}`).toBeDefined();
        if (!toast) continue;
        expect(inter(toast.rect, titre.rect), `${f.nom} recouvrement t=${t}`).toBe(false);
        expect(toast.rect.x - (titre.rect.x + titre.rect.largeur), `${f.nom} écart titre/toast t=${t}`).toBeGreaterThanOrEqual(0);
        const txt = e.find((x) => x.id === "s2/alerte/texte")!;
        expect(txt.tronque, "toast non raccourci").toBeUndefined();
        expect(txt.cesure, "toast sans césure").toBeUndefined();
        expect(txt.lignes!.join(" ").replace(/ /g, " ")).toBe("Un article passe sous le seuil");
      }
    }
  });

  it("plan réel avec marque et site : le site est à pleine opacité ≥ 2 s avant la fin", () => {
    const q = copie(PLAN_SANS_VOIX_REEL);
    Object.assign(q.scenes[3], { marque: "Axion IA", site: "axion-ia.com" });
    const p = planPour(f, q);
    const fin = p.scenes[3].finMs;
    for (const id of ["s4/site", "s4/marque"]) {
      const e = imageSansVoixA(p, fin - 2000).elements.find((x) => x.id === id)!;
      expect(e.opacite, id).toBeGreaterThan(0.99);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Tour 9                                                              */
/* ------------------------------------------------------------------ */

describe.each(FORMATS)("QUAL-1 tour 9 : collisions, historique, alerte, pictogrammes, horloges ($nom)", (f) => {
  const plan = planPour(f);
  const reel = planPour(f, PLAN_SANS_VOIX_REEL);
  const sc = echelleFormat(plan.format);
  const els = (t: number, p = plan) => imageSansVoixA(p, t).elements;
  const trouve = (t: number, id: string, p = plan) => els(t, p).find((x) => x.id === id);

  it("jamais deux textes d'une MÊME scène qui se recouvrent (toutes scènes, fixture et plan réel, toutes les 40 ms)", () => {
    for (const [nom, p] of [["fixture", plan], ["réel", reel]] as const) {
      for (let t = 0; t <= p.dureeMs; t += 40) {
        const tx = els(t, p).filter((e) => e.genre === "texte" && e.opacite >= 0.05);
        for (let i = 0; i < tx.length; i++) {
          for (let j = i + 1; j < tx.length; j++) {
            if (sceneDe(tx[i].id) !== sceneDe(tx[j].id)) continue;
            expect(inter(tx[i].rect, tx[j].rect), `${nom} t=${t} ${tx[i].id} / ${tx[j].id}`).toBe(false);
          }
        }
      }
    }
  });

  it("avant / après : la place de « une heure » est réservée dès le début ; il apparaît SUR PLACE (descente ≤ 12 px) sans jamais croiser « une minute »", () => {
    for (const p of [plan, reel]) {
      const r = p.scenes[2] as Extract<SceneSansVoix, { genre: "repere" }>;
      const yRel = (t: number, id: string) => {
        const e = els(t, p);
        const x = e.find((y) => y.id === id);
        const k = e.find((y) => y.id === "s3/carte");
        return x && k ? x.rect.y - (k.rect.y + k.rect.hauteur / 2) : null;
      };
      // Bloc posé à ses positions finales : la position de « une minute » ne change pas quand « une heure » arrive (au zoom près, ≤ 6 %).
      const tSecond = Math.max(r.barreAMs, r.apresAMs);
      const avant = yRel(tSecond - 60, "s3/apres");
      const apres = yRel(tSecond + 600, "s3/apres");
      expect(Math.abs(avant! - apres!), "une minute ne bouge pas à l'arrivée de l'autre").toBeLessThan(0.02 * 1350);
      // Descente de « une heure » ≤ 12 px entre son premier instant visible et sa position posée.
      let y0: number | null = null;
      let yFin: number | null = null;
      for (let t = r.debutMs; t <= r.finMs; t += 20) {
        const a = trouve(t, "s3/avant", p);
        const m = trouve(t, "s3/apres", p);
        const k = trouve(t, "s3/carte", p);
        if (a && m && a.opacite >= 0.05 && m.opacite >= 0.05) {
          expect(inter(a.rect, m.rect), `${f.nom} t=${t} une heure / une minute`).toBe(false);
          expect(a.rect.y + a.rect.hauteur, `t=${t} une heure au-dessus`).toBeLessThanOrEqual(m.rect.y + 1e-6);
        }
        if (a && k && a.opacite >= 0.05) {
          const rel = a.rect.y - k.rect.y;
          if (y0 === null) y0 = rel;
          yFin = rel;
        }
      }
      expect(y0, "une heure est apparue").not.toBeNull();
      expect(Math.abs(y0! - yFin!) / 1.06, "descente").toBeLessThanOrEqual(12 * sc + 8 * sc);
      const a1 = trouve(Math.max(r.barreAMs, r.apresAMs) + 120, "s3/avant", p);
      const a2 = trouve(Math.max(r.barreAMs, r.apresAMs) + 700, "s3/avant", p);
      const k1 = trouve(Math.max(r.barreAMs, r.apresAMs) + 120, "s3/carte", p)!;
      const k2 = trouve(Math.max(r.barreAMs, r.apresAMs) + 700, "s3/carte", p)!;
      if (a1 && a2) expect(Math.abs(a1.rect.y - k1.rect.y - (a2.rect.y - k2.rect.y)), "descente ≤ 12 px").toBeLessThanOrEqual(12 * sc * 1.07);
    }
  });

  it("historique : la liste se rétrécit (300 ms) AVANT que le panneau n'entre ; aucun texte du panneau ne recouvre la liste", () => {
    for (const p of [plan, reel]) {
      const ec = ecranDe(p);
      const pan = ec.evenements.find((e) => e.genre === "panneau")!;
      let premierPanneau = Infinity;
      let finListe = 0;
      const largeurListe = (t: number) => trouve(t, "s2/liste", p)!.rect.largeur;
      const plein = largeurListe(pan.aMs - 1500);
      let prec = plein;
      let precX = NaN;
      for (let t = pan.aMs - 1500; t <= pan.aMs + 3000; t += 20) {
        const e = els(t, p);
        const panneau = e.find((x) => x.id === "s2/panneau");
        if (panneau && panneau.opacite >= 0.05 && premierPanneau === Infinity) premierPanneau = t;
        const liste = e.find((x) => x.id === "s2/liste")!;
        const textesListe = e.filter((x) => x.genre === "texte" && x.opacite >= 0.05 && x.id.startsWith("s2/liste"));
        const textesPanneau = e.filter((x) => x.genre === "texte" && x.opacite >= 0.05 && x.id.startsWith("s2/panneau"));
        for (const a of textesPanneau) for (const b of textesListe) expect(inter(a.rect, b.rect), `t=${t} ${a.id} / ${b.id}`).toBe(false);
        // Tour 10 : la largeur de la liste GLISSE (aucun saut) pendant que le panneau entre par la droite.
        expect(Math.abs(largeurListe(t) - prec), `t=${t} saut de la liste`).toBeLessThanOrEqual(0.15 * plein);
        if (panneau && panneau.opacite > 0.99) expect(liste.rect.x + liste.rect.largeur, `t=${t} liste / panneau`).toBeLessThanOrEqual(panneau.rect.x + 1e-6);
        if (panneau && panneau.opacite >= 0.05) {
          if (!Number.isNaN(precX)) expect(Math.abs(panneau.rect.x - precX), `t=${t} saut du panneau`).toBeLessThanOrEqual(0.12 * panneau.rect.largeur);
          precX = panneau.rect.x;
        }
        prec = largeurListe(t);
        finListe = prec;
      }
      expect(finListe).toBeLessThan(plein * 0.6);
      expect(largeurListe(premierPanneau + 400)).toBeLessThan(plein * 0.7);
    }
  });

  it("alerte : la carte « Passent sous le seuil » n'a qu'UN contour terracotta (pas de double bordure), le toast n'a plus de pastille", () => {
    for (const p of [plan, reel]) {
      const al = ecranDe(p).evenements.find((e) => e.genre === "alerte")!;
      for (let t = al.aMs + 100; t < ecranDe(p).finMs - 200; t += 100) {
        const e = els(t, p);
        const carte = e.find((x) => x.id === "s2/carte-2")!.rect;
        const entoure = e.filter((x) => x.contour === "terracotta" && x.opacite > 0.05 && x.rect.x <= carte.x + 1e-6 && x.rect.x + x.rect.largeur >= carte.x + carte.largeur - 1e-6 && x.rect.y <= carte.y + 1e-6 && x.rect.y + x.rect.hauteur >= carte.y + carte.hauteur - 1e-6 && x.rect.largeur < carte.largeur + 20 * sc);
        expect(entoure.map((x) => x.id), `t=${t}`).toEqual(["s2/pulse-carte"]);
        expect(e.find((x) => x.id === "s2/carte-2/allume"), `t=${t} pas de double bordure`).toBeUndefined();
        expect(e.find((x) => x.id === "s2/alerte/pastille")).toBeUndefined();
      }
    }
  });

  it("alerte : toast ≥ 40 px, cloche ≥ 40 px, jusqu'à 2 lignes dans la barre qui grandit, jamais un mot coupé", () => {
    for (const p of [plan, reel]) {
      const t = 33600;
      const e = els(t, p);
      const txt = e.find((x) => x.id === "s2/alerte/texte")!;
      const cloche = e.find((x) => x.id === "s2/alerte/cloche")!;
      const filet = e.find((x) => x.id === "s2/fenetre/filet")!;
      const fen = e.find((x) => x.id === "s2/fenetre")!;
      expect(txt.taillePx!).toBeGreaterThanOrEqual(40 * sc * 0.99);
      expect(cloche.rect.largeur).toBeGreaterThanOrEqual(40 * sc * 0.99);
      expect(txt.lignes!.length).toBeLessThanOrEqual(2);
      expect(txt.tronque).toBeUndefined();
      expect(txt.lignes!.join(" ")).toBe("Un article passe sous le seuil");
      if (txt.lignes!.length === 2) expect(filet.rect.y - fen.rect.y, "la barre a grandi").toBeGreaterThan(110 * sc);
    }
  });

  it("alerte : toast de 45-47 caractères jamais sous 36 px (raccourci à une frontière de mot si besoin), titre de fenêtre jamais sous 40 px", () => {
    for (const texte of ["Trois articles passent sous le seuil de réserve", "Trois articles passent sous le seuil de sécurité fixé"]) {
      for (const titreFenetre of ["Tableau de bord", "Tableau de bord des stocks"]) {
        const q = copie(PLAN_SANS_VOIX_STOCKS);
        evDe(q, "alerte").texte = texte;
        ecranDe(q).titreFenetre = titreFenetre;
        const p = planPour(f, q);
        for (const t of [33000, 33700]) {
          const e = els(t, p);
          const a = e.find((x) => x.id === "s2/alerte/texte")!;
          const ti = e.find((x) => x.id === "s2/fenetre/titre")!;
          expect(a.taillePx!, `${texte} ${titreFenetre} toast`).toBeGreaterThanOrEqual(36 * sc);
          expect(ti.taillePx!, `${titreFenetre} titre`).toBeGreaterThanOrEqual(40 * sc * 0.99);
          expect(ti.lignes!.length).toBe(1);
          for (const x of [a, ti]) if (x.tronque) expect(x.texteSource!.startsWith(x.texte!.replace(/…$/, "")), x.id).toBe(true);
          for (const x of e.filter((y) => y.genre === "texte" && y.opacite >= 0.05 && y.id !== "s2/alerte/texte" && y.id.startsWith("s2/"))) {
            expect(inter(a.rect, x.rect), `${x.id} sous le toast`).toBe(false);
          }
        }
      }
    }
  });

  it("l'étiquette « Par urgence » n'apparaît qu'une fois les lignes rétrécies : elle ne recouvre jamais une ligne", () => {
    for (const p of [plan, reel]) {
      const tri = ecranDe(p).evenements.find((e) => e.genre === "tri")!;
      for (let t = tri.aMs - 100; t <= tri.aMs + 1200; t += 20) {
        const e = els(t, p);
        const et = e.find((x) => x.id === "s2/liste/etiquette");
        if (!et || et.opacite < 0.05) continue;
        for (const r of e.filter((x) => /^s2\/rang-\d+$/.test(x.id) && x.opacite > 0.05)) expect(inter(et.rect, r.rect), `t=${t} ${r.id}`).toBe(false);
      }
    }
  });

  it("pictogrammes : trois cartes, trois pictogrammes DISTINCTS (boite, seuil, valeur), choisis par mots-clés, dans leur carte et à gauche", () => {
    expect(pictogrammesCartes(["Articles en stock", "Passent sous le seuil", "Valeur totale"])).toEqual(["boite", "seuil", "valeur"]);
    expect(pictogrammesCartes(["Montant", "Alerte rupture", "Stock"])).toEqual(["valeur", "seuil", "boite"]);
    expect(pictogrammesCartes(["Chiffre d'affaires", "Rupture", "Article"])).toEqual(["valeur", "seuil", "boite"]);
    expect(pictogrammesCartes(["Clients", "Ventes", "Marge"])).toEqual(["boite", "seuil", "valeur"]);
    expect(pictogrammesCartes(["Stock A", "Stock B", "Stock C"])).toEqual(["boite", "seuil", "valeur"]);
    expect(pictogrammesCartes(["Articles en stock", "Passent sous le seuil", "Valeur totale"])).toEqual(pictogrammesCartes(["Articles en stock", "Passent sous le seuil", "Valeur totale"]));
    for (const p of [plan, reel]) {
      const e = els(8000, p);
      const icones = [1, 2, 3].map((k) => e.find((x) => x.id === `s2/carte-${k}/icone`)!);
      expect(icones.map((i) => i.icone)).toEqual(["boite", "seuil", "valeur"]);
      expect(new Set(icones.map((i) => i.icone)).size).toBe(3);
      icones.forEach((i, k) => {
        const lib = e.find((x) => x.id === `s2/carte-${k + 1}/libelle`)!;
        expect(i.parentId).toBe(`s2/carte-${k + 1}`);
        expect(dedans(i.rect, e.find((x) => x.id === `s2/carte-${k + 1}`)!.rect)).toBe(true);
        expect(i.rect.x, "à gauche du libellé").toBeLessThanOrEqual(lib.rect.x + 1e-6);
        expect(i.rect.largeur).toBeGreaterThanOrEqual(26 * sc);
        expect(i.genre).toBe("forme");
      });
    }
  });

  it("mini-graphiques : une forme DIFFÉRENTE par carte", () => {
    if (f.nom === "1:1" || f.nom === "16:9") return;
    const e = els(8000);
    const profil = (k: number) => e.filter((x) => new RegExp(`^s2/carte-${k}/col-\\d+$`).test(x.id)).sort((a, b) => a.rect.x - b.rect.x).map((x) => Math.round(x.rect.hauteur));
    const p1 = profil(1);
    const p2 = profil(2);
    const p3 = profil(3);
    expect(p1.length).toBeGreaterThan(5);
    expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p2));
    expect(JSON.stringify(p2)).not.toBe(JSON.stringify(p3));
    expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p3));
  });

  it("fin : le curseur reste DANS le contenu (sans site comme avec) et sa pointe est ≥ 12 px sous le texte du bouton", () => {
    const z = zonesSansVoix(plan.format, plan.basPct).contenu;
    for (const base of [PLAN_SANS_VOIX_STOCKS, PLAN_SANS_VOIX_REEL]) {
      for (const sansSite of [false, true]) {
        const q = copie(base);
        const ap = q.scenes[3] as Extract<SceneSansVoix, { genre: "appel" }>;
        if (sansSite) {
          delete ap.site;
          delete ap.marque;
        }
        const p = planPour(f, q);
        for (let t = ap.debutMs; t <= ap.finMs; t += 20) {
          const e = els(t, p);
          const cur = e.find((x) => x.id === "s4/curseur" && x.opacite > 0.05);
          if (!cur) continue;
          expect(dedans(cur.rect, z, 0.01), `t=${t} sansSite=${sansSite} ${base === PLAN_SANS_VOIX_REEL ? "réel" : "fixture"} curseur ${JSON.stringify(cur.rect)} contenu ${JSON.stringify(z)}`).toBe(true);
        }
        let derniere = null as ReturnType<typeof els>[number] | null;
        let eDer: ReturnType<typeof els> = [];
        for (let t = ap.debutMs; t <= ap.finMs; t += 20) {
          const e = els(t, p);
          const c = e.find((x) => x.id === "s4/curseur" && x.opacite > 0.5);
          if (c) {
            derniere = c;
            eDer = e;
          }
        }
        const e = eDer;
        const tx = e.find((x) => x.id === "s4/bouton/texte")!;
        const cur = derniere!;
        expect(cur.pointe!.y - (tx.rect.y + tx.rect.hauteur), "pointe sous le texte").toBeGreaterThanOrEqual(12 * sc * 0.97);
      }
    }
  });

  it("titre d'ouverture : le titre domine toujours la question, même longue (tour 11)", () => {
    const q = copie(PLAN_SANS_VOIX_REEL);
    (q.scenes[0] as Extract<SceneSansVoix, { genre: "titre" }>).surTitre = "Vous perdez un temps fou chaque semaine à compter vos stocks à la main, article après article, et à vérifier les écarts ?";
    const p = planPour(f, q);
    for (const t of [1500, 3000]) {
      const e = els(t, p);
      const sur = e.find((x) => x.id === "s1/sur-titre");
      const ti = e.find((x) => x.id === "s1/titre");
      if (sur && ti) expect(sur.taillePx!, `t=${t}`).toBeLessThan(ti.taillePx!);
    }
  });
});

describe.each(FORMATS)("QUAL-1 tour 10 : ouverture opaque, conteneurs jamais vides, alerte, mini-graphiques ($nom)", (f) => {
  const plan = planPour(f);
  const sc = echelleFormat(plan.format);
  const els = (t: number, p = plan) => imageSansVoixA(p, t).elements;

  it("première image (0 ms) OPAQUE : le titre est à l'opacité 1", () => {
    const e = els(0);
    expect(e.length).toBeGreaterThan(0);
    for (const x of e.filter((y) => y.genre === "texte")) expect(x.opacite, x.id).toBeGreaterThanOrEqual(0.999);
  });

  it("aucun conteneur (panneau, carte) visible > 0,5 s sans au moins un enfant à opacité ≥ 0,5", () => {
    for (const p of [plan, planPour(f, PLAN_SANS_VOIX_REEL)]) {
      const parents = new Set<string>();
      for (let t = 0; t <= p.dureeMs; t += 500) for (const x of els(t, p)) if (x.parentId) parents.add(x.parentId);
      const debutVide = new Map<string, number>();
      for (let t = 0; t <= p.dureeMs; t += 40) {
        const e = els(t, p);
        for (const id of parents) {
          const c = e.find((x) => x.id === id);
          const vide = !!c && c.opacite >= 0.05 && !e.some((x) => x.parentId === id && x.opacite >= 0.5);
          if (!vide) debutVide.delete(id);
          else if (!debutVide.has(id)) debutVide.set(id, t);
          else expect(t - debutVide.get(id)!, `${id} vide depuis ${debutVide.get(id)} (t=${t})`).toBeLessThanOrEqual(500);
        }
      }
    }
  });

  it("le panneau Historique entre REMPLI : libellés grisés dès son entrée, allumés (noirs) au mot", () => {
    const pan = evDe(plan, "panneau");
    const tIn = pan.aMs + 700;
    const lib = els(tIn).filter((x) => /panneau\/rubrique-\d\/libelle$/.test(x.id));
    expect(lib.length).toBeGreaterThanOrEqual(2);
    const premier = pan.rubriques[pan.rubriques.length - 1];
    for (const l of lib) expect(l.opacite, l.id).toBeGreaterThanOrEqual(0.5);
    const tard = els(Math.max(premier.aMs, pan.aMs) + 1500).filter((x) => /panneau\/rubrique-\d\/libelle$/.test(x.id));
    for (const l of tard) expect(l.couleur, l.id).toBe("noir");
  });

  it("mini-graphiques des cartes : ≤ 7 colonnes épaisses (≥ 12 px) espacées (≥ 6 px), hauteur ≥ 26 px ; plus de petits traits gris près des icônes", () => {
    const e = els(plan.scenes[1].debutMs + 130 + 900 + 800 * 4);
    for (const k of [1, 2, 3]) {
      const cols = e.filter((x) => new RegExp(`^s2/carte-${k}/col-\\d+$`).test(x.id) && x.opacite > 0.15).sort((a, b) => a.rect.x - b.rect.x);
      if (cols.length === 0) continue;
      expect(cols.length).toBeLessThanOrEqual(8);
      const pleines = cols.filter((c) => c.rect.largeur > 11.9 * sc);
      expect(pleines.length, `carte ${k}`).toBeGreaterThanOrEqual(5);
      for (const c of pleines) expect(c.rect.hauteur, `${c.id} hauteur`).toBeGreaterThanOrEqual(26 * sc * 0.99);
      for (let i = 1; i < pleines.length; i++) {
        const ecart = pleines[i].rect.x - (pleines[i - 1].rect.x + pleines[i - 1].rect.largeur);
        if (pleines[i].rect.largeur > 0.9 * pleines[0].rect.largeur && pleines[i - 1].rect.largeur > 0.9 * pleines[0].rect.largeur) expect(ecart, `${k} écart`).toBeGreaterThanOrEqual(5.9 * sc);
      }
      expect(e.find((x) => x.id === `s2/carte-${k}/accent`), `carte ${k} : plus de trait gris près de l'icône`).toBeUndefined();
    }
  });

  it("alerte : halo terracotta unique de 500 ms autour du toast, cloche qui s'agite (±8 px, 3 oscillations), barre de la ligne concernée qui baisse sous le marqueur « seuil »", () => {
    const ev = evDe(plan, "alerte");
    const sc2 = plan.scenes[1];
    const tDecl = ev.declencheurAMs ?? ev.aMs + 0.6 * (sc2.finMs - ev.aMs);
    const halo = (t: number) => els(t).find((x) => x.id === "s2/halo-alerte");
    expect(halo(tDecl - 50)).toBeUndefined();
    expect(halo(tDecl + 100)!.opacite).toBeGreaterThan(0.5);
    expect(halo(tDecl + 100)!.contour).toBe("terracotta");
    expect(halo(tDecl + 300)!.rect.largeur).toBeGreaterThan(halo(tDecl + 100)!.rect.largeur);
    expect(halo(tDecl + 520)).toBeUndefined();
    const xs: number[] = [];
    for (let t = tDecl + 20; t < tDecl + 900; t += 20) xs.push(els(t).find((x) => x.id === "s2/alerte/cloche")!.rect.x - els(t).find((x) => x.id === "s2/alerte")!.rect.x);
    const rep = Math.min(...xs.slice(-3));
    const sens = xs.map((x) => Math.sign(x - rep)).filter((v, i, a) => v !== 0 && (i === 0 || v !== a[i - 1]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10 * sc);
    expect(sens.length).toBeGreaterThanOrEqual(5);
    const barre = (t: number) => els(t).find((x) => x.id === "s2/rang-1/barre")!.rect.largeur;
    const seuil = els(tDecl).find((x) => x.id === "s2/rang-1/seuil")!;
    const bx = els(tDecl).find((x) => x.id === "s2/rang-1/barre")!.rect.x;
    expect(seuil.remplissage).toBe("terracotta");
    expect(barre(ev.aMs + 700)).toBeGreaterThan(seuil.rect.x - bx); // la liste est revenue pleine largeur (500 ms)
    expect(barre(tDecl)).toBeLessThan(seuil.rect.x - bx);
  });

  it("autour de l'alerte les deux autres cartes redeviennent grises : « sous le seuil » reste la seule cernée de terracotta", () => {
    const ev = evDe(plan, "alerte");
    const e = els(ev.aMs + 800);
    const allumees = e.filter((x) => /^s2\/carte-\d\/allume$/.test(x.id) && x.opacite > 0.05);
    expect(allumees.length).toBe(0);
    expect(e.find((x) => x.id === "s2/pulse-carte")!.opacite).toBeGreaterThan(0.9);
  });
});

describe.each(FORMATS)("QUAL-1 tour 11 : caméra dirigée, tuiles, historique, halo, accroche ($nom)", (f) => {
  const reel = planPour(f, PLAN_SANS_VOIX_REEL);
  const sc = echelleFormat(reel.format);
  const z = zonesSansVoix(reel.format, reel.basPct);
  const els = (t: number) => imageSansVoixA(reel, t).elements;
  const par = (t: number, id: string) => els(t).find((e) => e.id === id);
  const compact = z.contenu.hauteur < 760 * sc;
  const fin = 43925;

  it("caméra bornée : toutes les 40 ms, tous les éléments restent dans le contenu et hors de la bande des sous-titres", () => {
    const pb: string[] = [];
    for (let t = 0; t <= fin; t += 40) pb.push(...problemes(reel, t));
    expect(pb.slice(0, 5)).toEqual([]);
  });

  it("caméra par zones : chaque changement de zone (cartes, liste, Historique, alerte) recadre nettement (≥ 40 px du centre ou ≥ 5 % d'échelle)", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const ev = (g: string) => sce.evenements.find((e) => e.genre === g)!;
    const tClic = Math.max((ev("clic") as { aMs: number }).aMs, sce.debutMs + 1600);
    const zones = [
      { nom: "cartes", t: ev("cartes-chiffres").aMs },
      { nom: "liste", t: ev("liste").aMs },
      { nom: "Historique", t: Math.max(ev("panneau").aMs, tClic + 500) },
      { nom: "alerte", t: ev("alerte").aMs },
    ];
    const centre = (t: number) => {
      const r = par(t, "s2/fenetre")!.rect;
      return { x: r.x + r.largeur / 2, y: r.y + r.hauteur / 2, l: r.largeur };
    };
    for (const zn of zones) {
      const a = centre(zn.t - 20);
      const b = centre(zn.t + 900);
      const dep = Math.hypot(b.x - a.x, b.y - a.y);
      const ech = Math.abs(b.l / a.l - 1);
            expect(dep >= 40 * sc * 0.97 || ech >= 0.05 - 1e-6, `${zn.nom} : déplacement ${dep.toFixed(1)} px, échelle ${(ech * 100).toFixed(1)} %`).toBe(true);
    }
  });

  it("caméra douce : |Δx|, |Δy|, |Δlargeur| ≤ 6 px par image et |accélération| ≤ 3 px/img², toutes les 40 ms, sur la fenêtre", () => {
    for (const p of [reel, planPour(f)]) {
      const sce = p.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
      const r = (t: number) => imageSansVoixA(p, t).elements.find((e) => e.id === "s2/fenetre")!.rect;
      const mes: { x: number; y: number; l: number }[] = [];
      // Hors entrée (200 ms) et sortie de scène : seuls comptent les recadrages voulus.
      for (let t = sce.debutMs + 400; t <= sce.finMs - 200; t += 40) {
        const q = r(t);
        mes.push({ x: q.x, y: q.y, l: q.largeur });
      }
      for (let i = 1; i < mes.length; i++) {
        const dx = mes[i].x - mes[i - 1].x;
        const dy = mes[i].y - mes[i - 1].y;
        const dl = mes[i].l - mes[i - 1].l;
        expect(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dl)), `vitesse i=${i}`).toBeLessThanOrEqual(6 * sc);
        if (i >= 2) {
          const ax = dx - (mes[i - 1].x - mes[i - 2].x);
          const ay = dy - (mes[i - 1].y - mes[i - 2].y);
          const al = dl - (mes[i - 1].l - mes[i - 2].l);
          expect(Math.max(Math.abs(ax), Math.abs(ay), Math.abs(al)), `accélération i=${i}`).toBeLessThanOrEqual(3 * sc);
        }
      }
    }
  });

  it("tuile citée dominante : 1,08 de (aMs − 300 ms) à l'aMs de la suivante, fond terracotta ≤ 0,12, les deux autres à 0,75 ; barres qui poussent", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const ev = sce.evenements.find((e) => e.genre === "cartes-chiffres") as Extract<EvenementEcran, { genre: "cartes-chiffres" }>;
    const larg = (t: number, k: number) => par(t, `s2/carte-${k + 1}`)!.rect.largeur;
    // La caméra ne bouge pas pendant ces mesures (tuiles comparées entre elles à un même instant).
    ev.cartes.forEach((c, k) => {
      const suiv = ev.cartes[k + 1]?.aMs ?? c.aMs + 1000;
      const t = Math.min(c.aMs + 400, suiv - 400);
      const autres = [0, 1, 2].filter((j) => j !== k);
      const ratio = larg(t, k) / larg(t, autres[0]);
      expect(ratio, `tuile ${k + 1} ${f.nom}`).toBeGreaterThanOrEqual(compact ? 1.003 : 1.07);
      expect(ratio).toBeLessThanOrEqual(1.081);
      expect(par(t, `s2/carte-${k + 1}`)!.opacite).toBeGreaterThan(0.95);
      for (const j of autres) expect(par(t, `s2/carte-${j + 1}`)!.opacite, `atténuée ${j + 1}`).toBeCloseTo(OPACITE_ATTENUEE, 2);
      const teinte = par(t, `s2/carte-${k + 1}/teinte`)!;
      expect(teinte.remplissage).toBe("terracotta");
      expect(teinte.opacite).toBeLessThanOrEqual(0.12);
      expect(teinte.opacite).toBeGreaterThan(0.05);
      // Avant (a − 300) : aucune mise en avant.
      expect(par(c.aMs - 320, `s2/carte-${k + 1}/teinte`)).toBeUndefined();
    });
    // Entre le focus « cartes » et sa tuile : le cadre de groupe disparaît pendant la mise en avant (jamais collé aux bordures des tuiles).
    for (const t of [ev.cartes[1].aMs + 400, ev.cartes[2].aMs + 400]) {
      const cadre = par(t, "s2/focus-cadre");
      expect(!cadre || cadre.opacite < 0.05, `cadre à ${t}`).toBe(true);
    }
    const a = ev.cartes[0].aMs;
    const barre = (t: number) => par(t, "s2/carte-1/valeur")!.rect.largeur;
    expect(barre(a + 600)).toBeGreaterThan(barre(a + 150) * 1.5);
  });

  it("tri visible : lignes en désordre, puis glissé de 450 ms vers le rang trié (≥ 1 hauteur de ligne pour ≥ 2 lignes), pastilles du plus foncé au plus clair", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const tri = sce.evenements.find((e) => e.genre === "tri")!.aMs;
    const lignes = (t: number) => els(t).filter((e) => /^s2\/rang-\d+$/.test(e.id)).map((e) => ({ id: e.id, y: e.rect.y, h: e.rect.hauteur }));
    const avant = lignes(tri - 20);
    const apres = lignes(tri + 450 + 20);
    const bouge = avant.filter((a0) => Math.abs(apres.find((x) => x.id === a0.id)!.y - a0.y) >= a0.h * 0.97);
    expect(bouge.length).toBeGreaterThanOrEqual(2);
    // Triées après : le rang 1 est en haut, les autres suivent dans l'ordre.
    const ordre = [...apres].sort((a0, b0) => a0.y - b0.y).map((x) => x.id);
    expect(ordre).toEqual(apres.map((x) => x.id).sort());
    // Pas triées avant.
    expect([...avant].sort((a0, b0) => a0.y - b0.y).map((x) => x.id)).not.toEqual(ordre);
    // Pastilles : opacité décroissante du rang 1 au dernier.
    const pas = apres.map((x) => els(tri + 470).find((e) => e.id === `${x.id}/pastille`)!.opacite);
    for (let i = 1; i < pas.length; i++) expect(pas[i]).toBeLessThan(pas[i - 1]);
    // Fini en 450 ms : plus de mouvement ensuite.
    expect(Math.abs(lignes(tri + 600)[0].y - apres[0].y)).toBeLessThan(2 * sc);
  });

  it("changement de plan à l'Historique : liste en bande ≤ 25 %, Historique ≥ 70 %, lignes 2..N effacées, mini-barres supprimées, libellés ≥ 34 px", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const tClic = Math.max((sce.evenements.find((e) => e.genre === "clic") as { aMs: number }).aMs, sce.debutMs + 1600);
    const tP = Math.max(sce.evenements.find((e) => e.genre === "panneau")!.aMs, tClic + 500);
    const t = 27800; // panneau ouvert, toutes les rubriques construites, avant l'alerte
    expect(t).toBeGreaterThan(tP + 1500);
    const e = els(t);
    const fen = e.find((x) => x.id === "s2/fenetre")!.rect;
    const liste = e.find((x) => x.id === "s2/liste")!.rect;
    const pan = e.find((x) => x.id === "s2/panneau")!.rect;
    expect(liste.largeur / fen.largeur).toBeLessThanOrEqual(0.25);
    expect(pan.largeur / fen.largeur).toBeGreaterThanOrEqual(0.7);
    expect(e.find((x) => x.id === "s2/rang-1")!.opacite).toBeGreaterThan(0.9);
    for (const x of e.filter((y) => /^s2\/rang-[2-9]/.test(y.id))) expect(x.opacite, x.id).toBeLessThan(0.05);
    expect(e.filter((x) => /\/mini-\d+$/.test(x.id) && x.opacite >= 0.05)).toEqual([]);
    for (const x of e.filter((y) => y.genre === "texte" && y.id.startsWith("s2/panneau/") && y.opacite > 0.5)) expect(x.taillePx!, x.id).toBeGreaterThanOrEqual(34 * sc - 0.5);
    if (!compact) {
      const col = Math.max(...e.filter((x) => /rubrique-\d\/colonne-\d$/.test(x.id)).map((x) => x.rect.hauteur));
      expect(col).toBeGreaterThanOrEqual(44 * sc);
      const frise = e.find((x) => x.id.endsWith("colonne-frise"))!;
      expect(frise.rect.hauteur).toBeGreaterThanOrEqual(12 * sc * 0.99);
    }
    // Les mini-barres n'existent jamais quand la liste fait < 50 % de la fenêtre.
    for (let u = sce.debutMs + 300; u <= sce.finMs - 200; u += 40) {
      const ee = els(u);
      const f2 = ee.find((x) => x.id === "s2/fenetre")!.rect;
      const l2 = ee.find((x) => x.id === "s2/liste")!.rect;
      if (l2.largeur < 0.5 * f2.largeur) expect(ee.filter((x) => /\/mini-\d+$/.test(x.id) && x.opacite >= 0.05).length, `t=${u}`).toBe(0);
    }
  });

  it("à l'alerte : l'Historique se referme (glisse à droite, 500 ms) et la liste revient pleine largeur", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const al = sce.evenements.find((e) => e.genre === "alerte")!.aMs;
    const rel = (t: number, id: string) => {
      const ee = els(t);
      const f2 = ee.find((x) => x.id === "s2/fenetre")!.rect;
      return ee.find((x) => x.id === id)!.rect.largeur / f2.largeur;
    };
    expect(par(al - 50, "s2/panneau")!.opacite).toBeGreaterThan(0.95);
    const x0 = par(al - 50, "s2/panneau")!.rect.x;
    expect(par(al + 250, "s2/panneau")!.rect.x).toBeGreaterThan(x0 + 20 * sc);
    expect(par(al + 600, "s2/panneau")!.opacite).toBeLessThan(0.05);
    expect(rel(al - 50, "s2/liste")).toBeLessThanOrEqual(0.25);
    expect(rel(al + 600, "s2/liste")).toBeGreaterThanOrEqual(0.9);
    expect(par(al + 600, "s2/liste/titre")!.opacite).toBeGreaterThan(0.9);
  });

  it("lisibilité : titre de fenêtre ≥ 32 px graisse 800, pastille « Par urgence » ≥ 26 px, toast ≥ 28 px à ≥ 24 px du titre", () => {
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const titre = par(12000, "s2/fenetre/titre")!;
    expect(titre.graisse).toBe(800);
    expect(titre.taillePx!).toBeGreaterThanOrEqual(32 * sc - 0.5);
    const tri = sce.evenements.find((e) => e.genre === "tri")!.aMs;
    expect(par(tri + 1000, "s2/liste/etiquette/texte")!.taillePx!).toBeGreaterThanOrEqual(26 * sc);
    const decl = (sce.evenements.find((e) => e.genre === "alerte") as { declencheurAMs: number }).declencheurAMs;
    const toast = par(decl + 700, "s2/alerte/texte")!;
    expect(toast.taillePx!).toBeGreaterThanOrEqual(28 * sc);
    const ti = par(decl + 700, "s2/fenetre/titre")!.rect;
    const al = par(decl + 700, "s2/alerte")!.rect;
    expect(al.x - (ti.x + ti.largeur)).toBeGreaterThanOrEqual(24 * sc * 0.98);
  });

  it("historique : mini-barres toujours dans le panneau (entrée comprise), libellés dans le panneau, rubriques construites à leur mot", () => {
    for (let t = 23000; t <= 29000; t += 40) {
      const p = par(t, "s2/panneau");
      if (!p) continue;
      for (const e of els(t).filter((x) => x.id.startsWith("s2/panneau/") && (x.id.includes("/colonne-") || x.id.endsWith("/libelle")))) {
        expect(dedans(e.rect, p.rect, 0.01), `${t} ${e.id}`).toBe(true);
      }
    }
    // Les colonnes d'une rubrique poussent une à une, à partir de SON mot (et pas toutes ensemble).
    const sce = reel.scenes[1] as Extract<SceneSansVoix, { genre: "ecran" }>;
    const pan = sce.evenements.find((e) => e.genre === "panneau") as Extract<EvenementEcran, { genre: "panneau" }>;
    const r2 = pan.rubriques[1];
    const h = (t: number, j: number) => par(t, `s2/panneau/rubrique-2/colonne-${j}`)?.rect.hauteur ?? 0;
    const t0 = Math.max(r2.aMs, pan.aMs + 600);
    if (h(t0 + 1400, 6) > 0) {
      expect(h(t0 + 500, 1)).toBeGreaterThan(h(t0 + 500, 6));
      expect(h(t0 + 1400, 6)).toBeGreaterThan(h(t0 + 500, 6));
    }
  });

  it("libellés de l'historique : pas visibles avant la fin du glissé du tiroir (aucun débordement)", () => {
    for (let t = 23500; t < 23800; t += 40) {
      const p = par(t, "s2/panneau");
      if (!p) continue;
      for (const e of els(t).filter((x) => /s2\/panneau\/rubrique-\d+\/libelle$/.test(x.id))) expect(e.opacite, `${t} ${e.id}`).toBeLessThan(0.3);
    }
  });

  it("halo de l'alerte : dans la fenêtre (carte) et dans le contenu, à ≥ 24 px du titre de la fenêtre", () => {
    let vu = 0;
    for (let t = 32000; t <= 34400; t += 20) {
      const h = par(t, "s2/halo-alerte");
      if (!h) continue;
      vu++;
      const fen = par(t, "s2/fenetre")!.rect;
      expect(dedans(h.rect, fen, 0.01), `${t} carte`).toBe(true);
      expect(dedans(h.rect, z.contenu, 0.01), `${t} contenu`).toBe(true);
      const ti = par(t, "s2/fenetre/titre")!.rect;
      expect(h.rect.x - (ti.x + ti.largeur), `${t} titre`).toBeGreaterThanOrEqual(24 * sc * 0.98);
    }
    expect(vu).toBeGreaterThan(10);
  });

  it("accroche : le titre domine la question (taille, graisse), ≥ 28 px entre les deux", () => {
    const sur = par(2000, "s1/sur-titre")!;
    const ti = par(2000, "s1/titre")!;
    expect(sur.taillePx!).toBeLessThan(ti.taillePx! * 0.8);
    expect(sur.graisse!).toBeLessThanOrEqual(600);
    expect(ti.rect.y - (sur.rect.y + sur.rect.hauteur)).toBeGreaterThanOrEqual(28 * sc * 0.99);
  });

  it("grande horloge d'ouverture : écart ≥ 120° avec la petite aiguille dès l'image 0", () => {
    for (const t of [0, 40, 1000, 4000]) {
      const h = par(t, "s1/pile/horloge");
      if (!h) continue;
      const ecart = Math.abs(300 - h.progression! * 360);
      expect(Math.min(ecart, 360 - ecart), `t=${t}`).toBeGreaterThanOrEqual(120);
    }
  });
});
