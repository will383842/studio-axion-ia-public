import { describe, expect, it } from "vitest";
import { decouperLigne, listeDe, parserTables } from "./parseur";

describe("decouperLigne", () => {
  it("retire les bords et rogne les cellules", () => {
    expect(decouperLigne("| a |  b | c |")).toEqual(["a", "b", "c"]);
  });
  it("garde les cellules vides", () => {
    expect(decouperLigne("| a |  |  | d |")).toEqual(["a", "", "", "d"]);
  });
  it("lit \\| comme une barre dans la cellule", () => {
    expect(decouperLigne("| a \\| b | c |")).toEqual(["a | b", "c"]);
    expect(decouperLigne("| x \\|")).toEqual(["x |"]);
  });
  it("garde les accents et guillemets français", () => {
    expect(decouperLigne("| « j'ai un cabinet » | Réservez à l'œil |")).toEqual(["« j'ai un cabinet »", "Réservez à l'œil"]);
  });
});

describe("parserTables", () => {
  const texte = [
    "# Base X",
    "Explications | avec une barre qui ne doit pas compter.",
    "",
    "## table: demo",
    "",
    "Du texte avant le tableau.",
    "",
    "| code | nom | note |",
    "|---|:---:|---|",
    "| a.un | Éléonore | x \\| y |",
    "| a.deux |  |  |",
    "",
    "Texte après : ferme le tableau.",
    "| ceci | ne | compte | pas |",
    "",
    "## table: vide",
    "| code | nom |",
    "|---|---|",
  ].join("\n");

  it("lit les tables, ignore le texte autour, échappe les barres, garde les cellules vides", () => {
    const t = parserTables(texte, "essai.md");
    expect(Object.keys(t)).toEqual(["demo", "vide"]);
    expect(t.demo.colonnes).toEqual(["code", "nom", "note"]);
    expect(t.demo.lignes).toEqual([
      { code: "a.un", nom: "Éléonore", note: "x | y" },
      { code: "a.deux", nom: "", note: "" },
    ]);
    expect(t.vide.lignes).toEqual([]);
  });

  it("accepte les fins de ligne Windows", () => {
    expect(parserTables(texte.replace(/\n/g, "\r\n")).demo.lignes).toHaveLength(2);
  });

  it("refuse une ligne au mauvais nombre de colonnes, en disant laquelle", () => {
    const mauvais = "## table: t\n| code | nom |\n|---|---|\n| a | b | c |";
    expect(() => parserTables(mauvais, "f.md")).toThrow(/f\.md, ligne 4 : « t » attend 2 colonnes, la ligne en a 3/);
  });

  it("refuse un code en double ou vide", () => {
    expect(() => parserTables("## table: t\n| code | nom |\n|---|---|\n| a | 1 |\n| a | 2 |")).toThrow(/code en double dans « t » : a/);
    expect(() => parserTables("## table: t\n| code | nom |\n|---|---|\n|  | 1 |")).toThrow(/sans code/);
  });

  it("refuse deux tables du même nom et un en-tête avec colonne en double", () => {
    expect(() => parserTables("## table: t\n| code |\n|---|\n\n## table: t\n| code |\n|---|")).toThrow(/déjà définie/);
    expect(() => parserTables("## table: t\n| code | code |\n|---|---|")).toThrow(/colonne en double/);
  });

  it("accepte une table sans colonne code (pas de contrôle de clé)", () => {
    const t = parserTables("## table: t\n| a | b |\n|---|---|\n| 1 | 2 |\n| 1 | 2 |");
    expect(t.t.lignes).toHaveLength(2);
  });
});

describe("listeDe", () => {
  it("sépare sur « ; », rogne et retire les vides", () => {
    expect(listeDe("a ; b;  ; é ")).toEqual(["a", "b", "é"]);
    expect(listeDe("")).toEqual([]);
  });
});
