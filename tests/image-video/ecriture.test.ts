/**
 * L6 · Fiche, recettes par type, écriture du script et règles bloquantes. Appels Claude SIMULÉS (aucune clé, aucun
 * réseau) ; tout est figé : fixtures des cartes A-F et du faux schéma à 16 blocs, scripts de `40-SCRIPTS…`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CarteImage, TypeImage } from "@/domaine/image-video/carte";
import { TYPES_IMAGE } from "@/domaine/image-video/carte";
import { complexiteDe } from "@/domaine/image-video/complexite";
import { schemaFicheImage, type FicheImage } from "@/domaine/image-video/fiche";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { EXEMPLE_TON_V4 } from "@/moteurs/montage-image-video/emprunts";
import {
  APPELS_ECRITURE_MAX,
  CONSIGNE_ECRITURE_IV,
  CONSIGNE_MOT_MACHINE,
  contexteDuSocleIV,
  ecrireScriptIV,
  roleEcritureImageVideo,
  variableEcritureIV,
  type OutilsEcritureIV,
  type ReponseAppelIV,
} from "@/moteurs/montage-image-video/ecriture";
import { FICHES_SIMULEES, ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import {
  MODE_DEUX_VIDEOS_ABSENT,
  RECETTES,
  chapitresDetachables,
  ficheSansChapitres,
  lireDecoupage,
  questionDeRepli,
  questionDitePour,
} from "@/moteurs/montage-image-video/recettes";
import { refusQuestion } from "@/moteurs/montage-image-video/fins";
import { cleFormule, verifierScript, type ChoixFormule, type ContexteRegles } from "@/moteurs/montage-image-video/regles";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const LETTRES = ["A", "B", "C", "D", "E", "F"] as const;
type Lettre = (typeof LETTRES)[number];
const cartes = Object.fromEntries(LETTRES.map((l) => [l, lire(l)])) as Record<Lettre, CarteImage>;
const faux = lire("faux-16-noeuds");
const fiches = Object.fromEntries(LETTRES.map((l) => [l, ficheSimulee(`essai-${l.toLowerCase()}`)!])) as Record<Lettre, FicheImage>;
const ficheFaux = ficheSimulee("essai-faux16")!;

/** Will a tranché « garder » chaque formule absolue des scripts (choix fait à la validation du script). */
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);
const ctx = (l: Lettre, extra: Partial<ContexteRegles> = {}): ContexteRegles => ({ carte: cartes[l], choixFormules: GARDER, ...extra });
const copie = (f: FicheImage): FicheImage => structuredClone(f);
const regles = (v: ReturnType<typeof verifierScript>) => v.manquements.map((m) => m.regle);

/** Remplace le texte dit d'un écran (et lui seul). */
function avecTexte(f: FicheImage, id: string, texteDit: string, textesEcran?: string[]): FicheImage {
  const c = copie(f);
  const e = c.ecrans.find((x) => x.id === id)!;
  e.texteDit = texteDit;
  e.surMot = [{ mot: 0, action: "apparait" }];
  if (textesEcran) e.textesEcran = textesEcran;
  return c;
}

// Aucun appel réseau pendant ces tests.
const fetchReel = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error("Aucun appel réseau dans les tests image → vidéo.");
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchReel;
});

describe("contrat fiche-image/1", () => {
  it("les 7 fiches simulées passent le schéma", () => {
    for (const f of Object.values(FICHES_SIMULEES)) expect(schemaFicheImage.safeParse(f).success).toBe(true);
  });
  it("refuse une version inconnue, un champ en plus, une partie inconnue", () => {
    expect(schemaFicheImage.safeParse({ ...fiches.C, version: "fiche-image/2" }).success).toBe(false);
    expect(schemaFicheImage.safeParse({ ...fiches.C, inconnu: 1 }).success).toBe(false);
    const c = copie(fiches.C) as unknown as { ecrans: { partie: string }[] };
    c.ecrans[0]!.partie = "fin";
    expect(schemaFicheImage.safeParse(c).success).toBe(false);
  });
  it("porte deux accroches et une question de commentaire", () => {
    for (const l of LETTRES) {
      expect(fiches[l].accroches).toHaveLength(2);
      expect(fiches[l].questionCommentaire.texteDit.endsWith("?")).toBe(true);
    }
  });
});

describe("les 6 scripts de 40 passent toutes les règles", () => {
  for (const l of LETTRES) {
    it(`${l} : aucun manquement, Will ayant tranché les formules`, () => {
      const v = verifierScript(fiches[l], ctx(l));
      expect(v.manquements).toEqual([]);
      expect(v.ok).toBe(true);
    });
  }

  it("sans choix de Will, seules les formules absolues restent, toutes pour Will, avec une proposition", () => {
    const attendu: Record<Lettre, string[]> = {
      A: ["dès le premier jour"],
      B: [],
      C: ["Zéro demande perdue", "toujours"],
      D: ["toujours", "zéro question sans réponse"],
      E: [],
      F: ["Risque d'erreur : zéro", "Zéro erreur"],
    };
    for (const l of LETTRES) {
      const v = verifierScript(fiches[l], { carte: cartes[l] });
      expect(v.manquements.every((m) => m.regle === "Q05bis" && m.pourWill && m.priorite === 2 && !!m.proposition)).toBe(true);
      expect(v.manquements.map((m) => /« (.+) »/.exec(m.message)![1])).toEqual(attendu[l]);
    }
  });

  it("les durées estimées tombent dans la classe de chaque image", () => {
    for (const l of [...LETTRES, "faux"] as const) {
      const carte = l === "faux" ? faux : cartes[l];
      const f = l === "faux" ? ficheFaux : fiches[l];
      const { fourchetteSec: [bas, haut] } = complexiteDe(carte);
      const d = verifierScript(f, { carte, choixFormules: GARDER }).dureeEstimeeSec;
      expect(d).toBeGreaterThanOrEqual(bas * 0.9);
      expect(d).toBeLessThanOrEqual(haut * 1.1);
    }
  });

  it("déterministe : deux contrôles donnent exactement le même verdict", () => {
    for (const l of LETTRES) expect(verifierScript(fiches[l], { carte: cartes[l] })).toEqual(verifierScript(fiches[l], { carte: cartes[l] }));
  });
});

