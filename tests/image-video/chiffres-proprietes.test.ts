/**
 * Propriétés de la lecture des heures (relecture de #252, tête c8b06f6e), vérifiées avec la VRAIE règle Q04/Q05
 * (`verifierScript`) sur la carte C dont un nœud porte le texte d'image généré. Déterministe et exhaustif :
 * (forme de l'heure × H × M) × suite.
 * - P1 : la voix qui dit exactement les chiffres de l'image (en lettres, en fin et au milieu de phrase) est acceptée.
 * - P2 (prioritaire) : une heure tronquée, une minute fausse, un montant amputé ou un nombre absent de l'image est refusé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { chiffresDeLaCarte } from "@/domaine/image-video/carte";
import { chiffresDe } from "@/domaine/image-video/chiffres";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { nombreEnLettres } from "@/domaine/prononciations";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { cleFormule, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";

const carteC: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(["0 demande perdue", "toujours"].map((f) => [cleFormule(f), "garder" as const]));

/** La carte C sans son « 2h » (n10 → « 9h ») : sinon « deux heures » serait permis par l'image et masquerait une troncature. */
function carteAvec(image: string): CarteImage {
  const c = structuredClone(carteC);
  c.noeuds.find((n) => n.id === "n10")!.detail = "Réponse sous 9h";
  c.noeuds.find((n) => n.id === "n03")!.detail = image;
  c.chiffres = chiffresDeLaCarte(c);
  return c;
}
const FICHE: FicheImage = (() => {
  const f = structuredClone(ficheSimulee("essai-c")!);
  const e = f.ecrans.find((x) => x.textesEcran.some((t) => t.includes("*2h*")))!;
  e.texteDit = e.texteDit.replace("deux heures", "neuf heures");
  e.textesEcran = e.textesEcran.map((t) => t.replace("*2h*", "*9h*"));
  return f;
})();
function avecVoix(phrase: string): FicheImage {
  const f = structuredClone(FICHE);
  const e = f.ecrans.find((x) => x.textesEcran.some((t) => t.includes("23h14")))!;
  e.texteDit = `Voici une situation type. Son message arrive. ${phrase}`;
  return f;
}
const q0405 = (image: string, phrase: string) =>
  verifierScript(avecVoix(phrase), { carte: carteAvec(image), choixFormules: GARDER }).manquements.filter((m) => m.regle === "Q04" || m.regle === "Q05");

/** Un chiffre attendu (sens voulu de l'image), dit en lettres. */
type Jeton = { genre: "heure"; h: number; m: number } | { genre: "h"; v: number } | { genre: "min"; v: number } | { genre: "€"; v: number } | { genre: "sec"; v: number } | { genre: "mot"; v: number; mot: string };

const lettres = (n: number) => nombreEnLettres(n);
function dit(j: Jeton): string {
  switch (j.genre) {
    case "heure":
      return `${j.h === 1 ? "une heure" : `${lettres(j.h)} heures`} ${lettres(j.m)}`;
    case "h":
      return j.v === 1 ? "une heure" : `${lettres(j.v)} heures`;
    case "min":
      return j.v === 1 ? "une minute" : `${lettres(j.v)} minutes`;
    case "€":
      return j.v === 0 ? "zéro euro" : `${lettres(j.v)} euros`;
    case "sec":
      return `${lettres(j.v)} secondes`;
    case "mot":
      return `${lettres(j.v)} ${j.mot}`;
  }
}

const FORMES = ["H h MM", "HhMM", "H h M", "H h", "H heures", "H heures MM"] as const;
const SANS_MINUTE: readonly (typeof FORMES)[number][] = ["H h", "H heures"];
const HS = [1, 2, 6, 23];
const MS = [5, 14, 20, 59];
/** Suite écrite après l'heure, et les chiffres qu'elle porte. */
const SUITES: { texte: string; jetons: Jeton[]; /** Nombre de la ligne suivante (une minute fausse possible). */ suivant?: number }[] = [
  { texte: "", jetons: [] },
  { texte: " récupérées", jetons: [] },
  { texte: "\n5 000 € perdus", jetons: [{ genre: "€", v: 5000 }] },
  ...[3, 5, 12, 20].flatMap((n) =>
    ["clients", "relances"].map((mot) => ({ texte: `\n${n} ${mot}`, jetons: [{ genre: "mot" as const, v: n, mot }], suivant: n })),
  ),
  { texte: " 5 000 €", jetons: [{ genre: "€", v: 5000 }] },
  { texte: " 2 500 e-mails", jetons: [{ genre: "mot", v: 2500, mot: "e-mails" }] },
  { texte: ", 4 sec", jetons: [{ genre: "sec", v: 4 }] },
  { texte: " min", jetons: [] },
];

