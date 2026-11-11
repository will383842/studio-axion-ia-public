import { describe, expect, it } from "vitest";
import { reconcilier } from "@/services/reconciliation-calendrier";

const creneau = { id: "c1", statut: "programme" as const };
const publication = { id: "p1", statut: "programmee" as const };
const visuel = { id: "v1", statut: "programme" as const };

describe("reconcilier", () => {
  it("post publié → créneau, publication et visuel publiés", () => {
    const r = reconcilier({ diffuseur: "publie" }, { creneau, publication, visuel });
    expect(r.creneau).toEqual({ statut: "publie" });
    expect(r.publication).toEqual({ statut: "publiee" });
    expect(r.visuel).toEqual({ statut: "publie" });
    expect(r.aReprendre).toBeUndefined();
  });
  it("échec → a_reprendre avec la raison", () => {
    const r = reconcilier({ diffuseur: "echec", raison: "Jeton expiré" }, { creneau, publication, visuel });
    expect(r.creneau).toEqual({ statut: "echec" });
    expect(r.publication).toEqual({ statut: "echec", erreur: "Jeton expiré" });
    expect(r.visuel).toEqual({ statut: "echec_envoi" });
    expect(r.aReprendre).toEqual({ raison: "Jeton expiré" });
  });
  it("échec sans raison : raison par défaut", () => {
    expect(reconcilier({ diffuseur: "echec" }, { creneau, publication }).aReprendre?.raison).toMatch(/inconnue/);
  });
  it("sans visuel : pas de changement de visuel", () => {
    expect(reconcilier({ diffuseur: "publie" }, { creneau, publication }).visuel).toBeUndefined();
  });
  it("en attente : rien ne change", () => {
    const r = reconcilier({ diffuseur: "en_attente" }, { creneau, publication, visuel });
    expect(r).toEqual({});
  });
  it("idempotent : déjà publié → rien à changer", () => {
    const r = reconcilier({ diffuseur: "publie" }, { creneau: { id: "c1", statut: "publie" }, publication: { id: "p1", statut: "publiee" }, visuel: { id: "v1", statut: "publie" } });
    expect(r).toEqual({});
  });
  it("transition non permise (créneau encore valide) : ignorée, jamais forcée", () => {
    const r = reconcilier({ diffuseur: "publie" }, { creneau: { id: "c1", statut: "valide" }, publication });
    expect(r.creneau).toBeUndefined();
    expect(r.publication).toEqual({ statut: "publiee" });
  });
});