describe("Q04 · rien d'oublié", () => {
  it("C sans « quatre secondes » est refusé", () => {
    const f = avecTexte(fiches.C, "e08", "Il l'écrit, il l'envoie tout de suite.");
    const v = verifierScript(f, ctx("C"));
    expect(v.ok).toBe(false);
    expect(v.manquements.some((m) => m.regle === "Q04" && m.message.includes("4 sec"))).toBe(true);
  });
  it("un bloc jamais cité est refusé ; la photo de personnes (A) n'est jamais demandée", () => {
    const f = copie(fiches.C);
    f.ecrans.find((e) => e.id === "e13")!.refs = [];
    f.ecrans.find((e) => e.id === "e13")!.surMot = [{ mot: 0, action: "apparait" }];
    expect(verifierScript(f, ctx("C")).manquements.some((m) => m.regle === "Q04" && m.message.includes("Alerte Telegram"))).toBe(true);
    expect(fiches.A.ecrans.some((e) => e.refs.includes("n01"))).toBe(false);
    expect(verifierScript(fiches.A, ctx("A")).ok).toBe(true);
  });
  it("valeur ET unité : D sans « deux heures récupérées par jour » est refusé, le 2 de « deux minutes » ne compte pas", () => {
    const f = avecTexte(fiches.D, "e14", "Du temps récupéré chaque jour.", ["Temps *récupéré*"]);
    expect(f.ecrans.find((e) => e.id === "e10")!.texteDit).toBe("En deux minutes.");
    const v = verifierScript(f, ctx("D"));
    expect(v.ok).toBe(false);
    expect(v.manquements.filter((m) => m.regle === "Q04").map((m) => m.message)).toEqual(["Le chiffre « 2h » de l'image n'est jamais dit."]);
  });
});

describe("chiffres comparés avec leur unité (relecture A09)", () => {
  it("D : « 2h » devenu « trois heures » est refusé (inventé ET oublié), même si 3 est un compte visible", () => {
    const f = avecTexte(fiches.D, "e14", "Trois heures récupérées par jour.", ["*3h* récupérées / jour"]);
    const v = verifierScript(f, ctx("D"));
    expect(v.manquements.map((m) => m.message)).toEqual(expect.arrayContaining(["Écran e14 : « 3 h » n'est pas sur l'image.", "Le chiffre « 2h » de l'image n'est jamais dit."]));
  });
  it("C sans « réponse sous deux heures » est refusé, même si « deux chemins » est dit", () => {
    const f = avecTexte(fiches.C, "e14", "Et le client est prévenu : réponse rapide.");
    expect(verifierScript(f, ctx("C")).manquements.map((m) => m.message)).toContain("Le chiffre « 2h » de l'image n'est jamais dit.");
  });
  it("la numérotation ne vaut que sans unité : « quatre minutes » est refusé sur B", () => {
    const f = avecTexte(fiches.B, "e09", "Quatre. Vous montez en compétences en quatre minutes.");
    expect(verifierScript(f, ctx("B")).manquements.map((m) => m.message)).toEqual(["Écran e09 : « 4 min » n'est pas sur l'image."]);
  });
  it("F : « 8 min + 6 min + 5 min = 19 min » est accepté (chaque unité est sur l'image)", () => {
    const e06 = fiches.F.ecrans.find((e) => e.id === "e06")!;
    const f = avecTexte(fiches.F, "e06", e06.texteDit, ["8 min + 6 min + 5 min = *19 min*", "Risque d'erreur : élevé"]);
    const v = verifierScript(f, ctx("F"));
    expect(v.manquements).toEqual([]);
    expect(v.ok).toBe(true);
  });
});

describe("calcul écrit terminé par une unité (relecture A09, 2e passe)", () => {
  const ecranD14 = (texte: string) => avecTexte(fiches.D, "e14", "Deux heures récupérées par jour.", [texte]);
  const q05 = (f: FicheImage) => verifierScript(f, ctx("D")).manquements.filter((m) => m.regle === "Q05").map((m) => m.message);
  it("« 2 + 1 = 3h », « 2 + 2 = 4 heures », « 1 + 2 = 3 % » sont refusés : le résultat garde son unité", () => {
    expect(q05(ecranD14("2 + 1 = *3h*"))).toEqual(["Écran e14 : « 3 h » n'est pas sur l'image."]);
    expect(q05(ecranD14("Gain : 2 + 2 = *4 heures*"))).toEqual(["Écran e14 : « 4 h » n'est pas sur l'image."]);
    expect(q05(ecranD14("1 + 2 = *3 %*"))).toEqual(["Écran e14 : « 3 % » n'est pas sur l'image."]);
  });
  it("« 1 + 2 = 30 % » est refusé et le message garde l'unité", () => {
    expect(q05(ecranD14("1 + 2 = *30 %*"))).toEqual(["Écran e14 : « 30 % » n'est pas sur l'image."]);
  });
  it("un calcul juste de l'image passe toujours : F « 8 + 6 + 5 = 19 », D « 16 + 4 = 20 e-mails »", () => {
    expect(verifierScript(fiches.F, ctx("F")).ok).toBe(true);
    expect(q05(ecranD14("16 + 4 = *20* e-mails"))).toEqual([]);
    expect(q05(ecranD14("1 + 1 = *2h*"))).toEqual([]);
  });
});

describe("Q05 · rien d'inventé (priorité 4) et ajouts de Will", () => {
  const avec30 = avecTexte(fiches.C, "e09", "Et le ticket se ferme tout seul. Trente pour cent de temps gagné.");
  it("un script qui ajoute « 30 % » est refusé", () => {
    const v = verifierScript(avec30, ctx("C"));
    expect(v.manquements.find((m) => m.regle === "Q05")?.message).toContain("« 30 % »");
  });
  it("« 30 % » ajouté par Will est accepté et marqué", () => {
    const v = verifierScript(avec30, ctx("C", { ajoutsWill: ["30 %"] }));
    expect(v.ok).toBe(true);
    expect(v.marques).toEqual(["« 30 % » : ajouté par Will."]);
  });
  it("valeur ET unité : D avec « trois heures » au lieu de « 2h » est refusé (la numérotation un… quatre est sans unité)", () => {
    const f = avecTexte(fiches.D, "e14", "Trois heures récupérées par jour.", ["*3h* récupérées / jour"]);
    const v = verifierScript(f, ctx("D"));
    expect(v.ok).toBe(false);
    expect(v.manquements.filter((m) => m.regle === "Q05").map((m) => m.message)).toEqual(["Écran e14 : « 3 h » n'est pas sur l'image."]);
    expect(v.manquements.some((m) => m.regle === "Q04" && m.message.includes("« 2h »"))).toBe(true);
    // « Les quatre autres » (numérotation, sans unité) reste permis dans le script modèle.
    expect(verifierScript(fiches.D, ctx("D")).ok).toBe(true);
  });
  it("contrôle aussi les accroches, les textes d'écran et la question", () => {
    const f = copie(fiches.D);
    f.accroches[1].texteDit = "Trente e-mails ce matin.";
    f.questionCommentaire.texteDit = "Et vous, combien en recevez-vous, cinquante ?";
    f.ecrans[0]!.textesEcran = ["*25* e-mails"];
    const v = verifierScript(f, ctx("D"));
    const q05 = v.manquements.filter((m) => m.regle === "Q05").map((m) => m.message);
    expect(q05).toEqual(["Écran e01 : « 25 » n'est pas sur l'image.", "Accroche B : « 30 » n'est pas sur l'image.", "Question de commentaire : « 50 » n'est pas sur l'image."]);
  });
});

