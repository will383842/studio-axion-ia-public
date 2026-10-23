/**
 * CALIBRAGE DU SOCLE (18/10/2026) : le socle doit DISTINGUER un bon script d'un mauvais.
 * Le jeu d'essai (`fixtures-calibrage.ts`) a 3 bons scripts (douleur, valeur, preuve, « on s'en occupe », un seul appel)
 * et 3 mauvais (tutoriel « faites-le vous-même », annonce d'outil, redites). Si un réglage de seuil efface cette
 * séparation, ce test le dit. Constat chiffré : `docs/ecriture/CALIBRAGE-SOCLE-2026-10-18.md`.
 */
import { describe, expect, it } from "vitest";
import { evaluerQualite, noteSur100, SEUIL_THEME_AMBRE, SEUIL_THEME_ROUGE, voyantDe, type ResultatRegle } from "@/domaine/qualite-script";
import { NOMBRE, norm } from "@/domaine/qualite-script/regles/outils";
import { RECETTE_ECRIRE_AVOCAT } from "@/domaine/qualite-script/recettes";
import { normaliser, SCRIPTS_CALIBRAGE } from "./fixtures-calibrage";

const rapports = SCRIPTS_CALIBRAGE.map((s) => ({ s, r: evaluerQualite(normaliser(s), RECETTE_ECRIRE_AVOCAT) }));
const note = (x: (typeof rapports)[number]) => noteSur100(x.r.notes) ?? 0;
const bons = rapports.filter((x) => x.s.nature === "bon");
const mauvais = rapports.filter((x) => x.s.nature === "mauvais");

describe("jeu d'essai de calibrage", () => {
  it("3 bons, 3 mauvais, tous inventés ; toute ligne chiffrée porte le marqueur de preuve fictive", () => {
    expect(bons).toHaveLength(3);
    expect(mauvais).toHaveLength(3);
    for (const s of SCRIPTS_CALIBRAGE) for (const [, dit, sourcee] of s.lignes) if (NOMBRE.test(norm(dit))) expect(sourcee, `${s.id} : « ${dit} »`).toBe(true);
  });
});

describe("séparation des bons et des mauvais", () => {
  it("les 3 bons ne sont jamais rouges (vert ou ambre) ; les 3 mauvais sont rouges", () => {
    for (const x of bons) expect(x.r.voyant, x.s.id).not.toBe("rouge");
    for (const x of mauvais) expect(x.r.voyant, x.s.id).toBe("rouge");
  });
  it("chaque bon dépasse chaque mauvais d'au moins 20 points (note sur 100), et l'ordre est préservé", () => {
    const pireBon = Math.min(...bons.map(note));
    const meilleurMauvais = Math.max(...mauvais.map(note));
    expect(pireBon - meilleurMauvais).toBeGreaterThanOrEqual(20);
    for (const b of bons) for (const m of mauvais) expect(note(b) - note(m), `${b.s.id} contre ${m.s.id}`).toBeGreaterThanOrEqual(20);
    const ordre = [...rapports].sort((a, b) => note(b) - note(a)).map((x) => x.s.nature);
    expect(ordre).toEqual(["bon", "bon", "bon", "mauvais", "mauvais", "mauvais"]);
  });
  it("les bons n'ont plus qu'une alerte au plus ; aucune règle bloquante en écart", () => {
    for (const x of bons) {
      expect(x.r.resultats.filter((y) => y.statut === "ecart" && y.niveauVise === "bloquant"), x.s.id).toEqual([]);
      expect(x.r.resultats.filter((y) => y.statut === "ecart").length, x.s.id).toBeLessThanOrEqual(1);
    }
  });
});

describe("le calibrage ne touche ni aux interdits ni au positionnement ni au mode observation", () => {
  const code = (id: string, c: string) => rapports.find((x) => x.s.id === id)!.r.resultats.find((y) => y.code === c)!;
  it("« faites-le vous-même » reste bloquant (PO-01) ; l'annonce d'outil aussi (PO-02)", () => {
    expect(code("M1-tutoriel", "PO-01")).toMatchObject({ statut: "ecart", niveauVise: "bloquant" });
    expect(code("M2-annonce-outil", "PO-02")).toMatchObject({ statut: "ecart", niveauVise: "bloquant" });
  });
  it("les redites sont vues par RP-01 dans le mauvais script de redites", () => {
    expect(code("M3-redites", "RP-01").statut).toBe("ecart");
  });
  it("mode observation : toutes les pastilles restent « info »", () => {
    for (const x of rapports) {
      expect(x.r.mode).toBe("observation");
      expect(x.r.pastilles.every((p) => p.niveau === "info")).toBe(true);
    }
  });
});

describe("seuils du voyant", () => {
  const r = (statut: ResultatRegle["statut"], theme: ResultatRegle["theme"]): ResultatRegle => ({ code: "X", theme, message: "m", statut, niveauVise: "alerte" });
  it("un thème sous 4/10 rend le voyant rouge, de 4 à 6/10 ambre, 7/10 et plus vert", () => {
    expect([SEUIL_THEME_ROUGE, SEUIL_THEME_AMBRE]).toEqual([4, 7]);
    // 1 règle ok sur 3 → 3/10 ; 2 sur 3 → 7/10 ; 1 sur 2 → 5/10.
    expect(voyantDe([r("ok", "valeur"), r("ecart", "valeur"), r("ecart", "valeur")])).toBe("rouge");
    expect(voyantDe([r("ok", "valeur"), r("ecart", "valeur")])).toBe("ambre");
    expect(voyantDe([r("ok", "valeur"), r("ok", "valeur"), r("ecart", "valeur")])).toBe("vert");
  });
  it("noteSur100 : moyenne des thèmes et thème le plus faible", () => {
    expect(noteSur100({ accroche: 10, retention: 10, valeur: 10, prospects: 10, positionnement: 10, interdits: 10, forme: 10 })).toBe(100);
    // moyenne 9,67 et plus faible 8 : (9,67 + 8) / 2 × 10 = 88.
    expect(noteSur100({ accroche: 10, retention: 8, valeur: null, prospects: 10, positionnement: 10, interdits: 10, forme: 10 })).toBe(88);
    expect(noteSur100({ accroche: null, retention: null, valeur: null, prospects: null, positionnement: null, interdits: null, forme: null })).toBeNull();
  });
});
