/**
 * LA QUESTION SUR L'IA (accord de Will du 18/10, plan « scripts et voix du tableau » § 3 point 3) : quatre formulations
 * validées, tirées EN TOURNANT (jamais une des 3 dernières livrées, comme les métiers des exemples), DITES juste AVANT
 * la phrase sur l'entreprise, jamais écrites à l'écran. La page de fin validée et la dernière phrase (2 à 5 mots, sans
 * question) ne changent pas. Client simulé : aucun appel, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { METIER_EXEMPLE_MAX, QUESTIONS_IA, questionIaDuTexte, questionIaSuivante, schemaEcriture, type EcritureScript } from "@/domaine/scripts-tableau";
import { controlerEcriture, controlerQuestionIa, texteDitDe } from "@/domaine/scripts-tableau-controles";
import { REGLES_TABLEAU, requeteEcriture } from "@/services/tableau-scripts/consignes";
import { OPTIONS_ESTIMATION } from "@/services/tableau-scripts";
import { CONSIGNE_DECOUPAGE } from "@/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { regleSansAppel } from "@/moteurs/montage-tableau/regles";
import { exempleV5 } from "./exemples-v5";
import { copie, ficheErreurCorrigee } from "../tableau/regles/exemples";

const Q1 = "En quoi l'IA peut-elle vous aider ?";

/** Le témoin v5 SANS sa question sur l'IA (les essais la placent eux-mêmes, au bon endroit ou non). */
function exempleSansQuestion() {
  const x = exempleV5("01-continuite");
  x.ecriture.script.appel = x.ecriture.script.appel.filter((p) => !QUESTIONS_IA.includes(p.dit as (typeof QUESTIONS_IA)[number]));
  return x;
}

/** Le témoin validé, avec la question dite juste avant la phrase sur l'entreprise (rien d'écrit à l'écran). */
function avecQuestion(question = Q1, ecran = ""): EcritureScript {
  const e = structuredClone(exempleSansQuestion().ecriture);
  e.script.appel = [{ dit: question, ecran }, ...e.script.appel];
  return e;
}
const DEMANDE = exempleSansQuestion().demande;
const codes = (e: EcritureScript, q = Q1) => controlerEcriture(e, DEMANDE, { questionIa: q }).filter((d) => d.eliminatoire).map((d) => d.code);

describe("les quatre formulations validées par Will", () => {
  it("dans cet ordre, mot pour mot", () => {
    expect([...QUESTIONS_IA]).toEqual([
      "En quoi l'IA peut-elle vous aider ?",
      "Et l'IA, que peut-elle faire pour vous ici ?",
      "Où l'IA peut-elle vous aider là-dedans ?",
      "Concrètement, comment l'IA peut-elle vous aider ?",
    ]);
  });
});

describe("tirage en tournant", () => {
  it("sans historique : la première ; ensuite, la suivante de la plus récente", () => {
    expect(questionIaSuivante(undefined)).toBe(QUESTIONS_IA[0]);
    expect(questionIaSuivante([])).toBe(QUESTIONS_IA[0]);
    expect(questionIaSuivante([QUESTIONS_IA[0]])).toBe(QUESTIONS_IA[1]);
    expect(questionIaSuivante([QUESTIONS_IA[3], QUESTIONS_IA[2], QUESTIONS_IA[1]])).toBe(QUESTIONS_IA[0]);
  });

  it("jamais une des 3 dernières, et les quatre passent en quatre vidéos", () => {
    const livrees: string[] = [];
    for (let i = 0; i < 12; i++) {
      const q = questionIaSuivante(livrees.slice(0, 3));
      expect(livrees.slice(0, 3)).not.toContain(q);
      livrees.unshift(q);
    }
    expect(new Set(livrees.slice(0, 4)).size).toBe(4);
  });

  it("retrouve la formulation dite dans un texte (traces des scripts livrés)", () => {
    expect(questionIaDuTexte(texteDitDe(avecQuestion(QUESTIONS_IA[2]).script))).toBe(QUESTIONS_IA[2]);
    expect(questionIaDuTexte(texteDitDe(exempleSansQuestion().ecriture.script))).toBeUndefined();
  });
});

