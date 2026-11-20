/**
 * Fidélité du texte (montage-tableau) : tests directs des fonctions exportées de `fidelite-texte.ts`
 * (valeurNombre, valeurEnLettres, nombresDits, sansTitreRepete, chiffresRetires, retablirChiffres, estDemande).
 * Entrées construites à la main, aucune donnée externe.
 */
import { describe, expect, it } from "vitest";
import { chiffresRetires, estDemande, nombresDits, retablirChiffres, sansTitreRepete, valeurEnLettres, valeurNombre } from "@/moteurs/montage-tableau/fidelite-texte";

describe("valeurNombre", () => {
  it("lit un nombre en chiffres", () => {
    expect(valeurNombre("12")).toBe(12);
  });
  it("lit un nombre à espace (« 1 200 ») comme 1200", () => {
    expect(valeurNombre("1 200")).toBe(1200);
  });
  it("lit un nombre en lettres, sans tenir compte de la casse ni de l'accent", () => {
    expect(valeurNombre("douze")).toBe(12);
    expect(valeurNombre("Trois")).toBe(3);
  });
  it("renvoie undefined pour un mot qui n'est pas un nombre, et pour « un »", () => {
    expect(valeurNombre("minutes")).toBeUndefined();
    expect(valeurNombre("un")).toBeUndefined();
  });
});

describe("valeurEnLettres", () => {
  it("lit les nombres composés", () => {
    expect(valeurEnLettres("vingt-deux")).toBe(22);
    expect(valeurEnLettres("soixante et onze")).toBe(71);
    expect(valeurEnLettres("quatre-vingt-dix")).toBe(90);
    expect(valeurEnLettres("deux cents")).toBe(200);
    expect(valeurEnLettres("mille")).toBe(1000);
  });
  it("renvoie undefined pour un texte qui n'est pas un nombre", () => {
    expect(valeurEnLettres("bonjour")).toBeUndefined();
    expect(valeurEnLettres("")).toBeUndefined();
  });
});

describe("nombresDits", () => {
  it("trouve les nombres écrits en lettres et les rend en chiffres", () => {
    expect([...nombresDits("Il est vingt-deux heures")]).toEqual(["22"]);
    expect([...nombresDits("trois relances et dix minutes")].sort()).toEqual(["10", "3"]);
  });
  it("ignore « un », « une » et les chiffres déjà écrits", () => {
    expect(nombresDits("Un mail et une réponse, 5 fois").size).toBe(0);
  });
});

describe("sansTitreRepete", () => {
  it("retire le titre répété en tête de phrase", () => {
    expect(sansTitreRepete("Faites rédiger les réponses aux mails.", "Faites rédiger")).toBe("les réponses aux mails.");
  });
  it("compare sans accent ni casse, et retire la ponctuation qui suit", () => {
    expect(sansTitreRepete("FAITES REDIGER : les réponses", "Faites rédiger")).toBe("les réponses");
  });
  it("rend la phrase d'origine si elle ne répète pas le titre", () => {
    expect(sansTitreRepete("Les réponses aux mails.", "Faites rédiger")).toBe("Les réponses aux mails.");
  });
  it("rend null si la phrase n'est que le titre", () => {
    expect(sansTitreRepete("Faites rédiger.", "Faites rédiger")).toBeNull();
  });
});