describe("Q06 · phrase-choc mot pour mot (priorité 3) et interdits (priorité 1)", () => {
  it("une phrase-choc modifiée d'un mot est refusée", () => {
    const f = avecTexte(fiches.E, "e13", "Vous cherchez. Vous trouvez vite.");
    const v = verifierScript(f, ctx("E"));
    expect(regles(v)).toContain("Q06");
  });
  it("casse et ponctuation ignorées : « Formez-vous aujourd'hui, transformez… » = deux phrases dites", () => {
    expect(verifierScript(fiches.A, ctx("A")).manquements.some((m) => m.regle === "Q06")).toBe(false);
  });
  it("une phrase-choc qui contient « machine » est refusée MÊME mot pour mot, avec une reformulation, sans reproche de mot pour mot", () => {
    const carte: CarteImage = { ...cartes.D, phraseChoc: "Vous lisez ce qui compte. La machine gère le reste." };
    const f = avecTexte(fiches.D, "e17", "La machine gère le reste.");
    const v = verifierScript(f, { carte, choixFormules: GARDER });
    expect(v.ok).toBe(false);
    expect(v.manquements[0]).toMatchObject({ regle: "Q08", priorite: 1, pourWill: true, proposition: "Vous lisez ce qui compte. La automatisation gère le reste." });
    expect(regles(v)).not.toContain("Q06");
    expect(v.manquements).toHaveLength(1);
  });
  it("même en conflit, les écrans de la phrase-choc restent contrôlés (autre interdit, faux client, texte d'écran)", () => {
    const carte: CarteImage = { ...cartes.D, phraseChoc: "Vous lisez ce qui compte. La machine gère le reste." };
    const f = avecTexte(fiches.D, "e17", "La machine gère le reste.", ["La machine gère le *reste* à Villeexemple"]);
    f.ecrans.find((e) => e.id === "e16")!.texteDit = "Vous lisez ce qui compte.";
    const v = verifierScript(f, { carte, choixFormules: GARDER });
    expect(v.ok).toBe(false);
    expect(v.manquements.map((m) => [m.regle, m.ecranId, m.message])).toEqual([
      ["Q08", undefined, expect.stringContaining("La phrase-choc de l'image contient « machine »")],
      ["Q08", "e17", "Écran e17 : « Villeexemple » est interdit."],
    ]);
    const g = avecTexte(fiches.D, "e16", "Notre client adore. Vous lisez ce qui compte.");
    expect(verifierScript(g, { carte, choixFormules: GARDER }).manquements.some((m) => m.regle === "Q08" && m.ecranId === "e16" && m.message.includes("client"))).toBe(true);
  });
  it("une fois la reformulation validée par Will, c'est elle que le mot pour mot compare", () => {
    const carte: CarteImage = { ...cartes.D, phraseChoc: "Vous lisez ce qui compte. La machine gère le reste.", phraseChocValidee: "Vous lisez ce qui compte. L'IA gère le reste." };
    expect(verifierScript(fiches.D, { carte, choixFormules: GARDER }).ok).toBe(true);
    const f = avecTexte(fiches.D, "e17", "La machine gère le reste.");
    const v = verifierScript(f, { carte, choixFormules: GARDER });
    expect(regles(v)).toEqual(["Q08", "Q06"]);
  });
});

describe("Q05 bis · formules absolues (priorité 2) et situation type", () => {
  it("F : « Zéro erreur » non tranché est bloquant", () => {
    const choix = { [cleFormule("risque erreur : zéro")]: "garder" as const };
    const v = verifierScript(fiches.F, { carte: cartes.F, choixFormules: choix });
    expect(v.ok).toBe(false);
    expect(v.manquements).toEqual([expect.objectContaining({ regle: "Q05bis", pourWill: true, proposition: "Presque plus d'erreurs." })]);
  });
  it("F : tranché « garder » passe", () => {
    expect(verifierScript(fiches.F, ctx("F")).ok).toBe(true);
  });
  it("F : tranché « reformuler » passe avec la version prudente dite mot pour mot", () => {
    const choix = { [cleFormule("risque erreur : zéro")]: "garder" as const, [cleFormule("Zéro erreur")]: "reformuler" as const };
    const f = avecTexte(fiches.F, "e17", "Presque plus d'erreurs.", ["Presque plus d'*erreurs*"]);
    const v = verifierScript(f, { carte: cartes.F, choixFormules: choix });
    expect(v.manquements).toEqual([]);
    // Le choix peut aussi être porté par la carte (choixWill), et la version retenue par Will (phraseChocValidee).
    const carte: CarteImage = {
      ...cartes.F,
      phraseChocValidee: "Une saisie. Trois outils. Presque plus d'erreurs.",
      formulesAbsolues: cartes.F.formulesAbsolues.map((x) => ({ ...x, choixWill: x.ou === "phraseChoc" ? ("reformuler" as const) : ("garder" as const) })),
    };
    expect(verifierScript(f, { carte }).ok).toBe(true);
  });
  it("F : tranché « reformuler » mais le script garde « Zéro erreur » → refusé", () => {
    const choix = { [cleFormule("risque erreur : zéro")]: "garder" as const, [cleFormule("Zéro erreur")]: "reformuler" as const };
    const v = verifierScript(fiches.F, { carte: cartes.F, choixFormules: choix });
    expect(regles(v)).toEqual(["Q05bis", "Q06"]);
    expect(v.manquements[0]!.pourWill).toBeUndefined();
  });
  for (const l of ["C", "D", "E", "F"] as const) {
    it(`${l} sans « situation type » est refusé`, () => {
      const f = copie(fiches[l]);
      const premier = f.ecrans.find((e) => e.partie === "explication")!;
      premier.texteDit = premier.texteDit.replace("Voici une situation type. ", "");
      premier.textesEcran = premier.textesEcran.filter((t) => t !== "Situation type");
      premier.surMot = [{ mot: 0, action: "apparait" }];
      const v = verifierScript(f, ctx(l));
      expect(v.manquements.some((m) => m.regle === "Q05bis" && m.message.includes("situation type"))).toBe(true);
    });
  }
  it("A et B (formation) ne demandent pas « situation type »", () => {
    expect(cartes.A.automatisation || cartes.B.automatisation).toBe(false);
  });
});

