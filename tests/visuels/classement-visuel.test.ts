/**
 * L1-02 · classement du visuel : réseaux, sous-type, famille « infographie », versions par réseau persistées.
 * Tout est simulé : aucun réseau, aucun rendu réel.
 */
import { describe, expect, it } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { lireVisuelStocke } from "@/domaine/visuels/depot";
import { InfographieSpec } from "@/domaine/visuels/schema-infographie";
import { VersionsStockees } from "@/domaine/visuels/schema";
import type { Visuel } from "@/domaine/visuels/visuel";
import { REGISTRE_VISUELS } from "@/visuels/registre";
import { creerRegistreVersionsDepuis, rendreVersionsReseaux, versionsPourStockage, type DependancesRenduReseaux } from "@/visuels/services/rendu-reseaux";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

const ancien = {
  id: "vis_ancien",
  famille: "carrousel",
  titre: "Ancien visuel",
  entree: { type: "sujet", sujet: "Un sujet" },
  statut: "brouillon",
  modeTexte: "simulation",
  versionSpec: 1,
  coutCentimes: 0,
  creeLe: "2026-01-01T00:00:00.000Z",
  modifieLe: "2026-01-01T00:00:00.000Z",
};

function simule() {
  const soumises: DemandeRendu[] = [];
  const service: ServiceRendu = {
    async soumettre(d) {
      soumises.push(d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const base = { debordements: 0, textesEnZone: 0, chevauchements: 0, taillePoliceMin: 26, intrusions: 0 };
      return { statut: "termine", sortieCle: `cle/${id}`, mesures: id.endsWith("-pdf") ? { pages: 2, octets: 1000 } : base };
    },
  };
  return { service, soumises };
}

const deps = (service: ServiceRendu, registre: DependancesRenduReseaux["registre"]): DependancesRenduReseaux => ({
  rendu: () => service,
  stockage: { urlDepot: async (cle) => `https://r2.exemple/depot/${cle}`, urlLecture: async (cle) => `https://r2.exemple/lecture/${cle}` },
  registre,
  attendre: async () => {},
  allume: async () => true,
});

describe("L1-02 · lecture d'un visuel", () => {
  it("lit un ancien visuel (sans réseaux, sous-type ni versions) sans erreur", () => {
    const v = lireVisuelStocke(ancien);
    expect(v.id).toBe("vis_ancien");
    expect(v.reseaux).toBeUndefined();
    expect(v.versions).toBeUndefined();
  });

  it("relit à l'identique un visuel LinkedIn + Instagram avec ses versions", async () => {
    const { service } = simule();
    const memoire = new Map();
    const registre = creerRegistreVersionsDepuis([], (v) => void memoire.set(v.empreinte, v));
    const versions = await rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin", "instagram"], deps(service, registre));
    const visuel: Visuel = { ...(ancien as unknown as Visuel), reseaux: ["linkedin", "instagram"], sousType: "pedagogique", versions: versionsPourStockage(versions) };
    const relu = lireVisuelStocke(JSON.parse(JSON.stringify(visuel)));
    expect(relu).toEqual(visuel);
    expect(relu.versions).toHaveLength(2);
  });

  it("refuse une famille inconnue, un réseau inconnu et une version mal formée", () => {
    expect(() => lireVisuelStocke({ ...ancien, famille: "autre" })).toThrow();
    expect(() => lireVisuelStocke({ ...ancien, reseaux: ["myspace"] })).toThrow();
    expect(() => lireVisuelStocke({ ...ancien, versions: [{ cadre: "meta" }] })).toThrow();
    expect(VersionsStockees.safeParse([{ cadre: "meta" }]).success).toBe(false);
  });

  it("n'ajoute aucun champ de prix : coutCentimes reste 0", () => {
    expect(lireVisuelStocke(ancien).coutCentimes).toBe(0);
  });
});

describe("L1-02 · infographie/1", () => {
  const valide = { version: "infographie/1", alt: "Trois étapes", titre: "Le parcours", blocs: [{ titre: "Un", texte: "Premier" }, { titre: "Deux", texte: "Second", valeur: "42 %" }] };

  it("figure dans REGISTRE_VISUELS et son schéma accepte un spec valide", () => {
    const def = REGISTRE_VISUELS.find((d) => d.id === "infographie/1");
    expect(def).toBeDefined();
    expect(def!.schema.safeParse(valide).success).toBe(true);
    expect(REGISTRE_VISUELS.some((d) => d.id === "carrousel/1")).toBe(true);
  });

  it("refuse un lien, une clé inconnue et un seul bloc", () => {
    expect(InfographieSpec.safeParse({ ...valide, blocs: [{ titre: "A", texte: "voir https://x.exemple" }, valide.blocs[1]] }).success).toBe(false);
    expect(InfographieSpec.safeParse({ ...valide, extra: 1 }).success).toBe(false);
    expect(InfographieSpec.safeParse({ ...valide, blocs: [valide.blocs[0]] }).success).toBe(false);
  });
});

describe("L1-02 · après redémarrage, rien n'est refacturé", () => {
  it("un registre reconstruit depuis les versions stockées ne soumet aucun rendu", async () => {
    const premier = simule();
    const stock: ReturnType<typeof versionsPourStockage> = [];
    const reg1 = creerRegistreVersionsDepuis([], (v) => void stock.push(v as (typeof stock)[number]));
    await rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin", "instagram", "facebook"], deps(premier.service, reg1));
    expect(premier.soumises.length).toBeGreaterThan(0);
    expect(stock).toHaveLength(2);

    const second = simule();
    const reg2 = creerRegistreVersionsDepuis(JSON.parse(JSON.stringify(stock)));
    const versions = await rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin", "instagram"], deps(second.service, reg2));
    expect(second.soumises).toHaveLength(0);
    expect(versions).toHaveLength(2);
  });
});
