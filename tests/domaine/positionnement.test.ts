import { describe, expect, it } from "vitest";
import { diyImperatif, faitLeVousMeme, NOUVEAUTE_OUTIL, tutoriel, tutorielNumerote } from "@/domaine/positionnement";
import * as ancien from "@/domaine/qualite-script/regles/positionnement";

describe("positionnement partagé", () => {
  it("l'ancien module réexporte (aucun import cassé)", () => {
    expect(ancien.faitLeVousMeme).toBe(faitLeVousMeme);
    expect(ancien.NOUVEAUTE_OUTIL).toBe(NOUVEAUTE_OUTIL);
  });
  it("faux positifs : rien n'est signalé", () => {
    for (const t of ["Vous le faites vous-même chaque lundi.", "Vous n'avez plus à le faire vous-même.", "Essayez-le avec nous.", "Testez notre diagnostic.", "Réservez un appel."]) {
      expect(diyImperatif(t), t).toBeUndefined();
    }
    expect(NOUVEAUTE_OUTIL.test("la nouvelle loi")).toBe(false);
  });
  it("vrais positifs", () => {
    expect(diyImperatif("Listez les dossiers. Cochez ce qui manque. Écrivez trois lignes.")).toBeTruthy();
    expect(diyImperatif("Faites-le vous-même en dix minutes.")).toBeTruthy();
    for (const t of ["Testez-le ce soir.", "Installez-le demain.", "Copiez ce prompt.", "À vous de jouer.", "Lancez-vous."]) expect(diyImperatif(t), t).toBeTruthy();
  });
  it("faitLeVousMeme garde son comportement (conclusion)", () => {
    expect(faitLeVousMeme("Faites-le vous-même.")).toBeTruthy();
    expect(faitLeVousMeme("On s'en occupe pour vous, vous-même n'avez rien à faire.")).toBeUndefined();
  });
  it("faux positifs de la relecture : questions, inversions, faux amis, « faites le calcul », équipe", () => {
    for (const t of [
      "Savez-vous combien de devis dorment ? Avez-vous déjà perdu un client ? Pouvez-vous répondre ? Voulez-vous le voir ?",
      "Faites le calcul : dix heures par semaine.",
      "Faites le point avec nous.",
      "Faites-le tester par votre équipe.",
      "Testez-le avec votre équipe.",
      "Chez vous, assez de relances à la main.",
      "Avant, vous relanciez vous-même chaque client.",
      "Imaginez lundi matin. Votre assistante est absente. Envoyez-la à votre DAF.",
    ]) expect(diyImperatif(t), t).toBeUndefined();
  });
  it("« avec notre guide » ne dispense pas ; « avec notre équipe » dispense", () => {
    expect(diyImperatif("Faites-le vous-même avec notre guide.")).toBeTruthy();
    expect(faitLeVousMeme("Faites-le vous-même avec notre guide.")).toBeTruthy();
    expect(diyImperatif("Installez-le avec notre équipe.")).toBeUndefined();
  });
  it("trois impératifs doivent se SUIVRE ; au tutoiement, les verbes sans -ez comptent", () => {
    expect(tutoriel("Listez les dossiers. Cochez ce qui manque. Écrivez trois lignes.")).toBe(3);
    expect(tutoriel("Listez les dossiers. Un client attend. Cochez ce qui manque. Et ensuite ? Écrivez trois lignes.")).toBe(0);
    expect(tutoriel("Liste les dossiers. Coche ce qui manque. Écris trois lignes.", "tu")).toBe(3);
    expect(tutoriel("Liste les dossiers. Coche ce qui manque. Écris trois lignes.", "vous")).toBe(0);
  });
  it("au tutoiement : fais-le, teste-le, à toi de jouer en formule ; « toi-même » seul non", () => {
    for (const t of ["Fais-le toi-même.", "Teste-le ce soir.", "À toi de jouer.", "Lance-toi."]) expect(diyImperatif(t, "tu"), t).toBeTruthy();
    expect(diyImperatif("Avant, tu relançais toi-même chaque client.", "tu")).toBeUndefined();
  });
  it("dispenses : seulement quand elles ne sont pas l'ordre lui-même", () => {
    for (const t of ["Faites-le vous-même sans attendre.", "Faites-le vous-même, c'est simple pour vous.", "Vous-même, faites-le en dix minutes.", "Faites le vous-même.", "Testez par vous-même.", "Fais-le par toi-même."]) {
      expect(diyImperatif(t), t).toBeTruthy();
    }
    for (const t of ["Vous n'avez plus à le faire vous-même.", "Ne le faites pas vous-même.", "Installez-le avec notre équipe.", "Essayez-le avec nous.", "On le fait pour vous, sans que vous le fassiez vous-même."]) {
      expect(diyImperatif(t), t).toBeUndefined();
    }
  });
  it("numérotation : « Première étape : listez », « Étape 1, listez », « Étape 1 : … »", () => {
    expect(tutoriel("Première étape : listez les dossiers. Deuxième étape : cochez ce qui manque.")).toBe(2);
    expect(tutoriel("Étape 1, listez les dossiers. Étape 2, cochez ce qui manque.")).toBe(2);
    expect(tutoriel("Étape 1 : listez les dossiers. Étape 2 : écrivez trois lignes.")).toBe(2);
    expect(tutorielNumerote("Première étape : listez les dossiers. Deuxième étape : cochez ce qui manque.")).toBe(2);
  });
  it("trois impératifs séparés par des virgules : tutoriel (C96) mais pas tutoriel numéroté (C95)", () => {
    expect(tutoriel("Listez, cochez, écrivez, envoyez.")).toBeGreaterThanOrEqual(3);
    expect(tutorielNumerote("Listez, cochez, écrivez, envoyez.")).toBe(0);
    expect(tutoriel("Savez-vous, avez-vous, voulez-vous ?")).toBe(0);
    expect(tutoriel("Chez vous, assez de relances, nez au vent.")).toBe(0);
  });
});
