/**
 * PAGES TROP CHARGÉES DU GABARIT CLAIR (style « reference/2 ») : réparées avant tout refus. Défaut réel du 14/10/2026
 * (vidéo v-b19aefb21d57, après l'agrandissement du texte à 90 / 72 / 54 px) : le vrai découpage de Claude a été
 * REFUSÉ deux fois de suite par la règle « page lisible » :
 *  - « page 6 : la page ne tient pas dans la zone sûre, même réduite (titre, phrase clé, 1 détail) » (étape
 *    « Automatisez », un détail de 13 mots qui demandait 4 rangées) ;
 *  - « page 7 … (titre, phrase clé, avant / après, 1 détail) » (exemple du plombier, trop haut en carré).
 * Il avait fallu raccourcir les lignes à la main. Désormais, dans l'ordre : 1) la page est réduite pas à pas jusqu'aux
 * minimums lisibles (titre 70, phrase clé 56, détails 44 px), une longue ligne prenant au besoin 4 rangées ; 2) sinon sa
 * dernière scène (ou la fin de son unique scène) passe sur une page de plus, qui rappelle le même titre ; 3) le refus
 * ne reste qu'en dernier recours, avec ce qu'il faut faire.
 */
import { describe, expect, it } from "vitest";
import { TAILLES_GABARIT } from "../../../src/briques/tableau-scene/reference/charte";
import { CONSIGNE_DECOUPAGE, remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type ElementLigne, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { ErreurMiseEnPage, mettreEnPage, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { temoinGabarit, sortiesTemoin } from "../gabarit-finitions/temoin";
import { contexteDe } from "../reference-1/fiches";
import { ficheReference2, type NomFicheReference2 } from "../reference-2/fiches";
import { DETAIL_PAGE_6, ficheRefusee, ficheTropChargee } from "./fiche-refusee";

/** Les textes écrits d'une fiche (lignes et lignes de preuve), dans l'ordre. */
const textes = (f: FicheTableau) => f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "ligne" ? [e.texte] : e.type === "preuve" ? e.lignes : []));

/** La mise en page de chacune des quatre sorties (vertical, portrait, carré, horizontal), ou le message du refus. */
function quatreSorties(f: FicheTableau): { format: string; mise?: MiseEnPageTableau; refus?: string }[] {
  return IDS_FORMATS_SORTIE.map((format) => {
    try {
      return { format, mise: mettreEnPage(f, format === "vertical" ? {} : { format }) };
    } catch (e) {
      if (!(e instanceof ErreurMiseEnPage)) throw e;
      return { format, refus: e.message };
    }
  });
}

/** Rien ne déborde de la zone sûre, aucune taille sous son minimum lisible, aucun bloc de plus de 4 rangées. */
function lisible(m: MiseEnPageTableau): string[] {
  const z = m.zoneSure.px;
  return m.pages.flatMap((p) =>
    p.elements.flatMap((e) => {
      const r = e.encombrement.px;
      const fautes: string[] = [];
      if (r.x < z.x - 1 || r.y < z.y - 1 || r.x + r.largeur > z.x + z.largeur + 1 || r.y + r.hauteur > z.y + z.hauteur + 1) fautes.push(`page ${p.page} · ${e.elementId} déborde de la zone sûre`);
      const g = e.gabarit?.sorte;
      const min = g === "titre" ? TAILLES_GABARIT.titreMin : g === "phrase" ? TAILLES_GABARIT.phraseMin : e.type === "ligne" ? TAILLES_GABARIT.detailMin : 0;
      if (e.lignes.length && (e.taillePx ?? 0) + 0.5 < min) fautes.push(`page ${p.page} · ${e.elementId} en ${e.taillePx} px (au moins ${min})`);
      if (e.lignes.length > (g === "titre" ? 2 : 4)) fautes.push(`page ${p.page} · ${e.elementId} en ${e.lignes.length} rangées`);
      return fautes;
    }),
  );
}

