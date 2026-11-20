import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerLecteurCommentaires } from "@/fournisseurs/zernio-inbox";
import { creerFauxClientZernio, fetchInterdit } from "./aides/faux-zernio";

const espionFetch = vi.spyOn(globalThis, "fetch");
beforeEach(() => {
  espionFetch.mockClear();
});
afterEach(() => {
  expect(espionFetch).not.toHaveBeenCalled();
});

const ev = (id: string, reseau: string) => ({
  type: "zernio.commentaire_manuel",
  recuLe: "2026-11-10T10:00:00Z",
  charge: { idCommentaire: id, idCompte: "exemple-c1", reseau, repere: "exemple-repere" },
});
const lecteur = (evenements: unknown[]) =>
  creerLecteurCommentaires({ source: async () => ({ evenements: evenements as never, curseurSuivant: null }), comptesLecture: ["exemple-c1"] });
const lire = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

describe("L5-11 gardes", () => {
  it("T-G1 aucun appel réseau", async () => {
    const { faux } = creerFauxClientZernio(fetchInterdit().fetch as never);
    const r = await lecteur([ev("a", "linkedin_page")]).lireCommentaires({ idCompte: "exemple-c1", reseau: "linkedin_page" });
    expect(r.statut).toBe("ok");
    expect(faux.appels.length).toBe(0);
  });
  it("T-G2 aucune porte d'écriture", () => {
    expect(Object.keys(lecteur([]))).toEqual(["lireCommentaires"]);
    const src = lire("src/fournisseurs/zernio-inbox.ts");
    const corps = src.slice(src.indexOf("export function creerLecteurCommentaires"));
    for (const m of ["requete", "repondre", "envoyer", "/v1/"]) expect(corps).not.toContain(m);
  });
  it("T-G3 linkedin et tiktok toujours manuels", async () => {
    for (const reseau of ["linkedin_page", "tiktok"] as const) {
      const r = await lecteur([ev("a", reseau)]).lireCommentaires({ idCompte: "exemple-c1", reseau });
      if (r.statut !== "ok") throw new Error();
      expect(r.commentaires).toHaveLength(1);
      expect(r.commentaires.every((c) => c.traitement === "manuel")).toBe(true);
    }
    expect(lire("src/services/parcours-conversation.ts")).toContain('if (reseau !== "instagram" && reseau !== "facebook") return "reseau";');
  });
  it("T-G4 liste fermée du client inchangée", () => {
    const src = lire("src/fournisseurs/publication/zernio-client.ts");
    const bloc = /const ROUTES\b[\s\S]*?\n\];/.exec(src)?.[0] ?? "";
    expect(bloc.split("\n").filter((l) => l.includes("/v1/inbox")).length).toBe(4);
    expect(bloc).not.toMatch(/GET[^\n]*\/v1\/inbox\/comments/);
  });
});
