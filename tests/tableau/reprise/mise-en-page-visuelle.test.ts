/**
 * Reprise visuelle de la mise en page du tableau animé : page finie qui occupe la hauteur utile, texte sur toute la
 * largeur, rangées équilibrées, une taille par niveau sur la page, marques réservées (ellipse d'« entourer », traits,
 * coche) sans chevauchement, bulle de preuve complète, mesure aux polices dessinées, mots importants.
 * Sur les 20 fiches de test (4 exemples + 16 variantes).
 */
import { describe, expect, it } from "vitest";
import { pointEntourer } from "../../../src/briques/stylo/courbes";
import { validerFicheTableau, type ElementTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { ErreurMiseEnPage, OCCUPATION_MIN, largeurNiveau, mettreEnPage, type ElementPlace, type RectPx } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { contexteExemple, copie, ficheAvantApres, ficheDemonstration, ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";
import { VINGT_FICHES } from "../mise-en-page/variantes";

const recouvre = (a: RectPx, b: RectPx) => Math.min(a.x + a.largeur, b.x + b.largeur) > Math.max(a.x, b.x) && Math.min(a.y + a.hauteur, b.y + b.hauteur) > Math.max(a.y, b.y);
const dedans = (a: RectPx, b: RectPx) => a.x >= b.x && a.y >= b.y && a.x + a.largeur <= b.x + b.largeur && a.y + a.hauteur <= b.y + b.hauteur;
const element = <T extends ElementTableau["type"]>(f: FicheTableau, id: string, type: T) => f.scenes.flatMap((s) => s.elements).find((e) => e.id === id && e.type === type) as Extract<ElementTableau, { type: T }>;
const PREUVES = { phrase: "Posez-moi trois questions", testeLe: "2026-10-09" };
const avecPreuves = (f: FicheTableau) => Object.fromEntries(f.scenes.flatMap((s) => s.elements).filter((e) => e.type === "preuve").map((e) => [e.id, PREUVES]));

describe.each(VINGT_FICHES.map((v) => [v.nom, v.fiche] as const))("%s", (_nom, fiche) => {
  const mp = mettreEnPage(fiche, { preuves: avecPreuves(fiche) });
  const utile = mp.bandeSousTitres.px.y - mp.zoneSure.px.y;

  it(`la page finie occupe au moins ${OCCUPATION_MIN * 100} % de la hauteur utile, marges haute et basse équilibrées`, () => {
    for (const p of mp.pages) {
      const haut = Math.min(...p.elements.map((e) => e.encombrement.px.y));
      const bas = Math.max(...p.elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
      expect((bas - haut) / utile, `page ${p.page}`).toBeGreaterThanOrEqual(OCCUPATION_MIN);
      expect(p.occupation).toBeCloseTo((bas - haut) / utile, 5);
      // Marges : celle du haut ne dépasse pas celle du bas de plus d'un écart (bloc réparti, pas tassé en haut ni en bas).
      const margeHaut = haut - mp.cadre.px.y;
      const margeBas = mp.cadre.px.y + mp.cadre.px.hauteur - bas;
      expect(Math.abs(margeHaut - margeBas)).toBeLessThanOrEqual(0.04 * 1920 + 2);
    }
  });

  it("aucun encombrement (élément + marques) n'en touche un autre ; tous dans le cadre, la zone sûre, au-dessus de la bande", () => {
    for (const p of mp.pages) {
      const els = p.elements;
      for (let i = 0; i < els.length; i++) {
        expect(dedans(els[i].encombrement.px, mp.cadre.px), els[i].elementId).toBe(true);
        expect(dedans(els[i].encombrement.px, mp.zoneSure.px)).toBe(true);
        expect(els[i].encombrement.px.y + els[i].encombrement.px.hauteur).toBeLessThanOrEqual(mp.bandeSousTitres.px.y);
        expect(dedans(els[i].px, els[i].encombrement.px)).toBe(true);
        for (let j = i + 1; j < els.length; j++) expect(recouvre(els[i].encombrement.px, els[j].encombrement.px), `${els[i].elementId} / ${els[j].elementId}`).toBe(false);
      }
      for (const g of p.gestes) if (g.zone) expect(dedans(g.zone.px, els.find((e) => e.elementId === g.cibleId)!.encombrement.px)).toBe(true);
    }
  });

  it("une seule taille par niveau sur toute la page", () => {
    for (const p of mp.pages) {
      const parNiveau = new Map<string, Set<number>>();
      for (const e of p.elements.filter((x) => x.type !== "dessin")) parNiveau.set(e.niveau!, (parNiveau.get(e.niveau!) ?? new Set()).add(e.taillePx!));
      for (const [niveau, tailles] of parNiveau) expect([...tailles], `page ${p.page} · ${niveau}`).toHaveLength(1);
    }
  });

  it("chaque rangée est mesurée aux polices dessinées et tient dans sa boîte", () => {
    for (const e of mp.pages.flatMap((p) => p.elements).filter((x) => x.type !== "dessin" && x.type !== "preuve"))
      for (const l of e.lignes) {
        const w = largeurNiveau(l.texte, e.niveau!, e.taillePx!);
        expect(l.px.largeur).toBe(Math.ceil(w));
        expect(dedans(l.px, e.px)).toBe(true);
      }
  });

  it("l'ellipse d'« entourer » passe au large de sa cible et dans l'encombrement réservé", () => {
    for (const p of mp.pages) {
      const cercles: { c: RectPx; enc: RectPx }[] = [
        ...p.elements.filter((e) => e.marque === "entoure").map((e) => ({ c: e.px, enc: e.encombrement.px })),
        ...p.gestes.filter((g) => g.geste === "entourer").map((g) => ({ c: (g.zone ?? g.cible).px, enc: p.elements.find((e) => e.elementId === g.cibleId)!.encombrement.px })),
      ];
      for (const { c, enc } of cercles)
        for (let i = 0; i <= 200; i++) {
          const q = pointEntourer(c, i / 200);
          const surCible = q.x > c.x && q.x < c.x + c.largeur && q.y > c.y && q.y < c.y + c.hauteur;
          expect(surCible).toBe(false);
          expect(q.x >= enc.x && q.x <= enc.x + enc.largeur && q.y >= enc.y && q.y <= enc.y + enc.hauteur).toBe(true);
        }
    }
  });

  it("bulle de preuve complète : phrase testée, résultats, « Testé le JJ/MM », queue — chacun à sa place, sans chevauchement", () => {
    for (const e of mp.pages.flatMap((p) => p.elements).filter((x) => x.type === "preuve")) {
      const b = e.bulle!;
      expect(b.phrase.map((l) => l.texte).join(" ")).toBe(`« ${PREUVES.phrase} »`);
      expect(b.date.texte).toBe("Testé le 09/10");
      const textes = [...b.phrase, ...b.etiquettes, ...e.lignes, b.date].map((l) => l.px);
      for (const r of textes) expect(dedans(r, e.px)).toBe(true);
      for (let i = 0; i < textes.length; i++) for (let j = i + 1; j < textes.length; j++) expect(recouvre(textes[i], textes[j])).toBe(false);
      // La phrase est au-dessus des résultats, la date dessous.
      expect(Math.max(...b.phrase.map((l) => l.px.y + l.px.hauteur))).toBeLessThanOrEqual(Math.min(...e.lignes.map((l) => l.px.y)));
      expect(b.date.px.y).toBeGreaterThanOrEqual(Math.max(...e.lignes.map((l) => l.px.y + l.px.hauteur)));
      expect(dedans(b.queue.px, e.encombrement.px)).toBe(true);
      // Avant / après étiquetés : l'avant sobre, l'après mis en valeur.
      const tons = new Set(e.lignes.map((l) => l.ton).filter(Boolean));
      for (const ton of tons) expect(b.etiquettes.some((x) => x.ton === ton)).toBe(true);
    }
  });
});

describe("largeur et rangées", () => {
  it("sans dessin à côté, le texte prend toute la largeur du cadre ; à côté d'un dessin, il garde au moins 70 %", () => {
    const mp = mettreEnPage(ficheErreurCorrigee);
    const c = mp.cadre.px;
    for (const p of mp.pages)
      for (const e of p.elements.filter((x) => x.type === "ligne")) {
        const voisins = p.elements.filter((d) => d.type === "dessin" && d.px.y < e.px.y + e.px.hauteur && d.px.y + d.px.hauteur > e.px.y);
        const place = c.x + c.largeur - e.px.x;
        if (!voisins.length) expect(e.encombrement.px.x - c.x).toBeLessThanOrEqual(c.largeur * 0.12);
        else expect(place).toBeGreaterThanOrEqual(c.largeur * 0.7 - (voisins.some((d) => d.cote === "droite") ? c.largeur * 0.3 : 0));
      }
    expect(c.largeur).toBeGreaterThan(669);
  });

  it("plus de rangée d'un seul mot quand le texte tient en deux mots par rangée (« Trois questions d'abord »)", () => {
    const e06 = mettreEnPage(ficheErreurCorrigee).pages.flatMap((p) => p.elements).find((e) => e.elementId === "e06")!;
    expect(e06.lignes.length).toBeLessThanOrEqual(2);
    for (const v of VINGT_FICHES.slice(0, 4))
      for (const e of mettreEnPage(v.fiche).pages.flatMap((p) => p.elements).filter((x) => x.type === "ligne")) {
        const mots = e.lignes.map((l) => l.texte.split(" ").length);
        expect(e.lignes.length, e.lignes.map((l) => l.texte).join(" / ")).toBeLessThanOrEqual(Math.max(1, Math.ceil(mots.reduce((a, b) => a + b, 0) / 2)));
        // Jamais un petit mot (« à », « la », « de ») seul sur une rangée.
        for (const l of e.lignes) if (e.lignes.length > 1) expect(/^[\p{Ll}']{1,3}$/u.test(l.texte)).toBe(false);
      }
  });

  it("la page est AGRANDIE quand elle est peu chargée (échelle > 1) et réduite quand elle est pleine", () => {
    const echelles = VINGT_FICHES.flatMap((v) => mettreEnPage(v.fiche).pages.map((p) => p.echelle));
    expect(Math.max(...echelles)).toBeGreaterThan(1);
    expect(Math.min(...echelles)).toBeLessThan(1);
  });
});

describe("bulle de preuve", () => {
  it("avant / après : deux colonnes étiquetées Avant | Après, séparées d'un trait ; l'après seul mis en valeur", () => {
    const b = mettreEnPage(ficheAvantApres, { preuves: { e09: PREUVES } }).pages.flatMap((p) => p.elements).find((e) => e.elementId === "e09")!;
    expect(b.deuxColonnes).toBe(true);
    expect(b.bulle!.separateur).toBeDefined();
    const sep = b.bulle!.separateur!;
    for (const l of b.lignes) expect(l.colonne === "avant" ? l.px.x + l.px.largeur <= sep.x : l.px.x >= sep.x).toBe(true);
    expect(b.lignes.filter((l) => l.ton === "apres").map((l) => l.texte).join(" ")).toBe("deux minutes");
  });

  it("autres structures : blocs empilés, étiquette à gauche de chaque bloc", () => {
    const b = mettreEnPage(ficheErreurCorrigee, { preuves: { e08: PREUVES } }).pages.flatMap((p) => p.elements).find((e) => e.elementId === "e08")!;
    expect(b.deuxColonnes).toBe(false);
    expect(b.bulle!.etiquettes.map((l) => l.texte)).toEqual(["Avant", "Après"]);
    for (const et of b.bulle!.etiquettes) {
      const contenu = b.lignes.filter((l) => l.ton === et.ton);
      expect(Math.min(...contenu.map((l) => l.px.x))).toBeGreaterThan(et.px.x + et.px.largeur);
    }
  });

  it("sans phrase donnée, la place de la phrase (2 rangées) et de la date est quand même réservée", () => {
    const b = mettreEnPage(ficheDemonstration).pages.flatMap((p) => p.elements).find((e) => e.type === "preuve")!;
    expect(b.bulle!.phrase).toEqual([]);
    expect(b.bulle!.rangeesPhrase).toBe(2);
    expect(b.bulle!.zonePhrase.px.hauteur).toBeGreaterThan(0);
    expect(b.bulle!.date.px.hauteur).toBeGreaterThan(0);
  });

  it("une phrase testée trop longue fait échouer la mise en page en nommant la page (rien n'est omis en silence)", () => {
    const longue = { phrase: "Posez-moi trois questions précises sur mon métier, mes clients, mes prix, mes délais, mes outils et mes habitudes avant de rédiger quoi que ce soit", testeLe: "2026-10-09" };
    expect(() => mettreEnPage(ficheQuestionAbonne, { preuves: { e10: longue } })).toThrow(ErreurMiseEnPage);
    expect(() => mettreEnPage(ficheQuestionAbonne, { preuves: { e10: longue } })).toThrow(/^Page 3 · /);
  });
});

describe("mots importants (champ `importants` de la ligne)", () => {
  it("validé : chaque mot doit être un mot de la ligne (casse, accents et ponctuation ignorés)", () => {
    const f = copie(ficheErreurCorrigee);
    element(f, "e06", "ligne").importants = ["questions", "D'ABORD"];
    expect(validerFicheTableau(f, contexteExemple(f, { mesurerLargeur: () => 0 })).ok).toBe(true);
    element(f, "e06", "ligne").importants = ["réponses"];
    const r = validerFicheTableau(f, contexteExemple(f, { mesurerLargeur: () => 0 }));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problemes.map((p) => p.message).join("\n")).toMatch(/le mot important « réponses » n'est pas un mot de la ligne/);
    element(f, "e06", "ligne").importants = [];
    expect(validerFicheTableau(f, contexteExemple(f, { mesurerLargeur: () => 0 })).ok).toBe(false);
  });

  it("transmis par la mise en page, place du soulignement réservée ; un mot absent fait échouer la mise en page", () => {
    const f = copie(ficheQuestionAbonne);
    element(f, "e07", "ligne").importants = ["toujours"];
    const e = mettreEnPage(f).pages.flatMap((p) => p.elements).find((x) => x.elementId === "e07") as ElementPlace;
    expect(e.importants).toEqual(["toujours"]);
    const derniere = e.lignes[e.lignes.length - 1].px;
    expect(e.encombrement.px.y + e.encombrement.px.hauteur).toBeGreaterThan(derniere.y + derniere.hauteur);
    element(f, "e07", "ligne").importants = ["absent"];
    expect(() => mettreEnPage(f)).toThrow(/le mot important « absent » n'est pas dans la ligne/);
  });
});

describe("page à la limite", () => {
  it("les 20 fiches de test réservent la place de tous leurs gestes", () => {
    for (const v of VINGT_FICHES) for (const p of mettreEnPage(v.fiche).pages) expect(p.gestesSerres, `${v.nom} page ${p.page}`).toBeUndefined();
  });

  it("une page qui ne tient qu'en ôtant la place des gestes se pose quand même, et le signale (la règle 4 la met en page sans ses gestes)", () => {
    const f = copie(ficheErreurCorrigee);
    element(f, "e10", "ligne").texte = Array.from({ length: 20 }, () => "juste").join(" ");
    const sansGestes = { ...f, scenes: f.scenes.map((s) => ({ ...s, elements: s.elements.filter((e) => e.type !== "geste") })) };
    expect(mettreEnPage(sansGestes).pages[2].gestesSerres).toBeUndefined();
    const p = mettreEnPage(f).pages[2];
    expect(p.gestesSerres).toBe(true);
    expect(p.gestes.map((g) => g.geste).sort()).toEqual(["cocher", "entourer"]);
  });
});
