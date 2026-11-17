/** G12-07a : ce que la version porte pour être retouchée (fonction pure, non branchée). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { CLES_PROJET_V4, projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";

const demande = { videoId: "v1", versionId: "ver1", priseCle: "prises/brute.mp4" };

function etatComplet(): EtatChaineV4 {
  return {
    ...etatInitialV4(demande),
    transcription: { mots: [{ mot: "bonjour", debut: 0, fin: 0.5 }], dureeSec: 12, largeur: 1080, hauteur: 1920 },
    cadrage: { x: 10, largeur: 540, hauteur: 960, visage: true, centreX: 0.5 },
    coupes: { gardes: [{ debutSec: 0, finSec: 10 }], dureeSec: 10, mots: [] },
    realisation: { version: "complete", essais: 1, avertissements: 0, plan: { elements: [{ id: "a" }] } },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: 10, taille: 1234, masterCle: "rendus/master.mp4" },
    videos: {
      fichiers: [{ nom: "a.mp4", cle: "broll/a.mp4" }],
      choix: [{ fichier: "a.mp4", source: "pexels", id: "1", scene: "s" }],
      retirees: [],
      manques: [],
      depenseUsd: 0.12,
      controle: { rendable: true, erreurs: [] },
    },
    planScenes: { entree: "e", plan: null, remarques: [] },
  } as unknown as EtatChaineV4;
}

describe("projetMontageV4", () => {
  it("état vide : seulement priseCle", () => {
    expect(projetMontageV4(etatInitialV4(demande))).toEqual({ priseCle: "prises/brute.mp4" });
  });

  it("état complet : toutes les clés, valeurs égales en profondeur", () => {
    const etat = etatComplet();
    const p = projetMontageV4(etat);
    expect(Object.keys(p).sort()).toEqual([...CLES_PROJET_V4].sort());
    expect(p).toEqual({
      priseCle: "prises/brute.mp4",
      renduCle: "rendus/v.mp4",
      vignetteCle: "rendus/v.jpg",
      masterCle: "rendus/master.mp4",
      plan: etat.realisation!.plan,
      gardes: etat.coupes!.gardes,
      cadrage: etat.cadrage,
      transcription: { mots: etat.transcription!.mots, dureeSec: 12 },
      videos: {
        fichiers: [{ nom: "a.mp4", cle: "broll/a.mp4" }],
        choix: [{ fichier: "a.mp4", source: "pexels", id: "1", scene: "s" }],
      },
      planScenes: { entree: "e", plan: null, remarques: [] },
    });
  });

  it("muter la sortie n'altère pas l'état", () => {
    const etat = etatComplet();
    const avant = structuredClone(etat);
    const p = projetMontageV4(etat) as { plan: { elements: unknown[] }; gardes: unknown[]; transcription: { mots: unknown[] } };
    p.plan.elements.push({ id: "z" });
    p.gardes.length = 0;
    p.transcription.mots.length = 0;
    expect(etat).toEqual(avant);
  });

  it("aucune clé commune avec celles que le moteur écrit déjà", () => {
    const deja = ["moteur", "squelette", "version", "charte", "plaquettes", "essaisClaude"];
    expect(CLES_PROJET_V4.filter((c) => deja.includes(c))).toEqual([]);
    expect(Object.keys(projetMontageV4(etatComplet())).filter((c) => deja.includes(c))).toEqual([]);
  });

  it("masterCle non chaîne : absent", () => {
    const etat = etatComplet();
    (etat.rendu as { masterCle?: unknown }).masterCle = 42;
    expect(projetMontageV4(etat)).not.toHaveProperty("masterCle");
  });

  it("videos : fichiers vides, pas de clé videos", () => {
    const etat = etatComplet();
    (etat as unknown as { videos: { fichiers: unknown[] } }).videos.fichiers = [];
    expect(projetMontageV4(etat)).not.toHaveProperty("videos");
  });

  it("videos : choix absent, videos sans choix", () => {
    const etat = etatComplet();
    delete (etat as unknown as { videos: { choix?: unknown } }).videos.choix;
    expect(projetMontageV4(etat).videos).toEqual({ fichiers: [{ nom: "a.mp4", cle: "broll/a.mp4" }] });
  });

  it("aucun montant dans le projet (depenseUsd, controle, retirees, manques)", () => {
    const json = JSON.stringify(projetMontageV4(etatComplet()));
    for (const mot of ["depenseUsd", "controle", "retirees", "manques", "0.12"]) expect(json).not.toContain(mot);
  });

  it("muter videos ou planScenes de la sortie n'altère pas l'état", () => {
    const etat = etatComplet();
    const avant = structuredClone(etat);
    const p = projetMontageV4(etat) as { videos: { fichiers: unknown[]; choix: unknown[] }; planScenes: { remarques: unknown[]; entree: string } };
    p.videos.fichiers.length = 0;
    p.videos.choix.length = 0;
    p.planScenes.remarques.push("x");
    p.planScenes.entree = "z";
    expect(etat).toEqual(avant);
  });

  it("garde statique : aucun import de @/services/", () => {
    const src = readFileSync(join(process.cwd(), "src/moteurs/montage-facecam-animee/projet-v4.ts"), "utf8");
    expect(src).not.toMatch(/@\/services\//);
  });
});
