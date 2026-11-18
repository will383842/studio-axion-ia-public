/**
 * G12-07c · la version finie de la face caméra animée v4 GARDE son projet (prise, rendu, plan, coupes, cadrage, transcription,
 * vidéos choisies, plan de scènes). Preuve par le chemin réel : le VRAI moteur `creerMoteurMontageFacecamAnimee`, outils doubles
 * (aucun réseau, aucun Claude réel), de « lancer » jusqu'à « terminé ». Aucun réglage : ce sont des données de la version.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import { CHARTE_FACECAM_ANIMEE, creerMoteurMontageFacecamAnimee, ID_MOTEUR_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import type { OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { lireProjetGardeV4, manquesRetoucheGratuiteV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import type { ResultatFabrication } from "@/moteurs/types";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;

const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
const REPONSE = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_VALIDE.elementsV4!.map(({ medias: _m, ...e }) => e), motsForts };

const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: ID_MOTEUR_FACECAM_ANIMEE, ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle: "studio/dev/entree/facecam-animee/f-1.mov", fichierId: "f-1", texteValide: SCRIPT, accordEssaiReel: true } } } as unknown as CommandeFabrication;

function outilsDoubles(): OutilsChaineV4 {
  return {
    transcrire: vi.fn(async () => ({ mots: BRUT.mots, dureeSec: DUREE_PRISE })),
    plafondClaudeAtteint: async () => false,
    appelerRealisateur: vi.fn(async () => ({ ok: true as const, donnees: REPONSE })),
    // Étape « vidéos » : un fichier préparé pour chaque vidéo `broll/` que le plan réclame (comme le fait le service réel).
    videos: vi.fn(async (d: { plan: PlanFacecamAnimee }) => {
      const els = (d.plan.elementsV4 ?? []).map((e, i) => (PLAN_VALIDE.elementsV4![i].medias ? { ...e, medias: PLAN_VALIDE.elementsV4![i].medias } : e));
      const noms = [...new Set(els.flatMap((e) => e.medias ?? []))].filter((m) => m.startsWith("broll/")).map((m) => m.slice("broll/".length));
      return { plan: { ...d.plan, elementsV4: els }, fichiers: noms.map((nom) => ({ nom, cle: `studio/dev/facecam-animee/v-1/broll/${nom}` })), manques: [] };
    }),
    rendre: vi.fn(async (d) => ({ cle: "studio/dev/facecam-animee/v-1/fa4.mp4", vignetteCle: "studio/dev/facecam-animee/v-1/fa4.jpg", dureeSec: d.plan.duree, taille: 34_000_000 })),
  } as unknown as OutilsChaineV4;
}

async function jusquaPrete(): Promise<ResultatFabrication> {
  const m = creerMoteurMontageFacecamAnimee({ outils: async () => outilsDoubles(), statutFormat: "masque" });
  let t: Travail = await m.lancer(COMMANDE, { travailId: "trav-1", versionId: "ver-1", titre: "Essai" });
  let resultat: ResultatFabrication | undefined;
  for (let k = 0; k < 12 && t.statut !== "termine"; k++) {
    const r = await m.avancer(t, COMMANDE);
    t = r.travail;
    resultat = r.resultat;
    expect(t.statut).not.toBe("echec");
  }
  expect(t.statut).toBe("termine");
  return resultat!;
}

/** Sorties, note et lignes telles que les écrit master (3149073 et suivants), recopiées avant le changement ; les sous-titres : empreinte. */
const MASTER = {
  "sorties": [
    {
      "ratio": "9:16",
      "fichierCle": "studio/dev/facecam-animee/v-1/fa4.mp4",
      "vignetteCle": "studio/dev/facecam-animee/v-1/fa4.jpg",
      "resolution": "1080x1920",
      "dureeSec": 82.667,
      "taille": 34000000,
      "rapportQualite": {
        "note": 90,
        "verifie": {
          "image": true,
          "son": true,
          "sousTitres": true,
          "mentionIA": false,
          "droits": false
        },
        "alertes": [
          {
            "code": "synchronisation",
            "gravite": "attention",
            "message": "1 mot(s) dit(s) non affiché(s) (liste des mots interdits à l'écran)."
          }
        ],
        "niveauSonoreLufs": -14
      }
    }
  ],
  "noteQualite": {
    "globale": 90,
    "alertes": [
      {
        "code": "synchronisation",
        "gravite": "attention",
        "message": "1 mot(s) dit(s) non affiché(s) (liste des mots interdits à l'écran)."
      }
    ]
  },
  "lignesReelles": [
    {
      "etape": "Montage face caméra animée",
      "fournisseur": "studio",
      "unite": "forfait",
      "quantite": 1,
      "prixUnitaire": {
        "centimes": 0,
        "devise": "EUR"
      },
      "total": {
        "centimes": 0,
        "devise": "EUR"
      },
      "nature": "reel"
    }
  ]
};