interface Cas {
  image: string;
  jetons: Jeton[];
  /** Voix qui doivent être refusées (P2). */
  faux: { pourquoi: string; jetons: Jeton[] }[];
}

function heureEcrite(forme: (typeof FORMES)[number], h: number, m: number): string {
  const mm = String(m).padStart(2, "0");
  switch (forme) {
    case "H h MM":
      return `${h} h ${mm}`;
    case "HhMM":
      return `${h}h${mm}`;
    case "H h M":
      return `${h} h ${m}`;
    case "H h":
      return `${h} h`;
    case "H heures":
      return `${h} ${h === 1 ? "heure" : "heures"}`;
    case "H heures MM":
      return `${h} ${h === 1 ? "heure" : "heures"} ${mm}`;
  }
}

const CAS: Cas[] = [];
for (const forme of FORMES)
  for (const h of HS)
    for (const m of SANS_MINUTE.includes(forme) ? [0] : MS)
      for (const s of SUITES) {
        const image = `${heureEcrite(forme, h, m)}${s.texte}`;
        const aMinute = !SANS_MINUTE.includes(forme);
        const enMin = aMinute && s.texte === " min";
        const tete: Jeton[] = !aMinute ? [{ genre: "h", v: h }] : enMin ? [{ genre: "h", v: h }, { genre: "min", v: m }] : [{ genre: "heure", h, m }];
        const jetons = [...tete, ...s.jetons];
        const faux: Cas["faux"] = [];
        const mFaux = m === 59 ? 58 : m + 1;
        if (aMinute && !enMin) faux.push({ pourquoi: "heure tronquée", jetons: [{ genre: "h", v: h }, ...s.jetons] });
        if (aMinute && !enMin) faux.push({ pourquoi: "minute fausse", jetons: [{ genre: "heure", h, m: mFaux }, ...s.jetons] });
        if (enMin) faux.push({ pourquoi: "minute fausse", jetons: [{ genre: "h", v: h }, { genre: "min", v: mFaux }] });
        if (enMin) faux.push({ pourquoi: "minutes oubliées", jetons: [{ genre: "h", v: h }] });
        if (!aMinute) faux.push({ pourquoi: "minute inventée", jetons: [{ genre: "heure", h, m: 14 }, ...s.jetons] });
        // Heure à cheval sur deux lignes : la minute reprend le nombre de la ligne suivante (« six heures vingt »).
        if (!aMinute && s.suivant !== undefined) {
          // La voix dit tout ce que l'image écrit (Q04 satisfaite) ET l'heure inventée : seule Q05 peut la refuser.
          const inventee: Jeton = { genre: "heure", h, m: s.suivant };
          faux.push({ pourquoi: "minute prise à la ligne suivante", jetons: [inventee, ...jetons] });
          faux.push({ pourquoi: "minute prise à la ligne suivante (en fin)", jetons: [...jetons, inventee] });
        }
        for (const [i, j] of s.jetons.entries()) {
          const autres = (k: Jeton) => [...tete, ...s.jetons.slice(0, i), k, ...s.jetons.slice(i + 1)];
          if (j.genre === "€") faux.push({ pourquoi: "montant amputé (zéro euro)", jetons: autres({ genre: "€", v: 0 }) });
          if (j.genre === "mot" && j.v === 2500) faux.push({ pourquoi: "montant amputé (cinq cents)", jetons: autres({ ...j, v: 500 }) });
          if (j.genre !== "heure" && j.genre !== "h" && j.genre !== "min") faux.push({ pourquoi: "nombre absent", jetons: autres({ ...j, v: 47 }) });
        }
        faux.push({ pourquoi: "nombre absent ajouté", jetons: [...jetons, { genre: "mot", v: 47, mot: "clients" }] });
        CAS.push({ image, jetons, faux });
      }

const fin = (js: Jeton[]) => `On lit sur l'image ${js.map(dit).join(", puis ")}.`;
const milieu = (js: Jeton[]) => `On lit ${js.map(dit).join(", puis ")} sur l'image chaque matin.`;

/**
 * Refus à tort assumés (P1 sacrifiée pour garder P2) : aucun à ce jour. Tout ajout ici doit être justifié et signalé
 * dans la PR.
 */
