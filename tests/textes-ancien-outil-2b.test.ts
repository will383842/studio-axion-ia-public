/**
 * TEXTES-ANCIEN-OUTIL-2b : les messages d'envoi montrés (erreurs, journal, essai) disent « l'ancien outil »
 * et jamais le nom de l'ancien outil. Seules des chaînes visibles sont concernées : aucune clé, aucun code, aucun
 * comportement. (La ligne OUTIL_RETIRE de publications.ts est comparée ailleurs : elle n'est pas lue ici.)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHRASES_BUFFER } from "@/fournisseurs/publication/buffer";

const NOM = /Buffer/;

/** Les lignes de la source qui contiennent l'ancre donnée (l'ancre doit exister : sinon le test échoue). */
function lignes(fichier: string, ancre: string): string[] {
  const trouvees = readFileSync(fichier, "utf8").split("\n").filter((l) => l.includes(ancre));
  expect(trouvees.length, `${fichier} : ancre « ${ancre} » introuvable`).toBeGreaterThan(0);
  return trouvees;
}

describe("TEXTES-ANCIEN-OUTIL-2b — phrases d'erreur du fournisseur", () => {
  it("aucune phrase de PHRASES_BUFFER ne nomme l'ancien outil, et les clés restent les mêmes", () => {
    for (const [cle, phrase] of Object.entries(PHRASES_BUFFER)) expect(phrase, cle).not.toMatch(NOM);
    expect(Object.keys(PHRASES_BUFFER)).toEqual([
      "cleRefusee", "muet", "aVerifier", "panneEnvoi", "panne", "limite", "limiteCompte", "demandeRefusee", "commentaireInterdit",
      "motInterditTexte", "motInterditCommentaire", "motInterditTitre", "motInterditTexteAlternatif", "texteAlternatifAbsent",
      "publicationRefusee", "compteRefuse", "compteIntrouvable", "publicationIntrouvable", "incomprehensible", "incomprehensibleEnvoi",
    ]);
  });
  it("la phrase de la clé refusée dit « L'ancien outil »", () => {
    expect(PHRASES_BUFFER.cleRefusee).toBe("L'ancien outil refuse la clé du serveur : vérifiez-la.");
  });
});

describe("TEXTES-ANCIEN-OUTIL-2b — messages du service de publication", () => {
  const f = "src/services/publications.ts";
  it.each([
    ["essai d'envoi (journal)", "Essai d'envoi vers"],
    ["vidéo hors ligne", "elle ne peut pas partir"],
    ["nom de l'outil dans les messages (lui)", "const lui ="],
    ["programmation trop lointaine", "ou passez par un brouillon"],
    ["envoi absent", "n'avait rien reçu"],
  ])("%s ne nomme pas l'ancien outil", (_n, ancre) => {
    for (const l of lignes(f, ancre)) expect(l).not.toMatch(NOM);
  });
  it("les textes attendus", () => {
    const src = readFileSync(f, "utf8");
    expect(src).toContain("Essai d'envoi vers l'ancien outil");
    expect(src).toContain("ou passez par un brouillon chez le diffuseur");
    expect(src).toContain(`"L'ancien outil" : "L'outil de publication"`);
    expect(src).toContain("n'avait rien reçu pour");
    expect(src).toContain(`"l'ancien outil"`);
  });
});

describe("TEXTES-ANCIEN-OUTIL-2b — autres messages montrés", () => {
  it("suppression d'une vidéo : « un envoi vers l'ancien outil à vérifier »", () => {
    for (const l of lignes("src/services/suppression-video.ts", "a un envoi vers")) {
      expect(l).not.toMatch(NOM);
      expect(l).toContain("l'ancien outil");
    }
  });
  it("simulation : « Publication (ancien outil) », fournisseur prévu inchangé", () => {
    const src = readFileSync("src/fournisseurs/simulation/autres.ts", "utf8");
    expect(src).toContain('nom: "Publication (ancien outil)"');
    expect(src).not.toContain('nom: "Publication (Buffer)"');
    expect(src).toContain('reelPrevu: "Buffer"');
  });
  it("vitrine : « rien n'a été envoyé au diffuseur »", () => {
    for (const l of lignes("src/app/(studio)/styleguide/Vitrine.tsx", "notifier.essai(")) expect(l).not.toMatch(NOM);
    expect(readFileSync("src/app/(studio)/styleguide/Vitrine.tsx", "utf8")).toContain("rien n'a été envoyé au diffuseur");
  });
});
