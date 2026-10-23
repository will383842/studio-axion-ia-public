/**
 * RÈGLES EN VIGUEUR (v3 du 14/10, gabarit cadré du 15/10) : chaque contrôle d'organisation et de vérité passe sur
 * l'exemple validé et rougit sur un contre-exemple ; le script jugé le 14/10 est refusé pour les défauts relevés ; une
 * trace ancienne est relue sans erreur ; les parties nommées tiennent leur contrat avec le découpage. Les contrôles du
 * gabarit cadré (une idée, un gain, une preuve) : `gabarit-cadre.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { normaliserScript, partiesAccordees, partiesDuScript, phrasesDites, type DemandeScriptTableau, type EcritureScript, type ScriptTableau } from "@/domaine/scripts-tableau";
import {
  controlerAccroche,
  controlerEcriture,
  controlerEtapes,
  controlerExemple,
  controlerOrganisation,
  controlerVerite,
  phrasesAJustifier,
  texteDitDe,
  versionRetenue,
} from "@/domaine/scripts-tableau-controles";
import { DEMANDE_MODELE, DEMANDE_MODELE_1210, ecritureModele, scriptAncien1210 } from "./modele-valide";

const codes = (d: { code: string }[]) => [...new Set(d.map((x) => x.code))];
const avec = (f: (s: ScriptTableau) => void): ScriptTableau => {
  const s = ecritureModele().script;
  f(s);
  return s;
};
const p = (dit: string, ecran = "Deux mots") => ({ dit, ecran });

describe("l'exemple validé passe chaque contrôle", () => {
  it("accroche, étapes, exemple, organisation, vérité", () => {
    const e = ecritureModele();
    expect(controlerAccroche(e.script)).toEqual([]);
    expect(controlerEtapes(e.script)).toEqual([]);
    expect(controlerExemple(e.script, DEMANDE_MODELE)).toEqual([]);
    expect(controlerOrganisation(e.script)).toEqual([]);
    expect(controlerVerite(texteDitDe(e.script), e.affirmations)).toEqual([]);
  });
});

describe("accroche : la douleur en une phrase", () => {
  it("refuse deux phrases ou une accroche trop longue à dire", () => {
    expect(codes(controlerAccroche(avec((s) => (s.accroche = [p("Un salarié colle un contrat dans ChatGPT."), p("Vous ne le savez pas.")]))))).toEqual(["accroche-longue"]);
    expect(codes(controlerAccroche(avec((s) => (s.accroche = [p("Un salarié de votre entreprise colle un contrat client entier dans ChatGPT pour le résumer vite")]))))).toEqual(["accroche-longue"]);
  });
});

describe("ce qui change : un constat à l'indicatif, puis une ou deux phrases concrètes (lot B1)", () => {
  it("refuse un constat vague (un mot nu, une ouverture vague) ; un ordre est refusé comme tutoriel", () => {
    expect(codes(controlerEtapes(avec((s) => (s.etapes[0].action.dit = "Ça change."))))).toEqual(["etape-vague"]);
    expect(codes(controlerEtapes(avec((s) => (s.etapes[1].action.dit = "Soyez précis avec vos données."))))).toEqual(["etape-imperatif"]);
    expect(codes(controlerEtapes(avec((s) => (s.etapes[1].action.dit = "Pensez à vos données."))))).toEqual(["etape-imperatif"]);
  });
  it("refuse un constat sans phrase concrète ou à l'impératif ; plus de numéro dit exigé ; le résultat n'est pas obligatoire", () => {
    expect(codes(controlerEtapes(avec((s) => (s.etapes[0].comment = []))))).toEqual(["etape-sans-comment"]);
    expect(controlerEtapes(avec((s) => (s.etapes[2].resultat = p("", ""))))).toEqual([]);
    expect(codes(controlerEtapes(avec((s) => (s.etapes[1].action.dit = "Trois. Effacez les coordonnées du client."))))).toEqual(["etape-imperatif"]);
    expect(codes(controlerEtapes(avec((s) => (s.etapes[0].action.dit = "Remplacez les noms par des lettres."))))).toEqual(["etape-imperatif"]);
  });
});

describe("exemple : l'avant et l'après", () => {
  it("refuse un exemple sans « Avant » ou sans « Maintenant »", () => {
    expect(codes(controlerExemple(avec((s) => s.exemple.phrases.splice(1, 1)), DEMANDE_MODELE))).toEqual(["exemple-avant-apres"]);
    expect(codes(controlerExemple(avec((s) => (s.exemple.phrases[2].dit = "Elle colle six lignes : Client A, sans signature.")), DEMANDE_MODELE))).toEqual(["exemple-avant-apres"]);
  });
});

describe("organisation", () => {
  it("refuse « problème » (dit ou écrit) et le retournement", () => {
    expect(codes(controlerOrganisation(avec((s) => (s.promesse = [p("Le vrai problème : personne ne leur a montré quoi coller.")]))))).toContain("libelle-probleme");
    expect(codes(controlerOrganisation(avec((s) => (s.douleur[0].ecran = "Le problème"))))).toContain("libelle-probleme");
  });
  it("refuse une partie manquante, une promesse de plus de deux phrases, un « à retenir » en plusieurs phrases", () => {
    expect(codes(controlerOrganisation(avec((s) => (s.aRetenir = []))))).toContain("partie-vide");
    expect(controlerOrganisation(avec((s) => (s.promesse = [p("Trois réflexes. Avant de coller.")])))).toEqual([]);
    expect(codes(controlerOrganisation(avec((s) => (s.promesse = [p("Voici trois réflexes. Ils sont simples. Le troisième se cache.")]))))).toContain("promesse-longue");
    expect(codes(controlerOrganisation(avec((s) => (s.aRetenir = [p("Vert. Orange. Rouge.")]))))).toContain("a-retenir-long");
  });
  it("refuse une douleur posée trop tard (après 15 s)", () => {
    expect(codes(controlerOrganisation(avec((s) => s.douleur.push(p("Vous l'apprenez par hasard, des semaines plus tard, en lisant un échange."), p("Et vous vous demandez ce qu'ils ont collé d'autre depuis des mois.")))))).toContain("douleur-tardive");
  });
  it("refuse une répétition, et un « à retenir » qui redit la clôture", () => {
    expect(codes(controlerOrganisation(avec((s) => s.exemple.phrases.push(p("Un client appelle.")))))).toEqual(["repetition"]);
    expect(codes(controlerOrganisation(avec((s) => (s.aRetenir = [p("Réservez un appel de diagnostic.")]))))).toContain("repetition");
  });
});

describe("vérité", () => {
  it("refuse les affirmations absolues, même justifiées", () => {
    const justif = [{ extrait: "x", nature: "fait" as const, pourquoi: "une justification assez longue" }];
    for (const t of ["Rien de privé n'est sorti.", "Il n'y a aucun risque.", "C'est 100 % sûr.", "Vous travaillez en toute sécurité.", "Résultat garanti.", "Ce document est conforme au RGPD.", "C'est illégal.", "Vous ne la retaperez plus jamais."]) {
      expect(codes(controlerVerite(t, justif)), t).toContain("affirmation-absolue");
    }
  });
  it("exige une justification pour chaque phrase absolue ou juridique", () => {
    expect(phrasesAJustifier("Le RGPD vous oblige. Écrivez ici. Rouge : jamais dans l'outil.")).toEqual(["Le RGPD vous oblige.", "Rouge : jamais dans l'outil."]);
    expect(codes(controlerVerite("Rouge : jamais dans l'outil.", []))).toEqual(["affirmation-non-verifiee"]);
    expect(codes(controlerVerite("Rouge : jamais dans l'outil.", [{ extrait: "jamais dans l'outil", nature: "consigne", pourquoi: "vrai" }]))).toEqual(["affirmation-non-verifiee"]);
    expect(controlerVerite("Rouge : jamais dans l'outil.", [{ extrait: "jamais dans l'outil", nature: "consigne", pourquoi: "Consigne de prudence : données sensibles." }])).toEqual([]);
  });
  it("une phrase absolue du témoin sans affirmation justifiée est refusée ; justifiée, elle passe", () => {
    const e = ecritureModele();
    e.script.etapes[1].comment[0].dit = "Jamais besoin de tout relire dans ses mails.";
    e.affirmations = [];
    expect(codes(controlerEcriture(e, DEMANDE_MODELE))).toEqual(["affirmation-non-verifiee"]);
    e.affirmations = [{ extrait: "Jamais besoin de tout relire dans ses mails", nature: "consigne", pourquoi: "Consigne de commodité : la fiche reprend le point du dossier à chaque échange." }];
    expect(controlerEcriture(e, DEMANDE_MODELE)).toEqual([]);
  });
});

describe("le script jugé par Will le 14/10 est refusé pour ses défauts", () => {
  // Le texte dit de la vidéo v-f1739d6a4f51, rangé au mieux dans la forme v3.
  const JUGE: EcritureScript = {
    idee: "",
    gain: { formule: "", unite: "" },
    metierExemple: "agence immobilière",
    script: {
      accroche: [p("Un salarié a collé un contrat client dans ChatGPT.")],
      douleur: [p("Vous ne le savez pas."), p("Vous l'apprenez par hasard, des semaines plus tard."), p("Et vous vous demandez : qu'ont-ils collé d'autre ?")],
      promesse: [p("Interdire ne sert à rien : ils continueront en cachette."), p("Le vrai problème : personne ne leur a montré quoi coller."), p("Voici une règle en trois couleurs, installée en quatre étapes.")],
      etapes: [
        { action: p("Un. Listez les documents que votre équipe touche chaque semaine."), comment: [p("Devis, contrats, fiches de paie, e-mails.")], resultat: p("", "") },
        { action: p("Deux. Classez-les en trois couleurs."), comment: [p("Vert, on colle. Orange, on retire les noms. Rouge, jamais.")], resultat: p("", "") },
        { action: p("Trois. Montrez le geste orange sur un vrai document."), comment: [p("Le nom du client devient Client A. Le montant devient X.")], resultat: p("", "") },
        { action: p("Quatre. Faites refaire ce geste à chacun, devant vous."), comment: [p("On retient ce qu'on a fait, pas ce qu'on a lu.")], resultat: p("", "") },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [p("Prenons une agence immobilière et ses compromis de vente."), p("Avant, l'assistante collait le compromis entier pour le résumer."), p("Maintenant, elle remplace les noms et l'adresse, puis colle."), p("Rien de privé n'est sorti."), p("Et le résumé est aussi bon.")],
      },
      aRetenir: [p("Listez. Classez. Montrez. Faites refaire.")],
      appel: [p("Axion-IA aide les équipes à apprendre sur leurs vraies tâches."), p("Pour savoir quoi apprendre à votre équipe, réservez un appel de diagnostic."), p("Le geste avant l'erreur.")],
    },
    motsDouleur: ["contrat client", "ChatGPT"],
    sources: [],
    affirmations: [],
    variantes: [],
    aPreparer: [],
  };
  it("« problème », promesse en trois phrases, sans gain, « rien n'est sorti », récapitulatif en liste", () => {
    const c = codes(controlerEcriture(JUGE, DEMANDE_MODELE));
    for (const attendu of ["libelle-probleme", "promesse-longue", "gain-absent", "affirmation-absolue", "affirmation-non-verifiee", "a-retenir-long", "a-retenir-liste"]) expect(c, attendu).toContain(attendu);
  });
});

describe("relecture tolérante d'une trace d'avant la v3", () => {
  it("le script du 12/10 (retournement, récapitulatif, étapes en « phrases ») est relu sans erreur, puis recontrôlé et refusé", () => {
    const ancien = scriptAncien1210();
    const s = normaliserScript(ancien);
    expect(s.promesse[0].dit).toBe("Le problème n'est pas l'outil.");
    expect(s.aRetenir[0].dit).toMatch(/^Une tâche\. Cinq jours\./);
    expect(s.etapes[0].action.dit).toMatch(/^Un\. Choisissez/);
    expect(s.etapes[0].resultat).toBeUndefined();
    expect(phrasesDites(ancien as unknown as ScriptTableau).map((x) => x.dit)).toContain("Vous ne la retaperez plus jamais.");
    const v = versionRetenue([{ passe: "relecture", ecriture: { script: ancien as unknown as ScriptTableau, motsDouleur: ["essayé"], sources: [], variantes: [], aPreparer: [] } as unknown as EcritureScript }], DEMANDE_MODELE_1210 as DemandeScriptTableau)!;
    expect(v.valide).toBe(false);
    expect(v.ecriture.script.promesse.length).toBe(4);
    expect(codes(v.defauts)).toEqual(expect.arrayContaining(["libelle-probleme", "gain-absent", "idee-absente", "affirmation-absolue"]));
  });
  it("une donnée illisible rend un script vide, jamais une erreur", () => {
    expect(normaliserScript(null)).toMatchObject({ accroche: [], etapes: [], aRetenir: [] });
    expect(normaliserScript({ etapes: [null, 3] }).etapes).toHaveLength(2);
  });
});

describe("contrat avec le découpage : les parties nommées", () => {
  it("chaque étape porte son numéro, son action et ses phrases concrètes, sous-chaînes exactes de son texte", () => {
    const parties = partiesDuScript(ecritureModele().script);
    const etapes = parties.filter((x) => x.partie === "etape");
    expect(etapes.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(etapes.map((x) => x.libelle)).toEqual(["Étape 1", "Étape 2", "Étape 3"]); // libellé interne du contrat, inchangé en B1
    expect(etapes.map((x) => x.etape!.resultat)).toEqual(["", "", ""]);
    for (const x of etapes) for (const morceau of [x.etape!.action, x.etape!.comment, x.etape!.resultat]) expect(x.texte).toContain(morceau);
    expect(parties.find((x) => x.partie === "exemple")!.mention).toBe("Exemple illustratif");
    expect(parties.find((x) => x.partie === "solution")!.libelle).toBe("Solution");
    expect(parties[0].ecran).toEqual(["Dossier client, collègue en congé"]);
  });
  it("les parties ne valent que si elles redonnent exactement le texte dit", () => {
    const e = ecritureModele();
    const parties = partiesDuScript(e.script);
    expect(partiesAccordees(parties, texteDitDe(e.script))).toBe(true);
    expect(partiesAccordees(parties, texteDitDe(e.script).replace("Réservez", "Prenez"))).toBe(false);
    expect(partiesAccordees([], "")).toBe(false);
    expect(partiesAccordees(undefined, "x")).toBe(false);
  });
});
