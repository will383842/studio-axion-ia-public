/**
 * Lot G2 · branchement des adaptations dans la dérivation des versions par réseau. Réglage coupé : paramètres de
 * dérivation IDENTIQUES octet pour octet ; script de Will, avocat, réseau sans facultatif : jamais touchés ; erreur : silence.
 */
import { describe, expect, it } from "vitest";
import type { BlocScript } from "@/domaine/types";
import { adapterBlocsDuCorps } from "@/reseaux/adaptation-derivation";

const seg = (id: string, texte: string, facultatif?: "linkedin") => ({ id, texte, ...(facultatif ? { facultatif } : {}) });
const bloc = (id: string, segments: ReturnType<typeof seg>[]): BlocScript => ({ id, blocRecette: id, titre: id, segments } as unknown as BlocScript);
/** Une durée par segment : 1 s par mot. */
const dureeTexte = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");

const corps = [bloc("b1", [seg("s1", mots(25)), seg("f1", mots(30), "linkedin"), seg("f2", mots(30), "linkedin")])];
const base = { blocs: corps, reseau: "linkedin" as const, formatId: "tableau-anime", estCollee: false, dureeTexte };

describe("adapterBlocsDuCorps", () => {
  it("réglage coupé (ou valeur non strictement true) : rend les blocs tels quels, octet pour octet", () => {
    for (const actif of [false, "true", 1, null, undefined]) {
      const r = adapterBlocsDuCorps({ ...base, actif });
      expect(r).toBe(corps);
      expect(JSON.stringify(r)).toBe(JSON.stringify(corps));
    }
  });

  it("allumé : coupe le facultatif de LinkedIn qui dépasse le plafond (60 s), garde le début", () => {
    const r = adapterBlocsDuCorps({ ...base, actif: true });
    expect(r[0].segments.map((s) => s.id)).toEqual(["s1", "f1"]);
  });

  it("script de Will (collé) : jamais coupé, même allumé", () => {
    expect(adapterBlocsDuCorps({ ...base, actif: true, estCollee: true })).toBe(corps);
  });

  it("l'avocat n'est jamais adapté", () => {
    expect(adapterBlocsDuCorps({ ...base, actif: true, formatId: "avocat" })).toBe(corps);
  });

  it("réseau sans facultatif ou segments d'un autre réseau : inchangé", () => {
    expect(adapterBlocsDuCorps({ ...base, actif: true, reseau: "tiktok" })).toBe(corps);
    const sans = [bloc("b", [seg("a", mots(10))])];
    expect(adapterBlocsDuCorps({ ...base, blocs: sans, actif: true })).toBe(sans);
  });

  it("toute erreur est silencieuse : retombe sur les blocs d'origine", () => {
    const r = adapterBlocsDuCorps({ ...base, actif: true, dureeTexte: () => { throw new Error("boum"); } });
    expect(r).toBe(corps);
  });

  it("ne retire jamais un bloc de l'entrée (copie), ordre conservé", () => {
    const avant = JSON.stringify(corps);
    adapterBlocsDuCorps({ ...base, actif: true });
    expect(JSON.stringify(corps)).toBe(avant);
  });

  it("la durée de l'ouverture et de la fin compte dans le plafond de 60 s (toute la vidéo, pas le corps seul)", () => {
    // corps 25 s + f1 30 s = 55 s : tient seul ; avec 10 s d'ouverture et de fin, 65 s : f1 est coupé.
    expect(adapterBlocsDuCorps({ ...base, actif: true })[0].segments.map((s) => s.id)).toEqual(["s1", "f1"]);
    const r = adapterBlocsDuCorps({ ...base, actif: true, dureeHorsCorpsSec: 10 });
    expect(r[0].segments.map((s) => s.id)).toEqual(["s1"]);
  });

  it("ne coupe JAMAIS un segment qui porte `sourceTexte` (matière saisie par Will), même facultatif hors plafond", () => {
    const protege = { ...seg("f2", mots(30), "linkedin"), sourceTexte: { matiereId: "m1" } };
    const blocs = [bloc("b1", [seg("s1", mots(25)), seg("f1", mots(30), "linkedin"), protege as ReturnType<typeof seg>])];
    const r = adapterBlocsDuCorps({ ...base, blocs, actif: true });
    expect(r[0].segments.map((s) => s.id)).toEqual(["s1", "f2"]); // f2 protégé compte dans la durée fixe, f1 (hors plafond) est coupé
  });

  it("ne coupe JAMAIS un segment écrit ou retouché par Will (`ecritPar: \"will\"`), même facultatif hors plafond", () => {
    const retouche = { ...seg("f2", mots(30), "linkedin"), ecritPar: "will" as const };
    const blocs = [bloc("b1", [seg("s1", mots(25)), seg("f1", mots(30), "linkedin"), retouche as unknown as ReturnType<typeof seg>])];
    const r = adapterBlocsDuCorps({ ...base, blocs, actif: true });
    expect(r[0].segments.map((s) => s.id)).toEqual(["s1", "f2"]); // f2 retouché compte dans la durée fixe, f1 (machine) est coupé
  });
});
