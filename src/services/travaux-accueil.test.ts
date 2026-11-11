import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../tests/helpers/next-mocks";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
import { travailAfficheALAccueil } from "./travaux";

const echec = { statut: "echec", type: "fabrication" } as const;

describe("travailAfficheALAccueil (lot F)", () => {
  it("exclut un échec dont la vidéo est archivée ou absente, et un échec de fabrication sur vidéo prête", () => {
    expect(travailAfficheALAccueil(echec, { statut: "archivee" }, false)).toBe(false);
    expect(travailAfficheALAccueil(echec, { statut: "prete" }, false)).toBe(false);
    expect(travailAfficheALAccueil(echec, undefined, false)).toBe(false);
  });
  it("garde une retouche ou un recalque de sous-titres en échec sur une vidéo prête", () => {
    expect(travailAfficheALAccueil({ statut: "echec", type: "retouche" }, { statut: "prete" }, false)).toBe(true);
    expect(travailAfficheALAccueil({ statut: "echec", type: "recalque-sous-titres" }, { statut: "prete" }, false)).toBe(true);
    expect(travailAfficheALAccueil({ statut: "echec", type: "retouche" }, { statut: "archivee" }, false)).toBe(false);
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

describe("listerTravaux (accueil) : échecs périmés", () => {
  const travail = (id: string, type: Travail["type"], statut: Travail["statut"], creeLe: string): Travail =>
    ({ id, type, cibleId: "v-04", titre: id, etapes: [], statut, progression: 0, tentatives: 1, cleIdempotence: id, fournisseurUtilise: "simulation", creeLe, modifieLe: creeLe }) as Travail;
  beforeEach(async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    reinitialiserRequete();
  });
  async function preparer(videoStatut: "prete" | "echec", travaux: Travail[]) {
    const { depots } = await import("@/donnees/memoire");
    await depots().videos.modifier("v-04", { estDemo: false, statut: videoStatut });
    for (const t of travaux) await depots().travaux.enregistrer(t);
    const { listerTravaux } = await import("./travaux");
    return (await listerTravaux()).map((t) => t.id);
  }
  it("retouche en échec sur vidéo prête : gardée ; fabrication en échec sur vidéo prête : masquée", async () => {
    const ids = await preparer("prete", [travail("t-ret", "retouche", "echec", "2026-11-11T10:00:00.000Z"), travail("t-fab", "fabrication", "echec", "2026-11-11T09:00:00.000Z")]);
    expect(ids).toContain("t-ret");
    expect(ids).not.toContain("t-fab");
  });
  it("un ré-export plus récent n'efface pas l'échec ; une fabrication plus récente l'efface", async () => {
    const echecInitial = travail("t-ech", "fabrication", "echec", "2026-11-11T09:00:00.000Z");
    expect(await preparer("echec", [echecInitial, travail("t-reexp", "reexport", "termine", "2026-11-11T10:00:00.000Z")])).toContain("t-ech");
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    expect(await preparer("echec", [echecInitial, travail("t-fab2", "fabrication", "termine", "2026-11-11T10:00:00.000Z")])).not.toContain("t-ech");
  });
});