describe("contrôle de présence et de place", () => {
  it("le témoin avec la question, juste avant la phrase sur l'entreprise, rien d'écrit : accepté sans aucune remarque", () => {
    expect(controlerEcriture(avecQuestion(), DEMANDE, { questionIa: Q1 })).toEqual([]);
  });

  it("sans la question imposée : refusé", () => {
    expect(codes(exempleSansQuestion().ecriture)).toContain("question-ia");
  });

  it("une autre formulation que celle tirée, ou une question hors de la liste : refusé", () => {
    expect(codes(avecQuestion(QUESTIONS_IA[1]))).toContain("question-ia");
    expect(codes(avecQuestion("Comment l'IA peut-elle vous servir ?"))).toContain("question-ia");
  });

  it("en dernière phrase : refusé (la dernière phrase affirme et ferme)", () => {
    const e = structuredClone(exempleSansQuestion().ecriture);
    e.script.appel = [...e.script.appel, { dit: Q1, ecran: "" }];
    expect(codes(e)).toEqual(expect.arrayContaining(["question-ia", "cloture-question"]));
  });

  it("pas juste avant la phrase sur l'entreprise : refusé", () => {
    const e = structuredClone(exempleSansQuestion().ecriture);
    e.script.aRetenir = [{ dit: Q1, ecran: "" }, ...e.script.aRetenir];
    expect(codes(e)).toContain("question-ia");
  });

  it("écrite à l'écran : refusé (elle est dite, jamais écrite)", () => {
    expect(codes(avecQuestion(Q1, "L'IA vous aide ?"))).toContain("question-ia");
  });

  it("sans question tirée (historique illisible, anciennes traces) : contrôle désactivé", () => {
    expect(controlerQuestionIa(exempleSansQuestion().ecriture.script, undefined)).toEqual([]);
    expect(controlerEcriture(exempleSansQuestion().ecriture, DEMANDE)).toEqual([]);
  });
});

