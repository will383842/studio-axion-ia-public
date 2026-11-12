import { describe, expect, it } from "vitest";
import { planifierAvecContexte, planifierLot, type SujetAPlanifier } from "@/domaine/cadence/planifier";
import { ordreRotation } from "@/domaine/cadence/rotation";
import { REGLES_PAR_DEFAUT, verifierEspacement, type PostPlanifie, type ReglesEspacement } from "@/domaine/cadence/verifier";
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
    const posts: PostPlanifie[] = a.map((c) => ({ id: c.id, sujet: c.sujet, reseau: c.reseau, jour: c.jour, heure: "09:00", pilier: c.pilier, cible: c.cible }));
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

const viol = (r: { id: string; reseau: string; jour: string; heure: string; pilier: string; cible: string }[], regles?: ReglesEspacement) =>
  verifierEspacement(r.map(({ id, reseau, jour, heure, pilier, cible }) => ({ id, reseau, jour, heure, pilier, cible })), regles).filter((v) => v.niveau === "violation");

describe("planificateur : écart minimal et répétition pilier+cible (avis v1-s6)", () => {
  it("(b) deux sujets de même pilier et cible sur LinkedIn : au moins 4 jours d'écart, aucune violation", () => {
    const deux: SujetAPlanifier[] = [{ id: "a", pilier: "preuve", cible: "dirigeant" }, { id: "b", pilier: "preuve", cible: "dirigeant" }];
    const r = planifierLot(LUNDI, deux, ["linkedin"], []);
    expect(jours(r)).toEqual(["2026-12-07", "2026-12-11"]);
    expect(viol(r)).toEqual([]);
  });

  it("(c) avec un écart minimal de 48 h, deux sujets restent à 48 h ou plus", () => {
    const regles = { ...REGLES_PAR_DEFAUT, ecartMinH: 48, quotaParJour: 2 };
    const r = planifierLot(LUNDI, [sujet(1), sujet(2)], ["linkedin"], [], { regles });
    expect(jours(r)).toEqual(["2026-12-07", "2026-12-09"]);
    expect(viol(r, regles)).toEqual([]);
  });

  it("(a) les déclinaisons d'un même sujet ne s'étalent pas à cause de la règle pilier+cible", () => {
    const s: SujetAPlanifier = { id: "a", pilier: "preuve", cible: "dirigeant" };
    const r = planifierAvecContexte(LUNDI, ["linkedin", "tiktok", "instagram"], s, []);
    const base = planifierPublications(LUNDI, ["linkedin", "tiktok", "instagram"]);
    expect(r.map((c) => c.jour)).toEqual(base.map((c) => c.jour));
    expect(viol(r).filter((v) => v.code !== "repetition")).toEqual([]);
  });

  it("un post étranger nommé « a:linkedin » sans champ sujet n'est pas écarté", () => {
    const etranger: PostPlanifie = { id: "a:linkedin", reseau: "linkedin", jour: LUNDI, heure: "09:00", pilier: "z", cible: "z" };
    const r = planifierLot(LUNDI, [{ id: "a", pilier: "p", cible: "c" }], ["linkedin"], [etranger]);
    expect(jours(r)).toEqual(["2026-12-08"]);
  });

  it("un identifiant de sujet contenant « : » est écarté correctement à la relance", () => {
    const s: SujetAPlanifier = { id: "x:1", pilier: "p", cible: "c" };
    const a = planifierLot(LUNDI, [s], ["linkedin"], []);
    expect(planifierLot(LUNDI, [s], ["linkedin"], a)).toEqual(a);
  });
});

describe("rotation", () => {
  it("tri numérique : v2 avant v10", () => {
    expect(ordreRotation([sujet(10), sujet(2)]).map((x) => x.id)).toEqual(["v2", "v10"]);
  });
  it("ordre stable par identifiant, sans doublon", () => {
    expect(ordreRotation([sujet(3), sujet(1), sujet(3), sujet(2)]).map((s) => s.id)).toEqual(["v1", "v2", "v3"]);
  });
  it("ne modifie pas l'entrée", () => {
    const e = [sujet(2), sujet(1)];
    ordreRotation(e);
    expect(e.map((s) => s.id)).toEqual(["v2", "v1"]);
  });
});
