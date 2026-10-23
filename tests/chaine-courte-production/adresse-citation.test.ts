/**
 * CHAÎNE COURTE · contrôle d'adresse par le code (relecture finale A09, remarque) : une parole CITÉE entre guillemets
 * n'est pas une adresse au spectateur. Sans cela, une accroche au « vous » qui cite « tu perds 2 h » donnait
 * SORTIE_INVALIDE et faisait refaire une étape déjà payée. PUR, 0 $.
 */
import { describe, expect, it } from "vitest";
import { adresseFautive } from "@/generateur/chaine-courte";

describe("adresseFautive : les citations entre guillemets ne comptent pas", () => {
  it("vidéo au « vous » qui cite une parole au « tu » : pas fautive", () => {
    expect(adresseFautive("Mon client m'a dit : « tu perds 2 heures par semaine ». Et vous ?", "vous")).toBe(false);
    expect(adresseFautive('Mon client m\'a dit : "tu perds 2 heures". Et vous ?', "vous")).toBe(false);
    expect(adresseFautive("Mon client m'a dit : “tu perds 2 heures”. Et vous ?", "vous")).toBe(false);
  });

  it("vidéo au « tu » qui cite une parole au « vous » : pas fautive", () => {
    expect(adresseFautive("Ton banquier t'a dit : « vous devez tout vérifier ». Tu le crois ?", "tu")).toBe(false);
  });

  it("hors des guillemets, l'autre adresse reste fautive", () => {
    expect(adresseFautive("Vous perdez 2 heures par semaine.", "tu")).toBe(true);
    expect(adresseFautive("Mon client m'a dit : « c'est long ». Tu perds 2 heures.", "vous")).toBe(true);
  });
});
