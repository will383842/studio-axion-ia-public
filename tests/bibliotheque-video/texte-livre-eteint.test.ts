/**
 * C2-U17a : filet de préparation de C2-U17. Il ne lit ni n'écrit aucun état « prod ».
 * Il reste vert quand C2-U17 passe ces capacités de `prevu` à `eteint`.
 * Le jour où Williams en allume une (passage à `prod`, interrupteur à `true`), la fiche d'allumage
 * met ce test à jour dans sa PR, avec l'accord du relecteur (comme tests/zoom-gratuit/constat-existant.test.ts:1-4).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_TEXTE } from "@/briques/bibliotheque-video/catalogue/texte";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { PAVE_ANIME_ACTIF } from "@/briques/sous-titres/pave";
import { ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF } from "@/briques/sous-titres/noms-outils";
import { REPERE_EPAULE_ACTIF } from "@/briques/sous-titres/repere-epaule";
import { ESCALIER_ACTIF } from "@/briques/sous-titres/escalier";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";
import type { CommandeFabrication } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { entreeBibliothequeDuLancement } from "@/services/bibliotheque-video";

const racine = process.cwd();
// CORRECTION 18/11 (relecture Opus, point 2) : garde par le VRAI `parametresComposition` (commande avocat), pas une lecture de texte.
const MAINT_SORTIE = "2026-11-17T08:00:00.000Z";
function composerAvocatSortie(entrees: Record<string, unknown>) {
  const n1 = decorsCatalogue(MAINT_SORTIE).find((d) => d.id === "decor-n1-halo-orange")!;
  const mot = (m: string, d: number) => ({ mot: m, debutSec: d, finSec: d + 0.3 });
  const c = {
    versionContrat: 2, moteurId: "montage-avocat", videoId: "v-test", formatId: "avocat", versionFormat: 2, profilRenduVersion: 1, dureeCibleSec: 12, ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" }, distribution: [],
    styles: { lut: null, sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT }, habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT }, profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT }, musique: null, decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never } },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees, reglages: {}, plans: [], prononciations: [], mentionIA: { active: false }, budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme, profilRendu: formatAvocat.profilRendu, recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINT_SORTIE, sousTitres: { base: "karaoke", intensite: "equilibre" }, medias: {},
  } as unknown as CommandeFabrication;
  const plans = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
  const segments = [{ id: "g1", debutSec: 0.5, finSec: 2.5, mots: [mot("Avec", 0.5), mot("devis", 2)] }];
  return parametresComposition(c, { ratio: "9:16", plans, segments, dureeSec: 12 });
}
async function entreesAvocat(reglage?: unknown) {
  reinitialiserDepots();
  if (reglage !== undefined) await ecrireParametre("bibliothequeVideo.avocat", reglage);
  return entreeBibliothequeDuLancement({ id: "v-test", formatId: "avocat" });
}


interface Piece {
  id: string;
  fichiers: [string, string][];
}

const PIECES: readonly Piece[] = [
  { id: ID.textePave, fichiers: [["src/briques/sous-titres/pave.ts", "C2-U7a"], ["src/briques/sous-titres/pave.ts", "C2-U7b"]] },
  { id: ID.texteNomOutil, fichiers: [["src/briques/sous-titres/noms-outils.ts", "C2-U8"]] },
  { id: ID.texteNomOutilAutonome, fichiers: [["src/briques/sous-titres/noms-outils.ts", "C2-U9"]] },
  { id: ID.texteBandeauNom, fichiers: [["src/briques/sous-titres/bandeau-nom.ts", "C2-U10"], ["src/services/bandeau-nom.ts", "C2-U11"]] },
  { id: ID.texteRepereEpaule, fichiers: [["src/briques/sous-titres/repere-epaule.ts", "C2-U18"]] },
  { id: ID.texteSortieAnimee, fichiers: [["src/briques/sous-titres/sortie.ts", "C2-U19"]] },
  { id: ID.texteEscalier, fichiers: [["src/briques/sous-titres/escalier.ts", "C2-U20a"], ["studio-rendu/compositions/sous-titres/LigneEscalier.tsx", "C2-U20b"]] },
];

const texteDe = (chemin: string) => readFileSync(join(racine, chemin), "utf8");

describe("C2-U17a : capacités texte livrées et éteintes", () => {
  it("état : jamais prod, coulisse, absent ni demande", () => {
    for (const p of PIECES) {
      expect(["prevu", "eteint"], p.id).toContain(etatCapacite(p.id as IdCapacite));
    }
  });

  it("livré : chaque fichier existe et porte sa fiche", () => {
    for (const p of PIECES) {
      for (const [chemin, etiquette] of p.fichiers) {
        expect(existsSync(join(racine, chemin)), `${p.id} : ${chemin}`).toBe(true);
        expect(texteDe(chemin), `${chemin} doit citer ${etiquette}`).toContain(etiquette);
      }
    }
  });

  // MISE À JOUR DE RÉFÉRENCE 18/11 (BR-SORTIE-ANIMEE, seconde lecture du pilote) : SORTIE_ACTIVE passe à true côté code ; il n'allume
  // rien seul, c'est le champ `sortie` (posé seulement quand la capacité est permise) qui décide. La garde « éteint » est
  // conservée, déplacée : sans entrée bibliothèque, `parametresComposition` ne pose pas `sortie` (voir ci-dessous).
  it("éteint : les 4 interrupteurs restants sont à false", () => {
    expect(PAVE_ANIME_ACTIF).toBe(false);
    expect(ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF).toBe(false);
    expect(REPERE_EPAULE_ACTIF).toBe(false);
    expect(ESCALIER_ACTIF).toBe(false);
  });

  it("éteint : sans entrée bibliothèque (ou sans la capacité), `parametresComposition` ne pose pas `sortie` (appel réel ; chemin complet dans tests/briques/composition/sortie-animee-branchee.test.ts)", async () => {
    const sansEntree = composerAvocatSortie(await entreesAvocat(false)); // v20g : avocat allumé par défaut, `false` écrit en base
    expect("sortie" in sansEntree.texte.sousTitres!).toBe(false);
    for (const reglage of [true, { capacites: ["texte.surlignage-marqueur"] }]) {
      expect("sortie" in composerAvocatSortie(await entreesAvocat(reglage)).texte.sousTitres!).toBe(false);
    }
    // contrôle positif : la même chaîne POSE bien `sortie` quand la capacité est listée (la garde n'est donc pas vide)
    expect("sortie" in composerAvocatSortie(await entreesAvocat({ capacites: ["texte.sortie-animee"] })).texte.sousTitres!).toBe(true);
    const poses = texteDe("src/briques/composition/parametres.ts").match(/sortie\s*:\s*SORTIE_PAR_DEFAUT/g) ?? [];
    expect(poses).toHaveLength(1);
    expect(texteDe("src/briques/composition/parametres.ts")).toMatch(/sortieAnimeePermise\(c\.entrees\)\s*\?\s*\{\s*sortie\s*:\s*SORTIE_PAR_DEFAUT/);
  });

  it("éteint : aucun profil du code (ni le neutre) ne permet ces capacités", () => {
    const profils = [...Object.values(PROFILS_DU_CODE), profilNeutre("format-essai")];
    for (const profil of profils) {
      for (const p of PIECES) {
        expect(profil.capacites[p.id as IdCapacite]?.permis, `${p.id}`).not.toBe(true);
      }
    }
  });

  it("table complète : PIECES = lignes texte prevu ou eteint, moins surlignage et style varié", () => {
    const attendus = LIGNES_TEXTE
      .filter((l) => l.etat === "prevu" || l.etat === "eteint")
      .map((l) => l.id as string)
      .filter((id) => id !== ID.texteSurlignageMarqueur && id !== ID.texteStyleVarie)
      .sort();
    expect(PIECES.map((p) => p.id).sort()).toEqual(attendus);
  });

  // BR-ESCALIER-a 17/11 : scene.ts porte désormais le champ facultatif et la fonction pure ; la garde reste stricte
  // (liste fermée des lignes) et aucun fichier de src/** ne remplit `escalier:` (jamais rempli jusqu'à BR-FACECAM-TEXTE).
  it("escalier dans scene.ts : seulement le champ facultatif et escalierAuTemps ; seul src/briques/composition/parametres.ts remplit `escalier:` (BR-FACECAM-TEXTE, amendement n°1)", () => {
    const lignes = texteDe("src/briques/sous-titres/scene.ts")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /escalier/i.test(l));
    expect(lignes).toEqual([
      'import type { ZoneSureEscalier } from "./escalier";',
      "/** BR-ESCALIER : absent = rien ne change. */",
      "escalier?: { zone: ZoneSureEscalier; taillePx: number };",
      "* BR-ESCALIER : lignes de l'escalier à l'instant t (le groupe actif et les précédents de la même phrase, 6 au plus).",
      "* `null` si le champ `escalier` est absent ou si aucun groupe n'est actif. Pure, ne lève jamais.",
      "export function escalierAuTemps(d: DonneesCalque, t: number): { lignes: string[]; ligneActive: number } | null {",
      "if (!d.escalier) return null;",
    ]);
    const remplisseurs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name);
        if (e.isDirectory()) parcourir(chemin);
        else if (/\.(ts|tsx)$/.test(e.name) && /\bescalier\s*:/.test(readFileSync(chemin, "utf8"))) remplisseurs.push(chemin.replace(/\\/g, "/"));
      }
    };
    parcourir("src");
    // la déclaration du champ (`escalier?:`) ne correspond pas : seule une affectation `escalier:` compte ; BR-FACECAM-TEXTE : un seul fichier la porte (liste exacte).
    expect(remplisseurs).toEqual(["src/briques/composition/parametres.ts"]);
  });
});
