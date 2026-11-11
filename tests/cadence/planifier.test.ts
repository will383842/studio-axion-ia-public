import { describe, expect, it } from "vitest";
import { planifierAvecContexte, planifierLot, type SujetAPlanifier } from "@/domaine/cadence/planifier";
import { ordreRotation } from "@/domaine/cadence/rotation";
import { verifierEspacement, type PostPlanifie } from "@/domaine/cadence/verifier";
import { planifierPublications } from "@/domaine/classement-generateur";

const LUNDI = "2026-12-07";
const sujet = (n: number): SujetAPlanifier => ({ id: `v${n}`, pilier: `pilier-${n}`, cible: "dirigeant" });
const cinq = [5, 3, 1, 4, 2].map(sujet);
const jours = (r: { jour: string }[]) => r.map((c) => c.jour);

describe("planificateur multi-sujets", () => {
  it("sans contexte, reprend planifierPublications", () => {
    const r = planifierAvecContexte(LUNDI, ["linkedin", "tiktok"], sujet(1), []);
    const base = planifierPublications(LUNDI, ["linkedin", "tiktok"]);
    expect(r.map((c) => [c.reseau, c.jour])).toEqual(base.map((c) => [c.reseau, c.jour]));
  });

  it("5 vidéos LinkedIn lancées le même lundi = 5 jours ouvrés distincts", () => {
    const r = planifierLot(LUNDI, cinq, ["linkedin"], []);
    const j = jours(r);
    expect(new Set(j).size).toBe(5);
    expect(j).toEqual(["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11"]);
  });

  it("le sixième saute le week-end", () => {
    const six = [...cinq, sujet(6)];
    const r = planifierLot(LUNDI, six, ["linkedin"], []);
    expect(jours(r).at(-1)).toBe("2026-12-14");
  });

  it("même plan à la relance, quel que soit l'ordre d'entrée", () => {
    const a = planifierLot(LUNDI, cinq, ["linkedin", "tiktok"], []);
    const b = planifierLot(LUNDI, [...cinq].reverse(), ["linkedin", "tiktok"], []);
    expect(b).toEqual(a);
  });

  it("relance après enregistrement : les posts déjà posés par ce lot ne comptent pas contre lui", () => {
    const a = planifierLot(LUNDI, cinq, ["linkedin"], []);
    const posts: PostPlanifie[] = a.map((c) => ({ id: c.id, reseau: c.reseau, jour: c.jour, heure: "09:00", pilier: c.pilier, cible: c.cible }));
    expect(planifierLot(LUNDI, cinq, ["linkedin"], posts)).toEqual(a);
  });

  it("évite les jours déjà pris par d'autres posts", () => {
    const pris: PostPlanifie = { id: "autre", reseau: "linkedin", jour: LUNDI, heure: "09:00", pilier: "z", cible: "z" };
    const r = planifierLot(LUNDI, [sujet(1)], ["linkedin"], [pris]);
    expect(jours(r)).toEqual(["2026-12-08"]);
  });

  it("le plan ne produit aucune violation d'espacement", () => {
    const r = planifierLot(LUNDI, cinq, ["linkedin"], []);
    const posts = r.map((c) => ({ id: c.id, reseau: c.reseau, jour: c.jour, heure: c.heure, pilier: c.pilier, cible: c.cible }));
    expect(verifierEspacement(posts).filter((v) => v.niveau === "violation")).toEqual([]);
  });

  it("aucun créneau samedi ou dimanche pour LinkedIn", () => {
    const r = planifierLot("2026-12-05", cinq, ["linkedin"], []);
    for (const c of r) expect([0, 6]).not.toContain(new Date(`${c.jour}T00:00:00Z`).getUTCDay());
  });
});

describe("rotation", () => {
  it("ordre stable par identifiant, sans doublon", () => {
    expect(ordreRotation([sujet(3), sujet(1), sujet(3), sujet(2)]).map((s) => s.id)).toEqual(["v1", "v2", "v3"]);
  });
  it("ne modifie pas l'entrée", () => {
    const e = [sujet(2), sujet(1)];
    ordreRotation(e);
    expect(e.map((s) => s.id)).toEqual(["v2", "v1"]);
  });
});
