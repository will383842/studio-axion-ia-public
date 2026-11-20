import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIBELLE_MISE_A_JOUR_DIFFEREE, TYPE_EVENEMENT_COMMENTAIRE_MANUEL, commentaireLuDe } from "@/fournisseurs/publication/zernio-inbox-corps";
import { TYPE_COMMENTAIRE_MANUEL_CROCHET } from "@/services/parcours-mot";

const espionFetch = vi.spyOn(globalThis, "fetch");
beforeEach(() => {
  espionFetch.mockClear();
});
afterEach(() => {
  expect(espionFetch).not.toHaveBeenCalled();
});

const auto = (charge: Record<string, unknown> = {}) => ({
  type: "zernio.commentaire",
  recuLe: "2026-11-10T10:00:00Z",
  charge: { idCommentaire: "exemple-com-1", idCompte: "exemple-ig-1", reseau: "instagram", idPostPlateforme: "exemple-post-1", motSeul: "GUIDE", ...charge },
});
const manuel = (charge: Record<string, unknown> = {}) => ({
  type: "zernio.commentaire_manuel",
  recuLe: "2026-11-10T11:00:00Z",
  charge: { idCommentaire: "exemple-com-2", idCompte: "exemple-li-1", reseau: "linkedin_page", repere: "exemple-repere-1", lienPost: "https://exemple.test/post/1", ...charge },
});

describe("L5-11 commentaireLuDe", () => {
  it("T-C1 instagram valide", () => {
    const c = commentaireLuDe(auto());
    expect(c).toMatchObject({ reseau: "instagram", traitement: "automatique", repere: "exemple-post-1", lienPost: null, motSeul: "GUIDE", recuLe: "2026-11-10T10:00:00.000Z" });
  });
  it("T-C2 linkedin_page valide", () => {
    expect(commentaireLuDe(manuel())).toMatchObject({ reseau: "linkedin_page", traitement: "manuel", repere: "exemple-repere-1", lienPost: "https://exemple.test/post/1" });
  });
  it("T-C3 tiktok toujours manuel", () => {
    expect(commentaireLuDe(manuel({ reseau: "tiktok", traitement: "automatique" }))?.traitement).toBe("manuel");
  });
  it("T-C4 aucun texte ni auteur", () => {
    const r = commentaireLuDe(auto({ texte: "exemple-texte-secret", text: "exemple-texte-secret", idAuteur: "exemple-texte-secret" }));
    expect(JSON.stringify(r)).not.toContain("exemple-texte-secret");
    expect(Object.keys(r!).sort()).toEqual(["doute", "estReponse", "idCommentaire", "idCompte", "lienPost", "motSeul", "recuLe", "repere", "reseau", "traitement"]);
  });
  it("T-C5 refus croisés", () => {
    expect(commentaireLuDe(auto({ reseau: "linkedin_page" }))).toBeNull();
    expect(commentaireLuDe(manuel({ reseau: "instagram" }))).toBeNull();
    expect(commentaireLuDe({ ...auto(), type: "zernio.message" })).toBeNull();
    expect(commentaireLuDe(auto({ idCommentaire: "a/b" }))).toBeNull();
    expect(commentaireLuDe({ ...auto(), recuLe: "pas-une-date" })).toBeNull();
    expect(commentaireLuDe({ ...auto(), charge: null })).toBeNull();
    expect(commentaireLuDe(undefined)).toBeNull();
  });
  it("T-C6 proprio refusé", () => {
    expect(commentaireLuDe(auto({ proprio: true }))).toBeNull();
  });
  it("T-C7 constantes", () => {
    expect(TYPE_EVENEMENT_COMMENTAIRE_MANUEL).toBe(TYPE_COMMENTAIRE_MANUEL_CROCHET);
    expect(LIBELLE_MISE_A_JOUR_DIFFEREE).toBe("mise à jour différée");
  });
});
