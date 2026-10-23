/**
 * Écoute : Whisper découpe parfois un mot en plusieurs « mots » (première vraie transcription, v-dd3049053f88,
 * 18/10 : « Vingt » « -trois », « 80 » « % », « l » « 'analyse »). Recollés avant la comparaison, ils ne font plus
 * passer pour manquants ou inventés des mots et des chiffres que la voix a dits.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { comparerAuScript, recollerMotsWhisper, transcriptionUtile } from "@/moteurs/montage-image-video/ecoute";

const mots = (...m: string[]): MotHorodate[] => m.map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

describe("recollerMotsWhisper", () => {
  it("recolle un fragment à trait d'union, une apostrophe ou un « % » après un nombre ; garde début du premier et fin du dernier", () => {
    const r = recollerMotsWhisper(mots("Vingt", "-trois", "heures", "80", "%", "l", "'analyse", "20", "€"));
    expect(r.map((m) => m.mot)).toEqual(["Vingt-trois", "heures", "80%", "l'analyse", "20€"]);
    expect(r[0]).toMatchObject({ debutSec: 0, finSec: 0.55 });
  });

  it("ne touche ni aux mots entiers, ni à un « % » qui ne suit pas un nombre, ni au premier mot", () => {
    const r = recollerMotsWhisper(mots("%", "bonjour", "-", "il", "y", "a"));
    expect(r.map((m) => m.mot)).toEqual(["%", "bonjour", "-", "il", "y", "a"]);
    expect(recollerMotsWhisper([])).toEqual([]);
  });
});

describe("écoute : transcription Whisper découpée, script en toutes lettres", () => {
  it("« Vingt -trois heures quatorze » et « 80 % » sont retrouvés ; aucun chiffre manquant ni inventé", () => {
    const script = "Vingt-trois heures quatorze. Quatre-vingts pour cent des cas.";
    const entendus = mots("Vingt", "-trois", "heures", "quatorze.", "80", "%", "des", "cas.");
    const utile = transcriptionUtile(entendus, { finVoixSec: 5, script });
    const c = comparerAuScript(script, utile.mots);
    expect(c.part).toBe(1);
    expect(c.chiffresNonEntendus).toEqual([]);
    expect(c.chiffresInventes).toEqual([]);
  });
});
