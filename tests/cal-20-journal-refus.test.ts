import { describe, expect, it } from "vitest";
import {
  SEUIL_REGLE_PROPOSEE,
  compterRefusParMotif,
  motifsAProposer,
} from "@/domaine/calendrier/journal-refus";
import { creerJournalRefus } from "@/services/journal-refus";

const T = (n: number) => new Date(Date.UTC(2027, 0, n, 9, 0, 0));

function neuf() {
  let i = 0;
  return creerJournalRefus({ maintenant: () => T(++i), genererId: () => `r${++i}` });
}

describe("CAL-20 journal des refus", () => {
  it("note chaque refus avec motif, date et réseau, sans rien supprimer", () => {
    const j = neuf();
    const a = j.noterRefus({ motif: "ton trop commercial", reseau: "linkedin" });
    j.noterRefus({ motif: "ton trop commercial", reseau: "instagram" });
    expect(a.motif).toBe("ton trop commercial");
    expect(a.reseau).toBe("linkedin");
    expect(a.date).toBeInstanceOf(Date);
    expect(j.lister()).toHaveLength(2);
    expect("supprimer" in j).toBe(false);
  });

  it("la liste renvoyée est une copie : la modifier ne supprime rien", () => {
    const j = neuf();
    j.noterRefus({ motif: "m", reseau: "tiktok" });
    (j.lister() as unknown[]).length = 0;
    expect(j.lister()).toHaveLength(1);
  });

  it("à deux refus du même motif, rien n'est proposé", () => {
    const j = neuf();
    j.noterRefus({ motif: "trop long", reseau: "linkedin" });
    j.noterRefus({ motif: "trop long", reseau: "tiktok" });
    expect(j.reglesAProposer()).toEqual([]);
  });

  it("au troisième refus du même motif, une règle est proposée au fondateur, une seule fois", () => {
    const j = neuf();
    for (const r of ["linkedin", "tiktok", "instagram"] as const) j.noterRefus({ motif: "trop long", reseau: r });
    const p = j.reglesAProposer();
    expect(SEUIL_REGLE_PROPOSEE).toBe(3);
    expect(p).toHaveLength(1);
    expect(p[0].motif).toBe("trop long");
    expect(p[0].nombreRefus).toBe(3);
    expect(p[0].statut).toBe("proposee");
    j.noterRefus({ motif: "trop long", reseau: "linkedin" });
    expect(j.reglesAProposer()).toHaveLength(1);
  });

  it("le motif est comparé sans tenir compte de la casse ni des espaces", () => {
    const j = neuf();
    j.noterRefus({ motif: "Trop  long", reseau: "linkedin" });
    j.noterRefus({ motif: " trop long ", reseau: "linkedin" });
    j.noterRefus({ motif: "TROP LONG", reseau: "linkedin" });
    expect(j.reglesAProposer()).toHaveLength(1);
  });

  it("une règle proposée ne s'applique qu'après l'accord du fondateur", () => {
    const j = neuf();
    for (let k = 0; k < 3; k++) j.noterRefus({ motif: "trop long", reseau: "linkedin" });
    const [p] = j.reglesAProposer();
    expect(j.reglesAppliquees()).toEqual([]);
    expect(j.reglesAProposer()[0].statut).toBe("proposee");
    const ok = j.donnerAccord(p.id);
    expect(ok.statut).toBe("appliquee");
    expect(j.reglesAppliquees()).toHaveLength(1);
    expect(j.reglesAProposer()).toEqual([]);
  });

  it("refuser une règle ne la supprime pas et ne la repropose pas", () => {
    const j = neuf();
    for (let k = 0; k < 3; k++) j.noterRefus({ motif: "m", reseau: "tiktok" });
    const [p] = j.reglesAProposer();
    j.refuserRegle(p.id);
    expect(j.reglesAppliquees()).toEqual([]);
    expect(j.reglesAProposer()).toEqual([]);
    expect(j.toutesLesRegles()).toHaveLength(1);
  });

  it("accord sur une règle inconnue : erreur claire", () => {
    expect(() => neuf().donnerAccord("nope")).toThrow();
  });

  it("refuse un motif vide", () => {
    expect(() => neuf().noterRefus({ motif: "  ", reseau: "linkedin" })).toThrow();
  });

  it("fonctions pures du domaine", () => {
    const refus = [1, 2, 3].map((n) => ({ id: `${n}`, motif: "a", reseau: "linkedin" as const, date: T(n) }));
    expect(compterRefusParMotif(refus).get("a")).toBe(3);
    expect(motifsAProposer(refus, new Set())).toEqual(["a"]);
    expect(motifsAProposer(refus, new Set(["a"]))).toEqual([]);
  });
});
