/**
 * Vitrine d'une fabrication menée par le lanceur : le travail montré dans le studio porte l'état (l'écran y lit la carte
 * et le script à valider), et la boucle de fond ne le fait JAMAIS avancer (jamais deux exécutions, jamais deux
 * paiements). Aucun appel payant : les outils sont des doubles qui comptent leurs appels.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { avancerJusquAArretIV, etatInitialIV } from "@/moteurs/montage-image-video/fabrication";
import { CLE_LANCEUR_IV, CODE_CARTE_A_VALIDER, creerMoteurMontageImageVideo, travailVitrineIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const commande = { moteurId: "montage-image-video", formatId: "image-video", videoId: "v-essai", entrees: {} } as unknown as CommandeFabrication;

describe("vitrine du lanceur", () => {
  it("à la porte de la carte : travail en arrêt « carte à valider », état lisible, marque du lanceur", async () => {
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carteFixe("C"))), outilsSimules(carteFixe("C"), m));
    const t = travailVitrineIV({ travailId: "iv-lanceur-v-essai", versionId: "ver-v-essai-lanceur", titre: "Essai", maintenant: Date.UTC(2026, 9, 15) }, commande, e);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe(CODE_CARTE_A_VALIDER);
    expect(t.parametres?.[CLE_LANCEUR_IV]).toBe(true);
    expect((t.parametres?.imageVideo as { etape: string }).etape).toBe("carte-a-valider");
  });

  it("relancée par « Valider » (en cours), la boucle de fond ne l'avance pas : aucun outil n'est même construit", async () => {
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carteFixe("C"))), outilsSimules(carteFixe("C"), m));
    const vitrine = travailVitrineIV({ travailId: "t", versionId: "v", titre: "Essai" }, commande, e);
    let construits = 0;
    const moteur = creerMoteurMontageImageVideo({ outils: async () => (construits++, outilsSimules(carteFixe("C"), m)) });
    const relancee = await moteur.reessayer(vitrine);
    expect(relancee.statut).toBe("en_cours");
    const appels = m.appelsClaude.length;
    const { travail } = await moteur.avancer(relancee, commande);
    expect(travail).toBe(relancee);
    expect(construits).toBe(0);
    expect(m.appelsClaude.length).toBe(appels);
  });
});