const SIX = ["moteur", "squelette", "version", "charte", "plaquettes", "essaisClaude"];

describe("G12-07c · le moteur réel écrit le projet gardé", () => {
  it("a) projetMontage porte prise, rendu, plan, gardes, transcription ET les 6 clés du moteur avec les mêmes valeurs", async () => {
    const p = (await jusquaPrete()).projetMontage as Record<string, unknown>;
    for (const cle of ["priseCle", "renduCle", "plan", "gardes", "transcription"]) expect(p[cle], cle).toBeDefined();
    expect(p.priseCle).toBe("studio/dev/entree/facecam-animee/f-1.mov");
    expect(p.renduCle).toBe("studio/dev/facecam-animee/v-1/fa4.mp4");
    expect(p).toMatchObject({ moteur: ID_MOTEUR_FACECAM_ANIMEE, squelette: false, version: "complete", charte: CHARTE_FACECAM_ANIMEE, plaquettes: PLAN_VALIDE.elementsV4!.length, essaisClaude: 2 });
    for (const cle of SIX) expect(p, cle).toHaveProperty(cle);
  });

  it("b) sorties, note, lignes réelles, sous-titres inchangés ; aucun montant dans le projet", async () => {
    const r = await jusquaPrete();
    const { projetMontage, ...reste } = r;
    expect(projetMontage).toBeDefined();
    expect(Object.keys(reste).sort()).toEqual(["lignesReelles", "noteQualite", "sorties", "sousTitres"]);
    expect({ sorties: reste.sorties, noteQualite: reste.noteQualite, lignesReelles: reste.lignesReelles }).toEqual(MASTER);
    expect(reste.sousTitres).toHaveLength(187);
    expect(createHash("sha256").update(JSON.stringify(reste.sousTitres)).digest("hex")).toBe("c84d71bda136fd1dff58f5d83450799eaa9551205297ecbac43cf741897a31e4");
    const dump = JSON.stringify(projetMontage);
    for (const interdit of ["depenseUsd", "controle", "retirees", "manques"]) expect(dump).not.toContain(`"${interdit}"`);
  });

  it("c) le projet est relu sans manque et reste petit", async () => {
    const p = (await jusquaPrete()).projetMontage;
    expect(lireProjetGardeV4(p)).not.toBeNull();
    expect(manquesRetoucheGratuiteV4(p)).toEqual([]);
    expect(JSON.stringify(p).length).toBeLessThan(200 * 1024);
  });
});

describe("G12-07c · garde d'import", () => {
  it("d) index.ts importe projet-v4 une seule fois ; aucun autre fichier de src/ ne l'importe", () => {
    const index = readFileSync(join(RACINE, "src/moteurs/montage-facecam-animee/index.ts"), "utf8");
    expect(index.match(/from "\.\/projet-v4"/g)).toHaveLength(1);
    const importeurs: string[] = [];
    const parcourir = (dir: string) => {
      for (const nom of readdirSync(dir)) {
        const chemin = join(dir, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.(ts|tsx)$/.test(nom) && /from\s+["'][^"']*projet-v4["']/.test(readFileSync(chemin, "utf8"))) importeurs.push(chemin.slice(RACINE.length + 1));
      }
    };
    parcourir(join(RACINE, "src"));
    expect(importeurs).toEqual(["src/moteurs/montage-facecam-animee/index.ts"]);
  });
});
