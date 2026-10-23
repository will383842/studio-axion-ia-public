/**
 * Lot B1 (décision D1 de Will, 18/10) : le tableau n'écrit plus de TUTORIEL à l'impératif. Le corps dit ce qui change
 * (constats à l'indicatif, aucun numéro dit), la douleur pose une question au spectateur, le témoin v5 passe tout, le
 * script du 18/10 (« Un. Listez… Deux. Cochez… Trois. Écrivez… ») est refusé, et un texte de Will n'est jamais contrôlé.
 */
import { describe, expect, it } from "vitest";
import { QUESTIONS_IA, type DemandeScriptTableau, type ScriptTableau } from "@/domaine/scripts-tableau";
import {
  ETAPES_MAX,
  aDesEliminatoires,
  controlerARetenir,
  controlerEcriture,
  controlerEtapes,
  controlerPositionnement,
  controlerPromesse,
  controlerQuestionSpectateur,
  controlerRediteAccroche,
} from "@/domaine/scripts-tableau-controles";
import { pastillesTexteTableau } from "@/domaine/relecture-tableau";
import { exempleV4 } from "./exemples-v4";
import { exempleV5 } from "./exemples-v5";

const v5 = () => exempleV5("01-continuite");
const OPT = { questionIa: QUESTIONS_IA[0] };
const codes = (d: { code: string }[]) => [...new Set(d.map((x) => x.code))];
const avec = (f: (s: ScriptTableau) => void): ScriptTableau => {
  const s = v5().ecriture.script;
  f(s);
  return s;
};
const p = (dit: string, ecran = "Deux mots") => ({ dit, ecran });

describe("le témoin v5 (ce qui change)", () => {
  it("passe TOUS les contrôles, sans aucune remarque", () => {
    const e = v5();
    expect(controlerEcriture(e.ecriture, e.demande, OPT)).toEqual([]);
  });
  it("le nombre d'étapes tient en 3 au plus", () => {
    expect(ETAPES_MAX).toBe(3);
    const quatre = avec((s) => s.etapes.push({ action: p("Le suivi se met à jour sans qu'on y pense."), comment: [p("La fiche reste à jour.")] }));
    expect(codes(controlerEtapes(quatre))).toEqual(["nombre-etapes"]);
  });
});

describe("le tutoriel numéroté est refusé", () => {
  const tutoriel = (): ScriptTableau =>
    avec((s) => {
      s.etapes[0].action.dit = "Un. Listez vos dossiers en cours.";
      s.etapes[1].action.dit = "Deux. Cochez ceux qui dépendent d'une seule personne.";
      s.etapes[2].action.dit = "Trois. Écrivez trois lignes dans chaque fiche.";
    });
  it("« Un. Listez… Deux. Cochez… Trois. Écrivez… » lève etape-imperatif, éliminatoire, une fois par étape", () => {
    const d = controlerEtapes(tutoriel());
    expect(d.filter((x) => x.code === "etape-imperatif")).toHaveLength(3);
    expect(aDesEliminatoires(d)).toBe(true);
    expect(codes(d)).not.toContain("etape-numero");
  });
  it("un impératif sans numéro est refusé aussi", () => {
    expect(codes(controlerEtapes(avec((s) => (s.etapes[1].action.dit = "Effacez les coordonnées du client."))))).toEqual(["etape-imperatif"]);
  });
  it("l'ancien témoin (tutoriel de la v4) est refusé par le programme", () => {
    const e = exempleV4("01-formation");
    const d = controlerEcriture(e.ecriture, e.demande, OPT);
    expect(d.filter((x) => x.code === "etape-imperatif")).toHaveLength(3);
    expect(aDesEliminatoires(d)).toBe(true);
  });
  it("pas de faux positif : indicatif, « on », 1re personne du pluriel, nom en -ez", () => {
    for (const a of ["Le nom du client devient Client A.", "On écrit trois lignes dans la fiche.", "Prenons le cas d'un cabinet.", "Chez vous, la fiche se remplit seule.", "Un seul clic met la fiche à jour."]) {
      expect(controlerEtapes(avec((s) => (s.etapes[0].action.dit = a))), a).toEqual([]);
    }
  });
  it("un numéro dit n'est plus exigé", () => {
    expect(controlerEtapes(v5().ecriture.script)).toEqual([]);
  });
});

describe("la promesse n'annonce plus un nombre d'étapes", () => {
  it("le témoin passe ; « Trois réflexes à prendre » est une remarque, jamais éliminatoire", () => {
    expect(controlerPromesse(v5().ecriture.script)).toEqual([]);
    const d = controlerPromesse(avec((s) => (s.promesse[0].dit = "Trois réflexes à prendre avant de reprendre un dossier.")));
    expect(codes(d)).toEqual(["promesse-nombre"]);
    expect(aDesEliminatoires(d)).toBe(false);
  });
  it("un nombre qui n'annonce pas des étapes (« trois lignes ») n'est pas relevé", () => {
    expect(controlerPromesse(avec((s) => (s.promesse[0].dit = "Un dossier se reprend en lisant trois lignes.")))).toEqual([]);
  });
});

