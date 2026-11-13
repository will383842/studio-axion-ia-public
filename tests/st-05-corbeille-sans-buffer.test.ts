/**
 * ST-05 · La corbeille ne parle plus de Buffer dans son code (partie qui ne dépend pas de la PR 440 / L7-06).
 * Lecture de sources uniquement : aucun appel réel, aucune donnée touchée.
 *
 * Restes assumés, hors des fichiers autorisés (voir la PR) :
 *  - le texte affiché « dans Buffer ou Zernio » est figé par tests/corbeille-ui.test.ts ;
 *  - la clé de retour `brouillonsBuffer` est lue par les écrans et tests/zernio/z2s-corbeille.test.ts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { messageCorbeille } from "@/domaine/corbeille";

const lire = (f: string) => readFileSync(f, "utf8");
const TEXTE_AFFICHE = "dans Buffer ou Zernio";
const CLE_DE_RETOUR = /\bbrouillonsBuffer\b/g; // le mot entier : un autre identifiant en « …Buffer… » reste refusé

describe("ST-05 · corbeille sans Buffer", () => {
  it("règle 1 : domaine/corbeille.ts n'a plus de « Buffer » hors du texte affiché figé", () => {
    const reste = lire("src/domaine/corbeille.ts").split(TEXTE_AFFICHE).join("").match(/buffer/gi) ?? [];
    expect(reste).toEqual([]);
  });

  it("règle 2 : services/corbeille.ts n'a plus de « Buffer » hors de la clé de retour partagée", () => {
    const reste = lire("src/services/corbeille.ts").replace(CLE_DE_RETOUR, "").match(/buffer/gi) ?? [];
    expect(reste).toEqual([]);
  });

  it("règle 3 : le refus Buffer n'est pas décrit comme propre à la corbeille", () => {
    expect(lire("src/services/corbeille.ts")).not.toMatch(/envoi vers buffer/i);
  });

  it("règle 4 : le message garde son comportement (aucun brouillon, un, plusieurs)", () => {
    expect(messageCorbeille(1, 0)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours.");
    expect(messageCorbeille(1, 1)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours. 1 brouillon reste dans Buffer ou Zernio : à supprimer dans l'outil concerné.");
    expect(messageCorbeille(2, 3)).toContain("3 brouillons restent");
  });
});