describe("Q08 · interdits", () => {
  it("« machine » dans le script est refusé, avec une proposition", () => {
    const f = avecTexte(fiches.C, "e06", "La machine lit la demande. Et là, deux chemins.");
    const m = verifierScript(f, ctx("C")).manquements.find((x) => x.regle === "Q08");
    expect(m).toMatchObject({ priorite: 1, ecranId: "e06", proposition: "La automatisation lit la demande. Et là, deux chemins." });
  });
  it("« Martin » sans « par exemple » est refusé", () => {
    const f = avecTexte(fiches.E, "e10", "Vous cherchez le bon de commande Martin.");
    expect(verifierScript(f, ctx("E")).manquements.some((m) => m.regle === "Q08" && m.message.includes("Martin"))).toBe(true);
    expect(verifierScript(fiches.E, ctx("E")).ok).toBe(true);
  });
  it("faux client, « Villeexemple », « Certifexemple » et phrase d'appel dans le corps sont refusés", () => {
    for (const t of ["Un client a gagné trois heures.", "Votre équipe à Villeexemple respire.", "Une formation certifiée Certifexemple.", "Écrivez CHATBOT en commentaire."]) {
      const f = avecTexte(fiches.C, "e03", t);
      expect(verifierScript(f, ctx("C")).manquements.some((m) => m.regle === "Q08"), t).toBe(true);
    }
  });
  it("les manquements sont triés par priorité : interdits, formules, mot pour mot, rien d'inventé", () => {
    const f = avecTexte(avecTexte(fiches.F, "e17", "Zéro machine."), "e03", "Vous la tapez dans le CRM : trente minutes.");
    const v = verifierScript(f, { carte: cartes.F });
    const priorites = v.manquements.map((m) => m.priorite);
    expect(priorites).toEqual([...priorites].sort((a, b) => a - b));
    expect(v.manquements.slice(0, 4).map((m) => m.regle)).toEqual(["Q08", "Q05bis", "Q05bis", "Q06"]);
    expect(v.manquements.find((m) => m.priorite === 4)?.regle).toBe("Q05");
  });
});

describe("Q08 bis · question de commentaire", () => {
  const avecQuestion = (texteDit: string, texteEcran = "Votre réponse ?") => ({ ...copie(fiches.C), questionCommentaire: { texteDit, texteEcran } });
  const q = (f: FicheImage) => verifierScript(f, ctx("C")).manquements.filter((m) => m.regle === "Q08bis").map((m) => m.message);
  it("plus de 12 mots → refusée", () => {
    expect(q(avecQuestion("Et chez vous, combien de messages clients attendent encore une réponse jusqu'au lendemain matin ?"))).toEqual([
      "Question de commentaire : 14 mots, 12 au plus.",
    ]);
  });
  it("avec un mot à commenter ou un lien → refusée", () => {
    expect(q(avecQuestion("Vous voulez le schéma ? Écrivez CHATBOT en commentaire ?"))).toContain("Question de commentaire : elle ne demande jamais d'écrire un mot.");
    expect(q(avecQuestion("Et vous, avez-vous vu le lien dans mon profil ?"))).toContain("Question de commentaire : aucun lien.");
  });
  it("sans « vous » ou sans point d'interrogation → refusée", () => {
    expect(q(avecQuestion("Combien de messages attendent jusqu'au lendemain ?"))).toEqual(["Question de commentaire : elle s'adresse au public en « vous »."]);
    expect(q(avecQuestion("Et chez vous, des messages attendent."))).toEqual(["Question de commentaire : ce doit être une question."]);
  });
  it("les questions des 6 scripts passent aussi le contrôle des fins par réseau (L14)", () => {
    for (const l of LETTRES) expect(refusQuestion(fiches[l].questionCommentaire.texteDit), l).toBeNull();
  });
  it("dite partout sauf sur LinkedIn ; repli sur la banque", () => {
    expect(["instagram", "facebook", "tiktok", "youtube-shorts"].every(questionDitePour)).toBe(true);
    expect(questionDitePour("linkedin")).toBe(false);
    expect(questionDeRepli("linkedin")).toBeNull();
    expect(questionDeRepli("instagram")?.dit).toBe("Et chez vous, quelle tâche revient tous les jours ?");
    expect(questionDeRepli("youtube-shorts")?.dit).toBe("Et chez vous, quelle tâche revient tous les jours ?");
  });
});

