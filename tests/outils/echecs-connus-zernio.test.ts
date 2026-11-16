// Garde des données de scripts/echecs-connus.json : les 6 échecs Zernio connus y figurent, exacts, sans doublon.
// Ajouté pour satisfaire la règle « données sous scripts/ = un test touché ». Lecture de fichier seule, aucun réseau.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Echec = { fichier: string; nom: string; note: string };
const brut = fs.readFileSync(path.resolve(__dirname, "../../scripts/echecs-connus.json"), "utf8");
const donnees = JSON.parse(brut) as { version: number; echecs: Echec[] };

const ATTENDUS: { fichier: string; nom: string }[] = [
  { fichier: "tests/g7a-programmer.test.ts", nom: "« Programmer les N » déverrouillé le plan propose les 5 versions dans l'ordre J à J+4, puis chacune part sur SON réseau avec sa version (essai)" },
  { fichier: "tests/g7a-programmer.test.ts", nom: "« Programmer les N » déverrouillé une version dont « Avant de publier » n'est pas coché n'est pas envoyée, la raison est rendue" },
  { fichier: "tests/r1-synchro-buffer.test.ts", nom: "R1 — synchronisation des états Buffer brouillon → programmée → publiée (lien, vidéo publiée) ; 15 min entre deux lectures ; aucune mutation" },
  { fichier: "tests/r1-synchro-buffer.test.ts", nom: "R1 — synchronisation des états Buffer échec chez Buffer → « échec » avec la raison, et une notification" },
  { fichier: "tests/r1-synchro-buffer.test.ts", nom: "R1 — synchronisation des états Buffer à vérifier : retrouvée par la synchronisation (reliée) — ou absente après 30 min → « absent », notification, renvoi possible" },
  { fichier: "tests/r1-synchro-buffer.test.ts", nom: "R1 — « Programmer les N » en réel respecte le mode brouillons dans Buffer, un message par version sur SON compte ; un second « Programmer » ne renvoie rien" },
];

describe("scripts/echecs-connus.json — échecs Zernio connus", () => {
  it("est un JSON valide avec une liste d'échecs", () => {
    expect(donnees.version).toBe(1);
    expect(Array.isArray(donnees.echecs)).toBe(true);
    expect(donnees.echecs.length).toBeGreaterThanOrEqual(ATTENDUS.length);
  });

  it("chaque entrée a fichier, nom et note non vides", () => {
    for (const e of donnees.echecs) {
      for (const champ of ["fichier", "nom", "note"] as const) {
        expect(typeof e[champ], `${champ} de ${e.fichier}`).toBe("string");
        expect(e[champ].trim().length, `${champ} vide pour ${e.fichier}`).toBeGreaterThan(0);
      }
    }
  });

  it("les 6 entrées Zernio (2 g7a-programmer, 4 r1-synchro-buffer) figurent, au nom exact, avec une note", () => {
    for (const a of ATTENDUS) {
      const trouvees = donnees.echecs.filter((e) => e.fichier === a.fichier && e.nom === a.nom);
      expect(trouvees.length, `${a.fichier} — ${a.nom}`).toBe(1);
      expect(trouvees[0].note.trim().length).toBeGreaterThan(0);
    }
    expect(donnees.echecs.filter((e) => e.fichier === "tests/g7a-programmer.test.ts")).toHaveLength(2);
    expect(donnees.echecs.filter((e) => e.fichier === "tests/r1-synchro-buffer.test.ts")).toHaveLength(4);
  });

  it("aucun doublon (fichier + nom)", () => {
    const cles = donnees.echecs.map((e) => `${e.fichier}\u0000${e.nom}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("rien de plus large qu'un nom exact : ni joker, ni nom réduit au nom de fichier, fichier précis", () => {
    for (const e of donnees.echecs) {
      expect(e.fichier, e.fichier).toMatch(/^tests\/(.+\/)?[^/*?]+\.test\.tsx?$/);
      expect(e.nom, e.nom).not.toMatch(/^\(fichier\)$|^\*+$|^\.\*$/);
      expect(e.nom.includes("*") && e.nom.endsWith("*"), e.nom).toBe(false);
      expect(fs.existsSync(path.resolve(__dirname, "../..", e.fichier)), `fichier absent : ${e.fichier}`).toBe(true);
    }
  });
});