describe("question au spectateur et « à retenir »", () => {
  it("la douleur ou la promesse pose une question ; sinon une remarque (non éliminatoire)", () => {
    expect(controlerQuestionSpectateur(v5().ecriture.script)).toEqual([]);
    const d = controlerQuestionSpectateur(avec((s) => (s.douleur[4].dit = "Chez vous, personne ne reprend ce dossier.")));
    expect(codes(d)).toEqual(["question-spectateur"]);
    expect(aDesEliminatoires(d)).toBe(false);
  });
  it("la question sur l'IA de la fin ne compte pas comme question au spectateur", () => {
    const d = controlerQuestionSpectateur(avec((s) => (s.douleur[4].dit = "Chez vous, personne ne reprend ce dossier.")));
    expect(d).toHaveLength(1);
  });
  it("« à retenir » (ou le résultat de l'exemple) qui redit l'accroche est relevé, jamais éliminatoire", () => {
    expect(controlerRediteAccroche(v5().ecriture.script)).toEqual([]);
    const d = controlerRediteAccroche(avec((s) => (s.aRetenir[0].dit = "Le seul qui connaît un dossier client part en congé.")));
    expect(codes(d)).toEqual(["redit-accroche"]);
    expect(aDesEliminatoires(d)).toBe(false);
    const r = controlerRediteAccroche(avec((s) => (s.exemple.phrases[2].dit = "Maintenant, le dossier client reste connu quand le seul collègue est en congé.")));
    expect(codes(r)).toEqual(["redit-accroche"]);
  });
  it("branchés dans controlerEcriture, sans éliminer le script", () => {
    const e = v5();
    e.ecriture.script.douleur[4].dit = "Chez vous, personne ne reprend ce dossier.";
    const d = controlerEcriture(e.ecriture, e.demande, OPT).filter((x) => x.code === "question-spectateur");
    expect(d).toHaveLength(1);
    expect(d[0].eliminatoire).toBe(false);
  });
});

describe("« à retenir » n'est pas pris pour une liste de verbes quand les constats sont à l'indicatif", () => {
  it("le premier mot d'un constat (« Le », « À ») n'est pas un verbe des étapes", () => {
    const e = v5().ecriture;
    e.script.aRetenir[0].dit = "Une fiche tenue à jour évite d'appeler le collègue absent.";
    e.idee = e.script.aRetenir[0].dit;
    expect(controlerARetenir(e)).toEqual([]);
  });
});

describe("le positionnement du lot A est éliminatoire pour les scripts de Claude", () => {
  const DEMANDE: DemandeScriptTableau = v5().demande;
  it("« faites-le vous-même » en clôture élimine le script", () => {
    const d = controlerPositionnement(avec((s) => (s.appel.at(-1)!.dit = "Faites-le vous-même.")));
    expect(codes(d)).toEqual(["positionnement"]);
    expect(d[0].eliminatoire).toBe(true);
  });
  it("branché dans controlerEcriture : le script est éliminé", () => {
    const e = v5();
    e.ecriture.script.appel.at(-1)!.dit = "À vous de jouer.";
    expect(aDesEliminatoires(controlerEcriture(e.ecriture, DEMANDE, OPT).filter((x) => x.code === "positionnement"))).toBe(true);
  });
});

describe("un texte de Will (collé, « J'ai déjà mon texte ») est pris à l'identique", () => {
  it("un tutoriel numéroté collé par Will ne lève aucune pastille de style ni de fond", () => {
    const lignes = [
      { id: "s1", dit: "Un. Listez vos dossiers en cours.", deWill: true as const },
      { id: "s2", dit: "Deux. Cochez ceux qui dépendent d'une seule personne.", deWill: true as const },
      { id: "s3", dit: "Faites-le vous-même, c'est simple.", deWill: true as const },
    ];
    expect(pastillesTexteTableau(lignes)).toEqual([]);
  });
});

describe("correctifs relecture B1", () => {
  it("un impératif dans le commentaire d'un constat est éliminatoire", () => {
    const d = controlerEtapes(avec((s) => {
      s.etapes[0].action.dit = "Le nom du client devient Client A.";
      s.etapes[0].comment = [p("Effacez aussi l'adresse. Gardez seulement la ville.")];
    }));
    expect(codes(d)).toContain("etape-imperatif");
    expect(aDesEliminatoires(d)).toBe(true);
  });
  it("un tutoriel dans la douleur ou l'exemple est éliminatoire", () => {
    const d = controlerEtapes(avec((s) => {
      s.douleur[1].dit = "Listez vos dossiers.";
      s.douleur[2].dit = "Cochez les urgents.";
      s.douleur[3].dit = "Écrivez trois lignes.";
    }));
    expect(codes(d)).toContain("etape-imperatif");
  });
  it("impératifs non en -ez (faites, dites, ne collez jamais)", () => {
    for (const a of ["Faites la liste des dossiers.", "Dites-lui le nom du client.", "Ne collez jamais le nom du client."]) {
      const d = controlerEtapes(avec((s) => (s.etapes[0].action.dit = a)));
      expect(codes(d), a).toContain("etape-imperatif");
    }
  });
  it("un constat numéroté à l'indicatif est une remarque non éliminatoire (etape-numero-dit)", () => {
    const d = controlerEtapes(avec((s) => (s.etapes[0].action.dit = "Un. Le nom du client devient Client A.")));
    expect(codes(d)).toEqual(["etape-numero-dit"]);
    expect(aDesEliminatoires(d)).toBe(false);
  });
});