describe("les deux pages refusées le 14/10 (vidéo v-b19aefb21d57) sont acceptées sans retouche", () => {
  for (const [nom, cas] of [
    ["page 6 (« Automatisez », détail de 13 mots)", { page6: true }],
    ["page 7 (le plombier, avant / après longs)", { page7: true }],
    ["les deux à la fois", { page6: true, page7: true }],
  ] as const) {
    it(nom, () => {
      const brute = ficheRefusee(cas);
      const f = remettreEnForme(brute);
      const v = validerFicheTableau(f, contexteDe(f));
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
      // Sans retouche : aucun texte écrit ni dit n'a changé, aucun élément retiré.
      expect(textes(f)).toEqual(textes(brute));
      expect(f.scenes.map((s) => s.texteDit).join(" ")).toBe(brute.scenes.map((s) => s.texteDit).join(" "));
      // Les quatre sorties se mettent en page, lisibles, rien ne déborde.
      for (const r of quatreSorties(f)) {
        expect(r.refus, r.format).toBeUndefined();
        expect(lisible(r.mise!), r.format).toEqual([]);
      }
    });
  }

  it("page 6 : réparée par la réduction seule (le détail prend 4 rangées à 44 px au moins), sans page de plus", () => {
    const f = remettreEnForme(ficheRefusee({ page6: true }));
    // L'étape reste une page, sa scène entière (seule la page 7 du témoin, trop haute en carré, passe à une page de plus).
    expect(f.scenes.length).toBe(10);
    expect(f.scenes.filter((s) => s.page === 6).map((s) => s.id)).toEqual(["s06"]);
    const m = mettreEnPage(f);
    const detail = m.pages.find((p) => p.page === 6)!.elements.find((e) => e.elementId === "e26")!;
    expect(detail.lignes.map((l) => l.texte).join(" ").replace(/\s/g, " ")).toBe(DETAIL_PAGE_6.replace(/'/g, "’").replace(/ :/, " :").replace(/\s/g, " "));
    expect(detail.taillePx).toBeGreaterThanOrEqual(TAILLES_GABARIT.detailMin);
  });

  it("page 7 : tient en carré aux tailles minimales, écarts resserrés, sans page de plus", () => {
    const f = remettreEnForme(ficheRefusee({ page7: true }));
    expect(f.scenes.filter((s) => s.page === 7).map((s) => s.id)).toEqual(["s07", "s08"]);
    const page = mettreEnPage(f, { format: "carre" }).pages.find((p) => p.page === 7)!;
    expect(page.elements.find((e) => e.gabarit?.sorte === "titre")!.taillePx).toBe(TAILLES_GABARIT.titreMin);
  });

  it("encore plus chargée (un détail de plus) : la dernière scène passe sur une page de plus, qui rappelle le titre « Un plombier »", () => {
    const f0 = ficheTropChargee();
    const f = remettreEnForme(f0);
    const v = validerFicheTableau(f, contexteDe(f));
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    expect(f.scenes.find((s) => s.id === "s07")!.page).toBe(7);
    expect(f.scenes.find((s) => s.id === "s08")!.page).toBe(8);
    expect(f.scenes.find((s) => s.id === "s08")!.gabarit?.role).toBe("exemple");
    for (const r of quatreSorties(f)) {
      expect(r.refus, r.format).toBeUndefined();
      expect(lisible(r.mise!), r.format).toEqual([]);
      const suite = r.mise!.pages.find((p) => p.page === 8)!;
      const rappel = suite.elements.find((e) => e.gabarit?.sorte === "titre")!;
      expect(rappel.lignes.map((l) => l.texte).join(" "), r.format).toBe("Un plombier");
      expect(rappel.elementId.endsWith("~rappel")).toBe(true);
    }
  });

  it("aucun titre sous 70 px, aucune phrase clé sous 56, aucun détail sous 44 (minimums lisibles)", () => {
    expect([TAILLES_GABARIT.titreMin, TAILLES_GABARIT.phraseMin, TAILLES_GABARIT.detailMin]).toEqual([70, 56, 44]);
  });
});

describe("dernier recours : une page qui ne se répare pas est refusée avec ce qu'il faut faire", () => {
  it("un détail trop long pour 4 rangées, plus aucune page libre : refusé, en nommant la page et quoi faire", () => {
    const f = structuredClone(temoinGabarit().fiche);
    // 10 pages déjà (le plafond) : la page de plus est impossible.
    let page = 0;
    f.scenes = f.scenes.map((s, i) => ({ ...s, page: i < 10 ? ++page : page }));
    const s06 = f.scenes.find((s) => s.id === "s06")!;
    (s06.elements.find((e) => e.id === "e26") as ElementLigne).texte = "Mettez sa réponse dans le message d'accueil automatique de votre messagerie professionnelle, celui qui part au premier message.";
    const r = remettreEnForme(f);
    const v = validerFicheTableau(r, contexteDe(r));
    expect(v.ok).toBe(false);
    const msg = v.ok ? "" : v.problemes.map((p) => p.message).join("\n");
    expect(msg).toContain("page 6");
    expect(msg).toContain("même réduite aux tailles minimales (titre 70, phrase clé 56, détails 44 px)");
    expect(msg).toContain("raccourcissez une ligne (un détail de 10 mots au plus, un avant ou un après de 8)");
  });
});

describe("rien d'autre ne casse", () => {
  const REELLES: NomFicheReference2[] = ["relances", "taches-repetitives", "habitude-equipe", "consigne-ia"];
  for (const nom of REELLES)
    it(`fiche réelle « ${nom} » : acceptée, ses quatre sorties lisibles`, () => {
      const f = ficheReference2(nom);
      const v = validerFicheTableau(f, contexteDe(f));
      // Lot B2b : la fiche réelle « habitude-equipe » (1 670 caractères dits, enregistrée le 12/10) dépasse la limite de 90 s au
      // débit de la voix à 165 mots/min (1 520 caractères) : elle est désormais REFUSÉE, et seulement pour sa durée.
      if (nom === "habitude-equipe") {
        expect(v.ok ? [] : v.problemes.map((p) => p.message.replace(/^.*?règle « ([^»]*) ».*$/, "$1"))).toEqual(["durée de 90 secondes au plus"]);
        return;
      }
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
      for (const r of quatreSorties(f)) {
        expect(r.refus, `${nom} · ${r.format}`).toBeUndefined();
        expect(lisible(r.mise!), `${nom} · ${r.format}`).toEqual([]);
      }
    });

  it("le témoin réel du gabarit (gabarit-essai-reel-2026-10-14.json) : accepté, ses deux verticaux calés sur leurs vraies voix, ses quatre sorties lisibles", () => {
    const t = temoinGabarit();
    const f = remettreEnForme(t.fiche);
    const v = validerFicheTableau(f, contexteDe(f));
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    for (const r of quatreSorties(f)) {
      expect(r.refus, r.format).toBeUndefined();
      expect(lisible(r.mise!), r.format).toEqual([]);
    }
    for (const s of sortiesTemoin(t)) expect(lisible(mettreEnPage(s.fiche, s.options)), s.id).toEqual([]);
  });
});

describe("consigne du découpage (reference/2) : lignes courtes, avec un exemple", () => {
  it("détails de 10 mots au plus, avant / après de 8 mots au plus, et l'exemple de la fleuriste raccourci", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("10 mots au plus chacune");
    expect(CONSIGNE_DECOUPAGE).toContain("8 mots au plus chacune");
    expect(CONSIGNE_DECOUPAGE).toContain("→ « Elle retape ses délais six fois par jour. »");
    expect(CONSIGNE_DECOUPAGE).toContain("« Il part au premier message. »");
    // L'exemple JSON de la consigne respecte lui-même ces longueurs.
    expect(CONSIGNE_DECOUPAGE).not.toContain('"texte":"Elle retape ses délais six fois par jour, en boutique."');
  });
});
