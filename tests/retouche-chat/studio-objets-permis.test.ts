import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { ID } from "@/briques/bibliotheque-video/noms";

// Dépôts doubles recopiés de tests/retouche-chat/studio.test.ts (C9-38-b-b1).
const etat = vi.hoisted(() => ({ versions: new Map<string, Record<string, unknown>>(), videos: new Map<string, Record<string, unknown>>() }));
vi.mock("@/services/_commun", () => ({
  horodatage: () => ({ creeLe: "2026-11-20T00:00:00.000Z", modifieLe: "2026-11-20T00:00:00.000Z" }),
  depots: () => ({
    videos: { obtenir: async (id: string) => etat.videos.get(id) ?? null },
    versions: { obtenir: async (id: string) => etat.versions.get(id) ?? null, enregistrer: async () => undefined },
  }),
}));
vi.mock("@/services/videos", () => ({ choisirVersion: async () => undefined }));
vi.mock("@/services/fabrication", () => ({ prochainNumero: async () => 2 }));

import { portsStudio } from "@/services/retouche-chat/studio";

const ENTREE_TOUT_PREVU: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFILS_DU_CODE["demo-facecam"], recents: [], graine: "G", figeeLe: "2026-11-17" };
const ENTREE_OBJET_CHIFFRE: EntreeBibliotheque = {
  version: VERSION_BIBLIOTHEQUE,
  profil: { ...profilNeutre("demo-facecam"), capacites: { [ID.objetChiffre]: { permis: true } } as unknown as ProfilVideo["capacites"] },
  recents: [],
  graine: "G",
  figeeLe: "2026-11-17",
};

async function lire(commande: unknown) {
  etat.videos.set("vid", { id: "vid", versionChoisieId: "v1" });
  etat.versions.set("v1", { id: "v1", videoId: "vid", numero: 1, commande, projetMontage: { retoucheChat: { plan: PLAN_DEMO } } });
  return portsStudio().lireVersionChoisie("vid");
}

describe("chat de retouche : objets permis de la commande de la version lue (C9-38-b-b1)", () => {
  it("éteint = identique : aucune entrée, ou entrée « tout prévu » sans permis : exactement { versionId, plan }", async () => {
    for (const commande of [{ entrees: {} }, { entrees: { bibliothequeVideo: ENTREE_TOUT_PREVU } }]) {
      const r = await lire(commande);
      expect(r).not.toBeNull();
      expect(Object.keys(r!).sort()).toEqual(["plan", "versionId"]);
      expect(r!.versionId).toBe("v1");
    }
  });

  it("entrée qui permet objet.chiffre : objetsPermis contient objet-gros-chiffre", async () => {
    const r = await lire({ entrees: { bibliothequeVideo: ENTREE_OBJET_CHIFFRE } });
    expect(r!.objetsPermis).toContain("objet-gros-chiffre");
    expect(Object.keys(r!).sort()).toEqual(["objetsPermis", "plan", "versionId"]);
  });

  it("ancienne version sans commande.entrees : identique à éteint, ne lève jamais", async () => {
    for (const commande of [{}, undefined, null]) {
      const r = await lire(commande);
      expect(Object.keys(r!).sort()).toEqual(["plan", "versionId"]);
    }
  });
});
