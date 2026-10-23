/**
 * Garde des textes du stock de 96 cas : les longueurs que la fabrication exige (accroche, thème, tâches « avant », partie
 * humaine, résultat) et des thèmes tous distincts. Lecture directe de `stock.json`, aucun appel, aucun fichier écrit.
 */
import { describe, expect, it } from "vitest";
import figes from "./stock-champs-figes.json";
import brut from "@/formats/cas-concret/stock-metiers/stock.json";
import type { CasConcret } from "@/formats/cas-concret/cas";

/** Même comptage que `nombreMots` de `cas.ts` : on coupe aux espaces. */
const mots = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const cas = (brut as { cas: Array<{ rangement: { fiche: string }; cas: CasConcret }> }).cas;
const SIGLE = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/u;

describe("stock de cas · garde des textes (96 fiches)", () => {
  it("contient les 96 cas", () => {
    expect(cas).toHaveLength(96);
  });

  it("chaque cas respecte les longueurs de fabrication", () => {
    const ecarts: string[] = [];
    for (const { rangement, cas: c } of cas) {
      const f = rangement.fiche;
      if (c.promesse.includes("?")) ecarts.push(`${f} promesse avec un « ? » : « ${c.promesse} »`);
      if (!/\.$/.test(c.promesse.trim())) ecarts.push(`${f} promesse sans point final`);
      for (const e of c.etapes) if (mots(e.ligne) > 12) ecarts.push(`${f} ligne d'étape de ${mots(e.ligne)} mots`);
      if (mots(c.promesse) > 8) ecarts.push(`${f} promesse ${mots(c.promesse)} mots`);
      if (!c.theme || mots(c.theme) > 2) ecarts.push(`${f} theme « ${c.theme} »`);
      for (const t of c.avant.taches) if (mots(t) > 6) ecarts.push(`${f} tâche « ${t} »`);
      if (mots(c.resteHumain) > 11) ecarts.push(`${f} resteHumain ${mots(c.resteHumain)} mots`);
      if (SIGLE.test(c.resteHumain)) ecarts.push(`${f} resteHumain avec un sigle : « ${c.resteHumain} »`);
      if (mots(c.resultat) > 13) ecarts.push(`${f} resultat ${mots(c.resultat)} mots`);
    }
    expect(ecarts).toEqual([]);
  });

  it("les thèmes sont tous distincts (sans tenir compte de la casse)", () => {
    const vus = new Map<string, string[]>();
    for (const { rangement, cas: c } of cas) {
      const t = (c.theme ?? "").trim().toLowerCase();
      vus.set(t, [...(vus.get(t) ?? []), rangement.fiche]);
    }
    expect([...vus].filter(([, f]) => f.length > 1)).toEqual([]);
  });

  it("les champs intouchables sont identiques à ceux de master (id, offre, nature, posture, mot, faits, visuels, étapes humaines)", () => {
    const attendu = figes as Record<string, unknown>;
    const reel: Record<string, unknown> = {};
    for (const { rangement, cas: c } of cas) {
      reel[rangement.fiche] = {
        id: c.id,
        offre: c.offre,
        nature: c.nature ?? null,
        posture: c.posture,
        mot: c.mot,
        motDit: c.motDit ?? null,
        faits: c.faits,
        resteHumainApresEtape: c.resteHumainApresEtape ?? null,
        documentPromis: c.documentPromis,
        rangement,
        etapes: c.etapes.map((e) => ({ visuel: e.visuel, humaine: e.humaine ?? false })),
      };
    }
    expect(reel).toEqual(attendu);
  });
});
