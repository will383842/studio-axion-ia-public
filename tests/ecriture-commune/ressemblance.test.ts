/** C1.1 : ressemblance commune = copie + paraphrase + moule ; exclusions blanchies ; script de Will jamais contrôlé. */
import { describe, expect, it } from "vitest";
import {
  blanchirExclusions,
  comparerScripts,
  controlerRessemblance,
  copiesDe,
  moulesDe,
  paraphrasesDe,
  racine,
  sequencesDe,
} from "@/domaine/ecriture-commune/ressemblance";

const ANCIEN = "Chaque lundi, vous triez trente mails à la main. Alors on a branché un robot qui classe tout seul. Résultat : six heures gagnées par semaine.";

describe("racine", () => {
  it("rapproche les formes d'un même mot", () => {
    expect(racine("classent")).toBe(racine("classe"));
    expect(racine("heures")).toBe(racine("heure"));
    expect(racine("gagnées")).toBe(racine("gagner"));
  });
});

describe("copie", () => {
  it("détecte une suite de 5 mots reprise", () => {
    const nouveau = "Pourtant on a branché un robot qui classe tout seul chez un notaire.";
    expect(copiesDe(nouveau, [ANCIEN]).length).toBeGreaterThan(0);
  });
  it("ne signale rien pour un texte différent", () => {
    expect(copiesDe("Un devis part en deux minutes depuis le téléphone du plombier.", [ANCIEN])).toEqual([]);
  });
});

describe("paraphrase", () => {
  it("détecte la même phrase reformulée (mêmes mots pleins, ordre changé)", () => {
    const nouveau = "Tout seul, le robot branché classe alors vos mails.";
    expect(copiesDe(nouveau, [ANCIEN])).toEqual([]);
    expect(paraphrasesDe(nouveau, [ANCIEN]).length).toBeGreaterThan(0);
  });
  it("ne signale pas deux phrases de sujets différents", () => {
    expect(paraphrasesDe("Un devis part en deux minutes depuis le téléphone du plombier.", [ANCIEN])).toEqual([]);
  });
  it("ne compte pas une phrase de moins de 4 mots pleins", () => {
    expect(paraphrasesDe("Six heures gagnées.", ["Six heures gagnées."])).toEqual([]);
  });
});

describe("moule", () => {
  it("détecte la même charpente de phrase avec d'autres mots pleins", () => {
    const a = "Avant, vous passiez des heures à trier vos factures, et pour quoi ?";
    const b = "Avant, vous perdiez des journées à relire vos contrats, et pour quoi ?";
    expect(moulesDe(a).size).toBeGreaterThan(0);
    const r = comparerScripts(b, [a]);
    expect(r.moules.length).toBeGreaterThan(0);
    expect(r.copies).toEqual([]);
  });
  it("une phrase sans charpente commune ne ressemble pas", () => {
    const r = comparerScripts("Le devis part seul, le client signe depuis son canapé.", [ANCIEN]);
    expect(r.moules).toEqual([]);
  });
});

describe("exclusions blanchies dans le texte brut", () => {
  it("la promesse que le cas doit redire n'est jamais comptée", () => {
    const promesse = "on a branché un robot qui classe tout seul";
    const nouveau = "Pourtant on a branché un robot qui classe tout seul chez un notaire.";
    expect(comparerScripts(nouveau, [ANCIEN], [promesse]).copies).toEqual([]);
  });
  it("le pliage des accents garde la longueur : mêmes positions", () => {
    const t = "Élève très pressé : démarrage été";
    const r = blanchirExclusions(t, ["démarrage ete"]);
    expect(r.length).toBe(t.length);
    expect(r).not.toContain("marrage");
  });
  it("limite de mot : « AUTO » ne blanchit pas l'intérieur de « automatisé »", () => {
    const t = "Le flux automatisé tourne. Il est auto, dit-on, et autonome.";
    const r = blanchirExclusions(t, ["AUTO"]);
    expect(r).toContain("automatisé");
    expect(r).toContain("autonome");
    expect(r).not.toContain("auto,");
    expect(r.length).toBe(t.length);
  });
  it("espaces doublés et retours à la ligne : le passage est blanchi quand même", () => {
    const t = "On doit commenter le mot  à\ncommenter  ici, pas ailleurs.";
    const r = blanchirExclusions(t, ["mot à commenter"]);
    expect(r).not.toContain("commenter ici");
    expect(r).not.toMatch(/mot/);
    expect(r.length).toBe(t.length);
    expect(blanchirExclusions("Le  mot\n à  commenter.", ["mot  à\ncommenter"])).not.toMatch(/mot/);
  });
  it("sans exclusion le texte est rendu tel quel", () => {
    expect(blanchirExclusions("Bonjour.", [])).toBe("Bonjour.");
  });
});

describe("verdict", () => {
  it("un script collé par Will (origine « will ») n'est jamais contrôlé", () => {
    const r = controlerRessemblance({ texte: ANCIEN, anciens: [ANCIEN], origine: "will" });
    expect(r.controle).toBe(false);
    expect(r.ressemble).toBe(false);
  });
  it("un script de Claude identique à un ancien est refusé", () => {
    const r = controlerRessemblance({ texte: ANCIEN, anciens: [ANCIEN], origine: "claude" });
    expect(r.controle).toBe(true);
    expect(r.ressemble).toBe(true);
  });
  it("sans ancien script : rien à comparer", () => {
    expect(controlerRessemblance({ texte: ANCIEN, anciens: [], origine: "claude" }).ressemble).toBe(false);
  });
});

describe("compatibilité", () => {
  it("sequencesDe reste exporté", () => {
    expect(sequencesDe("Avant c'était trier les candidatures", 4).length).toBeGreaterThan(0);
  });
});
