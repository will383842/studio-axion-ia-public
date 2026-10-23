/**
 * PAGE PLUS REMPLIE (14/10/2026, regard de Will sur une vraie vidéo de 56 s au style « reference/1 ») : le style est bon,
 * mais les blocs sont des fragments très courts et la page n'est remplie qu'aux 2/3, le bas vide ; le reel de
 * référence écrit des PHRASES COMPLÈTES, plus denses, sur toute la page. Jugé sur les quatre fiches réelles, le témoin
 * du 14/10 et une fiche réaliste de 6 pages en « phrases complètes », dans les cinq sorties. Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { TAILLES_REFERENCE } from "../../../src/briques/tableau-scene/reference/charte";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { BLOCS_PAGE_REMPLIE, REMPLISSAGE_MIN, chevauchementsReference, pagesTropVidesReference } from "../../../src/moteurs/montage-tableau/controles-reference";
import { CONSIGNE_DECOUPAGE, roleDecoupageTableau } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { FICHES_REELLES, caleeReguliere, contexteDe, fichePhrasesCompletes, ficheReference, temoinReference } from "./fiches";

const SORTIES: IdSortie[] = ["vertical", "vertical-liens", "portrait", "carre", "horizontal"];
const phrases = fichePhrasesCompletes();
const toutes: [string, FicheTableau][] = [...FICHES_REELLES.map((f) => [f.nom, ficheReference(f.nom)] as [string, FicheTableau]), ["temoin-blocage-fin-tiktok", temoinReference().fiche], ["phrases-completes", phrases]];
const motDe = (f: FicheTableau) => (f.scenes.flatMap((s) => s.ecrans ?? []).find((e) => e.motCommentaire)?.motCommentaire ?? "MOT").toUpperCase();
const sortiesDe = (f: FicheTableau) => {
  const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: motDe(f) });
  return sortiesRelues(f, SORTIES, (id) => finDeLaSortie(id, choisirFin(f.appelId ?? null, id)));
};
const mises: { nom: string; id: string; mise: MiseEnPageTableau }[] = toutes.flatMap(([nom, f]) => sortiesDe(f).map((s) => ({ nom, id: s.id, mise: mettreEnPage(s.fiche, s.options) })));
const textesDe = (p: MiseEnPageTableau["pages"][number]) => p.elements.filter((e) => e.type !== "dessin");
/** Bas du dernier élément d'une page, en part de la hauteur de la zone sûre (0 en haut, 1 en bas). */
const basDansZone = (m: MiseEnPageTableau, p: MiseEnPageTableau["pages"][number]) => {
  const z = m.zoneSure.px;
  return (Math.max(...p.elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur)) - z.y) / z.hauteur;
};

describe("une page terminée est remplie sur toute sa hauteur", () => {
  it("chaque page de 2 blocs écrits ou plus est remplie à 80 % au moins de sa hauteur utile (cinq sorties, six fiches)", () => {
    for (const { nom, id, mise } of mises)
      for (const p of mise.pages) if (textesDe(p).length >= 2) expect.soft(p.occupation, `${nom} · ${id} · page ${p.page}`).toBeGreaterThanOrEqual(0.8);
  });

  it("le premier bloc est en haut, le dernier descend vers 85-90 % de la zone sûre : jamais de grand vide en bas", () => {
    for (const { nom, id, mise } of mises)
      for (const p of mise.pages) {
        if (textesDe(p).length < 2) continue;
        const bas = basDansZone(mise, p);
        expect.soft(bas, `${nom} · ${id} · page ${p.page} : bas du dernier bloc`).toBeGreaterThanOrEqual(0.84);
        // Une page chargée peut descendre plus bas, jamais hors de la zone sûre (au-dessus de la signature).
        expect.soft(bas, `${nom} · ${id} · page ${p.page} : bas du dernier bloc`).toBeLessThanOrEqual(0.97);
        // Une page qu'on a fait grandir s'arrête au bas visé (88 %, à un pas près).
        if (p.echelle > 1) expect.soft(bas, `${nom} · ${id} · page ${p.page} : page agrandie`).toBeLessThanOrEqual(0.9);
      }
  });

  it("sans chevauchement ni débordement : contrôles de la sortie au vert, page remplie comprise", () => {
    for (const [nom, f] of toutes)
      for (const s of sortiesDe(f)) {
        const lignes = controlerImageSortie(s.fiche, { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options });
        for (const libelle of ["Rien ne dépasse", "Aucun chevauchement", "Zone sûre", "Page remplie", "Blocs courts", "Taille du texte"]) {
          const l = lignes.find((x) => x.libelle === libelle);
          expect.soft(l?.etat, `${nom} · ${s.id} · ${libelle} : ${l?.raison}`).toBe("reussi");
        }
        expect(chevauchementsReference(mettreEnPage(s.fiche, s.options)), `${nom} · ${s.id}`).toEqual([]);
      }
  }, 60_000);

  it("le contrôle « Page remplie » demande 80 % dès 2 blocs : il signale une page remplie aux 2/3", () => {
    expect(BLOCS_PAGE_REMPLIE).toBe(2);
    expect(REMPLISSAGE_MIN).toBe(0.8);
    const m = mettreEnPage(ficheReference("relances"), {});
    expect(pagesTropVidesReference(m)).toEqual([]);
    const p = m.pages.find((x) => textesDe(x).length >= 2)!;
    const vide = { ...m, pages: m.pages.map((x) => (x === p ? { ...x, occupation: 0.7 } : x)) };
    expect(pagesTropVidesReference(vide).map((f) => f.message)).toEqual([`page ${p.page} : la page n'est remplie qu'à 70 % (au moins 80 %)`]);
  });
});