describe("Q07, Q09, Q10 · ossature, écriture, durée", () => {
  it("une partie manquante ou déplacée est refusée", () => {
    const sansDouleur = copie(fiches.B);
    sansDouleur.ecrans = sansDouleur.ecrans.filter((e) => e.partie !== "douleur");
    expect(verifierScript(sansDouleur, ctx("B")).manquements.some((m) => m.message === "La partie « douleur » manque.")).toBe(true);
    const deplace = copie(fiches.B);
    deplace.ecrans.find((e) => e.id === "e11")!.partie = "douleur";
    expect(regles(verifierScript(deplace, ctx("B")))).toContain("Q07");
  });
  it("accroche de plus de 8 mots, accroches de même famille, annonce du nombre absente → refusées", () => {
    const longue = copie(fiches.C);
    longue.accroches[0].texteDit = longue.ecrans[0]!.texteDit = "Vingt-trois heures quatorze. Un client vous écrit enfin ce soir.";
    expect(verifierScript(longue, ctx("C")).manquements.some((m) => m.message.startsWith("L'accroche fait 10 mots"))).toBe(true);
    const meme = copie(fiches.C);
    meme.accroches[1].famille = meme.accroches[0].famille;
    expect(regles(verifierScript(meme, ctx("C")))).toEqual(["Q07"]);
    const sansAnnonce = avecTexte(fiches.C, "e06", "Le chatbot lit la demande. Et là, il choisit.");
    expect(verifierScript(sansAnnonce, ctx("C")).manquements.some((m) => m.message.includes("annoncer le nombre (« 2 »)"))).toBe(true);
  });
  it("phrase de plus de 12 mots, chiffres en chiffres dans le texte dit, deux mots orange → refusés", () => {
    const f = avecTexte(fiches.B, "e03", "Vous voyez vos concurrents s'y mettre, et vous ne savez pas par où commencer.");
    expect(verifierScript(f, ctx("B")).manquements.map((m) => m.message)).toEqual([expect.stringContaining("phrase de 14 mots")]);
    const g = avecTexte(fiches.D, "e01", "20 e-mails ce matin.");
    g.accroches[0].texteDit = "20 e-mails ce matin.";
    expect(verifierScript(g, ctx("D")).manquements.some((m) => m.regle === "Q09" && m.message.includes("en lettres"))).toBe(true);
    const h = copie(fiches.D);
    h.ecrans[0]!.textesEcran = ["*20* *e-mails*"];
    expect(regles(verifierScript(h, ctx("D")))).toEqual(["Q09"]);
  });
  it("un script de plus de 150 mots (44 s × 3,4) dépasse la classe « simple » : Q10 le refuse", () => {
    const f = avecTexte(fiches.A, "e12", "Des outils prêts à l'emploi, un accompagnement sur mesure. Une approche pratique, orientée résultats, avec des outils, des cas concrets, des ateliers et un suivi. Une méthode claire, des exercices guidés, un appui à chaque étape, et des résultats que vous voyez tout de suite, dès la première semaine de travail. Vous repartez avec des outils que vous utilisez le lendemain.");
    const v = verifierScript(f, ctx("A"));
    expect(v.manquements.find((m) => m.regle === "Q10")?.message).toMatch(/^Script de 4[5-9] s pour une image « simple » \(30 à 40 s\) : trop long/);
  });
  it("une référence inconnue ou un événement calé hors du texte est refusé", () => {
    const f = copie(fiches.C);
    f.ecrans[4]!.refs.push("n99");
    f.ecrans[4]!.surMot = [{ mot: 40, action: "apparait" }];
    expect(verifierScript(f, ctx("C")).manquements.filter((m) => m.regle === "FORME")).toHaveLength(2);
  });
});

describe("très complexe : une vidéo en chapitres", () => {
  const ctxFaux = (extra: Partial<ContexteRegles> = {}): ContexteRegles => ({ carte: faux, ...extra });
  it("le faux schéma à 16 blocs passe : chapitres « 1/3 », « 2/3 », « 3/3 »", () => {
    expect(verifierScript(ficheFaux, ctxFaux()).manquements).toEqual([]);
    expect(ficheFaux.chapitres.map((c) => [c.repere, c.titre, c.essentiel])).toEqual([
      ["1/3", "Devis", true],
      ["2/3", "Support", false],
      ["3/3", "Réclamation", false],
    ]);
  });
  it("un chapitre non essentiel ne renvoie à rien après lui ; un renvoi est refusé", () => {
    const f = copie(ficheFaux);
    const resultat = f.ecrans.find((e) => e.partie === "resultat")!;
    resultat.refs = ["n02", "n08"];
    const v = verifierScript(f, ctxFaux());
    expect(v.manquements.map((m) => m.message)).toEqual([`L'écran ${resultat.id} renvoie au chapitre détachable « Support » (n08) : il ne pourrait plus être retiré.`]);
    const g = avecTexte(ficheFaux, resultat.id, "Comme on l'a vu, chaque demande suit sa voie.");
    expect(verifierScript(g, ctxFaux()).manquements.some((m) => m.message.includes("renvoie en arrière"))).toBe(true);
  });
  it("mauvais repère ou chapitre essentiel inversé → refusé", () => {
    const f = copie(ficheFaux);
    f.chapitres[1]!.repere = "2/2";
    f.chapitres[2]!.essentiel = true;
    expect(verifierScript(f, ctxFaux()).manquements.map((m) => m.regle)).toEqual(["CHAPITRES", "CHAPITRES"]);
  });
  it("version courte : le dernier chapitre détachable retiré, repères « 1/2 », « 2/2 », toujours conforme", () => {
    expect(chapitresDetachables(ficheFaux).map((c) => c.titre)).toEqual(["Réclamation", "Support"]);
    const courte = ficheSansChapitres(ficheFaux, 1);
    expect(courte.chapitres.map((c) => c.repere)).toEqual(["1/2", "2/2"]);
    const retires = complexiteDe(faux).chapitres.find((c) => c.titre === "Réclamation")!.noeuds;
    expect(verifierScript(courte, ctxFaux({ noeudsRetires: retires })).manquements).toEqual([]);
    expect(() => ficheSansChapitres(ficheFaux, 3)).toThrow("Seulement 2 chapitre(s) détachable(s)");
  });
  it("une image qui n'est pas très complexe n'a pas de chapitres", () => {
    const f = { ...copie(fiches.C), chapitres: [{ repere: "1/1", titre: "Tout", ecrans: ["e05"], essentiel: true }] };
    expect(regles(verifierScript(f, ctx("C")))).toEqual(["CHAPITRES"]);
  });
  it("le mode « deux vidéos » n'existe pas dans cette version", () => {
    expect(lireDecoupage("deux-videos")).toEqual({ ok: false, message: MODE_DEUX_VIDEOS_ABSENT });
    expect(lireDecoupage("chapitres")).toEqual({ ok: true, decoupage: "chapitres" });
    expect(lireDecoupage(undefined)).toEqual({ ok: true, decoupage: "chapitres" });
    expect(lireDecoupage("autre").ok).toBe(false);
  });
});

describe("recettes par type", () => {
  it("les 8 types ont une recette sur la même ossature", () => {
    expect(Object.keys(RECETTES).sort()).toEqual([...TYPES_IMAGE].sort());
    for (const t of TYPES_IMAGE as readonly TypeImage[]) expect(RECETTES[t].parcours.length).toBeGreaterThan(20);
    expect(RECETTES.embranchement.annonceNombre && RECETTES.benefices.annonceNombre).toBe(true);
    expect(RECETTES.entonnoir.annonceNombre || RECETTES["avant-apres"].annonceNombre).toBe(false);
  });
  it("une scène hors du type est refusée (entonnoir dans un avant / après)", () => {
    const f = copie(fiches.E);
    f.ecrans[5]!.scene = "entonnoir";
    expect(verifierScript(f, ctx("E")).manquements.map((m) => m.message)).toEqual(["L'écran e06 utilise une scène qui ne convient pas à ce type d'image (entonnoir)."]);
  });
});

