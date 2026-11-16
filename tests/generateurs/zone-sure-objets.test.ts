/**
 * N-07 : tout objet visible neuf est essayé dans les 4 formats et reste dans la zone sûre du réseau visé.
 * Chaque fiche d'objet neuf (C9-*, C6-*, G2-*) ajoute sa ligne à OBJETS_NEUFS (règle 7 du plan). Vide aujourd'hui.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { ZONES } from "@/briques/plan-scenes/zones";
import { RATIOS_ESSAI, boiteDansZoneSure, controleZoneSurePourGenerateur, type ObjetEssai } from "@/moteurs/conformite-zone-sure";
import { defautsDeSortie, testerGenerateur, type ExceptionConformite } from "@/moteurs/conformite";
import { listerMoteurs } from "@/moteurs";
import { construireCommande } from "@/services/fabrication";
import { reinitialiserDepots } from "@/donnees/memoire";
import * as auth from "@/services/auth";
import { listerReseaux } from "@/reseaux";
import type { Ratio } from "@/domaine/types";
import type { SortieProduite } from "@/moteurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 120_000 });

const MDP = "essai-n-07-zone-sure";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Registre des objets neufs : { id, boite(ratio) } en % de l'image. */
const OBJETS_NEUFS: ObjetEssai[] = [];

describe("N-07 : objets neufs dans la zone sûre, 4 formats", () => {
  it("les 4 formats d'essai", () => {
    expect([...RATIOS_ESSAI]).toEqual(["9:16", "4:5", "1:1", "16:9"]);
  });

  for (const objet of OBJETS_NEUFS) {
    for (const ratio of RATIOS_ESSAI) {
      for (const reseau of listerReseaux().filter((r) => r.zonesProtegees[ratio])) {
        it(`${objet.id} · ${ratio} · ${reseau.id}`, () => {
          const r = boiteDansZoneSure(objet.boite(ratio), ratio, [reseau.id]);
          expect(r.ok, r.raison).toBe(true);
        });
      }
    }
  }

  describe("cas témoins", () => {
    it("ZONES.plein est hors zone pour Instagram 9:16", () => {
      const r = boiteDansZoneSure(ZONES.plein, "9:16", ["instagram"]);
      expect(r.ok).toBe(false);
      expect(r.raison).toMatch(/Hors zone sûre/);
    });
    it("ZONES.centre est dans la zone pour LinkedIn 1:1", () => {
      const r = boiteDansZoneSure(ZONES.centre, "1:1", ["linkedin"]);
      expect(r.ok, r.raison).toBe(true);
    });
    it("ratio sans zone connue : non-fait, jamais réussi", () => {
      const r = boiteDansZoneSure(ZONES.centre, "16:9", ["instagram"]);
      expect(r.ok).toBe(false);
      expect(r.raison).toMatch(/Aucune zone sûre/);
    });
  });

  describe("branchement sur controlesEnPlus (G1-02)", () => {
    const sortie = (ratio: Ratio, reseaux: SortieProduite["reseaux"]): SortieProduite => ({
      ratio,
      fichierCle: "f.mp4",
      vignetteCle: "v.jpg",
      resolution: ratio === "9:16" ? "1080x1920" : "1080x1080",
      dureeSec: 10,
      taille: 1,
      rapportQualite: {} as SortieProduite["rapportQualite"],
      reseaux,
    });
    const horsZone: ObjetEssai = { id: "objet-factice-hors", boite: () => ZONES.plein };
    const dansZone: ObjetEssai = { id: "objet-factice-dans", boite: () => ({ x: 10, y: 20, largeur: 60, hauteur: 40 }) };

    it("un objet qui déborde en 9:16 Reels est refusé", () => {
      const defauts = defautsDeSortie(sortie("9:16", ["instagram"]), { simulation: true, controlesEnPlus: [controleZoneSurePourGenerateur([horsZone])] });
      expect(defauts.join(" ")).toMatch(/objet-factice-hors/);
    });
    it("un objet dans la zone est accepté", () => {
      const defauts = defautsDeSortie(sortie("9:16", ["instagram"]), { simulation: true, controlesEnPlus: [controleZoneSurePourGenerateur([dansZone])] });
      expect(defauts).toEqual([]);
    });
    it("sans objet : aucun défaut (éteint = identique)", () => {
      expect(controleZoneSurePourGenerateur([])(sortie("9:16", ["instagram"]))).toEqual([]);
    });
  });
  describe("branchement réel par testerGenerateur (G1-02)", () => {
    const horsZone: ObjetEssai = { id: "objet-factice-hors", boite: () => ZONES.plein };
    const dansZone: ObjetEssai = { id: "objet-factice-dans", boite: () => ({ x: 10, y: 20, largeur: 60, hauteur: 40 }) };
    const recues: SortieProduite[] = [];
    const espion = (sortie: SortieProduite): string[] => {
      recues.push(sortie);
      return [];
    };
    const moteurFactice = listerMoteurs().find((m) => m.id === "simulation")!;
    // Même exception datée que conformite-tous-moteurs.test.ts : la simulation n'a aucun état « sans fournisseur ».
    const exceptions: ExceptionConformite[] = [
      { moteur: "simulation", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "structurel : le moteur de simulation n'appelle aucun fournisseur" },
    ];

    // Le moteur de simulation (double, aucun coût) passe par testerGenerateur avec l'espion en `controlesEnPlus`.
    testerGenerateur(moteurFactice, async () => construireCommande("v-03"), { exceptions, controlesEnPlus: [espion] });

    // Enregistrés après testerGenerateur : ils s'exécutent après ses contrôles, donc après le passage de l'espion.
    it("testerGenerateur transmet controlesEnPlus : l'espion reçoit les sorties du moteur", () => {
      expect(recues.length, "controlesEnPlus n'a jamais été appelé par testerGenerateur").toBeGreaterThan(0);
    });
    it("appliqué aux sorties reçues : objet hors zone refusé, objet dans la zone accepté", () => {
      expect(recues.length).toBeGreaterThan(0);
      // Ratio et réseaux fixés ici : une sortie sans `reseaux` donne « Aucune zone sûre » (non-fait, tout objet refusé).
      const vues = recues.map((s) => ({ ...s, ratio: "9:16" as Ratio, reseaux: ["instagram"] as SortieProduite["reseaux"] }));
      for (const s of vues) {
        expect(controleZoneSurePourGenerateur([horsZone])(s).join(" ")).toMatch(/objet-factice-hors/);
        expect(controleZoneSurePourGenerateur([dansZone])(s)).toEqual([]);
      }
    });
  });
});
