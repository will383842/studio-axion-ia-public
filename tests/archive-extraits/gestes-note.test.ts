/**
 * X4-12s : gestes de la note, transformations pures (garder quand même, changer le sujet, chiffres réels).
 */
import { describe, expect, it } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { reporterGestes } from "@/briques/archive-extraits/inscription";
import { garderQuandMeme, changerSujet, marquerChiffresReels } from "@/briques/archive-extraits/gestes-note";

const T = "2026-11-17T10:00:00.000Z";

function plage(id: string, extra: Partial<PlageExtrait> = {}): PlageExtrait {
  return { id, debutSec: 0, finSec: 5, texte: `texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "a_verifier", ...extra };
}
function gele<T>(x: T): T {
  const f = (o: unknown): void => {
    if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(f); }
  };
  f(x);
  return x;
}
function fiche(plages: PlageExtrait[]): FicheSourceExtraits {
  return { videoId: "v", versionId: "ve", sortieId: "s", ratio: "9:16", licence: {} as never, famille: [], plages, rangee: true, sourcePreferee: true };
}

describe("garderQuandMeme", () => {
  it("pose valideeLe et survit à reporterGestes", () => {
    const p = plage("a", { etat: "a_verifier" });
    const r = garderQuandMeme(gele(p), T) as PlageExtrait;
    expect(r.valideeLe).toBe(T);
    const apres = reporterGestes([r], [plage("a")]);
    expect(apres[0].valideeLe).toBe(T);
    expect(apres[0].etat).toBe("utilisable");
  });
  it("refuse une plage exclue", () => {
    expect(garderQuandMeme(plage("a", { etat: "exclue" }), T)).toBe("Cet extrait ne peut pas être gardé.");
  });
  it("déterministe, entrée intacte", () => {
    const p = gele(plage("a"));
    expect(garderQuandMeme(p, T)).toEqual(garderQuandMeme(p, T));
    expect(p.valideeLe).toBeUndefined();
  });
});

describe("changerSujet", () => {
  it("accepte un des 13 sujets et pose sujetCorrigeLe", () => {
    const r = changerSujet(gele(plage("a")), "appels-offres", T) as PlageExtrait;
    expect(r.sujet).toBe("appels-offres");
    expect(r.sujetCorrigeLe).toBe(T);
    expect((changerSujet(plage("a"), "devis-factures", T) as PlageExtrait).sujet).toBe("devis-factures");
  });
  it("refuse un sujet inconnu", () => {
    expect(typeof changerSujet(plage("a"), "nimporte-quoi", T)).toBe("string");
  });
});

describe("marquerChiffresReels", () => {
  const chiffre = plage("c", { raisonsNote: [{ code: "chiffre", points: 25 }] });
  const autre = plage("o", { raisonsNote: [{ code: "interface", points: 35 }] });
  const sans = plage("s");
  it("ajoute la preuve aux seuls moments chiffre, sans doublon, puis l'enlève", () => {
    const f = gele(fiche([chiffre, autre, sans]));
    const oui = marquerChiffresReels(f, true);
    expect(oui.chiffresReels).toBe(true);
    expect(oui.plages[0].usages).toEqual(["preuve-chiffree"]);
    expect(oui.plages[1].usages).toBeUndefined();
    expect(oui.plages[2].usages).toBeUndefined();
    const deux = marquerChiffresReels(oui, true);
    expect(deux.plages[0].usages).toEqual(["preuve-chiffree"]);
    const non = marquerChiffresReels(deux, false);
    expect(non.chiffresReels).toBe(false);
    expect(non.plages[0].usages).toEqual([]);
  });
  it("garde les autres usages et reste déterministe", () => {
    const f = gele(fiche([plage("c", { raisonsNote: [{ code: "chiffre", points: 25 }], usages: ["ecran"] })]));
    const oui = marquerChiffresReels(f, true);
    expect(oui.plages[0].usages).toEqual(["ecran", "preuve-chiffree"]);
    expect(marquerChiffresReels(oui, false).plages[0].usages).toEqual(["ecran"]);
    expect(marquerChiffresReels(f, true)).toEqual(oui);
  });
});
