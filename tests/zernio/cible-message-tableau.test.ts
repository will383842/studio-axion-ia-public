/** Message « rien de coché » : la variante avec « tableau » est réservée à Pinterest. Faux fournisseur, données fictives. */
import { describe, expect, it } from "vitest";
import { ciblesZernioPour } from "@/services/zernio-cibles";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";

const svc = (canaux: CanalPublication[]): FournisseurPublication => ({ listerCanaux: async () => canaux }) as unknown as FournisseurPublication;
const canal = (service: string, id: string): CanalPublication => ({ id, organisationId: "z", nom: "Exemple", service, genre: "page", deconnecte: false }) as CanalPublication;

describe("message de cible absente", () => {
  it("Facebook et LinkedIn : l'ancienne phrase, sans « tableau »", async () => {
    for (const [reseau, id] of [["facebook", "c1:fb:p1"], ["linkedin", "c1:li:1"]] as const) {
      const r = await ciblesZernioPour(svc([canal(reseau, id), canal(reseau, id + "b")]), reseau, []);
      expect(r.ok).toBe(false);
      const m = !r.ok ? r.message : "";
      expect(m).toMatch(/Cochez la page ou le profil de destination/);
      expect(m).not.toMatch(/tableau/);
    }
  });
  it("Pinterest : la variante avec « tableau »", async () => {
    const r = await ciblesZernioPour(svc([canal("pinterest", "c9:pin:b1")]), "pinterest", []);
    expect(!r.ok && r.message).toMatch(/Cochez la page, le profil ou le tableau de destination/);
  });
});
