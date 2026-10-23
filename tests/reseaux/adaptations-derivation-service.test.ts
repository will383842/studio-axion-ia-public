/**
 * Lot G2 · le service de dérivation (fabrication-reseaux) lit le réglage `adaptations_reseaux.actif` : coupé = corps IDENTIQUE
 * (même référence, mêmes octets) ; allumé = coupe du facultatif LinkedIn ; script collé : jamais ; erreur de lecture : silence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { BlocScript, VarianteReseau } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { corpsAdapte, blocsDeLaVersion } = await import("@/services/fabrication-reseaux");
const { obtenirFormat, estimerDureeTexte, debitLecture } = await import("@/formats");

const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
const bloc = (id: string, segs: { id: string; texte: string; facultatif?: string }[]) => ({ id, blocRecette: "corps", titre: id, segments: segs }) as unknown as BlocScript;
const corps = () => [bloc("b1", [{ id: "s1", texte: mots(60) }, { id: "f1", texte: mots(60), facultatif: "linkedin" }, { id: "f2", texte: mots(60), facultatif: "linkedin" }])];
const v = (formatId = "tableau-anime", reseau = "linkedin") => ({ formatId, reseau }) as unknown as VarianteReseau;
const ids = (b: BlocScript[]) => b.flatMap((x) => x.segments.map((s) => s.id));

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
});

describe("corpsAdapte (branchement G2)", () => {
  it("réglage absent (défaut) : corps rendu tel quel, même référence, mêmes octets", async () => {
    const c = corps();
    const avant = JSON.stringify(c);
    const r = await corpsAdapte(v(), c, c);
    expect(r).toBe(c);
    expect(JSON.stringify(r)).toBe(avant);
  });

  it("réglage à false, ou valeur qui n'est pas exactement true : identique", async () => {
    for (const valeur of [false, "true", 1]) {
      await ecrireParametre("adaptations_reseaux.actif", valeur);
      const c = corps();
      expect(await corpsAdapte(v(), c, c)).toBe(c);
    }
  });

  it("allumé, script de la machine, LinkedIn : le second facultatif (hors plafond) est coupé", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const c = corps();
    expect(ids(await corpsAdapte(v(), [bloc("gen-1", [])], c))).toEqual(["s1", "f1"]);
  });

  it("allumé mais script collé par Will (bloc `colle-`) : jamais coupé", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const c = corps();
    expect(await corpsAdapte(v(), [bloc("colle-1", [])], c)).toBe(c);
  });

  it("allumé mais avocat : jamais adapté", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const c = corps();
    expect(await corpsAdapte(v("avocat"), [], c)).toBe(c);
  });

  it("erreur de lecture du réglage : retombe sur le corps d'avant", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const lire = vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base indisponible"));
    const c = corps();
    expect(await corpsAdapte(v(), [], c)).toBe(c);
    lire.mockRestore();
  });

  it("ouverture et fin : leur durée fait passer le total au-dessus de 60 s, la coupe se déclenche", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const format = obtenirFormat("tableau-anime");
    const debit = debitLecture(format, null);
    const n = (sec: number) => mots(Math.round(sec * debit));
    // corps seul : 20 s + facultatif 30 s = 50 s (tient) ; avec 8 s d'ouverture et 8 s de fin = 66 s (ne tient pas).
    const c = [bloc("b1", [{ id: "s1", texte: n(20) }, { id: "f1", texte: n(30), facultatif: "linkedin" }])];
    expect(ids(await corpsAdapte(v(), [bloc("gen-1", [])], c))).toEqual(["s1", "f1"]);
    const ouv = [bloc("o", [{ id: "o1", texte: n(8) }])];
    const fin = [bloc("f", [{ id: "e1", texte: n(8) }])];
    expect(ids(await corpsAdapte(v(), [bloc("gen-1", [])], c, { ouverture: ouv, fin }))).toEqual(["s1"]);
  });

  it("corpsAdapte avec `voixId` (voix HeyGen à vitesse 1,5) : le débit de la voix remplace celui du format (le contrôle et le raccord : adaptations-debit-controle-raccord.test.ts)", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const format = obtenirFormat("tableau-anime");
    const voix = { id: "vx", fournisseur: "heygen", reglages: { vitesse: 1.5 } };
    await depots().voix.enregistrer(voix as never);
    const debit = debitLecture(format, voix);
    expect(debit).not.toBe(debitLecture(format, null));
    // 52 s au débit de cette voix : avec le débit d'écriture du format, 52 s paraîtraient plus longues ou plus courtes.
    const n = (sec: number) => mots(Math.round(sec * debit));
    const c = [bloc("b1", [{ id: "s1", texte: n(25) }, { id: "f1", texte: n(30), facultatif: "linkedin" }])];
    expect(estimerDureeTexte(format, n(55), debit)).toBeGreaterThan(54);
    expect(ids(await corpsAdapte(v(), [bloc("gen-1", [])], c, { ouverture: [], fin: [], voixId: "vx" }))).toEqual(["s1", "f1"]);
    const ouv = [bloc("o", [{ id: "o1", texte: n(8) }])];
    // 63 s réelles au débit de la voix : coupe. Au débit d'écriture du format, ce total serait mal jugé.
    expect(ids(await corpsAdapte(v(), [bloc("gen-1", [])], c, { ouverture: ouv, fin: [], voixId: "vx" }))).toEqual(["s1"]);
  });

  it("blocsDeLaVersion appelle bien corpsAdapte : la version LinkedIn n'a plus le facultatif hors plafond", async () => {
    await ecrireParametre("adaptations_reseaux.actif", true);
    const format = obtenirFormat("tableau-anime");
    const debit = debitLecture(format, null);
    const n = (sec: number) => mots(Math.round(sec * debit));
    const blocs = [bloc("gen-b1", [{ id: "s1", texte: n(30) }, { id: "f1", texte: n(20), facultatif: "linkedin" }, { id: "f2", texte: n(20), facultatif: "linkedin" }])];
    const variante = { id: "v1", scriptId: "sc1", formatId: "tableau-anime", reseau: "linkedin", segmentFacultatifRetenu: true, ouverture: [], fin: [] } as unknown as VarianteReseau;
    const r = await blocsDeLaVersion(variante, undefined, blocs);
    expect(ids(r.corps)).toEqual(["s1", "f1"]);
  });
});
