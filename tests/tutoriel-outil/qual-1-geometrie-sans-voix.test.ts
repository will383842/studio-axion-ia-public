/**
 * QUAL-1 : géométrie pure du tutoriel sans voix composé. Invariants vérifiés toutes les 100 ms, 4 formats.
 */
import { describe, expect, it } from "vitest";
import { positionsVerticales } from "@/briques/sous-titres/largeur";
import { contrasteWcag } from "@/briques/charte/axion-2026";
import { COULEURS_HEX, NOMS_COULEURS, TAILLES_MIN, contrasteHex, taillesMinPour, zonesSansVoix, echelleFormat } from "@/briques/plan-scenes/tutoriel/sans-voix/grammaire";
import { imageSansVoixA } from "@/briques/plan-scenes/tutoriel/sans-voix/geometrie";
import type { ElementVisible, PlanComposeSansVoix, RectPx } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { DUREE_STOCKS_MS, PLAN_SANS_VOIX_STOCKS } from "./fixtures/plan-sans-voix-stocks";

const FORMATS = [
  { nom: "4:5", ratio: "4:5" as const, largeur: 1080, hauteur: 1350 },
  { nom: "9:16", ratio: "9:16" as const, largeur: 1080, hauteur: 1920 },
  { nom: "1:1", ratio: "1:1" as const, largeur: 1080, hauteur: 1080 },
  { nom: "16:9", ratio: "16:9" as const, largeur: 1920, hauteur: 1080 },
];

function planPour(f: (typeof FORMATS)[number]): PlanComposeSansVoix {
  const basPct = f.nom === "4:5" ? 87 : positionsVerticales(f.ratio, []).basPct;
  return { ...PLAN_SANS_VOIX_STOCKS, format: { largeur: f.largeur, hauteur: f.hauteur, fps: 25 }, basPct };
}

