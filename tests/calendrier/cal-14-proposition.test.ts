/** CAL-14 · modèle Proposition : « Proposée » non publiable, origine à deux valeurs, refus archivés. */
import { describe, expect, it } from "vitest";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import {
  ORIGINES_ENTREE, STATUTS_PLAN, estPubliable, refuserProposition, transitionAutorisee, transitionner, validerProposition,
} from "@/domaine/plan-editorial/statuts";

const base: CreneauEditorial = {
  id: "c1", jourVise: "2026-12-01", heuresParReseau: { linkedin: "2026-12-01T08:30:00.000Z" },
  compteCible: "compte-fictif", statut: "propose", decalages: 0, videoId: "v1", origine: "usine",
};

describe("CAL-14 · jamais publiée sans validation", () => {
  it("une entrée « Proposée » n'est pas publiable, même complète", () => {
    expect(estPubliable(base).ok).toBe(false);
    expect(estPubliable({ ...base, statut: "a_valider" }).ok).toBe(false);
  });
  it("aucun chemin ne mène de « propose » à programme ou publie sans passer par « valide »", () => {
    const vus = new Set<string>(["propose"]);
    const file = ["propose"] as const satisfies readonly string[];
    const aVisiter: string[] = [...file];
    while (aVisiter.length) {
      const s = aVisiter.pop()!;
      for (const v of STATUTS_PLAN) if (transitionAutorisee(s as never, v) && v !== "valide" && !vus.has(v)) { vus.add(v); aVisiter.push(v); }
    }
    expect(vus.has("programme")).toBe(false);
    expect(vus.has("publie")).toBe(false);
  });
  it("l'usine ne peut pas valider ; seul le fondateur le peut, et la validation est tracée", () => {
    const aValider = { ...base, statut: "a_valider" as const };
    expect(transitionner(aValider, "valide", "usine").ok).toBe(false);
    expect(validerProposition(aValider, "usine", "2026-12-02T09:00:00Z", "fondateur").ok).toBe(false);
    const r = validerProposition(aValider, "studio", "2026-12-02T09:00:00Z", "fondateur");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creneau.statut).toBe("valide");
      expect(r.creneau.valideeLe).toBe("2026-12-02T09:00:00Z");
      expect(r.creneau.valideePar).toBe("fondateur");
      expect(estPubliable(r.creneau).ok).toBe(true);
    }
  });
  it("une proposition encore « propose » ne se valide pas directement", () => {
    expect(validerProposition(base, "studio", "2026-12-02T09:00:00Z", "fondateur").ok).toBe(false);
  });
  it("un statut « valide » sans trace de validation n'est pas publiable", () => {
    expect(estPubliable({ ...base, statut: "valide" }).ok).toBe(false);
    expect(estPubliable({ ...base, statut: "valide", valideeLe: "2026-12-02T09:00:00Z" }).ok).toBe(false);
  });
});

describe("CAL-14 · origine", () => {
  it("n'a que deux valeurs : vous et usine", () => {
    expect([...ORIGINES_ENTREE]).toEqual(["vous", "usine"]);
  });
});

describe("CAL-14 · refus archivé, jamais supprimé", () => {
  it("archive la proposition avec le motif facultatif et garde toutes ses données", () => {
    const r = refuserProposition(base, "Pas le bon angle", "2026-12-02T10:00:00Z");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creneau.statut).toBe("archive");
      expect(r.creneau.motifRefus).toBe("Pas le bon angle");
      expect(r.creneau.refuseLe).toBe("2026-12-02T10:00:00Z");
      expect(r.creneau.id).toBe(base.id);
      expect(r.creneau.videoId).toBe("v1");
      expect(estPubliable(r.creneau).ok).toBe(false);
    }
  });
  it("le motif est facultatif", () => {
    const r = refuserProposition(base, undefined, "2026-12-02T10:00:00Z");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.creneau.motifRefus).toBeUndefined();
  });
  it("on ne refuse que ce qui est proposé ou à valider", () => {
    expect(refuserProposition({ ...base, statut: "publie" }, "x", "2026-12-02T10:00:00Z").ok).toBe(false);
  });
});
