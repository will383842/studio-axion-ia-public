/** S1.3 — passeport d'essai : titre, adresse proposée, résumé, transcription (fonctions pures, gratuites). */
import { describe, expect, it } from "vitest";
import { passeportDEssai, slugWeb, titreWebDEssai } from "@/domaine/site-videos/passeport";
import type { BlocScript, SegmentSousTitres, Sortie, Video } from "@/domaine/types";
import { texteScript } from "@/domaine/derivations";
import { formatAvocat } from "@/formats/avocat";

describe("S1.3 titre web d'essai", () => {
  it("retire le code interne et le suffixe de version", () => {
    expect(titreWebDEssai({ titre: "0005-FC-TT-L · Automatiser ses devis" })).toBe("Automatiser ses devis");
    expect(titreWebDEssai({ titre: "Automatiser ses devis — v5" })).toBe("Automatiser ses devis");
  });
  it("retire « | Axion IA » et le point final", () => {
    expect(titreWebDEssai({ titre: "Automatiser ses devis. | Axion IA" })).toBe("Automatiser ses devis");
  });
  it("coupe à 60 caractères au plus, sur un mot entier", () => {
    const t = titreWebDEssai({ titre: "Comment automatiser tous vos devis clients en dix minutes sans aucun outil compliqué ni abonnement" });
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t).toBe("Comment automatiser tous vos devis clients en dix minutes");
    expect("Comment automatiser tous vos devis clients en dix minutes sans").not.toBe(t);
  });
  it("un titre de 80 caractères sans espace est coupé net à 60", () => {
    expect(titreWebDEssai({ titre: "a".repeat(80) })).toHaveLength(60);
  });
});

describe("S1.3 slug", () => {
  it("sans accent, sans date, tirets propres", () => {
    expect(slugWeb("Réussir son été : 10 astuces !")).toBe("reussir-son-ete-10-astuces");
    expect(slugWeb("  --Œuvre &  Cœur--  ")).toBe("oeuvre-coeur");
  });
  it("60 caractères au plus, coupé sur un tiret", () => {
    const s = slugWeb("automatiser tous vos devis clients en dix minutes sans aucun outil compliqué ni abonnement");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
    expect(s).toBe("automatiser-tous-vos-devis-clients-en-dix-minutes-sans-aucun");
  });
});

const blocs: BlocScript[] = [
  { id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Vos devis vous prennent trop de temps." }] },
  { id: "b2", blocRecette: "promesse", segments: [{ id: "s2", texte: "Voici comment les faire en dix minutes." }, { id: "s3", texte: "Sans outil compliqué, promis." }] },
  { id: "b3", blocRecette: "coeur", segments: [{ id: "s4", texte: "Premier geste : un modèle." }] },
];
const segments: SegmentSousTitres[] = [];
const video = { id: "v1", titre: "0005-FC-TT-L · Automatiser ses devis", formatId: "avocat", ratios: ["9:16"], dureeCibleSec: 45 } as unknown as Video;
const sortie = { id: "so1", ratio: "9:16", dureeSec: 44 } as unknown as Sortie;

describe("S1.3 passeport d'essai", () => {
  const p = passeportDEssai({ video, blocs, segments, format: formatAvocat, sortie, credits: ["Photo : X"], contenuGenere: true, maintenant: "2026-10-18T10:00:00.000Z" });
  it("transcription = texte validé exact", () => {
    expect(p.transcription).toBe(texteScript(blocs));
  });
  it("résumé : deux premières phrases, 300 caractères au plus", () => {
    expect(p.resume).toBe("Vos devis vous prennent trop de temps. Voici comment les faire en dix minutes.");
    const long = passeportDEssai({ video, blocs: [{ id: "b", blocRecette: "coeur", segments: [{ id: "s", texte: ("mot ".repeat(90) + ".").trim() + " Autre phrase." }] }], segments, format: formatAvocat, sortie, credits: [], contenuGenere: false, maintenant: "2026-10-18T10:00:00.000Z" });
    expect(long.resume.length).toBeLessThanOrEqual(300);
  });
  it("champs de l'essai : version 1, origines « essai », le reste vide", () => {
    expect(p.version).toBe(1);
    expect(p.titreWeb).toBe("Automatiser ses devis");
    expect(p.aRetenir).toEqual([]);
    expect(p.questions).toEqual([]);
    expect(p.rubrique).toBe("");
    expect(p.motsCles).toEqual([]);
    expect(p.credits).toEqual(["Photo : X"]);
    expect(p.sortieId).toBe("so1");
    expect(p.ratio).toBe("9:16");
    expect(p.contenuGenere).toBe(true);
    expect(Object.values(p.origines).every((o) => o === "essai")).toBe(true);
    expect(Object.keys(p.origines).sort()).toEqual(["aRetenir", "chapitres", "motsCles", "questions", "resume", "rubrique", "titreWeb"]);
    expect(p.modifieLe).toBe("2026-10-18T10:00:00.000Z");
  });
});
