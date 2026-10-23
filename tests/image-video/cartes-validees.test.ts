/**
 * L15 (relecture A09) · Compteur des cartes validées par Will : une vidéo n'est comptée qu'UNE fois (deux clics, ou une
 * revalidation après reprise, ne font pas avancer les « 10 premières vidéos » de B6), lecture et écriture sous verrou.
 * Dépôts, session et journal : doubles (aucun réseau).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { avancerJusquAArretIV, etatInitialIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

const parametres = new Map<string, unknown>();
let travail: { id: string; parametres: { imageVideo: EtatFabricationIV } } | null = null;

vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (cle: string, defaut: unknown) => (parametres.has(cle) ? structuredClone(parametres.get(cle)) : defaut),
  ecrireParametre: async (cle: string, valeur: unknown) => {
    // Écriture lente : sans verrou, deux validations simultanées liraient la même liste.
    await new Promise((ok) => setTimeout(ok, 5));
    parametres.set(cle, structuredClone(valeur));
  },
  journaliser: async () => undefined,
  ErreurStudio: class extends Error {},
  depots: () => ({
    versions: { lister: async () => (travail ? [{ videoId: "v", numero: 1, travailId: travail.id, commande: { moteurId: "montage-image-video" } }] : []) },
    travaux: { obtenir: async () => travail },
  }),
}));

const { avecCarteValidee, nombreCartesValidees, PARAM_CARTES_VALIDEES } = await import("@/services/image-video");
const { validerCarteImageVideo } = await import("@/services/image-video-carte");

describe("compteur des cartes validées (PUR)", () => {
  it("une vidéo n'est ajoutée qu'une fois ; le nombre compte des vidéos distinctes", () => {
    expect(avecCarteValidee([], "v1")).toEqual(["v1"]);
    expect(avecCarteValidee(["v1"], "v1")).toBeNull();
    expect(avecCarteValidee(["v1"], "v2")).toEqual(["v1", "v2"]);
    expect(nombreCartesValidees(["v1", "v1", "v2"])).toBe(2);
    expect(nombreCartesValidees(undefined)).toBe(0);
    expect(nombreCartesValidees(7)).toBe(7);
    expect(avecCarteValidee(7, "v9")).toBeNull();
  });
});

describe("« Valider la carte » (service)", () => {
  beforeEach(async () => {
    parametres.clear();
    const carte = carteFixe("C");
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { videoId: "v" })), outilsSimules(carte, monde()));
    expect(e.etape).toBe("carte-a-valider");
    travail = { id: "t1", parametres: { imageVideo: e } };
  });

  it("deux clics sur la même carte, même en même temps : une seule carte comptée", async () => {
    const [a, b] = await Promise.all([validerCarteImageVideo("v", { maintenant: 0 }), validerCarteImageVideo("v", { maintenant: 0 })]);
    expect([a.cartesValidees, b.cartesValidees]).toEqual([1, 1]);
    expect(await validerCarteImageVideo("v", { maintenant: 0 })).toMatchObject({ cartesValidees: 1 });
    expect(parametres.get(PARAM_CARTES_VALIDEES)).toEqual(["v"]);
  });
});
