/** QUALL-1 : découpage du script (une seule source pour l'écran et le serveur). */
import { describe, expect, it } from "vitest";
import { chapitresDuScript, decouperEnPhrases, estLigneTitre, normaliserChapitres, titreDeduit } from "@/moteurs/montage-video-longue/decoupage";
import { dureeChapitreSansVoixMs } from "@/moteurs/montage-video-longue/minutage";
import { SCRIPT_ESSAI } from "./script-essai";

const phrases = (n: number) => Array.from({ length: n }, (_, i) => `Phrase numéro ${i + 1} du texte long.`).join(" ");

describe("QUALL-1 découpage : script d'essai", () => {
  const plan = chapitresDuScript(SCRIPT_ESSAI);
  it("4 chapitres aux vrais titres (les « : » du milieu ne comptent pas)", () => {
    expect(plan.map((c) => c.titre)).toEqual(["Le problème : compter à la main", "La solution : un tableau de bord qui se met à jour seul", "Les alertes : savoir avant de manquer", "Par où commencer"]);
    expect(plan.map((c) => c.id)).toEqual(["chapitre-1", "chapitre-2", "chapitre-3", "chapitre-4"]);
    expect(plan[0].texte.startsWith("Beaucoup de dirigeants")).toBe(true);
    expect(plan[3].texte.startsWith("Commencez petit.")).toBe(true);
  });
  it("aucun chapitre de moins de 10 s", () => {
    for (const c of plan) expect(dureeChapitreSansVoixMs(c.texte)).toBeGreaterThanOrEqual(10_000);
  });
  it("« Par où commencer » (sans ponctuation) est bien un titre", () => expect(estLigneTitre("Par où commencer")).toBe(true));
});

describe("QUALL-1 découpage : lignes-titres", () => {
  it("règle d'une ligne-titre", () => {
    expect(estLigneTitre("Le problème : compter")).toBe(true);
    for (const l of ["Une phrase.", "Pourquoi ?", "Attention !", "La suite…", "Un point ;", "Avant,", "Liste :", "- une puce", "• une puce", "* une puce", "1. premier", "2) second", "", "un deux trois quatre cinq six sept huit neuf dix onze douze treize"]) expect(estLigneTitre(l), l).toBe(false);
    expect(estLigneTitre("x".repeat(91))).toBe(false);
  });
  it("une liste à puces n'est pas prise pour un titre", () => {
    const c = chapitresDuScript(`- premier point\n- second point\n\n${phrases(6)}`);
    expect(c[0].titre).toBe("");
    expect(c[0].texte).toContain("- premier point - second point");
  });
  it("deux lignes-titres de suite : « A — B »", () => {
    const c = chapitresDuScript(`Partie\n\nSous-partie\n\n${phrases(6)}`);
    expect(c).toHaveLength(1);
    expect(c[0].titre).toBe("Partie — Sous-partie");
  });
  it("titre collé au paragraphe (même bloc)", () => {
    const c = chapitresDuScript(`Mon titre\n${phrases(6)}`);
    expect(c.map((x) => x.titre)).toEqual(["Mon titre"]);
    expect(c[0].texte.startsWith("Phrase numéro 1")).toBe(true);
  });
  it("titre seul en fin de script : texte du chapitre précédent", () => {
    const c = chapitresDuScript(`Un titre\n\n${phrases(6)}\n\nPour finir`);
    expect(c).toHaveLength(1);
    expect(c[0].texte.endsWith("Pour finir")).toBe(true);
  });
  it("avec « # », les titres sont ceux de l'utilisateur ; les chapitres courts sont fusionnés comme sans « # » (titres joints)", () => {
    const c = chapitresDuScript("# Un\nCourt.\n# Deux\nAussi court.");
    expect(c.map((x) => [x.titre, x.texte])).toEqual([["Un — Deux", "Court. Aussi court."]]);
  });
  it("script vide : aucun chapitre ; sans titre : un bloc = un chapitre", () => {
    expect(chapitresDuScript("  \n ")).toEqual([]);
    expect(chapitresDuScript(`${phrases(5)}\n\n${phrases(5)}`).map((c) => c.titre)).toEqual(["", ""]);
  });
});

describe("QUALL-1 découpage : fusion des chapitres courts", () => {
  it("un chapitre de 6 s est fusionné avec le suivant (les deux titres sont gardés)", () => {
    const court = "Une phrase courte ici.";
    const c = chapitresDuScript(`Court\n${court}\n\nLong\n${phrases(8)}\n\nAutre\n${phrases(8)}`);
    expect(c).toHaveLength(2);
    expect(c[0].titre).toBe("Court — Long");
    expect(c[0].texte.startsWith(court)).toBe(true);
  });
  it("le dernier trop court est fusionné avec le précédent, sans fin trompeuse : la fin (5 s) compte", () => {
    const c = normaliserChapitres([
      { id: "a", titre: "A", texte: phrases(8) },
      { id: "b", titre: "B", texte: "Mot." },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ id: "a", titre: "A — B" });
    expect(c[0].texte.endsWith("Mot.")).toBe(true);
  });
  it("égalité : les deux titres, le premier d'abord", () => {
    const c = normaliserChapitres([
      { id: "a", titre: "A", texte: "Un deux. Trois quatre." },
      { id: "b", titre: "B", texte: "Cinq six. Sept huit." },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].titre).toBe("A — B");
  });
  it("un seul chapitre court reste seul", () => expect(normaliserChapitres([{ id: "a", titre: "A", texte: "Oui." }])).toHaveLength(1));
});

