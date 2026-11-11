import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { travailAfficheALAccueil } from "./travaux";

const echec = { statut: "echec", type: "fabrication" } as const;

describe("travailAfficheALAccueil (lot F)", () => {
  it("exclut un échec dont la vidéo est archivée, prête ou absente", () => {
    expect(travailAfficheALAccueil(echec, { statut: "archivee" }, false)).toBe(false);
    expect(travailAfficheALAccueil(echec, { statut: "prete" }, false)).toBe(false);
    expect(travailAfficheALAccueil(echec, undefined, false)).toBe(false);
  });
  it("exclut un échec quand un travail plus récent existe pour la même vidéo", () => {
    expect(travailAfficheALAccueil(echec, { statut: "echec" }, true)).toBe(false);
  });
  it("garde un échec (attente de validation comprise) d'une vidéo en cours de vie", () => {
    expect(travailAfficheALAccueil(echec, { statut: "echec" }, false)).toBe(true);
    expect(travailAfficheALAccueil(echec, { statut: "en_fabrication" }, false)).toBe(true);
  });
  it("garde toujours un travail actif, même sur vidéo archivée", () => {
    expect(travailAfficheALAccueil({ statut: "en_cours", type: "fabrication" }, { statut: "archivee" }, true)).toBe(true);
    expect(travailAfficheALAccueil({ statut: "en_file", type: "fabrication" }, undefined, true)).toBe(true);
  });
});