describe("chiffresRetires", () => {
  it("repère « dix minutes » devenu « des minutes »", () => {
    const r = chiffresRetires("Vous gagnez des minutes chaque jour.", "Vous gagnez dix minutes chaque jour.");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ dit: "dix", valeur: 10, mot: "minutes", forme: "remplace" });
  });
  it("repère « Trois tâches » devenu « Tâches »", () => {
    const r = chiffresRetires("Tâches déléguées.", "Trois tâches déléguées.");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valeur: 3, mot: "Tâches", forme: "absent", debut: 0 });
  });
  it("ne signale rien quand le nombre est resté écrit", () => {
    expect(chiffresRetires("Vous gagnez 10 minutes.", "Vous gagnez dix minutes.")).toEqual([]);
  });
  it("ne signale pas un numéro dit suivi d'une ponctuation", () => {
    expect(chiffresRetires("Classez les mails.", "Deux. Classez les mails.")).toEqual([]);
  });
  it("signale un oubli total seulement avec l'option `oublies`", () => {
    const ecrit = "Il lit et l'envoie.";
    const dit = "Il lit et l'envoie : trois minutes.";
    expect(chiffresRetires(ecrit, dit)).toEqual([]);
    const r = chiffresRetires(ecrit, dit, { oublies: true });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valeur: 3, mot: "minutes", forme: "oublie", debut: ecrit.length, fin: ecrit.length });
  });
  it("ne rétablit pas un oubli qui n'est pas une mesure (« trois fois »)", () => {
    expect(chiffresRetires("Testé.", "Testé trois fois.", { oublies: true })).toEqual([]);
  });
});

describe("retablirChiffres", () => {
  it("remet le chiffre à la place du mot remplaçant", () => {
    expect(retablirChiffres("Vous gagnez des minutes.", "Vous gagnez dix minutes.")).toBe("Vous gagnez 10 minutes.");
  });
  it("remet le chiffre devant un mot de début de phrase, minuscule rendue", () => {
    expect(retablirChiffres("Tâches déléguées.", "Trois tâches déléguées.")).toBe("3 tâches déléguées.");
  });
  it("aller-retour sur 3 phrases : l'écrit abîmé redevient l'écrit d'origine", () => {
    const origine = "Vous gagnez 10 minutes. Vous écrivez 3 mails. Il reste 5 tâches ouvertes.";
    const dit = "Vous gagnez dix minutes. Vous écrivez trois mails. Il reste cinq tâches ouvertes.";
    const abime = "Vous gagnez des minutes. Vous écrivez plusieurs mails. Il reste quelques tâches ouvertes.";
    expect(chiffresRetires(abime, dit)).toHaveLength(3);
    expect(retablirChiffres(abime, dit)).toBe(origine);
    expect(chiffresRetires(origine, dit)).toEqual([]);
  });
  it("laisse intact un écrit qui a déjà ses chiffres", () => {
    const t = "Vous gagnez 10 minutes.";
    expect(retablirChiffres(t, "Vous gagnez dix minutes.")).toBe(t);
  });
  it("écrit un oubli à la fin après deux-points, avec `oublies`", () => {
    expect(retablirChiffres("Il lit et l'envoie.", "Il lit et l'envoie : trois minutes.", { oublies: true })).toBe("Il lit et l'envoie : 3 minutes.");
  });
  it("sans `oublies`, l'oubli n'est pas rétabli", () => {
    expect(retablirChiffres("Il lit et l'envoie.", "Il lit et l'envoie : trois minutes.")).toBe("Il lit et l'envoie.");
  });
  it("n'écrit pas un oubli déjà écrit ailleurs sur la page (`dejaEcrits`)", () => {
    expect(retablirChiffres("Il lit et l'envoie.", "Il lit et l'envoie : trois minutes.", { oublies: true, dejaEcrits: new Set([3]) })).toBe("Il lit et l'envoie.");
  });
});

describe("estDemande", () => {
  it("vrai pour un verbe de demande au spectateur", () => {
    expect(estDemande("Réservez votre place aujourd'hui.")).toBe(true);
    expect(estDemande("Cliquez sur le lien en description.")).toBe(true);
  });
  it("vrai pour une question finale", () => {
    expect(estDemande("Et vous, que ferez-vous ?")).toBe(true);
  });
  it("faux pour une phrase affirmative sans verbe de demande", () => {
    expect(estDemande("L'IA répond aux mails répétitifs.")).toBe(false);
  });
});
