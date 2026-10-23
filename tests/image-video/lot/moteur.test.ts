/**
 * LOT D'IMAGES · L4 — le moteur lit `lot` dans les entrées de la commande ; le travail arrêté à une porte en lot dit
 * « Mise de côté : motif » ; les codes d'erreur ne changent pas. Outils simulés, aucun réseau.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { avancerJusquAArretIV, etatInitialIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { CODE_CARTE_A_VALIDER, CODE_SCRIPT_A_VALIDER, creerMoteurMontageImageVideo, demandeDeLaCommande, lireEntreesImageVideo } from "@/moteurs/montage-image-video";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { carteFixe, monde, outilsSimules } from "../doubles-fabrication";
import type { CarteImage } from "@/domaine/image-video/carte";

vi.setConfig({ testTimeout: 120_000 });

const LOT = { id: "lot-iv-0123456789ab", rang: 2, accordParVideoCentimes: 220 };

function commande(carte: CarteImage, lot: unknown = LOT): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-image-video",
    videoId: `v-${carte.image.empreinte}`,
    formatId: "image-video",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [],
    styles: {},
    briques: {},
    entrees: { imageVideo: { imageCle: carte.image.cle, empreinte: carte.image.empreinte, plafondCentimes: 1500, codeSuivi: "essai", accordEssaiReel: true, ...(lot === null ? {} : { lot }) } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 1500, devise: "EUR" },
    tauxUsdEur: 0.9,
    construiteLe: "2026-10-15T08:00:00.000Z",
  } as unknown as CommandeFabrication;
}

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);
const CONTEXTE = { travailId: "t-iv", versionId: "ver-1", titre: "Essai", maintenant: T0 };

describe("entrées du lot", () => {
  it("lireEntreesImageVideo lit le lot ; absent ou mal formé : rien", () => {
    const carte = carteFixe("E");
    expect(lireEntreesImageVideo(commande(carte).entrees).lot).toEqual(LOT);
    expect(lireEntreesImageVideo(commande(carte, null).entrees).lot).toBeUndefined();
    expect(lireEntreesImageVideo(commande(carte, { id: 3, rang: "x" }).entrees).lot).toBeUndefined();
    expect(lireEntreesImageVideo(commande(carte, { id: "", rang: 1, accordParVideoCentimes: 220 }).entrees).lot).toBeUndefined();
  });
  it("la demande de la machine porte lot {id, rang} seulement quand la commande en porte un", () => {
    const carte = carteFixe("E");
    expect(demandeDeLaCommande(commande(carte), "ver-1").lot).toEqual({ id: LOT.id, rang: 2 });
    expect(demandeDeLaCommande(commande(carte, null), "ver-1").lot).toBeUndefined();
  });
});

describe("travail arrêté à une porte en lot", () => {
  async function jusquALArret(carte: CarteImage, lectureB?: ReturnType<typeof lectureDeCarte>, lot: unknown = LOT) {
    const moteur = creerMoteurMontageImageVideo({ outils: async () => outilsSimules(carte, monde(), { cartesValidees: 0, ...(lectureB ? { lectures: { b: lectureB } } : {}) }), numeroVersion: async () => 42 });
    const c = commande(carte, lot);
    let t: Travail = await moteur.lancer(c, CONTEXTE);
    for (let i = 0; i < 40 && t.statut !== "echec" && t.statut !== "termine"; i++) {
      const r = await moteur.avancer(t, c, T0 + i * 1000);
      t = JSON.parse(JSON.stringify(r.travail));
    }
    return t;
  }

  it("la carte mise de côté : code inchangé, message « Mise de côté : motif »", async () => {
    const carte = carteFixe("E");
    const b = lectureDeCarte(carte);
    b.titre = `${b.titre} (autre)`;
    const t = await jusquALArret(carte, b);
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: CODE_CARTE_A_VALIDER, reessayable: true });
    expect(t.erreur?.messagePourWill).toBe("Mise de côté : Les deux lectures de l'image ne disent pas la même chose.");
    expect((t.parametres!.imageVideo as EtatFabricationIV).miseDeCote?.porte).toBe("carte");
  });

  it("le script mis de côté : code inchangé, message « Mise de côté : motif »", async () => {
    // Plafond de la vidéo trop bas pour la suite : la voix dépasserait le prix accordé.
    const carte = carteFixe("E");
    const moteur = creerMoteurMontageImageVideo({ outils: async () => outilsSimules(carte, monde(), { cartesValidees: 0 }), numeroVersion: async () => 42 });
    const c = commande(carte);
    (c.entrees as { imageVideo: { plafondCentimes: number } }).imageVideo.plafondCentimes = 100;
    let t: Travail = await moteur.lancer(c, CONTEXTE);
    for (let i = 0; i < 40 && t.statut !== "echec" && t.statut !== "termine"; i++) {
      const r = await moteur.avancer(t, c, T0 + i * 1000);
      t = JSON.parse(JSON.stringify(r.travail));
    }
    expect(t.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER, reessayable: true });
    expect(t.erreur?.messagePourWill).toMatch(/^Mise de côté : La voix dépasserait le prix accordé/);
  });

  it("sans lot, la porte garde sa phrase d'avant", async () => {
    const t = await jusquALArret(carteFixe("E"), undefined, null);
    expect(t.erreur).toMatchObject({ code: CODE_CARTE_A_VALIDER });
    expect(t.erreur?.messagePourWill).toMatch(/^Vérifiez ce que j'ai compris/);
  });

  it("un état de la machine d'avant (sans lot) se lit tel quel", async () => {
    const carte = carteFixe("E");
    const e = await avancerJusquAArretIV(etatInitialIV({ videoId: "v", versionId: "x", image: { cle: carte.image.cle }, reseaux: ["linkedin"], validationCarte: "si-doute", appelCommentaire: "question-puis-fin", plafondCentimes: 500, tauxUsdEur: 0.9, codeSuivi: "c" }), outilsSimules(carte, monde(), { cartesValidees: 0 }));
    expect(e.miseDeCote).toBeUndefined();
  });
});
