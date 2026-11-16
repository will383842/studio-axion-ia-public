/** C2-U8 : noms d'outils en étiquette dans la ligne des sous-titres (texte seul, éteint par défaut). Phrases écrites ici, aucune voix. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { empreinteTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { autoriserTexte } from "@/briques/charte/axion-2026";
import { donneesCalque } from "@/briques/sous-titres";
import { ETIQUETTE, ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF, motsOutils, NOMS_OUTILS } from "@/briques/sous-titres/noms-outils";
import { cssElement, elementDe, largeurElement, sceneAuTemps } from "@/briques/sous-titres/scene";
import type { MotRendu, SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { ValeurStyleSousTitres } from "@/domaine/types";

const mots = (texte: string): { mot: string }[] => texte.split(" ").map((mot) => ({ mot }));
const motsT = (texte: string): MotRendu[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: +(1 + i * 0.4).toFixed(3), finSec: +(1.3 + i * 0.4).toFixed(3) }));
const groupe = (texte: string, id = "g1", souligne: number | null = null): SegmentRendu => {
  const ms = motsT(texte);
  return { id, debutSec: ms[0].debutSec, finSec: ms.at(-1)!.finSec + 0.1, mots: ms, souligne, style: "base", position: "auto", importance: 1 };
};
const style = (texteEcran?: NonNullable<ValeurStyleSousTitres["texteEcran"]>): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, ...(texteEcran ? { texteEcran } : {}) });
const calque = (segments: SegmentRendu[], texteEcran?: NonNullable<ValeurStyleSousTitres["texteEcran"]>) => donneesCalque({ segments, base: "karaoke", style: style(texteEcran) });

describe("C2-U8 : reconnaissance des noms", () => {
  it("un nom simple donne une étiquette", () => {
    expect(motsOutils({ mots: mots("je demande à ChatGPT") })).toEqual([{ debut: 3, longueur: 1, id: "chatgpt" }]);
    expect(motsOutils({ mots: mots("je demande à chatgpt,") })).toHaveLength(1);
  });
  it("un nom ambigu exige la majuscule et ne compte pas en début de phrase", () => {
    expect(motsOutils({ mots: mots("Claude écrit") })).toEqual([]);
    expect(motsOutils({ mots: mots("avec claude ici") })).toEqual([]);
    expect(motsOutils({ mots: mots("avec Claude ici") })).toEqual([{ debut: 1, longueur: 1, id: "claude" }]);
    expect(motsOutils({ mots: mots("oui. Claude répond") })).toEqual([]);
    expect(motsOutils({ mots: mots("Claude écrit") }, () => false)).toHaveLength(1);
  });
  it("un nom en deux mots forme une seule étiquette, rien s'il est coupé", () => {
    expect(motsOutils({ mots: mots("dans Google Sheets ici") })).toEqual([{ debut: 1, longueur: 2, id: "google-sheets" }]);
    expect(motsOutils({ mots: mots("dans Google") })).toEqual([]);
    expect(motsOutils({ mots: mots("Sheets ici") })).toEqual([]);
  });
  it("au plus une étiquette par segment, la première", () => {
    expect(motsOutils({ mots: mots("Excel puis Notion") })).toEqual([{ debut: 0, longueur: 1, id: "excel" }]);
    expect(motsOutils({ mots: mots("rien du tout") })).toEqual([]);
  });
});

describe("C2-U8 : fichier noms-outils.ts", () => {
  it("les id sont uniques et stables (liste figée)", () => {
    const ids = NOMS_OUTILS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["chatgpt", "claude", "excel", "notion", "canva", "zapier", "make", "gmail", "outlook", "google-sheets", "hubspot", "slack", "teams", "whatsapp", "gemini", "copilot", "mistral", "perplexity", "pennylane", "qonto"]);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(NOMS_OUTILS.filter((o) => o.ambigu).map((o) => o.id)).toEqual(["claude", "make", "teams"]);
    expect(Object.isFrozen(NOMS_OUTILS)).toBe(true);
    expect(ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF).toBe(false);
  });
  it("test statique : pur, sans adresse, image ni couleur en dur", () => {
    const src = readFileSync("src/briques/sous-titres/noms-outils.ts", "utf8");
    expect(src).not.toMatch(/@\//);
    expect(src).not.toMatch(/http/i);
    expect(src).not.toMatch(/\.(png|svg|jpg|webp)/i);
    expect(src).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(src).not.toMatch(/from "(react|remotion)/);
  });
  it("le texte sur le fond de l'étiquette est une paire de la charte", () => {
    expect(autoriserTexte(ETIQUETTE.texte, ETIQUETTE.fond)).toBe(true);
    expect(autoriserTexte(ETIQUETTE.bord, ETIQUETTE.fond)).toBe(true);
  });
});

describe("C2-U8 : données du calque", () => {
  it("sans outils : aucune clé, mêmes plaques", () => {
    const g = [groupe("avec ChatGPT et 3 mails")];
    const d = calque(g, { pave: { mots: "chiffres" } });
    expect("motsOutils" in d).toBe(false);
    expect(d.plaques).toEqual({ g1: 3 });
    expect(JSON.stringify(calque(g))).not.toContain("motsOutils");
  });
  it("avec outils : une entrée par segment nommé, aucune pour les autres", () => {
    const d = calque([groupe("avec ChatGPT ici", "a"), groupe("rien ici", "b")], { outils: "etiquette" });
    expect(d.motsOutils).toEqual({ a: { debut: 1, longueur: 1 } });
  });
  it("avec outils et pave : le mot étiqueté ne porte jamais plaque, le suivant la prend", () => {
    const d = calque([groupe("avec Excel et 3 mails")], { outils: "etiquette", pave: { mots: "chiffres" } });
    expect(d.plaques).toEqual({ g1: 3 });
    const d2 = calque([groupe("avec Claude Sheets")], { outils: "etiquette", pave: { mots: "forts" } });
    const el = sceneAuTemps(d2, 1.9)!;
    expect(el.mots.every((m) => !(m.etiquette && m.plaque))).toBe(true);
    // « jamais » reste le mot à plaque : l'outil, lui, n'en porte pas.
    const d3 = calque([groupe("jamais Excel")], { outils: "etiquette", pave: { mots: "forts" } });
    expect(d3.plaques).toEqual({ g1: 0 });
    expect(d3.motsOutils).toEqual({ g1: { debut: 1, longueur: 1 } });
  });
});

describe("C2-U8 : dessin", () => {
  it("le mot étiqueté (deux mots : début et fin) est marqué, ni plaque ni surlignage", () => {
    const d = calque([groupe("dans Google Sheets ici", "g1", 2)], { outils: "etiquette", marqueur: { teinte: "orange" } as never });
    const el = sceneAuTemps(d, 1.9)!;
    expect(el.mots.map((m) => m.etiquette)).toEqual([undefined, "debut", "fin", undefined]);
    const css = cssElement(el, d, "Manrope");
    expect(css.mot(1).background).toBe(ETIQUETTE.fond);
    expect(css.mot(2).color).toBe(ETIQUETTE.texte);
    expect(css.mot(1).WebkitTextStroke).toBe("0");
    expect(css.mot(0).background).toBeUndefined();
  });
  it("la ligne est plus large d'une étiquette et reste dans la zone", () => {
    const base = calque([groupe("avec Excel ici")]);
    const avec = calque([groupe("avec Excel ici")], { outils: "etiquette" });
    const e0 = elementDe(base, base.segments[0], 1.9);
    const e1 = elementDe(avec, avec.segments[0], 1.9);
    expect(largeurElement(e1)).toBeGreaterThan(0);
    expect(largeurElement(e1) / e1.taillePx).toBeGreaterThan(largeurElement(e0) / e0.taillePx);
  });
  it("outils sans nom dans le texte : scène identique à celle sans outils", () => {
    const g = [groupe("des mails ici")];
    expect(sceneAuTemps(calque(g, { outils: "etiquette" }), 1.9)).toEqual(sceneAuTemps(calque(g), 1.9));
  });
});

describe("C2-U8 : empreinte", () => {
  it("sans étiquette, l'empreinte est inchangée (valeur figée)", () => {
    const d = calque([groupe("jamais 3 mails")]);
    expect(empreinteTexte({ sousTitres: d, encadre: null, incrustations: [] } as never, 1.9)).toBe('[["g1",70,921.6,0,1,1,0,[["jamais","#FAF9F5",1,0],["3","#FAF9F5",1,0],["mails","#D97757",1,0]]],false,[]]');
  });
  it("avec étiquette, l'empreinte change", () => {
    const g = [groupe("avec Excel ici")];
    const e = (d: ReturnType<typeof calque>) => empreinteTexte({ sousTitres: d, encadre: null, incrustations: [] } as never, 1.9);
    expect(e(calque(g, { outils: "etiquette" }))).not.toBe(e(calque(g)));
  });
});
