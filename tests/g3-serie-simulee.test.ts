/**
 * LOT G3 — SÉRIE SIMULÉE (B.7.7, critère de fin G3) : 30 sujets enchaînés (étape 0 seulement, gratuite) sur un
 * registre de 10 matières, puis de 25. Attendus : aucune impasse hors « aucune matière vraie », relâchements dans
 * l'ordre écrit, part d'anecdote ≤ 25 % après 10 sujets, jamais deux combinaisons identiques d'affilée (réservation),
 * rotation des structures tenue sauf relâchement noté.
 */
import { describe, expect, it } from "vitest";
import { partAnecdote } from "@/domaine/variete";
import type { ElementSerieEtendu } from "@/domaine/controles-script";
import type { ChoixSerie, Matiere, TypeMatiere } from "@/domaine/types";
import { choisirCombinaison, ORDRE_RELACHEMENT, type ResultatChoix } from "@/generateur/choix-combinaison";
import { entreeChoix } from "./helpers/g3-choix";
import { matiere, preuve } from "./helpers/g3";

const PILIERS = {
  donnees: { idee: "Remplacer Excel par un tableau de bord", motsCles: ["excel", "donnees", "tableau"] },
  regles: { idee: "Les règles de ChatGPT au travail", motsCles: ["chatgpt", "regles", "donnees"] },
} as const;
type Pilier = keyof typeof PILIERS;

const TEXTES: Record<TypeMatiere, string> = {
  "anecdote-will": "J'ai vu un dirigeant recopier 40 factures à la main un vendredi soir, parce que son tableur avait planté.",
  "avis-will": "Un tableur n'est pas une base de données, parce qu'il ne garde aucune trace de qui change quoi.",
  "cas-client": "Chez un client, une personne passait 35 heures par semaine sur des fichiers partagés.",
  "parole-dirigeant": "« Je ne sais plus quel fichier est le bon », m'a dit un dirigeant de PME.",
  "question-recue": "Est-ce qu'on peut garder nos fichiers clients dans un outil en ligne sans risque ?",
  observation: "Dans presque toutes les PME que j'accompagne, le comptable reçoit encore des factures par mail, parce que personne n'a choisi d'outil.",
  "idee-recue": "On croit qu'un logiciel de gestion coûte plus cher qu'un tableur, parce que le tableur est gratuit.",
  etude: "Selon une étude de 2025, 6 dirigeants de PME sur 10 utilisent encore un tableur pour piloter leurs ventes.",
  actualite: "Depuis le 1er septembre 2026, la facture électronique devient obligatoire pour les grandes entreprises.",
  demonstration: "Je montre à l'écran comment exporter un tableau de bord en un clic.",
  limite: "Si vos tableaux changent de forme chaque mois, gardez le tableur encore un temps, parce que l'outil coûterait plus qu'il ne rapporte.",
};

/** Registre de N matières réparties sur 2 piliers ; 1 anecdote de Will pour 5 matières. */
function registre(n: number): Matiere[] {
  const ordre: TypeMatiere[] = ["cas-client", "avis-will", "observation", "anecdote-will", "question-recue", "limite", "idee-recue", "etude", "parole-dirigeant", "cas-client", "observation", "avis-will", "question-recue"];
  return Array.from({ length: n }, (_, i) => {
    const pilier: Pilier = i % 2 === 0 ? "donnees" : "regles";
    const type = ordre[Math.floor(i / 2) % ordre.length];
    return matiere(type, `${TEXTES[type]} (${i + 1})`, {
      id: `sim-${n}-${i + 1}`,
      pilier,
      motsCles: [...PILIERS[pilier].motsCles],
      scene: type === "anecdote-will" ? "Un vendredi soir, dans le bureau du dirigeant." : undefined,
      preuveId: type === "cas-client" ? (pilier === "donnees" ? "SP1" : "SP2") : undefined,
    });
  });
}

const PREUVES = [
  preuve("SP1", "Avant : une personne passait 35 heures par semaine sur des fichiers", { nature: "chiffree", valeurs: [{ brut: "35 h", normalise: 35 }], formulationsAutorisees: ["35 heures par semaine"], pilier: "donnees" }),
  preuve("SP2", "Après : la règle écrite tient en une page", { nature: "qualitative", formulationsAutorisees: ["une règle d'une page"], pilier: "regles" }),
  preuve("SR1", "La loi impose de conserver les factures 10 ans", { type: "regle-loi", nature: "chiffree", valeurs: [{ brut: "10 ans", normalise: 10 }], niveau: "prouve", client: undefined, pilier: "donnees" }),
  preuve("SR2", "Le RGPD impose de savoir où sont stockées les données clients", { type: "regle-loi", niveau: "prouve", client: undefined, pilier: "regles" }),
];

interface Tour {
  k: number;
  r: ResultatChoix;
  /** La carte « Reprendre « … » ? » a été proposée et Will a dit Oui (B.3.9 point 3). */
  reemploi: boolean;
}

