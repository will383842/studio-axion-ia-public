/**
 * C2-U17a : filet de préparation de C2-U17. Il ne lit ni n'écrit aucun état « prod ».
 * Il reste vert quand C2-U17 passe ces capacités de `prevu` à `eteint`.
 * Le jour où Williams en allume une (passage à `prod`, interrupteur à `true`), la fiche d'allumage
 * met ce test à jour dans sa PR, avec l'accord du relecteur (comme tests/zoom-gratuit/constat-existant.test.ts:1-4).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_TEXTE } from "@/briques/bibliotheque-video/catalogue/texte";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { PAVE_ANIME_ACTIF } from "@/briques/sous-titres/pave";
import { ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF } from "@/briques/sous-titres/noms-outils";
import { REPERE_EPAULE_ACTIF } from "@/briques/sous-titres/repere-epaule";
import { ESCALIER_ACTIF } from "@/briques/sous-titres/escalier";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const racine = process.cwd();

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

  it("éteint : sans entrée bibliothèque, `parametresComposition` ne pose pas `sortie` (le champ n'existe que derrière la porte ; preuve par le vrai chemin dans tests/briques/composition/sortie-animee-branchee.test.ts)", () => {
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

  it("escalier non branché dans scene.ts (C2-U20b-b le branchera ; ce cas sera alors remplacé par le relecteur de C2-U20b-b, pas supprimé)", () => {
    expect(texteDe("src/briques/sous-titres/scene.ts")).not.toContain("escalier");
  });
});
