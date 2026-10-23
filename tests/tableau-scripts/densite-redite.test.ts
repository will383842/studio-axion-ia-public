/**
 * LOT B2b · deux ALERTES non bloquantes du script du tableau, jamais éliminatoires :
 *  - densité par scène : un constat (une scène) qui dit plus de 22 mots, soit plus de 8 s à 2,75 mots/s, la durée au-delà
 *    de laquelle le découpage coupe une scène (`SCENE_LONGUE_SEC`) ;
 *  - redite : un écran qui reprend 80 % des mots de la phrase dite ou plus, 3 mots au moins, mots uniques de 3 lettres ou plus
 *    (dit, écrit et sous-titre diraient trois fois la même chose).
 * Le témoin v5 n'en déclenche aucune.
 */
import { describe, expect, it } from "vitest";
import { QUESTIONS_IA } from "@/domaine/scripts-tableau";
import { aDesEliminatoires, controlerDensiteScene, controlerEcranRedit, controlerEcriture, DENSITE_SCENE_MOTS_MAX } from "@/domaine/scripts-tableau-controles";
import { DEBIT_TABLEAU_MOTS_PAR_SEC } from "@/domaine/duree-tableau";
import { SCENE_LONGUE_SEC } from "@/moteurs/montage-tableau/decoupage";
import { exempleV5 } from "./exemples-v5";

const v5 = () => exempleV5("01-continuite");
const codes = (d: { code: string }[]) => d.map((x) => x.code);

describe("densité par scène (alerte)", () => {
  it("le seuil est ce que la voix dit en SCENE_LONGUE_SEC secondes au débit du tableau", () => {
    expect(DENSITE_SCENE_MOTS_MAX).toBe(Math.floor(SCENE_LONGUE_SEC * DEBIT_TABLEAU_MOTS_PAR_SEC));
    expect(DENSITE_SCENE_MOTS_MAX).toBe(22);
  });
  it("le témoin v5 : aucune alerte", () => {
    expect(controlerDensiteScene(v5().ecriture.script)).toEqual([]);
  });
  it("un constat de plus de 22 mots : alerte non éliminatoire, nommant le constat", () => {
    const e = v5().ecriture;
    e.script.etapes[0].comment[0].dit = "Où en est le dossier, ce qui est promis, la suite, la date du prochain contact et le nom de la personne à joindre.";
    const d = controlerDensiteScene(e.script);
    expect(codes(d)).toEqual(["densite-scene"]);
    expect(d[0].eliminatoire).toBe(false);
    expect(d[0].message).toMatch(/Le constat 1 dit \d+ mots/);
    expect(aDesEliminatoires(controlerEcriture(e, v5().demande, { questionIa: QUESTIONS_IA[0] }).filter((x) => x.code === "densite-scene"))).toBe(false);
  });
});

describe("redite dit / écrit (alerte)", () => {
  it("le témoin v5 : aucun écran ne reprend sa phrase", () => {
    expect(controlerEcranRedit(v5().ecriture.script)).toEqual([]);
  });
  it("un écran identique à la phrase dite (casse, accents et ponctuation ignorés) : alerte non éliminatoire", () => {
    const e = v5().ecriture;
    e.script.douleur[0].ecran = "UN CLIENT APPELLE !";
    e.script.etapes[2].action.ecran = "Le client ne répète plus son histoire";
    const d = controlerEcranRedit(e.script);
    expect(codes(d)).toEqual(["ecran-redit", "ecran-redit"]);
    expect(d.every((x) => !x.eliminatoire)).toBe(true);
    expect(d[0].message).toContain("Un client appelle.");
  });
  it("faux positif connu de la sous-chaîne : « Il a un mail » dans « Il a un maillon manquant » n'est pas une redite", () => {
    const e = v5().ecriture;
    e.script.douleur[0].dit = "Il a un mail.";
    e.script.douleur[0].ecran = "Il a un maillon manquant";
    expect(controlerEcranRedit(e.script)).toEqual([]);
  });
  it("vraie redite : l'écran reprend les mots de la phrase dite, dans un autre ordre ou avec un mot en plus", () => {
    const e = v5().ecriture;
    e.script.douleur[0].dit = "Un client appelle chaque matin.";
    e.script.douleur[0].ecran = "Chaque matin, un client appelle encore";
    expect(codes(controlerEcranRedit(e.script))).toEqual(["ecran-redit"]);
  });
  it("mots UNIQUES de 3 lettres ou plus : « Le client appelle le cabinet. » avec l'écran « Le client appelle » n'est pas une redite", () => {
    const e = v5().ecriture;
    e.script.douleur[0].dit = "Le client appelle le cabinet.";
    e.script.douleur[0].ecran = "Le client appelle";
    expect(controlerEcranRedit(e.script)).toEqual([]);
    // Un mot répété à l'écran ne gonfle pas la part retrouvée : « client » ×3 ne couvre que 1 mot sur 3.
    e.script.douleur[0].dit = "Le client appelle chaque matin.";
    e.script.douleur[0].ecran = "Client client client client";
    expect(controlerEcranRedit(e.script)).toEqual([]);
    // La vraie redite (tous les mots de 3 lettres ou plus retrouvés) reste relevée.
    e.script.douleur[0].dit = "Le client appelle le cabinet.";
    e.script.douleur[0].ecran = "Le client appelle le cabinet";
    expect(codes(controlerEcranRedit(e.script))).toEqual(["ecran-redit"]);
  });
  it("un écran qui garde seulement des mots-clés n'est pas une redite", () => {
    const e = v5().ecriture;
    e.script.douleur[0].ecran = "Client";
    expect(controlerEcranRedit(e.script)).toEqual([]);
  });
  it("branchée dans controlerEcriture", () => {
    const e = v5().ecriture;
    e.script.douleur[0].ecran = "Un client appelle";
    expect(codes(controlerEcriture(e, v5().demande, { questionIa: QUESTIONS_IA[0] }))).toEqual(["ecran-redit"]);
  });
});
