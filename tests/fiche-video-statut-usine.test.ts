import { describe, expect, it } from "vitest";
import { STATUTS_USINE } from "@/components/ui/statuts-usine";
import { statutUsineDeEtape, statutUsineDeVideo } from "@/components/videos/statut-usine-video";

// Refonte RA2 (maquette M2, fiche d'une vidéo) : la fiche parle avec les 9 statuts de l'usine.
describe("statuts de la fiche d'une vidéo", () => {
  it("chaque étape éditoriale devient l'un des 9 statuts", () => {
    for (const e of ["a_relire", "validee", "programmee", "publiee"] as const) expect(STATUTS_USINE[statutUsineDeEtape(e)]).toBeDefined();
    expect(statutUsineDeEtape("a_relire")).toBe("valider");
  });
  it("chaque statut technique devient un statut de l'usine, sauf « archivée »", () => {
    expect(statutUsineDeVideo("en_fabrication")).toBe("fabrication");
    expect(statutUsineDeVideo("echec")).toBe("corriger");
    expect(statutUsineDeVideo("archivee")).toBeNull();
  });
});