describe("texte plus grand quand il y a de la place, colonne plus large", () => {
  it("colonne d'écriture jusqu'à 88 % de la largeur (950 px sur 1080), dans la zone sûre", () => {
    expect(TAILLES_REFERENCE.colonne).toBe(950);
    for (const { nom, id, mise } of mises) {
      if (mise.format === "horizontal") continue;
      expect(mise.cadre.px.largeur, `${nom} · ${id}`).toBeGreaterThanOrEqual(Math.min(950 * (mise.styleReference?.k ?? 1), mise.zoneSure.px.largeur) - 1);
    }
  });

  it("vertical : une page de 3 blocs ou moins écrit à 56 px ou plus (jusqu'à 60), sauf si elle est déjà pleine à 52 px", () => {
    let pages = 0;
    let grandes = 0;
    for (const { nom, id, mise } of mises) {
      if (mise.format) continue;
      for (const p of mise.pages) {
        const base = textesDe(p).filter((e) => e.role !== "titre");
        if (textesDe(p).length > 3 || !base.length) continue;
        pages++;
        if (base[0].taillePx! >= 56) grandes++;
        else expect.soft(basDansZone(mise, p), `${nom} · ${id} · page ${p.page} : ${base[0].taillePx} px, page pas pleine`).toBeGreaterThanOrEqual(0.84);
        expect(base[0].taillePx!).toBeLessThanOrEqual(60);
      }
    }
    // La plupart de ces pages écrivent plus grand.
    expect(grandes / pages).toBeGreaterThanOrEqual(0.6);
  });
});

describe("fiche réaliste de 6 pages en « phrases complètes »", () => {
  it("6 pages, 3 à 5 blocs écrits par page, des phrases de 4 à 12 mots reprises du texte dit", () => {
    const m = mettreEnPage(phrases, {});
    expect(m.pages).toHaveLength(6);
    for (const p of m.pages) {
      const n = textesDe(p).filter((e) => e.type !== "mention").length;
      expect(n, `page ${p.page}`).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
    const dit = phrases.scenes.map((s) => s.texteDit).join(" ").toLowerCase();
    for (const s of phrases.scenes)
      for (const e of s.elements) {
        if (e.type !== "ligne") continue;
        const n = e.texte.split(/\s+/).length;
        expect(n, e.texte).toBeGreaterThanOrEqual(4);
        expect(n, e.texte).toBeLessThanOrEqual(12);
        // Reprise du texte dit : au moins les 2/3 de ses mots y sont.
        const mots = e.texte.toLowerCase().split(/[\s,.:?!]+/).filter(Boolean);
        expect(mots.filter((x) => dit.includes(x)).length / mots.length, e.texte).toBeGreaterThanOrEqual(2 / 3);
      }
  });

  it("la relecture d'avant la fabrication dit « Tout est bon » ; elle se cale sans trou de rythme", async () => {
    const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: "RAPPEL" });
    const r = await relireFicheTableau({ fiche: phrases, contexte: contexteDe(phrases), dejaVu: { coche: true, le: "2026-10-14" }, sorties: SORTIES, choisirFin });
    expect(r.points.map((p) => p.message)).toEqual([]);
    expect(() => caleeReguliere(phrases, "phrases-completes")).not.toThrow();
  });
});

describe("consigne du découpage : des phrases presque complètes", () => {
  it("pour « reference/1 » : phrases reprises du texte dit, jusqu'à ~12 mots, 2 à 3 lignes, 3 à 5 blocs par page, un exemple complet", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(8);
    expect(CONSIGNE_DECOUPAGE).toMatch(/phrases? presque compl[eè]tes?/i);
    expect(CONSIGNE_DECOUPAGE).toMatch(/12 mots/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/3 à 5 blocs/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/EXEMPLE/);
    // Les règles restent dites : texte écrit une fois, douleur dite et écrite en 3 s, un événement toutes les 4 s.
    expect(CONSIGNE_DECOUPAGE).toMatch(/3 premières secondes/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/toutes les 4 secondes/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/une seule fois/);
  });
});
