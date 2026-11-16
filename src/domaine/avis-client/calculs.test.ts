import { describe, expect, it } from "vitest";
import { choisirAvisClient, compteurAvis, noteMoyenne, texteChiffresHonnete } from "./calculs";
import type { AvisClient } from "./types";

function avis(o: Partial<AvisClient> = {}): AvisClient {
  return {
    id: "a1", auteur: "Marie", date: "2026-05-01", source: "google", note: 5,
    texte: "Très bien.", statut: "published",
    accordAuteur: { ecrit: true, date: "2026-05-02", forme: "courriel" },
    valideLe: "2026-05-03", ...o,
  };
}
const cinq = (notes = [1, 2, 3, 4, 5]) =>
  notes.map((n, i) => avis({ id: `a${i}`, note: n, date: `2026-05-0${i + 1}` }));

describe("compteurAvis / noteMoyenne", () => {
  it("0 avis → null (jamais 0)", () => {
    expect(compteurAvis([])).toBeNull();
    expect(noteMoyenne([])).toBeNull();
  });
  it("4 avis → null", () => {
    expect(compteurAvis(cinq().slice(0, 4))).toBeNull();
    expect(noteMoyenne(cinq().slice(0, 4))).toBeNull();
  });
  it("5 avis (1 à 5) → moyenne 3,0 et compteur 5", () => {
    expect(noteMoyenne(cinq())).toBe(3);
    expect(compteurAvis(cinq())).toBe(5);
  });
  it("un avis non publié n'est pas compté", () => {
    const l = [...cinq().slice(0, 4), avis({ id: "x", statut: "draft" })];
    expect(compteurAvis(l)).toBeNull();
    expect(noteMoyenne(l)).toBeNull();
    expect(compteurAvis([...cinq(), avis({ id: "x", statut: "hidden" })])).toBe(5);
  });
  it("moyenne sur tous, 1 décimale, jamais arrondie vers le haut", () => {
    expect(noteMoyenne(cinq([5, 5, 5, 5, 4]))).toBe(4.8);
    expect(noteMoyenne(cinq([5, 5, 5, 4, 4, 4]))).toBe(4.5);
    expect(noteMoyenne(cinq([5, 5, 5, 5, 5, 5, 4]))).toBe(4.8); // 4,857… → 4,8
  });
});

describe("choisirAvisClient", () => {
  it("liste vide → null", () => expect(choisirAvisClient([])).toBeNull());
  it("le plus récent, même à 1 étoile", () => {
    const l = [avis({ id: "a", note: 5, date: "2026-01-01" }), avis({ id: "b", note: 1, date: "2026-06-01" })];
    expect(choisirAvisClient(l)?.id).toBe("b");
  });
  it("désigné dans la liste → lui", () => {
    const l = [avis({ id: "a", date: "2026-01-01" }), avis({ id: "b", date: "2026-06-01" })];
    expect(choisirAvisClient(l, { designe: "a" })?.id).toBe("a");
  });
  it("désigné hors liste ou non publié → le plus récent", () => {
    const l = [avis({ id: "a", date: "2026-01-01" }), avis({ id: "b", date: "2026-06-01" }), avis({ id: "c", statut: "draft", date: "2027-01-01" })];
    expect(choisirAvisClient(l, { designe: "zzz" })?.id).toBe("b");
    expect(choisirAvisClient(l, { designe: "c" })?.id).toBe("b");
  });
  it("permuter les notes ne change pas le choix", () => {
    const dates = ["2026-01-01", "2026-03-01", "2026-02-01"];
    const mk = (notes: number[]) => dates.map((d, i) => avis({ id: `i${i}`, date: d, note: notes[i] }));
    expect(choisirAvisClient(mk([1, 3, 5]))?.id).toBe("i1");
    expect(choisirAvisClient(mk([5, 1, 3]))?.id).toBe("i1");
    expect(choisirAvisClient(mk([3, 5, 1]))?.id).toBe("i1");
  });
  it("seulement des avis non affichables → null", () => {
    expect(choisirAvisClient([avis({ statut: "draft" })])).toBeNull();
  });
});

describe("texteChiffresHonnete", () => {
  it.each(["+500 clients", "Note : 5/5", "5 / 5 !", "une note de 4,9", "note de 4.9", "100 % satisfaits", "98% de clients contents"])(
    "refuse : %s", (t) => {
      const r = texteChiffresHonnete(t);
      expect(r.ok).toBe(false);
      expect(r.motifs.length).toBeGreaterThan(0);
    });
  it.each(["Vidéo livrée en 3 jours", "Très bon accompagnement", "", "Un client satisfait"])("accepte : %s", (t) => {
    expect(texteChiffresHonnete(t)).toEqual({ ok: true, motifs: [] });
  });
});
