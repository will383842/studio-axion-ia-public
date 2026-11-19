import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  controlerMarque,
  couleursHorsCharte,
  etiquettesInterdites,
  jargon,
  montantsArgent,
  motsInterdits,
  nomsNonNeutres,
  policesHorsCharte,
  tutoiement,
  type EntreeControleMarque,
} from "@/moteurs/montage-tutoriel-outil/equipe/controle-marque";

const BON: EntreeControleMarque = {
  textes: [{ texte: "Vous voyez vos commandes en retard.", origine: "voix" }],
  couleurs: ["#B23F16", "#FAF9F5"],
  polices: ["Manrope"],
  noms: ["Espace démo · Stocks", "Entreprise exemple"],
  chiffresAffiches: false,
  mentionExemple: false,
};
const etat = (e: EntreeControleMarque, id: string): string => controlerMarque(e).find((c) => c.id === id)!.etat;

describe("mots interdits", () => {
  it.each(["Un résultat garanti.", "Garantie à vie", "Une équipe certifiée", "Qualiopi", "Nos intégrateurs", "Résultat à 100 %", "Un résultat garanti", "gar​anti"])("refuse « %s »", (t) => {
    expect(motsInterdits(t).length).toBeGreaterThan(0);
  });
  it("« certificat » est permis, comme dans la liste unique", () => {
    expect(motsInterdits("Un certificat de présence.")).toEqual([]);
    expect(motsInterdits("Vous voyez vos commandes.")).toEqual([]);
  });
});

describe("montants d'argent", () => {
  it.each(["1 200 €", "3k€", "500 euros", "49 $", "20 € HT"])("trouve « %s »", (t) => {
    expect(montantsArgent(`Cela coûte ${t} par mois.`).length).toBeGreaterThan(0);
  });
  it("« 12 commandes » : aucun montant", () => {
    expect(montantsArgent("Vous voyez 12 commandes en retard.")).toEqual([]);
  });
});

describe("étiquettes", () => {
  it("la suite en entier est refusée", () => {
    expect(etiquettesInterdites("Douleur · Solution · Exemple · À vous").length).toBeGreaterThan(0);
  });
  it("« Solution : » en carton du Studio est refusé", () => {
    expect(etiquettesInterdites("Solution :")).toEqual(["Solution"]);
    expect(etiquettesInterdites("Exemple")).toEqual(["Exemple"]);
    expect(etiquettesInterdites("À vous - maintenant")).toEqual(["À vous"]);
  });
  it("une phrase qui commence par le mot n'est pas une étiquette", () => {
    expect(etiquettesInterdites("Solution rapide pour vos stocks")).toEqual([]);
  });
  it("« exemple » dans un texte d'origine maquette est permis ; en carton du Studio, il est refusé", () => {
    const maquette = controlerMarque({ ...BON, textes: [{ texte: "Exemple", origine: "maquette" }] });
    expect(maquette.find((c) => c.id === "MARQUE-ETIQUETTES")!.etat).toBe("reussi");
    const studio = controlerMarque({ ...BON, textes: [{ texte: "Exemple", origine: "ecran-studio" }] });
    expect(studio.find((c) => c.id === "MARQUE-ETIQUETTES")!.etat).toBe("echoue");
  });
});

describe("tutoiement et jargon", () => {
  it("« tu » est refusé, le vouvoiement passe", () => {
    expect(tutoiement("Tu vois tes commandes.")).toBe(true);
    expect(tutoiement("Vous voyez vos commandes.")).toBe(false);
    expect(tutoiement("Une attitude attentive.")).toBe(false);
  });
  it("« workflow » est refusé", () => {
    expect(jargon("Un workflow simple")).toEqual(["workflow"]);
    expect(jargon("Un flux de travail simple")).toEqual([]);
  });
});

describe("couleurs, polices, noms", () => {
  it("terracotta, ivoire, gris neutre permis", () => {
    expect(couleursHorsCharte(["#B23F16", "#FAF9F5", "#777777"])).toEqual([]);
  });
  it("bleu #1E6FD9 → « bleu », jaune #F5C518 → « jaune »", () => {
    expect(couleursHorsCharte(["#1E6FD9"])[0]?.motif).toBe("bleu");
    expect(couleursHorsCharte(["#F5C518"])[0]?.motif).toBe("jaune");
  });
  it("police « Inter » refusée ; « sans-serif » seule en premier refusée ; Manrope permise", () => {
    expect(policesHorsCharte(["Inter"])).toHaveLength(1);
    expect(policesHorsCharte(["sans-serif"])).toHaveLength(1);
    expect(policesHorsCharte(["Manrope", "Axion Manrope"])).toEqual([]);
  });
  it("« Espace démo · Stocks » permis, « Ordiva » refusé, seule « Entreprise exemple » passe", () => {
    expect(nomsNonNeutres(["Espace démo · Stocks"])).toEqual([]);
    expect(nomsNonNeutres(["Ordiva"])).toEqual(["Ordiva"]);
    expect(nomsNonNeutres(["Entreprise exemple"])).toEqual([]);
    expect(nomsNonNeutres(["Entreprise Dupont"])).toEqual(["Entreprise Dupont"]);
    expect(nomsNonNeutres(["Espace démo · "])).toHaveLength(1);
  });
});

describe("controlerMarque", () => {
  it("tout bon : neuf contrôles réussis, tous bloquants", () => {
    const r = controlerMarque(BON);
    expect(r.map((c) => c.id)).toEqual(["MARQUE-MOTS", "MARQUE-ARGENT", "MARQUE-ETIQUETTES", "MARQUE-TUTOIEMENT", "MARQUE-JARGON", "MARQUE-COULEURS", "MARQUE-POLICE", "MARQUE-NOMS", "MARQUE-EXEMPLE"]);
    expect(r.every((c) => c.etat === "reussi" && c.bloquant)).toBe(true);
  });
  it("chaque défaut échoue le bon contrôle", () => {
    const t = (texte: string) => ({ ...BON, textes: [{ texte, origine: "voix" as const }] });
    expect(etat(t("Résultat garanti."), "MARQUE-MOTS")).toBe("echoue");
    expect(etat(t("Pour 1 200 € seulement."), "MARQUE-ARGENT")).toBe("echoue");
    expect(etat(t("Tu gagnes du temps."), "MARQUE-TUTOIEMENT")).toBe("echoue");
    expect(etat(t("Un workflow simple."), "MARQUE-JARGON")).toBe("echoue");
    expect(etat({ ...BON, couleurs: ["#1E6FD9"] }, "MARQUE-COULEURS")).toBe("echoue");
    expect(etat({ ...BON, polices: ["Inter"] }, "MARQUE-POLICE")).toBe("echoue");
    expect(etat({ ...BON, noms: ["Ordiva"] }, "MARQUE-NOMS")).toBe("echoue");
  });
  it("chiffres affichés sans mention « exemple » : MARQUE-EXEMPLE échoue ; avec la mention : réussi", () => {
    expect(etat({ ...BON, chiffresAffiches: true, mentionExemple: false }, "MARQUE-EXEMPLE")).toBe("echoue");
    expect(etat({ ...BON, chiffresAffiches: true, mentionExemple: true }, "MARQUE-EXEMPLE")).toBe("reussi");
  });
  it("fichier sans appel, sans disque, sans service ni fournisseur", () => {
    const t = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/controle-marque.ts", "utf8");
    for (const interdit of ["@/services", "@/fournisseurs", "node:fs", "fetch(", "Date.now", "claude"]) expect(t.toLowerCase()).not.toContain(interdit.toLowerCase());
  });
});
