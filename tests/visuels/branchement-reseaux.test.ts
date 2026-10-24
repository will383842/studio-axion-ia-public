/** Branchement du rendu par réseau dans le service réel : `dependancesCarrousels()` expose `rendreReseaux`, relié au rendu, au stockage et au registre. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const demandes: DemandeRendu[] = [];
const fauxRendu: ServiceRendu = {
  async soumettre(d) {
    demandes.push(d);
    return { idRendu: d.idRendu };
  },
  async etat(id): Promise<EtatRendu> {
    const d = demandes.find((x) => x.idRendu === id);
    const mesures = d?.operation === "assemblage-pdf" ? { pages: 2, octets: 1000 } : { debordements: 0, textesEnZone: 0, chevauchements: 0, taillePoliceMin: 28, intrusions: 0 };
    return { statut: "termine", sortieCle: d?.sortie.cle ?? "", mesures };
  },
};
vi.mock("@/fournisseurs/rendu/client", async (original) => ({ ...(await original<typeof import("@/fournisseurs/rendu/client")>()), obtenirServiceRendu: () => fauxRendu }));
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<typeof import("@/services/_commun")>()),
  fournisseur: async () => ({
    urlDepotDuree: async (cle: string) => `https://r2.exemple/depot/${cle}?sig=secret`,
    urlLectureDuree: async (cle: string) => `https://r2.exemple/lecture/${cle}?sig=secret`,
    urlLecture: async (cle: string) => `/lecture/${cle}`,
  }),
}));

import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { dependancesCarrousels } from "@/visuels/services/production";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

const pagesDe = (s: DemandeRendu[]) => s.filter((d) => d.operation === "visuel-page");
const pdfsDe = (s: DemandeRendu[]) => s.filter((d) => d.operation === "assemblage-pdf");

describe("dependancesCarrousels · rendreReseaux", () => {
  beforeEach(() => {
    reinitialiserDepots();
    demandes.length = 0;
  });

  it("est exposé à côté de `rendre`", () => {
    const deps = dependancesCarrousels();
    expect(typeof deps.rendre).toBe("function");
    expect(typeof deps.rendreReseaux).toBe("function");
  });

  it("générateur éteint : refus, aucune demande de rendu", async () => {
    await ecrireParametre("carrousels.actif", false);
    await expect(dependancesCarrousels().rendreReseaux(CONTENU_ESSAI, ["instagram", "facebook", "linkedin"])).rejects.toThrow("éteint");
    expect(demandes).toHaveLength(0);
  });

  it("Instagram + Facebook : UNE série de JPEG, sans PDF", async () => {
    await ecrireParametre("carrousels.actif", true);
    const versions = await dependancesCarrousels().rendreReseaux(CONTENU_ESSAI, ["instagram", "facebook"]);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ cadre: "meta", reseaux: ["instagram", "facebook"], pdfCle: null });
    expect(pagesDe(demandes)).toHaveLength(CONTENU_ESSAI.pages.length);
    expect(pdfsDe(demandes)).toHaveLength(0);
  });

  it("LinkedIn : les pages (×1 et ×2) et UN PDF ; la version est gardée au registre", async () => {
    await ecrireParametre("carrousels.actif", true);
    const [v] = await dependancesCarrousels().rendreReseaux(CONTENU_ESSAI, ["linkedin"]);
    expect(v.cadre).toBe("linkedin");
    expect(v.pages).toHaveLength(CONTENU_ESSAI.pages.length);
    expect(v.pdfCle).toMatch(/\.pdf$/);
    expect(pagesDe(demandes)).toHaveLength(2 * CONTENU_ESSAI.pages.length);
    expect(pdfsDe(demandes)).toHaveLength(1);

    demandes.length = 0;
    const [encore] = await dependancesCarrousels().rendreReseaux(CONTENU_ESSAI, ["linkedin"]);
    expect(encore.empreinte).toBe(v.empreinte);
    expect(demandes).toHaveLength(0);
  });
});