const dedans = (r: RectPx, c: RectPx, eps = 1e-6) => r.x >= c.x - eps && r.y >= c.y - eps && r.x + r.largeur <= c.x + c.largeur + eps && r.y + r.hauteur <= c.y + c.hauteur + eps;
const inter = (a: RectPx, b: RectPx) => a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
const visibles = (els: ElementVisible[]) => els.filter((e) => e.opacite >= 0.05);

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
    expect(contrasteHex(COULEURS_HEX.grisTexte, COULEURS_HEX.ivoire)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(COULEURS_HEX.grisTexte, COULEURS_HEX.blanc)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(COULEURS_HEX.terracotta, COULEURS_HEX.ivoire)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(COULEURS_HEX.grisTexte, COULEURS_HEX.ivoire)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(FORMATS)("QUAL-1 géométrie ($nom)", (f) => {
  const plan = planPour(f);
  const z = zonesSansVoix(plan.format, plan.basPct);
  const min = 32 * echelleFormat(plan.format);
  const instants: number[] = [];
  for (let t = 0; t <= DUREE_STOCKS_MS; t += 100) instants.push(t);

  it("invariants à chaque 100 ms", () => {
    const pb: string[] = [];
    for (const t of instants) {
      const img = imageSansVoixA(plan, t);
      const ids = new Set(img.elements.map((e) => e.id));
      expect(ids.size).toBe(img.elements.length);
      for (const e of visibles(img.elements)) {
        if (!dedans(e.rect, z.contenu)) pb.push(`${t} ${e.id} hors contenu`);
        if (inter(e.rect, z.bande)) pb.push(`${t} ${e.id} dans la bande`);
        if (e.taillePx !== undefined && e.taillePx < min - 1e-6) pb.push(`${t} ${e.id} taille ${e.taillePx}`);
        if (e.lignes && e.lignes.length > 3) pb.push(`${t} ${e.id} ${e.lignes.length} lignes`);
        if (e.genre === "texte" && (!e.lignes || !e.taillePx)) pb.push(`${t} ${e.id} texte sans lignes`);
        for (const c of [e.remplissage, e.contour, e.couleur]) if (c && !NOMS_COULEURS.includes(c)) pb.push(`${t} ${e.id} couleur ${c}`);
        if (e.genre === "curseur") {
          if (!e.cibleId || !ids.has(e.cibleId)) pb.push(`${t} curseur sans cible`);
          else if (img.elements.find((x) => x.id === e.cibleId)!.genre !== "cible") pb.push(`${t} cibleId n'est pas une cible`);
        }
        if (e.parentId && !ids.has(e.parentId)) pb.push(`${t} ${e.id} parent absent`);
        if (e.texte && /\d/.test(e.texte)) pb.push(`${t} chiffre dans ${e.texte}`);
      }
    }
    expect(pb.slice(0, 15)).toEqual([]);
  });

  it("enfants dans leur carte (visibles)", () => {
    const pb: string[] = [];
    for (const t of instants) {
      const img = imageSansVoixA(plan, t);
      const par = new Map(img.elements.map((e) => [e.id, e]));
      for (const e of visibles(img.elements)) {
        if (!e.parentId || e.icone === "point" || e.id.includes("allume") || e.id.includes("pulse")) continue;
        const p = par.get(e.parentId);
        if (p && p.opacite > 0.9 && e.opacite > 0.9 && !dedans(e.rect, p.rect, 1.5)) pb.push(`${t} ${e.id} sort de ${e.parentId}`);
      }
    }
    expect(pb.slice(0, 15)).toEqual([]);
  });

  it("jamais d'image vide : un texte ou une forme de contenu à chaque instant", () => {
    for (const t of instants) {
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
    for (const t0 of [100, 1200, 6000, 10500, 13000, 17500, 20300, 23100, 24000, 28500, 30100, 34100, 35800, 36600, 39000, 40100]) {
      const a = new Set([empreinte(t0), empreinte(t0 + 300), empreinte(t0 + 600)]);
      expect(a.size, `t=${t0}`).toBe(3);
    }
  });
});

describe("QUAL-1 scènes", () => {
  const plan = PLAN_SANS_VOIX_STOCKS;
  const texte = (t: number) => visibles(imageSansVoixA(plan, t).elements).filter((e) => e.genre === "texte").map((e) => e.texte);

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

  it("le clic : curseur vers la ligne 1, anneau à aMs, ligne allumée", () => {
    const a = imageSansVoixA(plan, 22900).elements.find((e) => e.genre === "curseur")!;
    const b = imageSansVoixA(plan, 23250).elements.find((e) => e.genre === "curseur")!;
    expect(a.cibleId).toBe("s2/ligne-1");
    expect(a.anneauClic).toBe(0);
    expect(b.anneauClic).toBeGreaterThan(0);
    expect(imageSansVoixA(plan, 24000).elements.some((e) => e.id === "s2/rang-1/allume" && e.opacite > 0.9)).toBe(true);
    const cible = imageSansVoixA(plan, 23000).elements.find((e) => e.id === "s2/ligne-1")!;
    const c = imageSansVoixA(plan, 23000).elements.find((e) => e.genre === "curseur")!;
    expect(c.pointe!.x).toBeGreaterThanOrEqual(cible.rect.x);
    expect(c.pointe!.x).toBeLessThanOrEqual(cible.rect.x + cible.rect.largeur);
    expect(c.pointe!.y).toBeGreaterThanOrEqual(cible.rect.y);
    expect(c.pointe!.y).toBeLessThanOrEqual(cible.rect.y + cible.rect.hauteur);
  });

  it("le panneau reste dans la fenêtre et ≤ 55 % de sa largeur", () => {
    const els = imageSansVoixA(plan, 28000).elements;
    const fen = els.find((e) => e.id === "s2/fenetre")!;
    const pan = els.find((e) => e.id === "s2/panneau")!;
    expect(pan.rect.largeur).toBeLessThanOrEqual(0.55 * fen.rect.largeur);
    expect(dedans(pan.rect, fen.rect)).toBe(true);
  });

  it("le trait barre « une heure » après barreAMs", () => {
    const barre = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.id === "s3/avant")!.barre!;
    expect(barre(34900)).toBe(0);
    expect(barre(36200)).toBe(1);
    const apres = (t: number) => imageSansVoixA(plan, t).elements.find((e) => e.id === "s3/apres")!.opacite;
    expect(apres(35550)).toBeLessThan(0.05);
    expect(apres(36500)).toBeGreaterThan(0.9);
    expect(texte(34600)).toContain("une heure");
  });

  it("surtitre et plan sans scène", () => {
    const p2: PlanComposeSansVoix = { ...plan, scenes: [{ ...(plan.scenes[0] as never), surTitre: "Tutoriel" }, ...plan.scenes.slice(1)] };
    expect(texte.call(null, 1000)).toBeTruthy();
    const els = imageSansVoixA(p2, 1500).elements;
    expect(els.find((e) => e.id === "s1/sur-titre")!.taillePx).toBeGreaterThanOrEqual(36);
    expect(imageSansVoixA({ ...plan, scenes: [] }, 100).elements).toEqual([]);
  });

  it("libellé très long : 2 lignes puis plancher, jamais sous 32 px", () => {
    const p: PlanComposeSansVoix = JSON.parse(JSON.stringify(plan));
    const ec = p.scenes[1] as Extract<PlanComposeSansVoix["scenes"][number], { genre: "ecran" }>;
    const ev = ec.evenements[0] as Extract<(typeof ec.evenements)[number], { genre: "cartes-chiffres" }>;
    ev.cartes[1].libelle = "Articles passant sous le seuil";
    const l = imageSansVoixA(p, 16000).elements.find((e) => e.id === "s2/carte-2/libelle")!;
    expect(l.taillePx).toBeGreaterThanOrEqual(32);
    expect(l.lignes!.length).toBeLessThanOrEqual(3);
  });

  it("carte-phrase : texte ≥ 56 px", () => {
    const p: PlanComposeSansVoix = { ...plan, scenes: [{ id: "c1", genre: "carte-phrase", debutMs: 0, finMs: 4000, mots: { premier: 0, dernier: 5 }, texte: "Un tableau de bord simple" }] };
    const t = imageSansVoixA(p, 2000).elements.find((e) => e.id === "c1/carte/texte")!;
    expect(t.taillePx).toBeGreaterThanOrEqual(56);
    expect(t.lignes!.length).toBeLessThanOrEqual(3);
  });
});