// ─── Écriture : appel Opus simulé, ≤ 2 avec relance guidée ──────────────────────────────────────────────────────────

interface Journal {
  reservations: { appelId: string; modele: string; coutEstimeUsd: number }[];
  appels: EntreeRole[];
}

/** Double des outils : réserve, puis rend les réponses fournies (ou la simulation du rôle). */
function outils(reponses: (ReponseAppelIV | "simulation")[], options: { budgetRefuse?: boolean; socle?: EntreeRole["contexte"] } = {}): { o: OutilsEcritureIV; j: Journal } {
  const j: Journal = { reservations: [], appels: [] };
  let i = 0;
  const o: OutilsEcritureIV = {
    budget: {
      reserver: async (d) => {
        j.reservations.push({ appelId: d.appelId, modele: d.modele, coutEstimeUsd: d.coutEstimeUsd });
        return options.budgetRefuse ? { ok: false, message: "plafond atteint" } : { ok: true };
      },
    },
    appeler: async (role: DefinitionRole, entree: EntreeRole) => {
      j.appels.push(entree);
      const r = reponses[i++] ?? "simulation";
      return r === "simulation" ? { ok: true, simule: true, donnees: role.simuler(entree) } : r;
    },
    ...(options.socle ? { socle: async () => options.socle } : {}),
  };
  return { o, j };
}

const entree = (l: Lettre, extra: Record<string, unknown> = {}) => ({ videoId: "v1", versionId: "s1", carte: cartes[l], choixFormules: GARDER, ...extra });

describe("écriture (simulation)", () => {
  it("un seul appel Opus, réservé avant, pour chacune des 6 images", async () => {
    for (const l of LETTRES) {
      const { o, j } = outils(["simulation"]);
      const r = await ecrireScriptIV(entree(l), o);
      expect(r.ok, l).toBe(true);
      if (!r.ok) continue;
      expect(r).toMatchObject({ appels: 1, relance: false, simule: true, aTrancher: [] });
      expect(r.fiche).toEqual(FICHES_SIMULEES[`essai-${l.toLowerCase()}`]);
      expect(j.reservations).toHaveLength(1);
      expect(j.reservations[0]).toMatchObject({ appelId: "ivecr-v1-s1-1", modele: "claude-opus-5-5" });
      expect(j.reservations[0]!.coutEstimeUsd).toBeGreaterThan(0);
    }
  });

  it("les formules non tranchées partent avec le script, pour Will, sans relance ; ok suit le verdict (faux)", async () => {
    const { o, j } = outils(["simulation"]);
    const r = await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte: cartes.F }, o);
    expect(r).toMatchObject({ ok: false, motif: "a-trancher", appels: 1, relance: false });
    expect(j.appels).toHaveLength(1);
    if (r.ok || r.motif !== "a-trancher") throw new Error("motif inattendu");
    expect(r.verdict.ok).toBe(false);
    expect(r.fiche).toEqual(FICHES_SIMULEES["essai-f"]);
    expect(r.aTrancher.map((m) => m.proposition)).toEqual(["Quarante-cinq secondes en tout. Risque d'erreur : très faible.", "Presque plus d'erreurs."]);
    expect(r.refus).toEqual(r.verdict.manquements.map((m) => m.message));
  });
  it("ok vrai seulement si le verdict est bon", async () => {
    for (const l of LETTRES) {
      const { o } = outils(["simulation"]);
      const r = await ecrireScriptIV(entree(l), o);
      expect(r.ok && r.verdict.ok, l).toBe(true);
    }
  });

  it("relance guidée par les refus exacts, puis réussite : 2 appels, 2 réservations", async () => {
    const mauvaise = avecTexte(fiches.C, "e08", "Il l'écrit, il l'envoie tout de suite.");
    const { o, j } = outils([{ ok: true, simule: true, texte: "```json\n" + JSON.stringify(mauvaise) + "\n```" }, "simulation"]);
    const r = await ecrireScriptIV(entree("C"), o);
    expect(r).toMatchObject({ ok: true, appels: 2, relance: true });
    expect(j.reservations.map((x) => x.appelId)).toEqual(["ivecr-v1-s1-1", "ivecr-v1-s1-2"]);
    expect(j.appels[1]!.variable).toContain("<refus>\n- Le chiffre « 4 sec » de l'image n'est jamais dit.");
  });

  it("deux réponses refusées : la main revient à Will, jamais un troisième appel", async () => {
    const { o, j } = outils([{ ok: true, simule: true, texte: "pas du JSON" }, { ok: true, simule: true, donnees: { version: "fiche-image/1" } }, "simulation"]);
    const r = await ecrireScriptIV(entree("C"), o);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
    expect(j.appels).toHaveLength(2);
  });

  it("réponse coupée : jamais lue, relance plus courte", async () => {
    const { o, j } = outils([{ ok: true, simule: true, texte: "{", stopReason: "max_tokens" }, "simulation"]);
    expect((await ecrireScriptIV(entree("D"), o)).ok).toBe(true);
    expect(j.appels[1]!.variable).toContain("coupée");
  });

  it("budget refusé : aucun appel", async () => {
    const { o, j } = outils(["simulation"], { budgetRefuse: true });
    expect(await ecrireScriptIV(entree("C"), o)).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    expect(j.appels).toHaveLength(0);
  });

  it("réglage « deux vidéos » : refusé avant toute réservation", async () => {
    const { o, j } = outils(["simulation"]);
    expect(await ecrireScriptIV({ ...entree("C"), decoupage: "deux-videos" }, o)).toMatchObject({ ok: false, motif: "reglage", message: MODE_DEUX_VIDEOS_ABSENT, appels: 0 });
    expect(j.reservations).toHaveLength(0);
  });

  it("image inconnue en simulation : aucune fiche inventée, refus", async () => {
    const carte: CarteImage = { ...cartes.C, image: { ...cartes.C.image, empreinte: "inconnue" } };
    const { o } = outils(["simulation", "simulation"]);
    expect(await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte }, o)).toMatchObject({ ok: false, motif: "refusee" });
  });

  it("socle de Will sans phrase de la v4 ; le mot « machine » d'un exemple de ton n'est jamais repris", async () => {
    expect(CONSIGNE_ECRITURE_IV).not.toContain(EXEMPLE_TON_V4);
    expect(CONSIGNE_ECRITURE_IV).toContain(CONSIGNE_MOT_MACHINE);
    const socle = { contexteAxion: "Charte de Will.", gagnants: "W09 : On vous envoie le plan de cette machine." };
    const { o, j } = outils(["simulation"], { socle });
    await ecrireScriptIV(entree("C"), o);
    expect(j.appels[0]!.contexte.contexteAxion).toBe("Charte de Will.\n\nPour ce format, les règles « image → vidéo » (la consigne) passent avant la charte générale quand elles diffèrent.");
    expect(j.appels[0]!.contexte.gagnants?.endsWith(CONSIGNE_MOT_MACHINE)).toBe(true);
    expect(contexteDuSocleIV(undefined)).toEqual({});
  });

  it("le socle avec les règles de départ : ton propre au format, aucune phrase de la v4 dans ce qui part vers Claude", async () => {
    const { socleCasConcretSansV4, TON_IMAGE_VIDEO_EN_MOTS } = await import("@/services/cas-concret-socle");
    const { EXTRAITS_WILL } = await import("@/donnees/generateur/modeles-will");
    const socle = await socleCasConcretSansV4(TON_IMAGE_VIDEO_EN_MOTS);
    expect(socle.gagnants).toBe(TON_IMAGE_VIDEO_EN_MOTS);
    const envoye = { ...contexteDuSocleIV(socle), consigne: CONSIGNE_ECRITURE_IV };
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
    const tout = norm(Object.values(envoye).join(" ")).join(" ");
    for (const e of EXTRAITS_WILL) {
      const m = norm(e.extrait);
      for (let i = 0; i + 4 <= m.length; i++) expect(tout).not.toContain(m.slice(i, i + 4).join(" "));
    }
    expect(TON_IMAGE_VIDEO_EN_MOTS).not.toContain("<deja_dit>");
    expect(TON_IMAGE_VIDEO_EN_MOTS).not.toContain("chez-nous");
  });

  it("comportement actuel de sansPhrasesV4 : la phrase de la v4 citée derrière « jamais » est gardée, la même hors garde-fou est retirée", async () => {
    const { sansPhrasesV4 } = await import("@/services/cas-concret-socle");
    const { EXTRAITS_WILL } = await import("@/donnees/generateur/modeles-will");
    const phrase = EXTRAITS_WILL[0]!.extrait.split(/\s+/).slice(0, 8).join(" ");
    const garde = `Jamais « ${phrase} » dans un script.`;
    const copie = `Exemple à suivre : ${phrase}`;
    // Garde-fou (jamais / interdit / ne pas dire) : la ligne est gardée, avec la phrase citée dedans (c'est voulu : elle sert à l'interdire).
    expect(sansPhrasesV4(garde)).toBe(garde);
    // Même phrase sans mot d'interdiction : la ligne est retirée.
    expect(sansPhrasesV4(`Charte.\n${copie}\nFin.`)).toBe("Charte.\nFin.");
    // Phrase de la v4 HORS des « » après « jamais » sur la même ligne : la ligne est retirée.
    expect(sansPhrasesV4(`Jamais de superlatif. ${phrase}`)).toBe("");
  });

  it("le nom du fichier de l'image n'est jamais transmis à Claude", () => {
    const v = variableEcritureIV(cartes.C, complexiteDe(cartes.C));
    expect(v).not.toContain(cartes.C.image.cle);
    expect(roleEcritureImageVideo.modele).toBe("claude-opus-5-5");
  });

  it("aucun appel réseau : fetch n'est jamais touché", async () => {
    const espion = vi.spyOn(globalThis, "fetch");
    const { o } = outils(["simulation"]);
    await ecrireScriptIV(entree("B"), o);
    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
  });
});

