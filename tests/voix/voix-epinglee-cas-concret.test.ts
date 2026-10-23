/** L1-05 PR 2 : voix épinglée du cas concret + refus de toute voix qui n'est pas celle de HeyGen. Doubles seulement : rien n'est dépensé. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { VOIX_MAITRE_HEYGEN_ID, VoixNonEpingleeError, exigerVoixMaitre } = await import("@/briques/voix-maitre");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const b = await import("@/services/cas-concret-branchements");
const { voixDeReference } = await import("@/services/cas-concret");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");

import type { CommandeFabrication } from "@/domaine/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";
import type { StockageFichiers } from "@/fournisseurs/types";

const commande = {
  versionContrat: 2, moteurId: "montage-cas-concret", videoId: "v-03", formatId: "cas-concret", versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: 50, ratios: ["9:16"],
  script: { blocs: [], texteComplet: "" },
  distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "heygen", voixId: "voix-clara" }],
  styles: { sousTitres: null, decor: null, lut: null, musique: null }, briques: {},
  entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: ["facebook"], essai: false, codeSuivi: "cc-x" } },
  reglages: {}, plans: [], prononciations: [], budgetMax: { centimes: 0, devise: "EUR" }, construiteLe: "2026-10-18T09:00:00.000Z",
} as unknown as CommandeFabrication;

const dep = { rendu: { service: creerServiceRenduSimule(() => 0), simule: true }, scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

/** Espions sur tout ce qui dépense ou touche au fournisseur : aucun ne doit être appelé quand la voix est refusée. */
function espions() {
  const verifierEtReserver = vi.fn(async () => {});
  const executer = vi.fn();
  const claudeActif = vi.fn(async () => true);
  const stockage = {
    type: "stockage", mode: "reel", preparerDepot: vi.fn(), confirmerDepot: vi.fn(), urlLecture: vi.fn(), urlLectureDuree: vi.fn(), urlDepotDuree: vi.fn(),
  } as unknown as StockageFichiers;
  const dep2 = { ...dep, verifierEtReserver, executer: executer as never, claudeActif, stockage } as DependancesBranchementsCasConcret;
  const aucunAppel = () => {
    expect(verifierEtReserver).not.toHaveBeenCalled();
    expect(executer).not.toHaveBeenCalled();
    expect(claudeActif).not.toHaveBeenCalled();
    for (const m of [stockage.preparerDepot, stockage.confirmerDepot, stockage.urlLecture, stockage.urlLectureDuree, stockage.urlDepotDuree]) expect(m).not.toHaveBeenCalled();
  };
  return { dep2, aucunAppel };
}

async function voixClara(fournisseur: string, idExterne: string | null) {
  await depots().voix.modifier("voix-clara", { fournisseur } as never);
  const r = (await depots().ressourcesFournisseurs.lister((x) => x.entiteId === "voix-clara" && !x.remplaceeLe))[0];
  if (r) await depots().ressourcesFournisseurs.modifier(r.id, { idExterne } as never);
}

beforeEach(() => reinitialiserDepots());

