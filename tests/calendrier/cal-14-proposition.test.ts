/** CAL-14 · modèle Proposition : « Proposée » non publiable, origine à deux valeurs, refus archivés. */
import { describe, expect, it } from "vitest";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import {
  ORIGINES_ENTREE, STATUTS_PLAN, estPubliable, refuserProposition, transitionAutorisee, transitionner, validerCreneau, validerProposition,
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
  it("transitionner refuse a_valider → valide, même pour le Studio : on passe par validerProposition", () => {
    const aValider = { ...base, statut: "a_valider" as const };
    for (const auteur of ["studio", "usine"] as const) {
      const r = transitionner(aValider, "valide", auteur);
      expect(r.ok, auteur).toBe(false);
      if (!r.ok && auteur === "studio") expect(r.raison).toMatch(/validerProposition/);
    }
  });
  it("aucun chemin de transitionner ne produit un « valide » sans trace depuis un créneau sans trace", () => {
    for (const de of STATUTS_PLAN) {
      const r = transitionner({ ...base, statut: de }, "valide", "studio");
      if (r.ok) expect(estPubliable(r.creneau).ok, `de ${de}`).toBe(false); // ok seulement si le créneau portait déjà une trace
      if (r.ok) expect(de === "programme" || de === "echec").toBe(true);
    }
  });
  it("un retour en « a_valider » ou « propose » efface l'ancienne trace de validation", () => {
    const valide = { ...base, statut: "valide" as const, valideeLe: "2026-12-02T09:00:00Z", valideePar: "fondateur" };
    for (const vers of ["a_valider"] as const) {
      const r = transitionner(valide, vers, "studio");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.creneau.valideeLe).toBeUndefined();
        expect(r.creneau.valideePar).toBeUndefined();
      }
    }
    const r2 = transitionner({ ...valide, statut: "a_valider" }, "propose", "studio");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.creneau.valideeLe).toBeUndefined();
  });
  it("une re-validation ne reprend pas l'ancienne trace", () => {
    const valide = { ...base, statut: "valide" as const, valideeLe: "2026-12-02T09:00:00Z", valideePar: "fondateur" };
    const retour = transitionner(valide, "a_valider", "studio");
    expect(retour.ok).toBe(true);
    if (!retour.ok) return;
    expect(estPubliable({ ...retour.creneau, statut: "valide" }).ok).toBe(false);
    const r = validerProposition(retour.creneau, "studio", "2026-12-05T09:00:00Z", "fondateur");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.creneau.valideeLe).toBe("2026-12-05T09:00:00Z");
  });
  it("validerProposition exige un instant ISO UTC valide : vide, illisible, jour inexistant refusés", () => {
    const aValider = { ...base, statut: "a_valider" as const };
    for (const le of ["", "hier", "2026-12-02", "2026-12-02T09:00:00", "2026-13-40T09:00:00Z", "2026-02-30T09:00:00Z"]) {
      expect(validerProposition(aValider, "studio", le, "fondateur").ok, le).toBe(false);
    }
    expect(validerProposition(aValider, "studio", "2026-12-02T09:00Z", "fondateur").ok).toBe(true);
    expect(validerProposition(aValider, "studio", "2026-12-02T09:00:00.123Z", "fondateur").ok).toBe(true);
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
  it("validerCreneau refuse une origine venue d'ailleurs (JSON de la porte) et accepte vous, usine, absente", () => {
    expect(validerCreneau({ ...base, origine: "equipe_ia" as never })).toContain("Origine inconnue.");
    expect(validerCreneau({ ...base, origine: "" as never })).toContain("Origine inconnue.");
    for (const origine of ORIGINES_ENTREE) expect(validerCreneau({ ...base, origine })).toEqual([]);
    expect(validerCreneau({ ...base, origine: undefined })).toEqual([]);
  });
});

describe("CAL-14 · refus archivé, jamais supprimé", () => {
  it("archive la proposition avec le motif facultatif et garde toutes ses données", () => {
    const r = refuserProposition(base, "studio", "Pas le bon angle", "2026-12-02T10:00:00Z");
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
  it("seul le fondateur refuse : l'usine ne peut pas archiver une proposition par le refus", () => {
    const r = refuserProposition(base, "usine", "motif", "2026-12-02T10:00:00Z");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/fondateur/);
  });
  it("le refus exige un instant ISO UTC valide : vide et illisible refusés", () => {
    for (const le of ["", "hier", "2026-12-02", "2026-02-30T10:00:00Z"]) expect(refuserProposition(base, "studio", "m", le).ok, le).toBe(false);
  });
  it("le motif est facultatif", () => {
    const r = refuserProposition(base, "studio", undefined, "2026-12-02T10:00:00Z");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.creneau.motifRefus).toBeUndefined();
  });
  it("on ne refuse que ce qui est proposé ou à valider", () => {
    expect(refuserProposition({ ...base, statut: "publie" }, "studio", "x", "2026-12-02T10:00:00Z").ok).toBe(false);
  });
});