/** 30 sujets, deux par semaine, alternés sur deux piliers. */
function simuler(nMatieres: number, nSujets = 30): { tours: Tour[]; serie: ElementSerieEtendu[] } {
  const matieres = registre(nMatieres);
  const serie: ElementSerieEtendu[] = [];
  const usages: Record<string, { reseau: string; le: string; numero?: number }[]> = {};
  const tours: Tour[] = [];
  const debut = Date.parse("2026-10-05T09:00:00.000Z");
  for (let k = 0; k < nSujets; k++) {
    const le = new Date(debut + k * 3.5 * 86_400_000).toISOString();
    const pilier: Pilier = k % 2 === 0 ? "donnees" : "regles";
    const lancer = (imposees?: string[]) =>
      choisirCombinaison(
        entreeChoix(
          { maintenant: le, matieres, preuves: PREUVES, series: { tiktok: [...serie], linkedin: [...serie] }, usagesMatieres: usages, sujetsValides: k },
          { idee: PILIERS[pilier].idee, pilier, motsCles: [...PILIERS[pilier].motsCles], reseaux: ["tiktok", "linkedin"], matiereIdsImposees: imposees },
        ),
      );
    let r = lancer();
    let reemploi = false;
    if (!r.ok && r.manque.type === "ANCRAGE_MANQUANT" && r.manque.reemploiPossible?.length) {
      // Will touche « Oui » : la matière la plus ancienne est reprise, imposée (jamais refusée par la rotation).
      const plusAncienne = [...r.manque.reemploiPossible].sort((a, b) => b.ilYaJours - a.ilYaJours)[0];
      r = lancer([plusAncienne.matiereId]);
      reemploi = true;
    }
    tours.push({ k, r, reemploi });
    if (!r.ok) continue;
    const c: ChoixSerie = r.retenue;
    // Réservation, puis validation : le sujet entre dans la série de chaque réseau coché ; la matière est consommée.
    serie.push({
      scriptMaitreId: `s${k}`,
      numero: k + 1,
      reserve: false,
      date: le,
      origineDate: "validation",
      formatIds: ["avocat"],
      structure: c.structure,
      typesAncrage: c.ancrages.map((a) => a.type),
      matiereIds: c.ancrages.map((a) => a.matiereId),
      anecdote: c.ancrages.some((a) => a.type === "anecdote-will"),
      pointDeVue: c.pointDeVue,
      emotion: c.emotion,
      pilier: c.pilier,
      expressionsApaisementRelance: [],
      ...(reemploi ? { reserve: false } : {}),
    });
    for (const a of c.ancrages.filter((x) => x.role === "principal")) (usages[a.matiereId] ??= []).push({ reseau: "tiktok", le, numero: k + 1 }, { reseau: "linkedin", le, numero: k + 1 });
  }
  return { tours, serie };
}

describe.each([10, 25])("série simulée de 30 sujets sur %i matières", (n) => {
  const { tours, serie } = simuler(n);

  it("aucune impasse hors « aucune matière vraie »", () => {
    const impasses = tours.filter((t) => !t.r.ok && !(t.r.manque.type === "ANCRAGE_MANQUANT" && !t.r.manque.reemploiPossible?.length));
    expect(impasses.map((t) => `${t.k}:${!t.r.ok && t.r.manque.type}`)).toEqual([]);
    expect(serie.length).toBe(30);
  });

  it("relâchements notés dans l'ordre écrit (ressenti → point de vue → famille → structure → type → anecdote)", () => {
    for (const t of tours) {
      if (!t.r.ok) continue;
      const rangs = t.r.retenue.relachements.map((x) => ORDRE_RELACHEMENT.indexOf(x.axe));
      expect(rangs.every((x) => x >= 0)).toBe(true);
      expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
    }
  });

  it("part d'anecdote ≤ 25 % sur les 10 derniers, dès 10 sujets", () => {
    for (let k = 10; k <= serie.length; k++) expect(partAnecdote(serie.slice(Math.max(0, k - 10), k))).toBeLessThanOrEqual(0.25);
  });

  it("jamais deux combinaisons identiques d'affilée", () => {
    for (let k = 1; k < serie.length; k++) {
      const a = serie[k - 1];
      const b = serie[k];
      expect(`${a.structure}|${a.matiereIds[0]}|${a.pointDeVue}|${a.emotion}`).not.toBe(`${b.structure}|${b.matiereIds[0]}|${b.pointDeVue}|${b.emotion}`);
    }
  });

  it("C43 : jamais 3 fois de suite la même structure sans relâchement noté", () => {
    for (let k = 2; k < serie.length; k++) {
      if (serie[k].structure === serie[k - 1].structure && serie[k].structure === serie[k - 2].structure) {
        const t = tours.find((x) => x.k === k)!;
        expect(t.r.ok && t.r.retenue.relachements.some((x) => x.axe === "structure")).toBe(true);
      }
    }
  });

  it("C53 : aucune matière ne revient avant 60 jours, sauf réemploi accepté par Will d'un toucher", () => {
    for (let k = 0; k < serie.length; k++) {
      for (let j = k + 1; j < serie.length; j++) {
        const jours = (Date.parse(serie[j].date) - Date.parse(serie[k].date)) / 86_400_000;
        if (jours < 60 && !tours[j].reemploi) expect(serie[j].matiereIds[0]).not.toBe(serie[k].matiereIds[0]);
      }
    }
    // 25 matières suffisent à deux sujets par semaine ; 10 matières demandent quelques réemplois.
    const reemplois = tours.filter((t) => t.reemploi).length;
    if (n >= 25) expect(reemplois).toBe(0);
    else expect(reemplois).toBeLessThanOrEqual(20);
    const structures = new Set(serie.map((e) => e.structure));
    expect(structures.size).toBeGreaterThanOrEqual(3);
  });

  it("2 à 3 combinaisons transmises au stratège à chaque sujet", () => {
    for (const t of tours) if (t.r.ok && t.r.structuresTirables >= 2) expect(t.r.combinaisons.length).toBeGreaterThanOrEqual(2);
    for (const t of tours) if (t.r.ok) expect(t.r.combinaisons.length).toBeLessThanOrEqual(3);
  });
});
