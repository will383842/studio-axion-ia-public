/**
 * TEXTES-ANCIEN-OUTIL-2c : les textes des mesures et de la fiche du calendrier disent « l'ancien outil »,
 * « le réseau » ou « le diffuseur », jamais le nom de l'ancien outil. Seules des chaînes visibles changent.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDICATEURS } from "@/domaine/mesures-rangs";
import { DEFINITIONS_BUFFER } from "@/services/mesures-completes";
import { phraseEtat } from "@/components/calendrier/FicheEntree";
import { creerLecteurBuffer, statsDepuisPostBuffer, statsDepuisReponseBuffer } from "@/fournisseurs/mesures/buffer";

const NOM = /Buffer/;

function lignes(fichier: string, ancre: string): string[] {
  const trouvees = readFileSync(fichier, "utf8").split("\n").filter((l) => l.includes(ancre));
  expect(trouvees.length, `${fichier} : ancre « ${ancre} » introuvable`).toBeGreaterThan(0);
  return trouvees;
}

describe("TEXTES-ANCIEN-OUTIL-2c — mesures", () => {
  it("les définitions des relevés disent « sur le réseau »", () => {
    expect(Object.keys(DEFINITIONS_BUFFER)).toEqual(["vues", "portee", "likes", "commentaires", "partages", "partagesParPortee"]);
    for (const [cle, texte] of Object.entries(DEFINITIONS_BUFFER)) expect(texte, cle).not.toMatch(NOM);
    expect(DEFINITIONS_BUFFER.portee).toBe("Personnes atteintes, relevées sur le réseau.");
  });
  it("la ligne du journal dit « par l'ancien outil »", () => {
    for (const l of lignes("src/services/mesures-completes.ts", "Chiffres mis à jour :")) {
      expect(l).not.toMatch(NOM);
      expect(l).toContain("par l'ancien outil");
    }
  });
  it("le rang « Vues » ne nomme pas l'ancien outil", () => {
    const vues = INDICATEURS.find((i) => i.id === "vues");
    expect(vues?.definition).toBe("Vues relevées sur le réseau ou saisies.");
  });
});

describe("TEXTES-ANCIEN-OUTIL-2c — erreurs de lecture des mesures", () => {
  it("les messages montrés disent « l'ancien outil »", async () => {
    expect(() => statsDepuisPostBuffer(null)).toThrow("L'ancien outil n'a pas renvoyé cette publication.");
    expect(() => statsDepuisReponseBuffer({ errors: [{}] })).toThrow("L'ancien outil n'a pas pu lire cette publication.");
    const lecteur = creerLecteurBuffer({ BUFFER_API_KEY: "cle-essai-0123456789" }, (async () => new Response("{}", { status: 401 })) as typeof fetch);
    await expect(lecteur.lire("66f1a2b3c4d5e6f708192a3b")).rejects.toThrow("L'ancien outil refuse la clé.");
    await expect(lecteur.lire("!")).rejects.toThrow("Identifiant de l'ancien outil illisible.");
  });
});

describe("TEXTES-ANCIEN-OUTIL-2c — fiche du calendrier", () => {
  const e = { etat: "a_corriger", envoiAbsent: true } as unknown as Parameters<typeof phraseEtat>[0];
  it("envoi absent et brouillon déposé : « le diffuseur »", () => {
    const absent = phraseEtat(e);
    expect(absent).toBe("L'envoi n'est pas arrivé jusqu'au diffuseur. Rien n'est parti.");
    const brouillon = phraseEtat({ ...e, etat: "brouillon_buffer" } as typeof e);
    expect(brouillon).toBe("Brouillon déposé chez le diffuseur. Rien ne part tant que vous ne l'avez pas validé là-bas.");
    expect(`${absent} ${brouillon}`).not.toMatch(NOM);
  });
});