describe("écriture sans impasse : chiffre hors image retiré sans appel", () => {
  const refusee = (f: FicheImage): ReponseAppelIV => ({ ok: true, simule: true, donnees: f });
  const deuxFois = (f: FicheImage) => outils([refusee(f), refusee(f)]);
  const verifier = (f: FicheImage) => verifierScript(f, ctx("D")).manquements.filter((m) => m.regle === "Q05").length;

  const e14 = (f: FicheImage) => f.ecrans.find((x) => x.id === "e14")!;
  const fautif = (dit: string, ecran: string) => avecTexte(fiches.D, "e14", `Deux heures récupérées par jour. ${dit}`, [...e14(fiches.D).textesEcran, ecran]);

  it("un chiffre nu hors image (dit en lettres, écrit en chiffres) est retiré, le script passe, sans appel de plus", async () => {
    const f = fautif("Vingt-cinq e-mails en moins.", "25 e-mails");
    expect(verifier(f)).toBe(1);
    const { o, j } = deuxFois(f);
    const r = await ecrireScriptIV(entree("D"), o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(j.appels).toHaveLength(APPELS_ECRITURE_MAX);
    expect(r.appels).toBe(APPELS_ECRITURE_MAX);
    expect(e14(r.fiche).texteDit).toBe("Deux heures récupérées par jour.");
    expect(e14(r.fiche).textesEcran.join(" ")).not.toMatch(/25/);
    expect(r.verdict.ok).toBe(true);
    expect(r.verdict.marques.some((m) => m.includes("Chiffres retirés") && m.includes("25") && m.includes("e14"))).toBe(true);
  });

  it("un chiffre avec unité (« 25 jours ») est retiré avec son unité", async () => {
    const f = fautif("Vingt-cinq jours de retard en moins.", "25 jours de retard");
    const { o } = deuxFois(f);
    const r = await ecrireScriptIV(entree("D"), o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(e14(r.fiche).texteDit).toBe("Deux heures récupérées par jour.");
    expect(e14(r.fiche).textesEcran.join(" ")).not.toMatch(/25|jours/);
  });

  it("un chiffre présent sur l'image n'est pas touché : la réparation ne retire que le refusé", async () => {
    const f = fautif("Vingt-cinq e-mails en moins.", "25 e-mails");
    const { o, j } = deuxFois(f);
    const r = await ecrireScriptIV(entree("D"), o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(j.appels).toHaveLength(APPELS_ECRITURE_MAX);
    expect(e14(r.fiche).texteDit).toContain("Deux heures récupérées par jour.");
    expect(e14(r.fiche).textesEcran).toEqual(e14(fiches.D).textesEcran);
    expect(r.fiche.ecrans.filter((e) => e.id !== "e14")).toEqual(fiches.D.ecrans.filter((e) => e.id !== "e14"));
    expect(r.verdict.marques).toHaveLength(1);
    // Sans chiffre refusé, le script simulé est accepté tel quel, sans réparation.
    const sim = outils(["simulation"]);
    const s = await ecrireScriptIV(entree("D"), sim.o);
    expect(s.ok && s.fiche).toEqual(FICHES_SIMULEES["essai-d"]);
    expect(s.ok && s.verdict.marques.some((m) => m.includes("Chiffres retirés"))).toBe(false);
    expect(sim.j.appels).toHaveLength(1);
  });

  describe("phrase entière retirée, chiffre de l'image jamais touché", () => {
    const carteJours: CarteImage = { ...cartes.D, chiffres: [...cartes.D.chiffres, { id: "c99", brut: "37 jours", valeur: 37, unite: "jour", dansNoeud: "n01", aDire: false, lu: "les-deux" }] };
    const lance = async (f: FicheImage, extra: Record<string, unknown> = {}) => ecrireScriptIV(entree("D", extra), deuxFois(f).o);
    const D14 = "Deux heures récupérées par jour.";
    const avecSurMot = (dit: string, lignes: string[], surMot?: FicheImage["ecrans"][number]["surMot"]) => {
      const f = avecTexte(fiches.D, "e14", dit, lignes);
      if (surMot) e14(f).surMot = surMot;
      return f;
    };

    it("37 refusé et « 37 jours » de l'image sur le même écran : « 37 jours » reste intact", async () => {
      const f = avecSurMot(`${D14} Trente-sept jours de retard en moins. Trente-sept e-mails en moins.`, ["37 jours de retard", "37 e-mails"]);
      const r = await lance(f, { carte: carteJours });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toBe(`${D14} Trente-sept jours de retard en moins.`);
      expect(e14(r.fiche).textesEcran).toEqual(["37 jours de retard"]);
    });

    it("« Douze jours » et « 12 jours » de l'image restent, le 12 seul part avec sa phrase", async () => {
      const carte12: CarteImage = { ...carteJours, chiffres: [...cartes.D.chiffres, { ...carteJours.chiffres.at(-1)!, brut: "12 jours", valeur: 12 }] };
      const f = avecSurMot(`${D14} Douze jours de retard en moins. Douze e-mails en moins.`, ["12 jours", "12 e-mails"]);
      const r = await lance(f, { carte: carte12 });
      // 12 sans unité est permis tant que l'image compte 12 blocs ; on exige seulement que rien de l'image ne soit retiré.
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toContain("Douze jours de retard en moins.");
      expect(e14(r.fiche).textesEcran).toContain("12 jours");
    });

    it("décimal « 2,5 h » : toute la phrase part, « Avant : 2 h » et « Pourquoi ? » ne bougent pas", async () => {
      const f = avecSurMot(D14, ["Avant : 2 h", "Gain : 2,5 h", "Pourquoi ?"]);
      const r = await lance(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toBe(D14);
      expect(e14(r.fiche).textesEcran).toEqual(["Avant : 2 h", "Pourquoi ?"]);
    });

    it("pourcentage : « 30 % » et « trente pour cent » partent, « 80 % » de l'image reste", async () => {
      const f = avecSurMot(`${D14} Trente pour cent de temps gagné. Quatre-vingts pour cent de réponses.`, ["30 %", "80 % de réponses"]);
      const r = await lance(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toBe(`${D14} Quatre-vingts pour cent de réponses.`);
      expect(e14(r.fiche).textesEcran).toEqual(["80 % de réponses"]);
    });

    it("un nombre dans un mot (B2B, e14) reste intact", async () => {
      const f = avecSurMot(`${D14} Vingt-cinq e-mails en moins.`, ["Cas B2B e14", "25 e-mails"]);
      const r = await lance(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toBe(D14);
      expect(e14(r.fiche).textesEcran).toEqual(["Cas B2B e14"]);
    });

    it("opérande de calcul refusé : la phrase du calcul part en entier, jamais « 16 + = 20 »", async () => {
      const f = avecSurMot(D14, ["9 + 11 = *20* e-mails", "16 + 4 = 20 e-mails"]);
      const r = await lance(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).textesEcran).toEqual(["16 + 4 = 20 e-mails"]);
      expect(e14(r.fiche).textesEcran.join(" ")).not.toMatch(/\+\s*=|=\s*\*?\s*$/);
    });

    it("l'animation sur un mot (surMot) est décalée après le retrait, celle d'un mot retiré tombe", async () => {
      const f = avecSurMot(`${D14} Vingt-cinq e-mails en moins. Vous gardez le temps.`, ["Temps *gardé*"], [
        { mot: 0, action: "apparait" },
        { mot: 6, action: "apparait" },
        { mot: 9, action: "apparait" },
      ]);
      const r = await lance(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(e14(r.fiche).texteDit).toBe(`${D14} Vous gardez le temps.`);
      expect(e14(r.fiche).surMot.map((s) => s.mot)).toEqual([0, 5]);
    });

    it("un écran sans texte dit après retrait n'est pas réparé : le refus reste", async () => {
      const f = avecSurMot("Vingt-cinq e-mails en moins.", ["25 e-mails"]);
      expect(await lance(f)).toMatchObject({ ok: false, motif: "refusee" });
    });

    it("le simulé de la dernière réponse est gardé", async () => {
      const f = fautif("Vingt-cinq e-mails en moins.", "25 e-mails");
      for (const simule of [true, false]) {
        const rep: ReponseAppelIV = { ok: true, simule, donnees: f };
        const r = await ecrireScriptIV(entree("D"), outils([rep, rep]).o);
        expect(r.ok && r.simule).toBe(simule);
      }
    });
  });

  it("un refus d'une autre règle reste refusé", async () => {
    const f = fautif("Vingt-cinq e-mails en moins.", "25 e-mails");
    f.questionCommentaire.texteDit = "Et vous, combien en recevez-vous, cinquante ?";
    const mixte = outils([refusee(f), refusee(f)]);
    expect(await ecrireScriptIV(entree("D"), mixte.o)).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
    const autre = avecTexte(fiches.C, "e08", "Il l'écrit, il l'envoie tout de suite.");
    const { o, j } = outils([refusee(autre), refusee(autre)]);
    expect(await ecrireScriptIV(entree("C"), o)).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
    expect(j.appels).toHaveLength(APPELS_ECRITURE_MAX);
  });
});
