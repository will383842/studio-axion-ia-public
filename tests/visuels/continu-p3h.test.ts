import { describe, expect, it } from "vitest";
import { GABARITS, GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS, PARCOURS_PRODUCTION } from "../../src/briques/visuels/continu/registre-parcours";
import { RUBRIQUE_MAX, coutures } from "../../src/domaine/visuels/continu/geometrie";
import { COMPOSANTS_PARCOURS } from "../../studio-rendu/compositions/visuels/continu/registre-composants";
import { graduationsPC, segmentsTiretsPB } from "../../studio-rendu/compositions/visuels/continu/parcours/traits";

/** Table attendue, écrite d'après la lecture de MAQUETTE-v3.html (`pano(n, …, { dk })`, rubrique + titre, appel final). */
interface Attendu {
  nom: string;
  commence: boolean;
  termine: boolean;
  sombres: number[];
  /** Budget (caractères) de chaque champ texte, page par page ; `?` = champ facultatif. */
  pages: Record<string, Record<string, number>>;
  orangeFort: string[];
}

const ATTENDU: Record<string, Attendu> = {
  PA: {
    nom: "Le chemin",
    commence: true,
    termine: true,
    sombres: [3],
    orangeFort: [],
    pages: {
      PA1: { titre: 10, accent: 10, "suite?": 1, texte: 70, pastille: 16 },
      PA2: { etape: 16, detail: 60 },
      PA3: { etape: 16, detail: 60 },
      PA4: { etape: 16, detail: 40, titre: 14, accent: 8, appel: 80 },
    },
  },
  PB: {
    nom: "Avant / avec nous",
    commence: true,
    termine: false,
    sombres: [],
    orangeFort: [],
    pages: {
      PB1: { titre: 14, accent: 14, texte: 56, avant: 18, avec: 18 },
      PB2: { avant: 11, avec: 18, aparte: 40 },
      PB3: { avant1: 17, avant2: 18, titre: 14, accent: 12, "suite?": 2, texte: 50, note: 30 },
    },
  },
  PC: {
    nom: "Le grand mot",
    commence: true,
    termine: false,
    sombres: [],
    orangeFort: [],
    pages: {
      PC1: { mot: 3, aparte: 30 },
      PC2: { mot: 4, texte: 56 },
      PC3: { mot: 4, texte: 64 },
    },
  },
  PD: {
    nom: "L’objet à cheval",
    commence: true,
    termine: false,
    sombres: [],
    orangeFort: ["PD3"],
    pages: {
      PD1: { titre: 12, accent: 12, "suite?": 16, texte: 70 },
      PD2: { question1: 28, reponse1: 44, question2: 24, reponse2: 30 },
      PD3: { question: 40, aparte: 50 },
    },
  },
  PE: {
    nom: "Bento continu",
    commence: true,
    termine: true,
    sombres: [],
    orangeFort: ["PE1"],
    pages: {
      PE1: { titre: 14, accent: 10, tuile: 34 },
      PE2: { doc: 26, docSous: 24, temps: 8, validez: 14, vue: 34, vueSous: 50, aparte: 46 },
      PE3: { equipe: 18, outils: 14, aparte: 30 },
      PE4: { titre: 22, accent: 26, bouton: 28 },
    },
  },
  PF: {
    nom: "La courbe",
    commence: true,
    termine: false,
    sombres: [],
    orangeFort: [],
    pages: {
      PF1: { titre: 14, accent: 14, "suite?": 22, texte: 60, depart: 14 },
      PF2: { jalon: 16 },
      PF3: { jalon: 16 },
      PF4: { jalon: 22, final: 12, plusTard: 26 },
    },
  },
  PG: {
    nom: "L’escalier",
    commence: true,
    termine: false,
    sombres: [],
    orangeFort: [],
    pages: {
      PG1: { titre: 11, accent: 12, etape: 14, detail: 60 },
      PG2: { etape: 14, detail: 60 },
      PG3: { etape: 14, detail: 60 },
      PG4: { etape: 12, detail: 30 },
    },
  },
  PH: {
    nom: "Le circuit",
    commence: true,
    termine: false,
    sombres: [3],
    orangeFort: [],
    pages: {
      PH1: { titre: 24, accent: 18, etape: 14, detail: 34 },
      PH2: { etape: 14, detail: 34 },
      PH3: { etape: 14, detail: 34 },
      PH4: { etape: 14, detail: 34 },
    },
  },
};

