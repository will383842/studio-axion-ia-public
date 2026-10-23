/**
 * Fins par réseau (TB-15) : table provisoire de 6 fins (2 par groupe), toutes NON validées (rien d'utilisable tant que
 * Will n'a pas validé) ; ajout du 11/10, en fin de table : la fin VALIDÉE « Écrivez {MOT} en commentaire. Je vous
 * l'envoie. » dans chaque groupe, et l'appel de diagnostic (non validé) dans chaque groupe ; longueurs, ton (vouvoiement, ni gain, ni prix, ni lieu, ni « demain »), au plus 1 sur 3
 * « Commentez MOT », choix refusé avec une phrase claire, lecture future de l'Usine (injectée).
 */
import { describe, expect, it } from "vitest";
import { ErreurFin, finPour, finPourAvecLecteur, groupeDe, nombreMots, TABLE_FINS, type FinTable, type LecteurAppels } from "../../../src/briques/fins";
import { GROUPES_FIN, MOTS_DIT_MAX, MOTS_ECRAN_MAX, RESEAUX_FIN } from "../../../src/briques/fins/types";
import { RESEAUX } from "../../../src/reseaux";

const validee = (f: FinTable): FinTable => ({ ...f, validee: true });
const TABLE_VALIDEE = TABLE_FINS.map(validee);

