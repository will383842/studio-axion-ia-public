/**
 * L2-07 · service d'infographie sous interrupteur : éteint → GENERATEUR_ETEINT et 0 réservation ; allumé (doubles) → un rendu par réseau ;
 * échec → crédit libéré. Rendu simulé : aucun navigateur, aucun réseau, aucun appel payant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InfographieSpec } from "@/domaine/visuels/schema-infographie";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { produireInfographie } = await import("@/visuels/services/infographies");

const spec = InfographieSpec.parse({
  version: "infographie/1",
  alt: "Exemple fictif",
  titre: "Trois chiffres à retenir",
  blocs: [
    { titre: "Premier", texte: "Un exemple fictif.", valeur: "42 %" },
    { titre: "Deuxième", texte: "Un autre exemple fictif.", valeur: "3 sur 4" },
  ],
});

function simule(echec = false) {
  const soumises: DemandeRendu[] = [];
  const service: ServiceRendu = {
    async soumettre(d) {
      soumises.push(d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      if (echec) return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "refusé" } };
      return { statut: "termine", sortieCle: `cle/${id}`, mesures: {} };
    },
  };
  return { service, soumises };
}

function dependances(service: ServiceRendu) {
  const reserver = vi.fn(async () => {});
  const liberer = vi.fn(async () => {});
  return {
    reserver,
    liberer,
    deps: {
      rendu: () => service,
      stockage: { urlDepot: async (c: string) => `https://r2.exemple/depot/${c}`, urlLecture: async (c: string) => `https://r2.exemple/lecture/${c}` },
      reserver,
      liberer,
      attendre: async () => {},
    },
  };
}

beforeEach(() => reinitialiserDepots());

describe("L2-07 · service d'infographie", () => {
  it("éteint par défaut : GENERATEUR_ETEINT, 0 réservation, 0 soumission", async () => {
    const { service, soumises } = simule();
    const { deps, reserver } = dependances(service);
    await expect(produireInfographie({ travailId: "t1", spec, gabarit: "chiffres-cles", reseaux: ["linkedin"] }, deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    expect(reserver).toHaveBeenCalledTimes(0);
    expect(soumises).toHaveLength(0);
  });

  it("valeur autre que le booléen true : toujours éteint", async () => {
    await ecrireParametre("infographies.actif", "true");
    const { service } = simule();
    const { deps, reserver } = dependances(service);
    await expect(produireInfographie({ travailId: "t1", spec, gabarit: "etapes", reseaux: ["linkedin"] }, deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    expect(reserver).toHaveBeenCalledTimes(0);
  });

  it("allumé : un rendu par réseau, composition « Infographie » via image-fixe, une réservation", async () => {
    await ecrireParametre("infographies.actif", true);
    const { service, soumises } = simule();
    const { deps, reserver, liberer } = dependances(service);
    const r = await produireInfographie({ travailId: "t2", spec, gabarit: "chiffres-cles", reseaux: ["linkedin", "instagram", "facebook"] }, deps);
    expect(r.map((v) => v.reseau)).toEqual(["linkedin", "instagram", "facebook"]);
    expect(soumises).toHaveLength(3);
    for (const d of soumises) {
      expect(d.operation).toBe("image-fixe");
      expect(d.parametres.composition).toBe("Infographie");
    }
    expect(new Set(soumises.map((d) => d.idRendu)).size).toBe(3);
    expect(r.every((v) => v.cle.length > 0)).toBe(true);
    expect(reserver).toHaveBeenCalledTimes(1);
    expect(liberer).not.toHaveBeenCalledWith("t2", "liberee");
    expect(liberer).toHaveBeenCalledWith("t2", "consommee");
  });

  it("réseau en double ou inconnu : refusé avant toute réservation", async () => {
    await ecrireParametre("infographies.actif", true);
    const { service, soumises } = simule();
    const { deps, reserver } = dependances(service);
    await expect(produireInfographie({ travailId: "t3", spec, gabarit: "etapes", reseaux: [] }, deps)).rejects.toThrow();
    await expect(produireInfographie({ travailId: "t3", spec, gabarit: "etapes", reseaux: ["tiktok" as never] }, deps)).rejects.toThrow();
    expect(reserver).toHaveBeenCalledTimes(0);
    expect(soumises).toHaveLength(0);
  });

  it("échec du rendu : le crédit réservé est libéré, l'erreur remonte", async () => {
    await ecrireParametre("infographies.actif", true);
    const { service } = simule(true);
    const { deps, reserver, liberer } = dependances(service);
    await expect(produireInfographie({ travailId: "t4", spec, gabarit: "comparaison", reseaux: ["linkedin"] }, deps)).rejects.toThrow();
    expect(reserver).toHaveBeenCalledTimes(1);
    expect(liberer).toHaveBeenCalledWith("t4", "liberee");
  });

  it("une infographie qui déborde est refusée avant toute réservation", async () => {
    await ecrireParametre("infographies.actif", true);
    const trop = InfographieSpec.parse({ ...spec, blocs: Array.from({ length: 8 }, (_, i) => ({ titre: `Point ${i + 1}`, texte: `Une phrase courte pour le point ${i + 1}.` })) });
    const { service, soumises } = simule();
    const { deps, reserver } = dependances(service);
    await expect(produireInfographie({ travailId: "t5", spec: trop, gabarit: "etapes", reseaux: ["linkedin"], ratio: "1:1" }, deps)).rejects.toThrow();
    expect(reserver).toHaveBeenCalledTimes(0);
    expect(soumises).toHaveLength(0);
  });
});
