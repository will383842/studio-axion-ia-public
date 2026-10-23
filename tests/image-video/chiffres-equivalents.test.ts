/**
 * Panne du 15/10 (image C, chatbot) : le script écrivait « 23 h 14 » et Q05 le lisait « 23 h » + « 14 », absents de
 * l'image. Les écritures d'une même valeur se valent ; un chiffre vraiment absent de l'image reste refusé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { chiffresDeLaCarte, coherenceDe } from "@/domaine/image-video/carte";
import { chiffresDe } from "@/domaine/image-video/chiffres";
import { clesDeLaCarte } from "@/moteurs/montage-image-video/controles-scene";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { CONSIGNE_ECRITURE_IV } from "@/moteurs/montage-image-video/ecriture";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { fusionnerLectures, type LectureImage } from "@/moteurs/montage-image-video/lecture";
import { LECTURE_DEMO, lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { avecVersionsPrudentes } from "@/domaine/image-video/versions-prudentes";
import { cleFormule, lectureChiffres, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";

const carteC: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const ficheC = ficheSimulee("essai-c")!;
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(["0 demande perdue", "toujours"].map((f) => [cleFormule(f), "garder" as const]));

/** L'écran qui montre l'heure du message, réécrit (écran ET voix). */
function avecHeure(texteDit: string, ecrit: string): FicheImage {
  const f = structuredClone(ficheC);
  const e = f.ecrans.find((x) => x.textesEcran.some((t) => t.includes("23h14")))!;
  e.texteDit = texteDit;
  e.textesEcran = ["Situation type", `Message client entrant · *${ecrit}*`];
  e.surMot = [{ mot: 0, action: "apparait" }];
  return f;
}
const q05 = (f: FicheImage) => verifierScript(f, { carte: carteC, choixFormules: GARDER }).manquements.filter((m) => m.regle === "Q05" || m.regle === "Q04");