describe("contrôle commun : toute voix qui n'est pas celle de HeyGen est refusée", () => {
  it("accepte HeyGen + voix maître", () => expect(() => exigerVoixMaitre("heygen", VOIX_MAITRE_HEYGEN_ID)).not.toThrow());
  it.each([["elevenlabs", VOIX_MAITRE_HEYGEN_ID], ["simulation", VOIX_MAITRE_HEYGEN_ID], ["heygen", "autre-voix"], ["heygen", "f22784b5aaaa"], ["heygen", null], ["", VOIX_MAITRE_HEYGEN_ID]])(
    "refuse %s / %s, en disant que rien n'a été dépensé",
    (fournisseur, id) => {
      let erreur: unknown;
      try { exigerVoixMaitre(fournisseur, id); } catch (e) { erreur = e; }
      expect(erreur).toBeInstanceOf(VoixNonEpingleeError);
      expect((erreur as InstanceType<typeof VoixNonEpingleeError>).messagePourWill).toMatch(/rien n'a été dépensé/);
    },
  );
});

describe("cas concret : voix épinglée avant toute dépense", () => {
  it.each([["f22784b5e0e04a2c9d3f5a6b7c8d9e0f"], ["voix-inconnue"], [null]])("voix HeyGen %s : refus, aucune lecture, aucune dépense", async (id) => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { dep2, aucunAppel } = espions();
    await voixClara("heygen", id);
    await expect(b.outilsCasConcret(commande, "tr", dep2)).rejects.toBeInstanceOf(VoixNonEpingleeError);
    expect(lire).not.toHaveBeenCalled();
    aucunAppel();
  });
  it("autre fournisseur (même avec l'identifiant maître) : refus, aucune lecture, aucune dépense", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { dep2, aucunAppel } = espions();
    await voixClara("elevenlabs", VOIX_MAITRE_HEYGEN_ID);
    await expect(b.outilsCasConcret(commande, "tr", dep2)).rejects.toBeInstanceOf(VoixNonEpingleeError);
    expect(lire).not.toHaveBeenCalled();
    aucunAppel();
  });
  it("voix « simulation » EN PRODUCTION (stockage réel factice, rendu réel) : STUDIO_NON_RELIE, aucune réservation", async () => {
    const { dep2, aucunAppel } = espions();
    await voixClara("simulation", "sim-voix-clara");
    const prod = { ...dep2, production: true, rendu: { service: creerServiceRenduSimule(() => 0), simule: false } } as DependancesBranchementsCasConcret;
    await expect(b.outilsCasConcret(commande, "tr", prod)).rejects.toThrow(b.STUDIO_NON_RELIE);
    expect(prod.verifierEtReserver).not.toHaveBeenCalled();
    expect(prod.executer).not.toHaveBeenCalled();
  });
  it("le moteur traduit le refus de voix en échec NON réessayable, sans « Vous pouvez réessayer »", async () => {
    const { dep2, aucunAppel } = espions();
    await voixClara("heygen", "voix-inconnue");
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, dep2) });
    const travail = await moteur.lancer(commande, { travailId: "tr", versionId: "ver", titre: "Essai" } as never);
    const { travail: fin } = await moteur.avancer(travail, commande);
    expect(fin.statut).toBe("echec");
    expect(fin.erreur).toMatchObject({ code: "CAS_CONCRET_NON_RELIE", reessayable: false });
    expect(fin.erreur?.messagePourWill).toMatch(/rien n'a été dépensé/);
    expect(fin.erreur?.messagePourWill).not.toContain("Vous pouvez réessayer");
    aucunAppel();
  });
  it("voix maître HeyGen : les outils se montent, avec cet identifiant", async () => {
    await voixClara("heygen", VOIX_MAITRE_HEYGEN_ID);
    const o = await b.outilsCasConcret(commande, "tr", dep);
    expect(o.voix.idVoix).toBe(VOIX_MAITRE_HEYGEN_ID);
  });
});

describe("voix de référence du format : seule la voix maître HeyGen (ou la voix d'essai) est choisie", () => {
  async function ajouterVoixHeygen(id: string, idExterne: string, creeLe: string) {
    const modele = await depots().voix.obtenir("voix-will");
    await depots().voix.enregistrer({ ...modele!, id, fournisseur: "heygen", creeLe } as never);
    await depots().ressourcesFournisseurs.enregistrer({ id: `rf-${id}`, entite: "voix", entiteId: id, fournisseur: "heygen", idExterne, statut: "pret", creeLe, modifieLe: creeLe } as never);
  }
  it("maître + doublon « Ma voix HeyGen » : c'est le maître, quel que soit l'ordre", async () => {
    await depots().voix.modifier("voix-will", { fournisseur: "elevenlabs" } as never);
    await ajouterVoixHeygen("voix-doublon", "f22784b5aaaa", "2026-01-01T00:00:00.000Z");
    await ajouterVoixHeygen("voix-maitre", VOIX_MAITRE_HEYGEN_ID, "2026-02-01T00:00:00.000Z");
    expect((await voixDeReference())?.voixId).toBe("voix-maitre");
  });
  it("seul le doublon HeyGen existe : aucune voix de référence", async () => {
    await depots().voix.modifier("voix-will", { fournisseur: "elevenlabs" } as never);
    await ajouterVoixHeygen("voix-doublon", "f22784b5aaaa", "2026-01-01T00:00:00.000Z");
    expect(await voixDeReference()).toBeNull();
  });
});