const NOMBRES: Record<string, number> = { PA: 4, PB: 3, PC: 3, PD: 3, PE: 4, PF: 4, PG: 4, PH: 4 };
const gabarit = (type: string) => GABARITS.find((g) => g.type === type)!;
const tousTypes = Object.values(ATTENDU).flatMap((a) => Object.keys(a.pages));

describe("continu P3h : registre des 8 parcours", () => {
  it("les huit parcours de production, du nombre de pages de la maquette", () => {
    expect(PARCOURS_PRODUCTION.map((p) => p.id)).toEqual(Object.keys(ATTENDU));
    for (const [id, a] of Object.entries(ATTENDU)) {
      const p = PARCOURS.find((x) => x.id === id)!;
      expect(p, id).toBeDefined();
      expect(p.pages, id).toBe(NOMBRES[id]);
      expect(p.pagesTypes.length, id).toBe(p.pages);
      expect(p.pagesTypes, id).toEqual(Object.keys(a.pages));
      expect(p.nom, id).toBe(a.nom);
      expect(p.commence, `${id} commence`).toBe(a.commence);
      expect(p.termine, `${id} termine`).toBe(a.termine);
      expect(p.sombres, `${id} sombres`).toEqual(a.sombres);
      expect(p.version, id).toBeGreaterThanOrEqual(1);
      expect(p.essai, id).toBeUndefined();
    }
  });
  it("les pages sont des gabarits de production (famille parcours, actifs, version ≥ 1)", () => {
    const prod = GABARITS_PRODUCTION.map((g) => g.type);
    for (const t of tousTypes) {
      const g = gabarit(t);
      expect(g, t).toBeDefined();
      expect(g.famille, t).toBe("parcours");
      expect(g.actif, t).toBe(true);
      expect(g.version, t).toBeGreaterThanOrEqual(1);
      expect(prod, t).toContain(t);
    }
  });
  it("sombre et orangeFort conformes à la maquette", () => {
    for (const [id, a] of Object.entries(ATTENDU)) {
      Object.keys(a.pages).forEach((t, j) => {
        expect(gabarit(t).sombre, `${t} sombre`).toBe(a.sombres.includes(j));
        expect(gabarit(t).orangeFort, `${t} orangeFort`).toBe(a.orangeFort.includes(t));
      });
      expect(id).toBeTruthy();
    }
  });
  it("seule la page de cas concret PB1 porte l'étiquette « Scénario type »", () => {
    for (const t of tousTypes) expect(!!gabarit(t).cas, t).toBe(t === "PB1");
  });
  it("chaque parcours a son composant (calque) dans le registre", () => {
    for (const id of Object.keys(ATTENDU)) expect(typeof COMPOSANTS_PARCOURS[id], id).toBe("function");
  });
});

