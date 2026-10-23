/**
 * Relecture du script avant la vidéo (brique 1 sur 8, demande de Will : « pouvoir relire et modifier le script avant la
 * génération de la vidéo », dans chaque générateur). Modèle commun : différences, empreinte du texte relu, durée estimée,
 * barème des contrôles par ligne (« will » si Will a modifié la ligne, « machine » sinon). Aucun réseau.
 */
import { describe, expect, it } from "vitest";
import {
  appliquerSaisie,
  auteursDesLignes,
  DEBIT_PAR_DEFAUT,
  differences,
  dureeEstimee,
  empreinte,
  niveauPour,
  scriptRelu,
  type LigneScript,
} from "@/domaine/relecture-script";

const SCRIPT: LigneScript[] = [
  { id: "1", dit: "On recrute nos collaborateurs en quinze minutes.", ecrits: [{ texte: "*15* MINUTES", modifiable: false }], groupe: "Accroche" },
  { id: "2", dit: "Avant, c'était ça.", ecrits: [{ texte: "AVANT", modifiable: true }], groupe: "Avant" },
  { id: "3", dit: "Le dossier est classé.", verrouille: true, groupe: "Après" },
];

describe("differences", () => {
  it("rien de changé : aucune différence", () => {
    expect(differences(SCRIPT, structuredClone(SCRIPT))).toEqual([]);
  });

  it("seule la phrase dite modifiée part, les écrits inchangés valent null", () => {
    const apres = appliquerSaisie(SCRIPT, "2", { dit: "Avant, tout se faisait à la main." });
    expect(differences(SCRIPT, apres)).toEqual([{ id: "2", dit: "Avant, tout se faisait à la main." }]);
  });

  it("un écrit modifié part à sa place, les autres valent null", () => {
    const apres = appliquerSaisie(SCRIPT, "2", { ecrit: { index: 0, texte: "AVANT *1 H*" } });
    expect(differences(SCRIPT, apres)).toEqual([{ id: "2", ecrits: ["AVANT *1 H*"] }]);
  });

  it("les espaces en trop ne comptent pas comme une modification", () => {
    const apres = appliquerSaisie(SCRIPT, "1", { dit: "  On recrute  nos collaborateurs en quinze minutes. " });
    expect(differences(SCRIPT, apres)).toEqual([]);
  });

  it("une ligne verrouillée et un écrit non modifiable ne changent pas", () => {
    const a = appliquerSaisie(SCRIPT, "3", { dit: "Autre chose." });
    const b = appliquerSaisie(a, "1", { ecrit: { index: 0, texte: "20 MINUTES" } });
    expect(b).toEqual(SCRIPT);
    expect(differences(SCRIPT, b)).toEqual([]);
  });
});

describe("empreinte", () => {
  it("stable : même texte, même empreinte (espaces normalisés)", () => {
    const copie = SCRIPT.map((l) => ({ ...l, dit: ` ${l.dit}  ` }));
    expect(empreinte(copie)).toBe(empreinte(SCRIPT));
    expect(empreinte(SCRIPT)).toMatch(/^relu-[0-9a-f]{16}-[0-9a-z]+$/);
  });

  it("change dès que le texte dit change", () => {
    expect(empreinte(appliquerSaisie(SCRIPT, "2", { dit: "Avant, c'était ça !" }))).not.toBe(empreinte(SCRIPT));
  });

  it("change dès qu'un texte écrit change", () => {
    expect(empreinte(appliquerSaisie(SCRIPT, "2", { ecrit: { index: 0, texte: "AVANT." } }))).not.toBe(empreinte(SCRIPT));
  });

  it("change si l'ordre des lignes change", () => {
    expect(empreinte([SCRIPT[1], SCRIPT[0], SCRIPT[2]])).not.toBe(empreinte(SCRIPT));
  });

  it("scriptRelu : le serveur exige l'empreinte du texte qu'il va lancer", () => {
    const e = empreinte(SCRIPT);
    expect(scriptRelu(SCRIPT, e)).toBe(true);
    expect(scriptRelu(appliquerSaisie(SCRIPT, "2", { dit: "Autre." }), e)).toBe(false);
    expect(scriptRelu(SCRIPT, undefined)).toBe(false);
  });
});

describe("barème des contrôles", () => {
  it("les lignes modifiées par Will passent au barème « will », les autres restent « machine »", () => {
    const apres = appliquerSaisie(SCRIPT, "2", { dit: "Avant, tout à la main." });
    expect(auteursDesLignes(SCRIPT, apres)).toEqual({ "1": "machine", "2": "will", "3": "machine" });
  });

  it("revenir au texte d'origine rend la ligne à la machine", () => {
    const aller = appliquerSaisie(SCRIPT, "2", { dit: "Autre." });
    const retour = appliquerSaisie(aller, "2", { dit: SCRIPT[1].dit });
    expect(auteursDesLignes(SCRIPT, retour)["2"]).toBe("machine");
  });

  it("niveauPour lit le barème commun (NIVEAUX) selon l'auteur", () => {
    expect(niveauPour("C1", "machine")).toBe("bloquant");
    expect(niveauPour("C1", "will")).toBe("info");
    expect(niveauPour("C6", "will")).toBeNull();
    expect(niveauPour("CODE-INCONNU", "machine")).toBeNull();
  });
});

describe("durée estimée", () => {
  it("2,8 mots/s par défaut", () => {
    expect(DEBIT_PAR_DEFAUT).toBe(2.8);
    const ligne: LigneScript[] = [{ id: "a", dit: "un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze" }];
    expect(dureeEstimee(ligne)).toBeCloseTo(5, 5);
  });

  it("débit du format quand il est fourni", () => {
    const ligne: LigneScript[] = [{ id: "a", dit: "un deux trois quatre" }];
    expect(dureeEstimee(ligne, 4)).toBeCloseTo(1, 5);
  });

  it("la ponctuation isolée ne compte pas comme un mot", () => {
    expect(dureeEstimee([{ id: "a", dit: "Résultat : des heures gagnées ." }], 1)).toBe(4);
  });
});