describe("consigne de l'écriture", () => {
  it("les règles placent la question juste avant la phrase sur l'entreprise, dite et jamais écrite", () => {
    expect(REGLES_TABLEAU).toMatch(/QUESTION SUR L'IA/);
    expect(REGLES_TABLEAU).toMatch(/juste AVANT la phrase sur l'entreprise/);
  });

  it("la formulation tirée est imposée mot pour mot à l'écriture", () => {
    const r = requeteEcriture(DEMANDE, { angle: "a", douleur: "d", accroches: [{ type: "situation-vecue", dit: "x", ecran: "x", pourquoi: "p" }], retenue: 0, raison: "r" }, undefined, { questionIa: QUESTIONS_IA[3] });
    expect(r.messages[0].contenu).toContain(`<question_ia>\n${QUESTIONS_IA[3]}\n</question_ia>`);
  });
});

describe("découpage : la question n'est jamais écrite à l'écran", () => {
  it("une ligne écrite qui reprend la question est refusée, même sur la page d'appel", () => {
    const f = copie(ficheErreurCorrigee);
    const derniere = f.scenes[f.scenes.length - 1];
    derniere.elements.push({ id: "eq", type: "ligne", texte: QUESTIONS_IA[0], niveau: "texte", role: "regle", ancre: 0 } as (typeof derniere.elements)[number]);
    expect(regleSansAppel(f).map((m) => m.detail).join(" ")).toContain("question sur l'IA");
  });

  it("dite seulement : acceptée", () => {
    const f = copie(ficheErreurCorrigee);
    const derniere = f.scenes[f.scenes.length - 1];
    derniere.texteDit = `${QUESTIONS_IA[0]} ${derniere.texteDit}`;
    expect(regleSansAppel(f).filter((m) => m.detail.includes("question sur l'IA"))).toEqual([]);
  });
});

describe("les quatre formulations passent les contrôles en code, une à une", () => {
  it("chacune, dite avant la phrase sur l'entreprise et tirée : aucun défaut (même « Concrètement, … » : aucune expression marquante)", () => {
    for (const q of QUESTIONS_IA) {
      expect(controlerEcriture(avecQuestion(q), DEMANDE, { questionIa: q }), q).toEqual([]);
    }
  });
});

describe("découpage : consigne et règle 12", () => {
  it("la consigne dit que la question sur l'IA est dite, jamais écrite, sur aucune page", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("LA QUESTION SUR L'IA");
    expect(CONSIGNE_DECOUPAGE).toContain("est DITE, jamais écrite, sur aucune page");
    for (const q of QUESTIONS_IA) expect(CONSIGNE_DECOUPAGE).toContain(`« ${q} »`);
  });

  it("une version raccourcie écrite (« L'IA peut-elle vous aider ? ») est refusée, sur n'importe quelle page", () => {
    for (const raccourcie of ["L'IA peut-elle vous aider ?", "L'IA, que peut-elle faire pour vous ?", "L'IA peut-elle vous aider"]) {
      const f = copie(ficheErreurCorrigee);
      f.scenes[1].elements.push({ id: "eq", type: "ligne", texte: raccourcie, niveau: "texte", role: "regle", ancre: 0 } as (typeof f.scenes)[number]["elements"][number]);
      expect(regleSansAppel(f).map((m) => m.detail).join(" "), raccourcie).toContain("question sur l'IA");
    }
  });

  it("toute ligne écrite qui finit par « ? » dans la dernière partie est refusée ; une affirmation sur l'IA reste permise", () => {
    const f = copie(ficheErreurCorrigee);
    const derniere = f.scenes[f.scenes.length - 1];
    derniere.elements.push({ id: "eq", type: "ligne", texte: "Prêt à essayer ?", niveau: "texte", role: "regle", ancre: 0 } as (typeof derniere.elements)[number]);
    expect(regleSansAppel(f).map((m) => m.detail).join(" ")).toContain("question sur l'IA");
    const g = copie(ficheErreurCorrigee);
    g.scenes[1].elements.push({ id: "ea", type: "ligne", texte: "L'IA trie vos devis", niveau: "texte", role: "regle", ancre: 0 } as (typeof g.scenes)[number]["elements"][number]);
    expect(regleSansAppel(g).filter((m) => m.detail.includes("question sur l'IA"))).toEqual([]);
  });
});

describe("découpage : la question écrite est refusée sur toute la page d'appel et dans les formes courtes", () => {
  type Elt = FicheTableau["scenes"][number]["elements"][number];
  const ligne = (texte: string) => ({ id: "eq", type: "ligne", texte, niveau: "texte", role: "regle", ancre: 0 }) as Elt;
  const refusee = (f: FicheTableau) => regleSansAppel(f).some((m) => m.detail.includes("question sur l'IA"));

  it("« Que peut faire l'IA pour vous ? » écrite sur scenes[1] ou sur l'avant-dernière scène : refusée", () => {
    for (const rang of [1, -2]) {
      const f = copie(ficheErreurCorrigee);
      f.scenes.at(rang)!.elements.push(ligne("Que peut faire l'IA pour vous ?"));
      expect(refusee(f), String(rang)).toBe(true);
    }
  });

  it("« Et l'IA, pour vous ? » est refusée ; « L'IA, concrètement ? » aussi, sur une scène de la page d'appel (pas seulement la dernière)", () => {
    const f = copie(ficheErreurCorrigee);
    f.scenes[1].elements.push(ligne("Et l'IA, pour vous ?"));
    expect(refusee(f)).toBe(true);
    const g = copie(ficheErreurCorrigee);
    const avant = g.scenes.at(-2)!;
    avant.page = g.scenes.at(-1)!.page;
    avant.elements.push(ligne("L'IA, concrètement ?"));
    expect(regleSansAppel(g).filter((m) => m.sceneId === avant.id && m.detail.includes("question sur l'IA"))).toHaveLength(1);
  });

  it("« L'IA vous fait peur ? » et « L'IA au service client ? » sont acceptées sur scenes[1] (hors page d'appel)", () => {
    for (const texte of ["L'IA vous fait peur ?", "L'IA au service client ?", "L'IA, concrètement ?"]) {
      const f = copie(ficheErreurCorrigee);
      f.scenes[1].elements.push(ligne(texte));
      expect(refusee(f), texte).toBe(false);
    }
  });

  it("« L'IA, concrètement ? » n'est refusée que sur la page d'appel", () => {
    const f = copie(ficheErreurCorrigee);
    f.scenes[1].elements.push(ligne("L'IA, concrètement ?"));
    expect(refusee(f)).toBe(false);
  });

  it("toute ligne écrite finissant par « ? » sur la page d'appel est refusée, même sur une autre scène que la dernière", () => {
    const f = copie(ficheErreurCorrigee);
    const avant = f.scenes.at(-2)!;
    avant.page = f.scenes.at(-1)!.page;
    avant.elements.push(ligne("Prêt à essayer ?"));
    expect(refusee(f)).toBe(true);
  });

  it("l'accroche validée « Vos réponses d'IA sont vagues ? » passe toujours", () => {
    const f = copie(ficheErreurCorrigee);
    f.scenes[1].elements.push(ligne("Vos réponses d'IA sont vagues ?"));
    expect(refusee(f)).toBe(false);
  });

  it("une preuve qui cite la question mot pour mot n'est pas contrôlée (comme la règle 13)", () => {
    const f = copie(ficheErreurCorrigee);
    f.scenes[1].elements.push({ id: "ep", type: "preuve", preuveId: "p1", lignes: ["Que peut faire l'IA pour vous ?"], ancre: 0 } as unknown as Elt);
    expect(refusee(f)).toBe(false);
  });
});

describe("contrôle : la question est dite dans l'appel", () => {
  it("question en dernière phrase de « à retenir » (suivie de la phrase sur l'entreprise de l'appel) : refusée", () => {
    const e = structuredClone(exempleSansQuestion().ecriture);
    e.script.aRetenir = [...e.script.aRetenir, { dit: Q1, ecran: "" }];
    expect(codes(e)).toContain("question-ia");
  });
});

describe("le métier de l'exemple est borné", () => {
  it(`${METIER_EXEMPLE_MAX} caractères au plus`, () => {
    const e = exempleSansQuestion().ecriture;
    expect(METIER_EXEMPLE_MAX).toBe(60);
    expect(schemaEcriture.safeParse({ ...e, metierExemple: "m".repeat(60) }).success).toBe(true);
    // Le schéma envoyé à Claude ne porte pas maxLength : il n'a donc pas de borne dure, la coupe se fait après lecture.
    expect(schemaEcriture.safeParse({ ...e, metierExemple: "m".repeat(61) }).success).toBe(true);
  });

  it("l'estimation compte trois métiers de la longueur maximale", () => {
    expect(OPTIONS_ESTIMATION.metiersRecents).toHaveLength(3);
    for (const m of OPTIONS_ESTIMATION.metiersRecents!) expect(m).toHaveLength(METIER_EXEMPLE_MAX);
  });
});

describe("le prix annoncé compte la question et les métiers récents", () => {
  it("la requête d'estimation porte la question la plus longue et trois métiers longs : au moins aussi grosse que toute requête réelle", () => {
    expect(OPTIONS_ESTIMATION.questionIa).toBe([...QUESTIONS_IA].sort((a, b) => b.length - a.length)[0]);
    expect(OPTIONS_ESTIMATION.metiersRecents).toHaveLength(3);
    const ANGLE = { angle: "", douleur: "", accroches: [{ type: "situation-vecue", dit: "", ecran: "", pourquoi: "" }], retenue: 0, raison: "" } as never;
    const taille = (o: { questionIa?: string; metiersRecents?: string[] }) => {
      const r = requeteEcriture(DEMANDE, ANGLE, undefined, o);
      return [...r.systeme.map((b) => b.texte), ...r.messages.map((m) => m.contenu)].join("\n").length;
    };
    const reel = (q: string) => taille({ questionIa: q, metiersRecents: ["fleuriste", "notaire", "plombier"] });
    const reelLong = (q: string) => taille({ questionIa: q, metiersRecents: ["a", "b", "c"].map((c) => `${c} `.repeat(30).slice(0, METIER_EXEMPLE_MAX)) });
    for (const q of QUESTIONS_IA) expect(taille(OPTIONS_ESTIMATION as { questionIa?: string; metiersRecents?: string[] }), q).toBeGreaterThanOrEqual(Math.max(reel(q), reelLong(q)));
  });
});