describe("chiffres équivalents (image C, 23h14)", () => {
  it("le script de référence passe", () => {
    expect(verifierScript(ficheC, { carte: carteC, choixFormules: GARDER }).manquements).toEqual([]);
  });

  for (const [dit, ecrit] of [
    ["Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "23h14"],
    ["Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "23 h 14"],
    ["Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "23h 14"],
    ["Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "23:14"],
    ["Voici une situation type. Son message arrive à 23 h 14, un soir.", "23h14"],
    ["Voici une situation type. Son message arrive à 23h14.", "23 h 14"],
  ] as const) {
    it(`accepté : dit « ${dit.slice(46)} », écrit « ${ecrit} »`, () => {
      expect(q05(avecHeure(dit, ecrit))).toEqual([]);
    });
  }

  it("refusé : « 22h14 » (écrit ou dit) n'est pas sur l'image", () => {
    const ecran = q05(avecHeure("Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "22h14"));
    expect(ecran.map((m) => m.message).join(" ")).toMatch(/« 22h14 » n'est pas sur l'image/);
    const voix = q05(avecHeure("Voici une situation type. Son message arrive à vingt-deux heures quatorze.", "23h14"));
    expect(voix.map((m) => m.message).join(" ")).toMatch(/« 22h14 » n'est pas sur l'image/);
    expect(q05(avecHeure("Voici une situation type. Son message arrive à 22 h 14.", "23h14")).length).toBeGreaterThan(0);
  });

  it("une heure impossible ou suivie d'une unité reste deux chiffres (aucun assouplissement)", () => {
    const vals = (t: string) => lectureChiffres(t).chiffres.map((c) => `${c.valeur}|${c.unite}`);
    expect(vals("23 h 14")).toEqual(["1394|heure"]);
    expect(vals("à 23 h 14, un client")).toEqual(["1394|heure"]);
    expect(vals("23 h 99")).toEqual(["23|h", "99|nombre"]);
    expect(vals("25 h 10")).toEqual(["25|h", "10|nombre"]);
    expect(vals("2 h 30 min")).toEqual(["2|h", "30|min"]);
    expect(vals("1 h 20 %")).toEqual(["1|h", "20|%"]);
    expect(vals("23 h")).toEqual(["23|h"]);
  });

  it("durées, pourcentages, plages et zéro : écritures équivalentes, même lecture", () => {
    const cle = (t: string) => lectureChiffres(t).chiffres.map((c) => (c.valeur === null ? c.brut.replace(/\s+/g, "").replace(/heures?sur/, "h/") : `${c.valeur}|${c.unite}`));
    for (const groupe of [
      ["4 sec", "4 s", "4 secondes", "quatre secondes"],
      ["2h", "2 h", "deux heures"],
      ["3h", "3 h", "trois heures"],
      ["80%", "80 %", "quatre-vingts pour cent"],
      ["0 demande", "zéro demande"],
    ]) for (const t of groupe) expect(cle(t), t).toEqual(cle(groupe[0]!));
    for (const t of ["24h/24", "24 h/24", "vingt-quatre heures sur vingt-quatre"]) expect(lectureChiffres(t).chiffres.map((c) => c.unite)).toEqual(["autre"]);
  });

  it("la consigne d'écriture demande de recopier exactement l'écriture de la carte, sans en imposer une autre", () => {
    expect(CONSIGNE_ECRITURE_IV).toMatch(/recopie exactement l'écriture de la carte/);
    expect(CONSIGNE_ECRITURE_IV).not.toMatch(/pas « 23 h 14 »/);
  });
});

describe("image qui écrit « 23 h 14 » (même lecture que le script)", () => {
  /** La carte C, dont l'image écrit l'heure avec des espaces. */
  function carteEspacee(ecrit: string): CarteImage {
    const c = structuredClone(carteC);
    c.noeuds.find((n) => n.id === "n01")!.detail = ecrit;
    c.chiffres = chiffresDeLaCarte(c);
    return c;
  }

  it("l'inventaire de l'image lit une seule heure, 1394|heure, écriture gardée", () => {
    for (const ecrit of ["23 h 14", "23h 14", "23 h14"]) {
      expect(chiffresDe(ecrit).map((c) => `${c.valeur}|${c.unite}|${c.brut}`), ecrit).toEqual([`1394|heure|${ecrit}`]);
      const c = carteEspacee(ecrit);
      expect(c.chiffres.filter((x) => x.dansNoeud === "n01").map((x) => `${x.valeur}|${x.unite}`)).toEqual(["1394|heure"]);
      expect([...clesDeLaCarte(c).values()]).toContain("1394|heure");
      expect([...clesDeLaCarte(c).values()]).not.toContain("23|h");
    }
  });

  it("le script de référence passe sur cette image (Q04 ne réclame plus « 23 h »)", () => {
    const c = carteEspacee("23 h 14");
    expect(verifierScript(ficheC, { carte: c, choixFormules: GARDER }).manquements).toEqual([]);
    expect(verifierScript(avecHeure("Voici une situation type. Son message arrive à vingt-trois heures quatorze.", "23 h 14"), { carte: c, choixFormules: GARDER }).manquements).toEqual([]);
  });

  it("le produit annoncé au bandeau garde son total écrit « 6 h 20 »", () => {
    const c = structuredClone(carteC);
    c.bandeau = ["19 min gagnées par commande", "Sur 20 cmd/jour = 6 h 20 récupérées"];
    expect(coherenceDe(c).filter((x) => x.calcul.includes("×"))).toEqual([{ calcul: "19 × 20 = 6 h 20", ok: true }]);
    c.bandeau = ["19 min gagnées par commande", "Sur 20 cmd/jour = 6 h 10 récupérées"];
    expect(coherenceDe(c).filter((x) => x.calcul.includes("×"))).toEqual([{ calcul: "19 × 20 = 6 h 20 ≠ 6 h 10", ok: false }]);
  });

  it("les deux côtés gardent les mêmes refus : unité qui suit, heure impossible", () => {
    const vals = (t: string) => chiffresDe(t).map((c) => `${c.valeur}|${c.unite}`);
    expect(vals("2 h 30 min")).toEqual(["2|h", "30|min"]);
    expect(vals("1 h 20 %")).toEqual(["1|h", "20|%"]);
    expect(vals("23 h 99")).toEqual(["23|h", "99|nombre"]);
    expect(vals("25 h 10")).toEqual(["25|h", "10|nombre"]);
    for (const t of ["23 h 14", "2 h 30 min", "1 h 20 %", "23 h 99", "25 h 10", "23h14"]) {
      expect(lectureChiffres(t).chiffres.map((c) => `${c.valeur}|${c.unite}`), t).toEqual(vals(t));
    }
  });
});

/**
 * Symétrie stricte image × script (relecture de #252) : chaque écriture de l'image, écrite à l'identique, écrite
 * autrement, ou dite en lettres (en fin de phrase ET au milieu), passe Q04 et Q05 ; un chiffre absent est refusé.
 */
describe("table image × script : même lecture des deux côtés (Q04, Q05)", () => {
  /** La carte C dont le nœud n03 (« Réponse générée », sans détail) porte en plus l'écriture `ecrit`. */
  function carteAvec(ecrit: string): CarteImage {
    const c = structuredClone(carteC);
    c.noeuds.find((n) => n.id === "n03")!.detail = ecrit;
    c.chiffres = chiffresDeLaCarte(c);
    return c;
  }
  const verdict = (image: string, phrase: string, ecrit: string) =>
    verifierScript(avecHeure(`Voici une situation type. ${phrase}`, ecrit), { carte: carteAvec(image), choixFormules: GARDER }).manquements.filter(
      (m) => m.regle === "Q04" || m.regle === "Q05",
    );

  const TABLE: { image: string; ecrits: string[]; ditFin: string; ditMilieu: string; absents: { ecrit?: string; dit?: string }[] }[] = [
    { image: "23h14", ecrits: ["23h14", "23 h 14"], ditFin: "Son message arrive à vingt-trois heures quatorze.", ditMilieu: "Son message arrive à vingt-trois heures quatorze sans réponse.", absents: [{ ecrit: "22h14" }, { dit: "Son message arrive à vingt-deux heures quatorze." }] },
    { image: "23 h 14", ecrits: ["23 h 14", "23h14"], ditFin: "Son message arrive à vingt-trois heures quatorze.", ditMilieu: "Son message arrive à vingt-trois heures quatorze sans réponse.", absents: [{ ecrit: "22h14" }, { dit: "Son message arrive à vingt-deux heures quatorze." }] },
    { image: "6 h 20 récupérées", ecrits: ["6 h 20 récupérées", "6h20 récupérées"], ditFin: "Au total, on récupère six heures vingt.", ditMilieu: "On a six heures vingt récupérées chaque jour.", absents: [{ ecrit: "6 h 10 récupérées" }, { dit: "On a sept heures vingt récupérées chaque jour." }, { dit: "On a 6 h 10 récupérées chaque jour." }] },
    { image: "6 h 05 récupérées", ecrits: ["6 h 05 récupérées", "6h05 récupérées"], ditFin: "Au total, on récupère six heures cinq.", ditMilieu: "On a six heures cinq récupérées chaque jour.", absents: [{ ecrit: "6 h 10 récupérées" }, { dit: "Au total, on récupère six heures six." }, { dit: "On a six heures six récupérées chaque jour." }] },
    { image: "23 h 05", ecrits: ["23 h 05", "23h05"], ditFin: "Son message arrive à vingt-trois heures cinq.", ditMilieu: "Son message arrive à vingt-trois heures cinq sans réponse.", absents: [{ ecrit: "22h05" }, { dit: "Son message arrive à vingt-trois heures six." }] },
    { image: "23h05", ecrits: ["23h05", "23 h 05"], ditFin: "Son message arrive à vingt-trois heures cinq.", ditMilieu: "Son message arrive à vingt-trois heures cinq sans réponse.", absents: [{ dit: "Son message arrive à vingt-deux heures cinq." }] },
    { image: "2 h 15 par jour", ecrits: ["2 h 15 par jour", "2h15 par jour"], ditFin: "Chaque jour, on gagne deux heures quinze.", ditMilieu: "On gagne deux heures quinze par jour.", absents: [{ ecrit: "2 h 10 par jour" }, { dit: "On gagne sept heures vingt par jour." }] },
    { image: "6 h 20 min", ecrits: ["6 h 20 min", "6h 20 min"], ditFin: "Le gain est de six heures vingt minutes.", ditMilieu: "On gagne six heures vingt minutes chaque jour.", absents: [{ ecrit: "6 h 10 min" }, { dit: "On gagne sept heures vingt minutes chaque jour." }] },
    { image: "3h", ecrits: ["3h", "3 h"], ditFin: "On perd trois heures.", ditMilieu: "On perd trois heures chaque semaine.", absents: [{ ecrit: "4h" }, { dit: "On perd sept heures vingt chaque semaine." }] },
    { image: "4 sec", ecrits: ["4 sec", "4sec"], ditFin: "La réponse part en quatre secondes.", ditMilieu: "En quatre secondes la réponse part.", absents: [{ ecrit: "7 sec" }, { dit: "En sept secondes la réponse part." }] },
    { image: "Gagnez 2 h 5 000 € par mois", ecrits: ["Gagnez 2 h 5 000 € par mois"], ditFin: "Gagnez deux heures et cinq mille euros.", ditMilieu: "Gagnez deux heures et cinq mille euros par mois.", absents: [{ dit: "Gagnez deux heures et zéro euro par mois." }] },
    { image: "En 1 h 2 500 e-mails triés", ecrits: ["En 1 h 2 500 e-mails triés"], ditFin: "En une heure, deux mille cinq cents e-mails triés.", ditMilieu: "En une heure, deux mille cinq cents e-mails triés chaque jour.", absents: [{ dit: "En une heure, cinq cents e-mails triés chaque jour." }] },
    { image: "80 %", ecrits: ["80 %", "80%"], ditFin: "On en règle quatre-vingts pour cent.", ditMilieu: "Quatre-vingts pour cent sont réglés tout seuls.", absents: [{ ecrit: "70 %" }, { dit: "Soixante-dix pour cent sont réglés tout seuls." }] },
  ];

  for (const l of TABLE) {
    for (const ecrit of l.ecrits) {
      for (const [forme, phrase] of [
        ["écrit à l'identique dans la voix", `Il est écrit ${l.image}.`],
        ["écrit autrement dans la voix", `Il est écrit ${ecrit}.`],
        ["dit en fin de phrase", l.ditFin],
        ["dit au milieu d'une phrase", l.ditMilieu],
      ] as const) {
        it(`image « ${l.image} » × écran « ${ecrit} » × ${forme} : Q04 et Q05 verts`, () => {
          expect(verdict(l.image, phrase, ecrit)).toEqual([]);
        });
      }
    }
    for (const a of l.absents) {
      it(`image « ${l.image} » : ${a.ecrit ? `écran « ${a.ecrit} »` : `voix « ${a.dit} »`} refusé`, () => {
        const m = verdict(l.image, a.dit ?? l.ditFin, a.ecrit ?? l.ecrits[0]!);
        expect(m.some((x) => x.regle === "Q05"), JSON.stringify(m)).toBe(true);
      });
    }
  }
});

describe("heure espacée suivie d'un montant en milliers (relecture de #252)", () => {
  const vals = (t: string) => chiffresDe(t).map((c) => `${c.valeur}|${c.unite}`);
  it("la minute n'avale jamais le premier chiffre d'un groupe de milliers", () => {
    expect(vals("Gagnez 2 h 5 000 € par mois")).toEqual(["2|h", "5000|€"]);
    expect(vals("En 1 h 2 500 e-mails triés")).toEqual(["1|h", "2500|nombre"]);
    expect(vals("3 h 2 000 €")).toEqual(["3|h", "2000|€"]);
    expect(vals("2 h 50 000 €")).toEqual(["2|h", "50000|€"]);
  });
  it("pas de saut de ligne entre « h » et la minute", () => {
    expect(vals("Gagnez 2 h\n5 000 € économisés")).toEqual(["2|h", "5000|€"]);
  });
  it("les vraies heures espacées restent lues", () => {
    expect(vals("6 h 05")).toEqual(["365|heure"]);
    expect(vals("23 h 14")).toEqual(["1394|heure"]);
  });
});

describe("calculs parasites (« 0 % + 0 % ≠ 100 % », « 1 + 1 ≠ 1 »)", () => {
  it("la carte C ne porte que le calcul juste des deux branches", () => {
    expect(coherenceDe(carteC)).toEqual([{ calcul: "80 % + 20 % = 100 %", ok: true }]);
  });

  it("une lecture qui rend « part 0 » et « quantité 1 » par défaut n'invente plus de calcul", () => {
    const lu: LectureImage = structuredClone(LECTURE_DEMO);
    for (const n of lu.noeuds) n.quantite = 1;
    for (const l of lu.liens) l.part = 0;
    const { brouillon } = fusionnerLectures(lu, structuredClone(lu));
    expect(brouillon.liens.some((l) => l.part !== undefined)).toBe(false);
    expect(coherenceDe(brouillon)).toEqual([]);
  });

  it("l'image C lue avec « quantité 1 » partout ne produit plus « 1 + 1 ≠ 1 »", () => {
    const lu = lectureDeCarte(carteC);
    for (const n of lu.noeuds) n.quantite = 1;
    const { brouillon } = fusionnerLectures(lu, structuredClone(lu));
    expect(coherenceDe(brouillon).map((x) => x.calcul)).not.toContain("1 + 1 ≠ 1");
    expect(coherenceDe(brouillon).every((x) => x.ok)).toBe(true);
  });

  it("entonnoir 20 → 19 + 1 : la sortie d'un seul objet garde sa quantité et le contrôle « 19 + 1 = 20 »", () => {
    const carteD: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/D.json"), "utf8"));
    carteD.noeuds.find((n) => n.id === "n03")!.quantite = 19;
    carteD.noeuds.find((n) => n.id === "n04")!.quantite = 1;
    const lu = lectureDeCarte(carteD);
    const { brouillon } = fusionnerLectures(lu, structuredClone(lu));
    expect(brouillon.noeuds.map((n) => n.quantite)).toEqual([20, undefined, 19, 1]);
    expect(coherenceDe(brouillon)).toEqual([{ calcul: "19 + 1 = 20", ok: true }]);
  });

  it("une vraie part et une vraie quantité restent lues", () => {
    const lu: LectureImage = structuredClone(LECTURE_DEMO);
    lu.noeuds[0]!.quantite = 20;
    const { brouillon } = fusionnerLectures(lu, structuredClone(lu));
    expect(brouillon.liens.filter((l) => l.part !== undefined).map((l) => l.part)).toEqual([80, 20]);
    expect(brouillon.noeuds[0]!.quantite).toBe(20);
  });
});

describe("version prudente d'une formule qui porte un chiffre à dire (Q04)", () => {
  const formule = (texte: string) => ({ texte, ou: "bandeau.1", proposition: "presque aucune demande" });
  for (const texte of ["0 demande perdue", "0 demande sans relance"]) {
    it(`« ${texte} » en version prudente : le chiffre « 0 demande » n'est plus réclamé (aucun message Q04)`, () => {
      const carte: CarteImage = structuredClone(carteC);
      carte.formulesAbsolues = [formule(texte), ...carte.formulesAbsolues.filter((f) => f.texte !== "0 demande perdue")];
      const prudente: Record<string, ChoixFormule> = { [cleFormule(texte)]: "reformuler", [cleFormule("toujours")]: "garder" };
      // Le script ne dit plus « 0 demande » : « presque aucune demande » à la place.
      const fiche = structuredClone(ficheC);
      for (const e of fiche.ecrans) {
        e.texteDit = e.texteDit.replace(/z[ée]ro demande/gi, "presque aucune demande");
        e.textesEcran = e.textesEcran.map((t) => t.replace(/\*0\* demande/gi, "presque aucune demande"));
      }
      const q04 = verifierScript(fiche, { carte, choixFormules: prudente }).manquements.filter((m) => m.regle === "Q04");
      expect(q04.filter((m) => /0 demande/.test(m.message))).toEqual([]);
      // Sans le choix prudent (formule gardée), le chiffre reste réclamé : la garde ne s'applique qu'au choix « reformuler ».
      const garde = verifierScript(fiche, { carte, choixFormules: { ...prudente, [cleFormule(texte)]: "garder" } }).manquements.filter((m) => m.regle === "Q04");
      expect(garde.some((m) => /0 demande/.test(m.message))).toBe(true);
    });
  }

  it("si la version prudente garde le chiffre, il reste réclamé", () => {
    const carte: CarteImage = structuredClone(carteC);
    carte.formulesAbsolues = [{ texte: "0 demande perdue", ou: "bandeau.1", proposition: "0 demande ou presque perdue" }];
    const fiche = structuredClone(ficheC);
    for (const e of fiche.ecrans) {
      e.texteDit = e.texteDit.replace(/z[ée]ro demande/gi, "presque aucune demande");
      e.textesEcran = e.textesEcran.map((t) => t.replace(/\*0\* demande/gi, "presque aucune demande"));
    }
    const q04 = verifierScript(fiche, { carte, choixFormules: { [cleFormule("0 demande perdue")]: "reformuler" } }).manquements.filter((m) => m.regle === "Q04" && /0 demande/.test(m.message));
    expect(q04.length).toBeGreaterThan(0);
  });

  it("le choix de la carte (choixWill) compte comme celui de l'écran", () => {
    const carte: CarteImage = structuredClone(carteC);
    carte.formulesAbsolues = carte.formulesAbsolues.map((f) => (f.texte === "0 demande perdue" ? { ...f, choixWill: "reformuler" as const } : f));
    const fiche = structuredClone(ficheC);
    for (const e of fiche.ecrans) e.texteDit = e.texteDit.replace(/z[ée]ro demande/gi, "presque aucune demande");
    expect(avecVersionsPrudentes(fiche, {})).toBeNull();
    const q04 = verifierScript(fiche, { carte, choixFormules: { [cleFormule("toujours")]: "garder" } }).manquements.filter((m) => m.regle === "Q04" && /0 demande/.test(m.message));
    expect(q04).toEqual([]);
  });
});
