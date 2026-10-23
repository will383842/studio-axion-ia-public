/**
 * X12 · l'écran de relance du cas concret : toute réponse devient une issue que l'écran dit (jamais un clic muet), et
 * la relance ne passe ni par la file des actions du routeur ni par une action serveur (adresse fixe du format).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADRESSE_RELANCE, PHRASES_ECRAN_RELANCE, lireIssue, phraseRelancee } from "@/components/formats/cas-concret/fiche-video/relance";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("X12 · lecture de la réponse de relance", () => {
  it("relancée, prix à confirmer, refus : lus tels quels", () => {
    expect(lireIssue({ issue: { statut: "relancee", travailId: "t" } })).toEqual({ statut: "relancee" });
    expect(lireIssue({ issue: { statut: "accord-requis", centimes: 29, phrase: "Un nouvel essai coûte environ 0,29 €." } })).toEqual({ statut: "accord-requis", centimes: 29, phrase: "Un nouvel essai coûte environ 0,29 €." });
    expect(lireIssue({ issue: { statut: "refusee", phrase: "Budget du mois atteint." } })).toEqual({ statut: "refusee", phrase: "Budget du mois atteint." });
  });

  it("réponse vide, illisible ou incomplète : une phrase, jamais rien", () => {
    for (const corps of [null, undefined, "", {}, { issue: null }, { issue: { statut: "inconnu" } }, { issue: { statut: "refusee", phrase: "  " } }, { issue: { statut: "accord-requis", centimes: "x" } }, { erreur: "Connexion requise." }]) {
      const i = lireIssue(corps);
      expect(i.statut).toBe("refusee");
      expect(i.statut === "refusee" && i.phrase.length).toBeGreaterThan(10);
    }
  });

  it("phrases de l'écran : vouvoiement, aucun identifiant technique", () => {
    for (const p of [...Object.values(PHRASES_ECRAN_RELANCE), phraseRelancee("L'écriture"), phraseRelancee(undefined)]) {
      expect(p).not.toMatch(/\b(tu|ton|ta|tes)\b|undefined|machine|\btrav-|\bv-[0-9a-f]/i);
    }
    expect(phraseRelancee("L'écriture")).toBe("Relance envoyée : l'étape « L'écriture » reprend.");
  });
});

describe("X12 · chemin de la relance", () => {
  it("le suivi du format appelle l'adresse fixe par fetch, sans action serveur", () => {
    const suivi = lire("src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx");
    expect(suivi).toContain("fetch(ADRESSE_RELANCE");
    expect(suivi).not.toMatch(/Action\b|from "@\/app\//);
    expect(ADRESSE_RELANCE).toBe("/cas-concret/relance");
    expect(lire("src/app/(studio)/cas-concret/relance/route.ts")).toContain("export async function POST");
  });
});
