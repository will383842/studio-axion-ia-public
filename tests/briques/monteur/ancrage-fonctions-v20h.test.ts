import { describe, expect, it } from "vitest";
import { ancreConsigne, instantDans, motCite, motsSansCoupe, type MotMonteur } from "../../../src/briques/monteur/ancrage";

const mot = (index: number, m: string, debut: number, montee: number | null): MotMonteur => ({
  index,
  mot: m,
  debutPriseSec: debut,
  finPriseSec: debut + 0.4,
  monteeSec: montee,
});

/** 20 mots, un par seconde ; les mots 0 et 1 sont coupés. */
const MOTS: MotMonteur[] = Array.from({ length: 20 }, (_, i) => mot(i, i === 5 ? "Certifexemple," : `m${i}`, i, i < 2 ? null : i - 2));

describe("instantDans", () => {
  it("lit mm:ss", () => {
    expect(instantDans("à 0:32")).toBe(32);
    expect(instantDans("vers 1:05")).toBe(65);
  });
  it("lit « 1 min 05 », « 2 minutes » et « à 32 s »", () => {
    expect(instantDans("à 1 min 05")).toBe(65);
    expect(instantDans("à 2 minutes")).toBe(120);
    expect(instantDans("à 32 s")).toBe(32);
    expect(instantDans("À 45 secondes")).toBe(45);
  });
  it("rend null sans temps, sur texte vide ou sur format invalide", () => {
    expect(instantDans("")).toBeNull();
    expect(instantDans("mets un effet ici")).toBeNull();
    expect(instantDans("à 0:5")).toBeNull();
  });
});

describe("motCite", () => {
  it("lit un mot entre guillemets", () => {
    expect(motCite("sur le mot « gratuit »")).toBe("gratuit");
    expect(motCite('sur "promo" svp')).toBe("promo");
  });
  it("lit « quand je dis … »", () => {
    expect(motCite("quand je dis Certifexemple")).toBe("Certifexemple");
    expect(motCite("Quand je parle de l'argent")).toBe("argent");
  });
  it("rend null sans mot cité ou sur texte vide", () => {
    expect(motCite("")).toBeNull();
    expect(motCite("ajoute un zoom")).toBeNull();
  });
});

describe("ancreConsigne", () => {
  it("ancre sur un temps cité (temps monté) et couvre 11 mots", () => {
    // monteeSec = index - 2 ; à 0:05 → premier mot gardé dont monteeSec ≥ 4,75 → index 7
    expect(ancreConsigne("à 0:05", MOTS)).toEqual({ debutMot: 7, finMot: 17 });
  });
  it("temps cité après la fin : dernier mot gardé", () => {
    expect(ancreConsigne("à 9:00", MOTS)).toEqual({ debutMot: 19, finMot: 19 });
  });
  it("ancre sur un mot cité, accents et ponctuation ignorés", () => {
    expect(ancreConsigne("quand je dis certifexemple", MOTS)).toEqual({ debutMot: 5, finMot: 15 });
  });
  it("mot cité introuvable : repli sur l'instant de la prise", () => {
    expect(ancreConsigne("quand je dis zzz", MOTS, 10)).toEqual({ debutMot: 10, finMot: 19 });
  });
  it("sans rien : premier mot gardé ; ignore les mots coupés", () => {
    expect(ancreConsigne("mets un effet", MOTS)).toEqual({ debutMot: 2, finMot: 12 });
    expect(ancreConsigne("mets un effet", MOTS, 0)).toEqual({ debutMot: 2, finMot: 12 });
  });
  it("aucun mot gardé ou liste vide", () => {
    expect(ancreConsigne("x", [mot(0, "a", 0, null), mot(1, "b", 1, null)])).toEqual({ debutMot: 0, finMot: 1 });
    expect(ancreConsigne("x", [])).toEqual({ debutMot: 0, finMot: 0 });
  });
  it("ne modifie pas l'entrée", () => {
    const copie = JSON.parse(JSON.stringify(MOTS));
    ancreConsigne("quand je dis certifexemple", MOTS, 3);
    expect(MOTS).toEqual(copie);
  });
});

describe("motsSansCoupe", () => {
  it("convertit les mots avec index et temps monté = début", () => {
    const entree = [
      { mot: "a", debutSec: 0, finSec: 0.5 },
      { mot: "b", debutSec: 0.5, finSec: 1 },
    ];
    const copie = JSON.parse(JSON.stringify(entree));
    expect(motsSansCoupe(entree)).toEqual([
      { index: 0, mot: "a", debutPriseSec: 0, finPriseSec: 0.5, monteeSec: 0 },
      { index: 1, mot: "b", debutPriseSec: 0.5, finPriseSec: 1, monteeSec: 0.5 },
    ]);
    expect(entree).toEqual(copie);
  });
  it("liste vide → liste vide", () => {
    expect(motsSansCoupe([])).toEqual([]);
  });
});
