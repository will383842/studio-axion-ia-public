/**
 * LOT « FINS » DU 14/10/2026 : Instagram (abonnement + mot = une demande), page d'appel suivie depuis une vidéo, code de
 * version du tableau posé par `codeVariante`, version en ligne de la sonde, garde-fou LinkedIn du tableau.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS, type FinTable } from "@/briques/fins";
import { controlerAction } from "@/domaine/scripts-tableau-controles";
import type { DemandeScriptTableau, ScriptTableau } from "@/domaine/scripts-tableau";
import { libelleEvenement } from "@/domaine/tracabilite-tableau";
import { analyserCode } from "@/domaine/derivations-generateur";
import { versionDuCode } from "@/lib/version-code";
import { finDeLaSortie, FIN_SANS_APPEL_LINKEDIN } from "@/moteurs/montage-tableau/relecture";
import { codesVersionTableau } from "@/services/tableau-code";
import { appelsValides, finDuTableau } from "@/services/tableau-fin";
import { DEMANDE_MODELE as DEMANDE_TEMOIN, ecritureModele } from "../../tableau-scripts/modele-valide";

/** Le témoin v3, avec une fin « commentaire » (le mot CINQ). */
const DEMANDE_MODELE: DemandeScriptTableau = { ...DEMANDE_TEMOIN, fin: { type: "commentaire", mot: "CINQ" } };

const codes = (d: { code: string }[]) => d.map((x) => x.code);
/** Le script modèle, avec l'appel remplacé. */
const avecAppel = (...dits: string[]): ScriptTableau => {
  const s = structuredClone(ecritureModele().script);
  s.appel = [{ dit: "Le détail tient sur une page.", ecran: "Le détail : une page" }, ...dits.map((dit) => ({ dit, ecran: dit.slice(0, 30) }))];
  return s;
};

describe("Instagram : « Abonnez-vous et écrivez {MOT} en commentaire » compte pour UNE demande", () => {
  const phrase = avecAppel("Abonnez-vous et écrivez CINQ en commentaire : je vous l'envoie.");

  it("acceptée pour Instagram", () => {
    expect(controlerAction(phrase, DEMANDE_MODELE, { reseau: "instagram" })).toEqual([]);
  });

  it("deux demandes ailleurs (Facebook, TikTok, LinkedIn) ou sans réseau connu", () => {
    for (const reseau of ["facebook", "tiktok", "linkedin", "youtube-shorts"] as const) expect(codes(controlerAction(phrase, DEMANDE_MODELE, { reseau })), reseau).toEqual(["actions-multiples"]);
    expect(codes(controlerAction(phrase, DEMANDE_MODELE))).toEqual(["actions-multiples"]);
  });

  it("un autre « abonnez-vous » dans le texte reste une seconde demande, même sur Instagram", () => {
    const deux = avecAppel("Abonnez-vous et écrivez CINQ en commentaire : je vous l'envoie.", "Et abonnez-vous à la page.");
    expect(codes(controlerAction(deux, DEMANDE_MODELE, { reseau: "instagram" }))).toEqual(["actions-multiples"]);
    const separes = avecAppel("Abonnez-vous.", "Écrivez CINQ en commentaire.");
    expect(codes(controlerAction(separes, DEMANDE_MODELE, { reseau: "instagram" }))).toEqual(["actions-multiples"]);
  });

  it("le mot doit toujours être dit", () => {
    const sansMot = avecAppel("Abonnez-vous et écrivez GUIDE en commentaire : je vous l'envoie.");
    expect(codes(controlerAction(sansMot, DEMANDE_MODELE, { reseau: "instagram" }))).toEqual(["action-hors-demande"]);
  });
});

describe("tableau : code de version par réseau, par `codeVariante`", () => {
  it("un code par réseau servi par les sorties produites, numéro sur quatre chiffres, format TB", () => {
    expect(codesVersionTableau(42, ["vertical", "vertical-liens", "carre"], "TB")).toEqual({ instagram: "0042-TB-IG", facebook: "0042-TB-FB", tiktok: "0042-TB-TT", "youtube-shorts": "0042-TB-YS", linkedin: "0042-TB-LI" });
    expect(codesVersionTableau(7, ["horizontal"], "TB")).toEqual({ youtube: "0007-TB-YT" });
    expect(codesVersionTableau(7, [], "TB")).toEqual({});
  });

  it("chaque code se relit (`analyserCode`, recherche « 0042-TB-IG »)", () => {
    for (const code of Object.values(codesVersionTableau(42, ["vertical", "carre", "horizontal"], "TB"))) expect(analyserCode(code!), code).toMatchObject({ numero: 42, codeFormat: "TB" });
  });

  it("l'historique de la vidéo le montre", () => {
    expect(libelleEvenement({ type: "code", donnees: { codesVersion: { instagram: "0042-TB-IG", linkedin: "0042-TB-LI" } } })).toBe("Code de version : 0042-TB-IG, 0042-TB-LI");
    expect(libelleEvenement({ type: "code", donnees: { chaine: "tableau-v3" } })).toBe("Fabriquée par · tableau-v3");
  });
});

describe("version en ligne (sonde /api/sante)", () => {
  it("le commit posé à la construction, sinon « inconnu »", () => {
    expect(versionDuCode({ STUDIO_COMMIT: " abc1234 " })).toBe("abc1234");
    expect(versionDuCode({ SOURCE_COMMIT: "def5678" })).toBe("def5678");
    expect(versionDuCode({})).toBe("inconnu");
  });
});

describe("tableau : garde-fou LinkedIn", () => {
  it("aucune fin au mot proposée ni rendue pour LinkedIn, même ajoutée à la main dans la table", () => {
    expect(appelsValides("linkedin")).toEqual([]);
    const trafiquee: FinTable[] = [...TABLE_FINS, { id: "fin-li-mot-envoi", groupe: "linkedin", type: "commentaire", dit: "Écrivez {MOT} en commentaire. Je vous l'envoie.", ecran: "Écrivez {MOT} en commentaire", validee: true }];
    expect(appelsValides("linkedin", trafiquee)).toEqual([]);
    for (const id of ["fin-li-mot-envoi", "fin-if-mot-envoi", null]) {
      const r = finDuTableau("linkedin", id, trafiquee, { mot: "guide" });
      expect(r, String(id)).toHaveProperty("absente");
    }
  });

  it("le carré de LinkedIn ne dit jamais l'appel au mot, quoi que rende le choix de la fin", () => {
    expect(finDeLaSortie("carre", { id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" })).toEqual({ absente: FIN_SANS_APPEL_LINKEDIN });
    expect(finDeLaSortie("carre", undefined)).toEqual({ absente: FIN_SANS_APPEL_LINKEDIN });
    // Les autres sorties ne changent pas.
    const fin = { id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" };
    expect(finDeLaSortie("portrait", fin)).toBe(fin);
  });
});
