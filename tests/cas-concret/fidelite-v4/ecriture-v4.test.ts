/**
 * V4-2 · mission F : l'écriture suit la v4 (sans appel payant). Les essais réels ont donné « 1 HEURE. » en accroche au
 * lieu de « 15 MINUTES. », 48 à 56 s au lieu de 41 s, un texte plus sec que la v4. Ce qui se teste sans modèle :
 *  - la consigne porte l'exemple de la v4 (`docs/formats/v4-reference/voix4.json`) et la règle « accroche → promesse » ;
 *  - la visée de durée : la sortie la plus courte de 40 à 47 s, jamais au-delà de 50 s ;
 *  - l'écriture simulée (gabarit) : le premier chiffre montré est celui de la PROMESSE, la durée est tenue, pour les 7 cas.
 * La qualité du texte rendu par le vrai modèle n'est PAS vérifiée ici (aucun appel) : un essai réel, avec l'accord de
 * Will, en jugera.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import type { ReseauCas } from "@/formats/cas-concret";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { CONSIGNE_ECRITURE, DUREE_SORTIE_COURTE_VISEE_MS, EXEMPLE_TON_V4, dureeDiteMs, dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { TENUE_FINALE_MS } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" } as const;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const voix4 = JSON.parse(readFileSync(join(__dirname, "../../../docs/formats/v4-reference/voix4.json"), "utf8")) as { mots: { word: string }[] };
const texteV4 = voix4.mots.map((m) => m.word).join(" ");

describe("V4-2 · la consigne suit la v4", () => {
  it("l'exemple de ton est le début de la v4, mot pour mot (voix4.json), jusqu'à la bascule", () => {
    expect(EXEMPLE_TON_V4.startsWith("On recrute nos collaborateurs en quinze minutes. Oui, quinze minutes. Avant, c'était ça :")).toBe(true);
    expect(EXEMPLE_TON_V4.endsWith("Alors on a tout automatisé.")).toBe(true);
    expect(texteV4.replace(/\s+/g, " ")).toContain(EXEMPLE_TON_V4);
    // 18/10 : l'exemple n'est plus envoyé seul (tous les scripts copiaient la v4) ; il reste ici pour la documentation.
    expect(CONSIGNE_ECRITURE).not.toContain(EXEMPLE_TON_V4);
    // L'exemple ne porte aucun mot interdit par R10.
    expect(EXEMPLE_TON_V4).not.toMatch(/machine/i);
  });

  it("l'accroche met en avant la PROMESSE : le premier chiffre montré est celui de la promesse, jamais celui de l'« avant »", () => {
    expect(CONSIGNE_ECRITURE).toContain("ACCROCHE");
    expect(CONSIGNE_ECRITURE).toMatch(/premier écran « chiffre ».*fait chiffré de la PROMESSE/);
    expect(CONSIGNE_ECRITURE).toMatch(/jamais le total de l'« avant »/);
  });

  it("la consigne dit la nouvelle visée de durée (40 à 47 s) et la borne de 50 s", () => {
    expect(CONSIGNE_ECRITURE).toContain("la vidéo la plus COURTE (celle de la fin la plus courte) dure de 40 à 47 s");
    expect(CONSIGNE_ECRITURE).toContain("jamais plus de 50 s");
  });
});

describe("V4-2 · durée visée proche de la v4 (41 s)", () => {
  it("visée de la sortie la plus courte : 40 à 47 s, sous 50 s", () => {
    expect(DUREE_SORTIE_COURTE_VISEE_MS.min).toBe(40_000);
    expect(DUREE_SORTIE_COURTE_VISEE_MS.max).toBeLessThanOrEqual(47_000);
  });

  it.each(CATALOGUE.map((c) => [c.id, c] as const))("%s, 4 réseaux : écriture simulée, sortie la plus courte de 40 à 47 s, aucune au-delà de 50 s", (_id, cas) => {
    const plan = regrouperFins(planDesFins({ reseaux: TOUS, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, avecMot: false, table: TABLE_FINS_DIAGNOSTIC }));
    const fiche = ficheParGabarit(cas, FIXE, dureesDesFins(plan.fins));
    const corps = dureeDiteMs(fiche.ecrans);
    const durees = plan.fins.map((f) => (corps + dureeDiteMs(f.ecrans) + TENUE_FINALE_MS) / 1000);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(40);
    expect(Math.min(...durees)).toBeLessThanOrEqual(47);
    expect(Math.max(...durees)).toBeLessThanOrEqual(50);
  });
});

describe("V4-2 · ordre accroche → promesse (écriture simulée)", () => {
  it("recrutement-apporteurs : e01 dit la promesse, e02 montre « 15 minutes » (pas « plus d'une heure »)", () => {
    const cas = CATALOGUE.find((c) => c.id === "recrutement-apporteurs")!;
    const f = ficheParGabarit(cas, FIXE);
    expect(f.ecrans[0].type).toBe("accroche");
    expect(f.ecrans[0].texteDit).toContain("15 minutes");
    const chiffre = f.ecrans.find((e) => e.type === "chiffre");
    expect(chiffre && chiffre.type === "chiffre" ? chiffre.faitId : null).toBe("visio-quinze-minutes");
    expect(f.ecrans.findIndex((e) => e.type === "chiffre")).toBeLessThan(f.ecrans.findIndex((e) => e.type === "liste-avant"));
  });

  it.each(CATALOGUE.map((c) => [c.id, c] as const))("%s : le premier chiffre montré porte un nombre de la promesse (s'il y en a un)", (_id, cas) => {
    const f = ficheParGabarit(cas, FIXE);
    const chiffre = f.ecrans.find((e) => e.type === "chiffre");
    if (!chiffre || chiffre.type !== "chiffre") return;
    const fait = cas.faits.find((x) => x.id === chiffre.faitId)!;
    const nombresPromesse = (cas.promesse.match(/\d+/g) ?? []).map(Number);
    if (nombresPromesse.length) expect(fait.valeurs.some((v) => nombresPromesse.includes(v)), `${chiffre.faitId}`).toBe(true);
    expect(fait.source).not.toBe("estimation");
  });
});
