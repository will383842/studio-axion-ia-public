/**
 * LOT G3 — `nombres-fr.ts` (C1 : toutes les formes dites d'un nombre) et horloge unique (B.7.1).
 */
import { describe, expect, it } from "vitest";
import { dureeBlocs, dureeTexte, horodaterSegments, MARGE_AVANT_MESURE } from "@/domaine/controles-script";
import { compterNombres, lireNombreEnLettres, memeValeur, nombresAffirmes, trouverNombres } from "@/domaine/nombres-fr";
import { bloc, seg } from "./helpers/g3";

describe("nombres dits en français (C1)", () => {
  it.each([
    ["35 heures par semaine", 35, "h"],
    ["trente-cinq heures", 35, "h"],
    ["0 heure", 0, "h"],
    ["zéro heure", 0, "h"],
    ["une PME sur deux", 0.5, undefined],
    ["un client sur trois", 1 / 3, undefined],
    ["trois quarts des dirigeants", 0.75, undefined],
    ["la moitié des données", 0.5, undefined],
    ["un tiers du temps", 1 / 3, undefined],
    ["deux fois plus vite", 2, "x"],
    ["3 fois moins de saisie", 3, "x"],
    ["un gain x3", 3, "x"],
    ["un effet 10x", 10, "x"],
    ["1,5 million d'euros", 1_500_000, undefined],
    ["67 000 €", 67_000, "€"],
    ["67 k€ économisés", 67_000, "€"],
    ["2 M€ de chiffre", 2_000_000, "€"],
    ["12 %", 12, "%"],
    ["cent pour cent", 100, "%"],
    ["quatre-vingt-dix jours", 90, "jour"],
    ["deux cent mille euros", 200_000, "€"],
    ["mille deux cents factures", 1200, undefined],
    ["vingt et un onglets", 21, "onglet"],
  ] as const)("« %s » → %s", (texte, valeur, unite) => {
    const [n] = nombresAffirmes(texte);
    expect(n).toBeDefined();
    expect(memeValeur(n.valeur, valeur)).toBe(true);
    if (unite) expect(n.unite).toBe(unite);
  });

  it.each([
    ["un client est venu me voir"],
    ["une PME de logistique"],
    ["Même avec GPT-5, rien ne change"],
    ["On répond 24 h/24 et 7j/7"],
    ["Premier point : le contrat."],
  ])("« %s » : aucun nombre à prouver", (texte) => {
    expect(nombresAffirmes(texte)).toEqual([]);
  });

  it("les années et les numéros de liste sont reconnus à part", () => {
    expect(trouverNombres("Depuis 2024, tout change.")[0].forme).toBe("annee");
    expect(trouverNombres("Deux conseils. 1. Lisez le contrat.").some((n) => n.forme === "liste")).toBe(true);
  });

  it("lireNombreEnLettres", () => {
    expect(lireNombreEnLettres("soixante-dix")).toBe(70);
    expect(lireNombreEnLettres("quatre-vingts")).toBe(80);
    expect(lireNombreEnLettres("trois cents")).toBe(300);
    expect(lireNombreEnLettres("bonjour")).toBeNull();
  });

  it("compterNombres (C41 : au plus un nombre dans l'accroche)", () => {
    expect(compterNombres("35 heures avant, 0 heure après.")).toBe(2);
    expect(compterNombres("Un temps plein, rien que pour des Excel.")).toBe(0);
  });
});

describe("horloge unique (B.7.1)", () => {
  const blocs = [bloc("accroche", seg("a", "Un temps plein, rien que pour des Excel.")), bloc("coeur", seg("b", "Remplacer Excel, ici, voulait dire tout supprimer."), seg("c", "Fini.", { pauseApresSec: 0.3 }), seg("d", "Une suite."))];

  it("les segments s'enchaînent sans trou, dans l'ordre", () => {
    const h = horodaterSegments(blocs, 4.4);
    expect(h.map((x) => x.segmentId)).toEqual(["a", "b", "c", "d"]);
    expect(h[0].debutSec).toBe(0);
    expect(h[1].debutSec).toBeCloseTo(h[0].finSec, 3);
  });
  it("une pause s'ajoute après son segment", () => {
    const h = horodaterSegments(blocs, 4.4);
    expect(h[3].debutSec - h[2].finSec).toBeCloseTo(0.3, 3);
  });
  it("le texte dit prime sur le texte affiché", () => {
    const b = [bloc("x", { id: "s", texte: "DAF", texteDit: "directeur administratif et financier" } as never)];
    expect(horodaterSegments(b, 4.4)[0].dureeSec).toBeGreaterThan(dureeTexte("DAF", 4.4));
  });
  it("« je lis » (2,9 mots/s) dure plus longtemps que le double (4,4 mots/s)", () => {
    expect(dureeBlocs(blocs, 2.9)).toBeGreaterThan(dureeBlocs(blocs, 4.4));
  });
  it("l'horodatage réel (G6) remplace l'estimation", () => {
    const h = horodaterSegments(blocs, 4.4, { dureesReelles: [1, 2, 3, 4] });
    expect(h[3].finSec).toBeCloseTo(10.3, 3);
  });
  it("marge de 10 % avant la mesure du débit réel (M0b)", () => {
    expect(MARGE_AVANT_MESURE).toBe(0.9);
  });
});
