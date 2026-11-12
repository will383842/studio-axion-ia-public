/** GV-VG-04c · le fournisseur n'écrit `titreCentre` dans les paramètres que s'il vaut `true`. */
import { describe, expect, it } from "vitest";
import { creerFournisseurMiniatureStudioRendu } from "@/fournisseurs/rendu/miniature";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { CouvertureMiniature, ServiceRendu, SourceMiniature } from "@/fournisseurs/types";
import type { DemandeRendu } from "../../studio-rendu/src/contrat";

const source: SourceMiniature = {
  url: "https://exemple/v.mp4", dureeSec: 40, ratio: "9:16", instantsSec: [12], gabarit: "image-video-v3",
  depots: [{ cle: "studio/dev/videos/v-1/miniatures/m-0.jpg", urlDepot: "https://exemple/depot/0" }],
};

async function demandes(couverture: CouvertureMiniature): Promise<DemandeRendu[]> {
  let t = 0;
  const service = creerServiceRenduSimule(() => t);
  const vus: DemandeRendu[] = [];
  const rendu: ServiceRendu = { soumettre: (d) => (vus.push(d), service.soumettre(d)), etat: service.etat };
  const f = creerFournisseurMiniatureStudioRendu({ rendu: () => rendu, attendre: async () => void (t += 1_000), maintenant: () => t });
  await f.proposer({ videoId: "v-1", titre: "T", nombre: 1, source, couverture });
  return vus;
}

describe("miniature · titreCentre", () => {
  it("vrai : transmis dans les paramètres", async () => {
    const [d] = await demandes({ texte: "Votre amende vite", motCle: "amende", titreCentre: true });
    expect(d.parametres.titreCentre).toBe(true);
  });
  it("absent ou faux : aucune clé en plus", async () => {
    for (const c of [{ texte: "Votre amende vite", motCle: "amende" }, { texte: "Votre amende vite", motCle: "amende", titreCentre: false }]) {
      const [d] = await demandes(c);
      expect(d.parametres).not.toHaveProperty("titreCentre");
    }
  });
});