describe("continu P3h : schémas stricts et budgets", () => {
  it("chaque exemple passe son schéma, un champ inconnu (étiquette) est refusé", () => {
    for (const t of tousTypes) {
      const g = gabarit(t);
      expect(g.schema.safeParse(g.exemple).success, t).toBe(true);
      expect(g.schema.safeParse({ ...g.exemple, etiquette: "Scénario type" }).success, t).toBe(false);
      expect(g.schema.safeParse({ ...g.exemple, titre: undefined, type: "X" }).success, t).toBe(false);
    }
  });
  it("chaque champ accepte son budget et refuse budget + 1", () => {
    for (const a of Object.values(ATTENDU)) {
      for (const [t, champs] of Object.entries(a.pages)) {
        const g = gabarit(t);
        const exemple = g.exemple as Record<string, unknown>;
        const attendus = Object.keys(champs).map((c) => c.replace("?", ""));
        for (const cle of Object.keys(exemple)) if (!["type", "alt", "rubrique"].includes(cle)) expect(attendus, `${t}.${cle}`).toContain(cle);
        for (const [nom, max] of Object.entries(champs)) {
          const c = nom.replace("?", "");
          if (!nom.endsWith("?")) expect(exemple[c], `${t}.${c} absent de l'exemple`).toBeDefined();
          expect(g.schema.safeParse({ ...exemple, [c]: "a".repeat(max) }).success, `${t}.${c} = ${max}`).toBe(true);
          expect(g.schema.safeParse({ ...exemple, [c]: "a".repeat(max + 1) }).success, `${t}.${c} = ${max + 1}`).toBe(false);
          expect(g.schema.safeParse({ ...exemple, [c]: "" }).success, `${t}.${c} vide`).toBe(false);
          const { [c]: _omis, ...sans } = exemple;
          expect(g.schema.safeParse(sans).success, `${t}.${c} omis`).toBe(nom.endsWith("?"));
        }
      }
    }
  });
  it("alt ≤ 125 et rubrique ≤ RUBRIQUE_MAX sur chaque page", () => {
    for (const t of tousTypes) {
      const g = gabarit(t);
      const exemple = g.exemple as Record<string, unknown>;
      expect(typeof exemple.alt, t).toBe("string");
      expect(g.schema.safeParse({ ...exemple, alt: "a".repeat(125) }).success, t).toBe(true);
      expect(g.schema.safeParse({ ...exemple, alt: "a".repeat(126) }).success, t).toBe(false);
      expect(g.schema.safeParse({ ...exemple, rubrique: "a".repeat(RUBRIQUE_MAX) }).success, t).toBe(true);
      expect(g.schema.safeParse({ ...exemple, rubrique: "a".repeat(RUBRIQUE_MAX + 1) }).success, t).toBe(false);
    }
  });
  it("un lien dans un texte est refusé", () => {
    for (const t of tousTypes) {
      const g = gabarit(t);
      const exemple = g.exemple as Record<string, unknown>;
      const champ = Object.keys(exemple).find((k) => !["type", "alt", "rubrique"].includes(k))!;
      expect(g.schema.safeParse({ ...exemple, [champ]: "voir https://exemple.fr" }).success, t).toBe(false);
    }
  });
  it("les exemples ne contiennent aucun mot interdit (Grenoble, garanti, CPF, tutoiement)", () => {
    for (const t of tousTypes) {
      const texte = Object.entries(gabarit(t).exemple)
        .filter(([k]) => k !== "type")
        .map(([, v]) => String(v))
        .join(" | ");
      expect(texte, t).not.toMatch(/Grenoble|garanti|CPF|J.aide|\btu\b|\bton\b|\bta\b/i);
    }
  });
});

describe("continu P3h : bords libres des raccords", () => {
  it("intervalles triés, dans [0, 1440], y1 < y2", () => {
    for (const t of tousTypes) {
      const { gauche, droite } = gabarit(t).bordsLibres;
      for (const bord of [gauche, droite]) {
        let dernier = -1;
        for (const [a, b] of bord) {
          expect(a, t).toBeGreaterThanOrEqual(dernier);
          expect(b, t).toBeGreaterThan(a);
          expect(b, t).toBeLessThanOrEqual(1440);
          dernier = b;
        }
      }
    }
  });
  it("les bords extérieurs d'un parcours qui commence sont déclarés (première gauche, dernière droite)", () => {
    for (const a of Object.values(ATTENDU)) {
      const types = Object.keys(a.pages);
      expect(gabarit(types[0]).bordsLibres.gauche.length).toBeGreaterThan(0);
      expect(gabarit(types[types.length - 1]).bordsLibres.droite.length).toBeGreaterThan(0);
    }
  });
});

describe("continu P3h : traits fins hors coutures", () => {
  const SEAMS3 = coutures(3);
  it("PC : aucune graduation de la règle ne tombe sur une couture (à 4 px près)", () => {
    const xs = graduationsPC(3).map((g) => g.x);
    expect(xs.length).toBeGreaterThan(50);
    for (const x of xs) for (const s of SEAMS3) expect(Math.abs(x - s), `x=${x}`).toBeGreaterThan(4);
  });
  it("PB : aucun segment de tirets ne traverse une couture, et leur phase est continue", () => {
    const seg = segmentsTiretsPB();
    expect(seg.length).toBeGreaterThanOrEqual(2);
    for (const s of seg) for (const c of SEAMS3) expect(s.x1 < c && s.x2 > c, `[${s.x1}, ${s.x2}] / ${c}`).toBe(false);
    for (const c of SEAMS3) for (const s of seg) expect(Math.abs(s.x1 - c) > 4 && Math.abs(s.x2 - c) > 4, `${s.x1}/${s.x2}/${c}`).toBe(true);
    // Période du motif « 3 18 » : décalage = (début − début d'origine) modulo 21.
    for (const s of seg) expect(s.decalage).toBe((s.x1 - 1560) % 21);
  });
});