describe("QUALL-1 découpage : titres déduits", () => {
  it("première proposition de 2 à 8 mots", () => {
    expect(titreDeduit("Le stock, c'est vital. Autre chose.")).toBe("Le stock");
    expect(titreDeduit("Commencez petit. Puis grandissez.")).toBe("Commencez petit");
  });
  it("sinon 6 premiers mots et « … »", () => {
    expect(titreDeduit("Beaucoup de dirigeants suivent encore leur stock dans un tableur.")).toBe("Beaucoup de dirigeants suivent encore leur…");
    expect(titreDeduit("Oui, bien sûr que oui nous irons demain matin.")).toBe("Oui, bien sûr que oui nous…");
  });
  it("vide : vide ; une phrase courte sans ponctuation est gardée sans point final", () => {
    expect(titreDeduit("")).toBe("");
    expect(titreDeduit("Bonjour.")).toBe("Bonjour");
  });
  it("découpe en phrases", () => expect(decouperEnPhrases("Un. Deux ! Trois ?  Quatre…  Cinq")).toEqual(["Un.", "Deux !", "Trois ?", "Quatre…", "Cinq"]));
});

describe("QUALL-1 découpage : chapitres déjà créés", () => {
  const essai = chapitresDuScript(SCRIPT_ESSAI);
  // Les 8 chapitres du constat : titre vide, texte = ligne-titre, puis le paragraphe.
  const huit = essai.flatMap((c, i) => [
    { id: `c${2 * i + 1}`, titre: "", texte: c.titre },
    { id: `c${2 * i + 2}`, titre: "", texte: c.texte },
  ]);
  it("les 8 chapitres redeviennent 4, titres retrouvés, ids des paragraphes gardés", () => {
    const r = normaliserChapitres(huit);
    expect(r.map((c) => c.titre)).toEqual(essai.map((c) => c.titre));
    expect(r.map((c) => c.id)).toEqual(["c2", "c4", "c6", "c8"]);
  });
  it("« Chapitre 3 » compte comme un titre manquant", () => {
    const r = normaliserChapitres([
      { id: "a", titre: "Chapitre 1", texte: "Mon titre" },
      { id: "b", titre: "Chapitre 2", texte: phrases(8) },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].titre).toBe("Mon titre");
  });
  it("un titre déjà posé n'est pas écrasé", () => {
    const r = normaliserChapitres([{ id: "a", titre: "Le mien", texte: phrases(8) }]);
    expect(r[0].titre).toBe("Le mien");
  });
});

describe("QUALL-8 : le titre de l'utilisateur n'est jamais perdu", () => {
  it("fusion d'un chapitre court : titre de l'autre gardé si le gardé n'en a pas, les deux joints sinon", () => {
    const court = "Un mot de plus pour finir.";
    const r1 = normaliserChapitres([
      { id: "a", titre: "Mon titre", texte: court },
      { id: "b", titre: "", texte: phrases(8) },
    ]);
    expect(r1).toHaveLength(1);
    expect(r1[0].titre).toBe("Mon titre");
    const r2 = normaliserChapitres([
      { id: "a", titre: "Premier", texte: court },
      { id: "b", titre: "Second", texte: phrases(8) },
    ]);
    expect(r2[0].titre).toBe("Premier — Second");
  });
});

describe("QUALL-8 : script avec « # »", () => {
  it("un « # Titre » sans texte devient le titre du chapitre suivant", () => {
    const r = chapitresDuScript(`# Intro\n# Le vrai titre\n${phrases(8)}\n# Suite\n${phrases(8)}`);
    expect(r.map((c) => c.titre)).toEqual(["Intro — Le vrai titre", "Suite"]);
  });
  it("un « # » seul est ignoré : jamais un titre ni un texte « # »", () => {
    const r = chapitresDuScript(`# Un\n${phrases(8)}\n#\n# Deux\n${phrases(8)}\n##`);
    expect(r.map((c) => c.titre)).toEqual(["Un", "Deux"]);
    expect(r.some((c) => /(^|\s)#+(\s|$)/.test(c.texte) || c.titre === "#")).toBe(false);
  });
  it("un chapitre « # » court est fusionné comme sans « # », titre gardé", () => {
    const r = chapitresDuScript(`# Court\nUn mot.\n# Long\n${phrases(8)}`);
    expect(r).toHaveLength(1);
    expect(r[0].titre).toBe("Court — Long");
  });
  it("côté serveur : un chapitre titré sans texte ouvre le suivant", () => {
    const r = normaliserChapitres([
      { id: "a", titre: "Ouverture", texte: "" },
      { id: "b", titre: "Corps", texte: phrases(8) },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].titre).toBe("Ouverture — Corps");
  });
});