const REFUS_A_TORT_ASSUMES: string[] = [];

describe("propriétés image × voix (Q04, Q05) sur toutes les écritures d'heure", () => {
  const nP1 = CAS.length * 2;
  const nP2 = CAS.reduce((n, c) => n + c.faux.length * 2, 0);

  it(`grille complète : ${CAS.length} textes d'image, ${nP1} voix justes (P1), ${nP2} voix fausses (P2)`, () => {
    expect(CAS.length).toBe((FORMES.length - SANS_MINUTE.length) * HS.length * MS.length * SUITES.length + SANS_MINUTE.length * HS.length * SUITES.length);
  });

  it("P2 (prioritaire) : aucune voix fausse n'est acceptée", () => {
    const acceptes: string[] = [];
    for (const c of CAS)
      for (const f of c.faux)
        for (const phrase of [fin(f.jetons), milieu(f.jetons)]) if (q0405(c.image, phrase).length === 0) acceptes.push(`${JSON.stringify(c.image)} · ${f.pourquoi} · « ${phrase} »`);
    expect(acceptes).toEqual([]);
  }, 300_000);

  it("P1 : la voix qui dit exactement les chiffres de l'image est acceptée (fin et milieu de phrase)", () => {
    const refuses: string[] = [];
    for (const c of CAS)
      for (const phrase of [fin(c.jetons), milieu(c.jetons)]) {
        const m = q0405(c.image, phrase);
        if (m.length && !REFUS_A_TORT_ASSUMES.includes(c.image)) refuses.push(`${JSON.stringify(c.image)} · « ${phrase} » · ${m.map((x) => x.message).join(" / ")}`);
      }
    expect(refuses).toEqual([]);
  }, 300_000);
});

describe("cas de la relecture (lecture de l'image)", () => {
  const vals = (t: string) => chiffresDe(t).map((c) => `${c.valeur}|${c.unite}`);
  it("un nombre à la ligne suivante ne change rien à l'heure", () => {
    expect(vals("Réponse à 23 h 14\n5 000 € perdus")).toEqual(["1394|heure", "5000|€"]);
    expect(vals("6 h 20\n3 clients")).toEqual(["380|heure", "3|nombre"]);
    expect(vals("2 h\n5 000 €")).toEqual(["2|h", "5000|€"]);
  });
  it("seule la minute qui commence un groupe de milliers sur la même ligne est exclue", () => {
    expect(vals("2 h 5 000 €")).toEqual(["2|h", "5000|€"]);
    expect(vals("1 h 2 500")).toEqual(["1|h", "2500|nombre"]);
    expect(vals("2 h 50 000 €")).toEqual(["2|h", "50000|€"]);
    expect(vals("6 h 20 5 000 €")).toEqual(["380|heure", "5000|€"]);
    expect(vals("6 h 20, 4 sec")).toEqual(["380|heure", "4|sec"]);
  });
  it("les cas précédents restent lus de même", () => {
    expect(vals("6 h 05")).toEqual(["365|heure"]);
    expect(vals("23 h 05")).toEqual(["1385|heure"]);
    expect(vals("23h05")).toEqual(["1385|heure"]);
    expect(vals("23 h 14")).toEqual(["1394|heure"]);
    expect(vals("6 h 20 récupérées")).toEqual(["380|heure"]);
    expect(vals("2 h 15 par jour")).toEqual(["135|heure"]);
    expect(vals("3h")).toEqual(["3|h"]);
    expect(vals("4 sec")).toEqual(["4|sec"]);
    expect(vals("80 %")).toEqual(["80|%"]);
    expect(vals("6h20 min")).toEqual(["6|h", "20|min"]);
  });
  it("voix de la relecture : « vingt-trois heures » et « six heures » seuls sont refusés", () => {
    expect(q0405("Réponse à 23 h 14\n5 000 € perdus", "On lit vingt-trois heures, puis cinq mille euros.").some((m) => m.regle === "Q05")).toBe(true);
    expect(q0405("6 h 20\n3 clients", "On lit six heures, puis trois clients.").some((m) => m.regle === "Q05")).toBe(true);
    expect(q0405("Réponse à 23 h 14\n5 000 € perdus", "On lit vingt-trois heures quatorze, puis cinq mille euros.")).toEqual([]);
    expect(q0405("6 h 05", "Au total, six heures cinq.")).toEqual([]);
  });
});
