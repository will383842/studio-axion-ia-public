/** C5 : CODES_CLIENT_CONNUS reste lié au type CodeErreurZernio (sans import domaine -> fournisseur, qui créerait un cycle). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CODES_CLIENT_CONNUS } from "@/domaine/guide-reseau/raison-refus";
import type { CodeErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

// Vérifié par tsc : ajouter un code au type sans l'ajouter ici (ou l'inverse) ne compile plus.
const TOUS: Record<CodeErreurZernio, true> = {
  "envoi-coupe": true, "mot-interdit": true, "chemin-refuse": true, debit: true, "lecture-requise": true, "conflit-idempotence": true, doublon: true, "a-verifier": true, indisponible: true,
  acces: true, introuvable: true, refuse: true, "reponse-invalide": true, "inbox-requis": true, "quota-messages": true, "reponse-privee-consommee": true, "reponse-privee-inconnue": true,
  "limite-incertaine": true, "lien-hors-domaine": true, "guide-inconnu": true, "boutons-non-supportes": true, "creation-incomplete": true,
};

describe("C5 CODES_CLIENT_CONNUS = codes de zernio-erreurs.ts + erreur-inconnue", () => {
  it("la liste du validateur est exactement celle du type", () => {
    expect([...CODES_CLIENT_CONNUS].sort()).toEqual([...Object.keys(TOUS), "erreur-inconnue"].sort());
  });
  it("la liste du type, lue dans la source, est celle du test", () => {
    const src = readFileSync("src/fournisseurs/publication/zernio-erreurs.ts", "utf8");
    const bloc = src.slice(src.indexOf("export type CodeErreurZernio ="), src.indexOf("/** Codes levés AVANT"));
    const codes = [...bloc.matchAll(/\|\s*"([a-z-]+)"/g)].map((m) => m[1]);
    expect(codes.sort()).toEqual(Object.keys(TOUS).sort());
  });
});
