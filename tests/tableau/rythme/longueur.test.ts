/**
 * LONGUEUR DU TEXTE DIT : UNE seule borne, dérivée de l'estimateur et du plafond de durée (`duree-tableau.ts`).
 * Essai réel n° 3 : l'écran affichait « Le texte dit 1670 / 1600 » pour un script que le générateur venait d'accepter.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARACTERES_DITS_MAX_TABLEAU, DUREE_MAX_TABLEAU_SEC, caracteresEn } from "../../../src/domaine/duree-tableau";
import { lignesDuTexteTableau, pastillesTexteTableau } from "../../../src/domaine/relecture-tableau";
import { controlerDuree } from "../../../src/domaine/scripts-tableau-controles";
import { CONSIGNE_DECOUPAGE } from "../../../src/moteurs/montage-tableau/decoupage";
import { DUREE_MAX_MS } from "../../../src/moteurs/montage-tableau/regles";
import { REGLES_TABLEAU as CONSIGNE_SCRIPT_TABLEAU } from "../../../src/services/tableau-scripts/consignes";

const source = (chemin: string) => readFileSync(new URL(`../../../${chemin}`, import.meta.url), "utf8");

describe("une seule borne de longueur, partout", () => {
  it("dérivée de l'estimateur et du plafond : 90 s à 16,9 caractères par seconde (165 mots/min), soit 1 520", () => {
    expect(CARACTERES_DITS_MAX_TABLEAU).toBe(caracteresEn(DUREE_MAX_TABLEAU_SEC));
    expect(CARACTERES_DITS_MAX_TABLEAU).toBe(1520);
  });

  it("le script de l'essai (1 500 caractères, YouTube) passe le générateur ; un caractère de trop au-delà de la borne, non", () => {
    expect(controlerDuree("a".repeat(1500), "youtube")).toEqual([]);
    expect(controlerDuree("a".repeat(CARACTERES_DITS_MAX_TABLEAU), "youtube")).toEqual([]);
    const [d] = controlerDuree("a".repeat(CARACTERES_DITS_MAX_TABLEAU + 1), "youtube");
    expect(d.eliminatoire).toBe(true);
    expect(d.message).toContain(`${CARACTERES_DITS_MAX_TABLEAU} caractères dits au plus`);
  });

  it("1520 caractères dits sont acceptés et 1521 refusés de la même façon par le contrôle de durée du script et par l'indicateur de l'écran (le découpage tient la même borne en ms : voir l'accord DUREE_MAX_MS ci-dessous), sans dépendre d'un arrondi flottant", () => {
    const texte = (n: number) => `${"a".repeat(n - 1)}.`;
    for (const reseau of ["linkedin", "youtube"] as const) {
      expect(controlerDuree(texte(1520), reseau)).toEqual([]);
      const [d] = controlerDuree(texte(1521), reseau);
      expect(d?.eliminatoire).toBe(true);
      expect(d?.code).toBe("duree-reseau");
    }
    const plafond = (n: number) => pastillesTexteTableau(lignesDuTexteTableau(texte(n))).some((p) => p.code === "duree-plafond");
    expect(plafond(1520)).toBe(false);
    expect(plafond(1521)).toBe(true);
    expect(controlerDuree(texte(1521), "youtube", "Le script", false)[0]?.eliminatoire).toBe(false); // forcé en remarque : seul l'indicateur change
    expect(source("src/domaine/duree-tableau.ts")).toMatch(/export const CARACTERES_DITS_MAX_TABLEAU = 1520;/);
  });

  it("le découpage (règle 14) tient la même borne : DUREE_MAX_MS est le plafond de 90 s, soit 1 520 caractères dits au débit commun", () => {
    expect(DUREE_MAX_MS).toBe(DUREE_MAX_TABLEAU_SEC * 1000);
    expect(caracteresEn(DUREE_MAX_MS / 1000)).toBe(CARACTERES_DITS_MAX_TABLEAU);
    expect(CONSIGNE_DECOUPAGE).toContain(`${DUREE_MAX_MS / 1000} secondes au plus (${CARACTERES_DITS_MAX_TABLEAU} caractères dits)`);
  });

  it("générateur et découpage annoncent la même borne", () => {
    expect(CONSIGNE_SCRIPT_TABLEAU).toContain(`${CARACTERES_DITS_MAX_TABLEAU} caractères dits au plus`);
    expect(CONSIGNE_DECOUPAGE).toContain(`(${CARACTERES_DITS_MAX_TABLEAU} caractères dits)`);
  });

  it("le compteur de l'écran et le prix annoncé lisent la borne commune ; plus aucun « 1600 »", () => {
    const ecran = source("src/components/formats/tableau-anime/NouvelleVideoTableau.tsx");
    expect(ecran).toContain("longueurMax={CARACTERES_DITS_MAX_TABLEAU} compter={caracteresDits}");
    expect(ecran).not.toMatch(/\b1600\b/);
    const service = source("src/services/tableau-creation.ts");
    expect(service).toContain("CARACTERES_DITS_MAX_TABLEAU");
    expect(service).not.toMatch(/\b1600\b|1 600/);
  });
});
