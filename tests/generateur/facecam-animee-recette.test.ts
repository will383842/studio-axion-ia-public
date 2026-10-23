/**
 * FACE CAMÉRA ANIMÉE (17/10) : une idée de l'Usine peut viser ce format. Will lit le script, se filme, dépose la prise.
 * Simulation seulement : aucun appel, aucun réglage allumé.
 *  - la ligne `facecam-animee` de la base 5 est dans la copie synchronisée du studio ;
 *  - la recette d'écriture du format (blocs, plafonds, règles de Will) est lue pour `facecam-animee` par la chaîne
 *    courte ET par la chaîne équipe ;
 *  - le format est proposé dans Écrire.
 */
import { describe, expect, it } from "vitest";
import { formats } from "@/donnees/bases-usine";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { STRUCTURES_AVOCAT } from "@/donnees/generateur/recette-avocat-v4";
import { formatsEcrivables, formatsClassables } from "@/components/generateur/donnees";
import { formatFacecamAnimee } from "@/formats/facecam-animee";
import { listerFormats } from "@/formats";
import { executerChaineCourte } from "@/generateur/chaine-courte";
import { executerChaineEquipe } from "@/generateur/chaine-equipe";
import { briefMinimal, etapeZero } from "@/generateur/etape-zero";
import { matiere } from "../helpers/g3";
import { executeurSimule, TOURNURES_G4 } from "../helpers/g4";
import { CONTEXTE_BANC, MAINTENANT_BANC } from "./banc/registre-banc-g4";

const avis1 = matiere("avis-will", "Un tableur partagé par mail, c'est trois versions du même fichier en une semaine, parce que personne ne sait laquelle est la bonne, donc on perd des heures à vérifier.", { id: "fa-avis-1", pilier: "donnees", motsCles: ["excel", "donnees"] });
const avis2 = matiere("avis-will", "Je conseille une seule source de données, ouverte à toute l'équipe.", { id: "fa-avis-2", pilier: "donnees", motsCles: ["excel", "donnees"] });
const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };
const options = { tournures: TOURNURES_G4, contexteWill };

function donnees() {
  const brief = briefMinimal({ idee: "La fin des fichiers Excel envoyés par mail", reseaux: ["linkedin"], formatId: "facecam-animee", pilier: "donnees", mode: "teleprompteur", matiereIdsImposees: [avis1.id, avis2.id] });
  const z = etapeZero({ maintenant: MAINTENANT_BANC, brief, mode: "teleprompteur", matieres: [avis1, avis2], preuves: [], contexteAxion: CONTEXTE_BANC });
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

describe("base 5 synchronisée : la ligne facecam-animee", () => {
  const ligne = formats({ etats: ["brouillon", "propose", "valide"] }).video.find((f) => f.code === "facecam-animee");

  it("code FA, actif, tournage, 30-75 s, quatre réseaux, proposé (à valider)", () => {
    expect(ligne).toBeDefined();
    expect(ligne).toMatchObject({ codeClassement: "FA", nom: "Face caméra animée", statut: "actif", tournage: true, duree: "30-75 s", etat: "propose", origine: "propose", enLot: false });
    expect(ligne!.reseauxConseilles).toEqual(["linkedin", "instagram", "tiktok", "facebook"]);
    expect(ligne!.squelette).toContain("douleur dans les 3 premières secondes");
    expect(ligne!.squelette).toContain("voici ce qu'on met en place pour vous");
    expect(ligne!.squelette).toContain("base 7");
  });

  it("le code de classement est celui du studio, et il est unique", () => {
    expect(ligne!.codeClassement).toBe(formatFacecamAnimee.codeClassement);
    const codes = formats().video.map((f) => f.codeClassement).filter((c) => c !== "" && !c.startsWith("["));
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("recette d'écriture du format", () => {
  it("paramètres : structures réelles, corps et accroche de SA recette, blocs du format", () => {
    const p = parametresGenerateur("facecam-animee");
    expect(p.formatId).toBe("facecam-animee");
    expect(p.recette.structures).toBe(STRUCTURES_AVOCAT);
    expect(p.recette.corpsMaxSec).toBe(formatFacecamAnimee.recetteScript.ciblesSecondes!.corpsMax);
    expect(p.recette.accrocheMaxSec).toBeLessThanOrEqual(5);
    expect(p.recette.roles).toEqual({ accroche: "accroche", appel: "appel" });
    expect(p.modelesDeTon).toEqual(["will"]);
  });

  it("règles de Will dans la recette : positionnement, interdits, phrases courtes, durée par réseau", () => {
    const regles = formatFacecamAnimee.recetteScript.regles.join("\n");
    for (const t of ["14 mots", "faites-le vous-même", "cet outil vient de sortir", "interdits permanents", "on le met en place pour vous"]) expect(regles).toContain(t);
    // Les mots interdits eux-mêmes ne sont jamais écrits dans la fiche (test du socle) : la liste unique les applique.
    expect(regles).not.toMatch(/villeexemple|gain garanti|certifexemple/i);
    expect(formatFacecamAnimee.recetteScript.zonesDureeParReseau).toEqual({ linkedin: [45, 75], instagram: [30, 60], tiktok: [30, 60], facebook: [30, 60] });
    const blocs = formatFacecamAnimee.recetteScript.blocs;
    expect(blocs.map((b) => b.id)).toEqual(["accroche", "probleme", "corps", "appel"]);
    expect(blocs.find((b) => b.id === "accroche")!.consigne).toContain("3 s");
    expect(blocs.find((b) => b.id === "corps")!.consigne).toContain("voici ce qu'on met en place pour vous");
  });

  it("chaîne courte : le rôle script reçoit la recette du format (plafonds, blocs du corps)", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineCourte(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    const script = appels.find((a) => a.role === "court-script")!.entree.variable;
    expect(script).toContain(`Corps : au plus ${formatFacecamAnimee.recetteScript.ciblesSecondes!.corpsMax} s`);
    expect(script).toContain('id="probleme"');
  });

  it("chaîne équipe : le scénariste reçoit la même recette", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    const script = appels.find((a) => a.role === "equipe-scenariste")!.entree.variable;
    expect(script).toContain(`Corps : au plus ${formatFacecamAnimee.recetteScript.ciblesSecondes!.corpsMax} s`);
    expect(script).toContain('id="probleme"');
  });
});

describe("choix du format dans Écrire", () => {
  it("proposé dans Écrire, sans changer les listes publiques ni le statut réservé", () => {
    expect(formatsEcrivables().some((f) => f.id === "facecam-animee")).toBe(true);
    expect(formatsClassables().some((f) => f.id === "facecam-animee" && f.code === "FA")).toBe(true);
    expect(listerFormats().some((f) => f.id === "facecam-animee")).toBe(false);
    expect(formatFacecamAnimee.reserveAWill).toBe(true);
  });
});