describe("table provisoire", () => {
  it("6 fins provisoires (2 par groupe), puis 5 ajoutées (fin-li-mot-envoi retirée le 14/10), puis la fin de TikTok et Shorts ; identifiants uniques", () => {
    expect(TABLE_FINS).toHaveLength(12);
    for (const g of GROUPES_FIN) expect(TABLE_FINS.slice(0, 6).filter((f) => f.groupe === g)).toHaveLength(2);
    expect(TABLE_FINS.slice(6, 11).map((f) => f.groupe)).toEqual(["instagram-facebook", "tiktok-youtube", "instagram-facebook", "tiktok-youtube", "linkedin"]);
    expect(TABLE_FINS[11]).toMatchObject({ id: "fin-ty-lien-profil", groupe: "tiktok-youtube", type: "lien", dit: "Le lien est dans mon profil.", validee: false });
    expect(new Set(TABLE_FINS.map((f) => f.id)).size).toBe(12);
    expect(TABLE_FINS.some((f) => f.id === "fin-li-mot-envoi")).toBe(false);
  });

  it("les 6 provisoires et l'appel de diagnostic restent non validés : seule la fin du mot à commenter l'est", () => {
    for (const f of TABLE_FINS.slice(0, 6)) expect(f.validee).toBe(false);
    for (const f of TABLE_FINS.filter((x) => x.id.endsWith("-diagnostic"))) expect(f.validee).toBe(false);
    const validees = TABLE_FINS.filter((f) => f.validee);
    // LinkedIn n'a plus de fin validée : rien n'est dit dans une vidéo LinkedIn (14/10).
    expect(validees.map((f) => f.groupe).sort()).toEqual(["instagram-facebook", "tiktok-youtube"]);
    for (const f of validees) expect(f.dit).toBe("Écrivez {MOT} en commentaire. Je vous l'envoie.");
  });

  it("phrase dite ≤ 12 mots, phrase à l'écran ≤ 8 mots, non vides", () => {
    for (const f of TABLE_FINS) {
      expect(nombreMots(f.dit), f.id).toBeGreaterThan(0);
      expect(nombreMots(f.dit), f.id).toBeLessThanOrEqual(MOTS_DIT_MAX);
      expect(nombreMots(f.ecran), f.id).toBeGreaterThan(0);
      expect(nombreMots(f.ecran), f.id).toBeLessThanOrEqual(MOTS_ECRAN_MAX);
    }
  });

  it("ton sobre : vouvoiement, ni promesse de gain, ni prix, ni lieu, ni « demain »", () => {
    for (const f of TABLE_FINS) {
      const t = `${f.dit} ${f.ecran}`.toLowerCase();
      expect(t, f.id).not.toMatch(/\b(tu|toi|ton|ta|tes|t')\b|villeexemple|demain|gagn|gratuit|offert|€|euro|\d/);
      expect(t, f.id).not.toMatch(/\b(garanti|rentab|économis|explos)/);
    }
  });

  it("« Commentez MOT » sur 1 fin sur 3 au plus ; les autres sont des appels de visibilité", () => {
    const commentaires = TABLE_FINS.filter((f) => f.type === "commentaire");
    expect(commentaires.length).toBeGreaterThanOrEqual(1);
    expect(commentaires.length / TABLE_FINS.length).toBeLessThanOrEqual(1 / 3);
    for (const f of TABLE_FINS.filter((x) => x.type !== "commentaire")) expect(f.dit + f.ecran, f.id).not.toMatch(/commentez/i);
    expect(new Set(TABLE_FINS.map((f) => f.type))).toEqual(new Set(["abonnement", "enregistrement", "envoi", "question", "commentaire", "lien"]));
  });

  it("les réseaux recopiés sont ceux de src/reseaux, chacun dans un groupe", () => {
    expect([...RESEAUX_FIN].sort()).toEqual(RESEAUX.map((r) => r.id).sort());
    for (const r of RESEAUX_FIN) expect(GROUPES_FIN).toContain(groupeDe(r));
    expect(groupeDe("facebook")).toBe(groupeDe("instagram"));
    expect(groupeDe("youtube-shorts")).toBe(groupeDe("tiktok"));
  });
});

describe("finPour", () => {
  it("refuse une fin non validée, avec une phrase claire", () => {
    expect(() => finPour("linkedin", "fin-li-envoi")).toThrow(ErreurFin);
    expect(() => finPour("linkedin", "fin-li-envoi")).toThrow(/pas encore validée par Will/);
    expect(() => finPour("instagram", undefined, {}, TABLE_FINS.filter((f) => !f.validee))).toThrow(/Aucune fin validée par Will pour instagram/);
    // La fin validée du groupe demande son mot à commenter.
    expect(() => finPour("instagram")).toThrow(/mot à commenter/);
    expect(finPour("instagram", undefined, { mot: "guide" })).toMatchObject({ id: "fin-if-mot-envoi", dit: "Écrivez GUIDE en commentaire. Je vous l'envoie.", ecran: "Écrivez GUIDE en commentaire" });
  });

  it("sans appel : la première fin validée du groupe du réseau", () => {
    const f = finPour("facebook", undefined, {}, TABLE_VALIDEE);
    expect(f.groupe).toBe("instagram-facebook");
    expect(f.id).toBe("fin-if-abonnement");
  });

  it("avec un appel : cette fin-là, si elle vise le groupe du réseau", () => {
    expect(finPour("instagram", "fin-if-enregistrement", {}, TABLE_VALIDEE).ecran).toMatch(/Enregistrez/);
    expect(() => finPour("linkedin", "fin-if-enregistrement", {}, TABLE_VALIDEE)).toThrow(/prévue pour instagram-facebook/);
    expect(() => finPour("linkedin", "fin-inconnue", {}, TABLE_VALIDEE)).toThrow(/Aucune fin « fin-inconnue »/);
  });

  it("un « Commentez MOT » demande son mot, rempli en capitales, longueurs tenues", () => {
    expect(() => finPour("tiktok", "fin-ty-commentaire", {}, TABLE_VALIDEE)).toThrow(/mot à commenter/);
    expect(() => finPour("tiktok", "fin-ty-commentaire", { mot: "deux mots" }, TABLE_VALIDEE)).toThrow(/un seul mot/);
    const f = finPour("youtube", "fin-ty-commentaire", { mot: "méthode" }, TABLE_VALIDEE);
    expect(f.ecran).toBe("Commentez MÉTHODE");
    expect(f.dit).not.toContain("{MOT}");
    expect(nombreMots(f.dit)).toBeLessThanOrEqual(MOTS_DIT_MAX);
  });

  it("refuse une fin trop longue", () => {
    const longue: FinTable = { id: "x", groupe: "linkedin", type: "envoi", dit: "un deux trois quatre cinq six sept huit neuf dix onze douze treize", ecran: "a", validee: true };
    expect(() => finPour("linkedin", "x", {}, [longue])).toThrow(/13 mots/);
    expect(() => finPour("linkedin", "x", {}, [{ ...longue, dit: "court", ecran: "un deux trois quatre cinq six sept huit neuf" }])).toThrow(/9 mots à l'écran/);
  });
});

describe("lecture future de l'Usine (injectée, non branchée)", () => {
  it("sans lecteur : la table provisoire (donc refusée tant qu'elle n'est pas validée)", async () => {
    await expect(finPourAvecLecteur("linkedin", "fin-li-envoi")).rejects.toThrow(/pas encore validée/);
  });

  it("avec un lecteur : l'appel lu fait foi, et il doit être validé aussi", async () => {
    const lue: FinTable = { id: "appel-42", groupe: "linkedin", type: "question", dit: "Quelle question posez-vous ?", ecran: "Votre question ?", validee: true };
    const appels: string[] = [];
    const lecteur: LecteurAppels = { lire: async (r, id) => (appels.push(`${r}:${id}`), id === "appel-42" ? lue : null) };
    expect((await finPourAvecLecteur("linkedin", "appel-42", lecteur)).id).toBe("appel-42");
    expect(appels).toEqual(["linkedin:appel-42"]);
    const nonValidee: LecteurAppels = { lire: async () => ({ ...lue, validee: false }) };
    await expect(finPourAvecLecteur("linkedin", "appel-42", nonValidee)).rejects.toThrow(/pas encore validée/);
  });

  it("un appel inconnu de l'Usine retombe sur la table", async () => {
    const vide: LecteurAppels = { lire: async () => null };
    await expect(finPourAvecLecteur("linkedin", "fin-li-envoi", vide)).rejects.toThrow(/pas encore validée/);
  });
});
