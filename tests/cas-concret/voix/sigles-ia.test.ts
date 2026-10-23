/**
 * L0b (15/10, analyse A1) : « l'I.A. » était lu « li… (blanc de 0,6 s) … A » par la voix. Le texte dit garde « I.A. »
 * (R22, sous-titres et écrans), mais la voix reçoit la prononciation de la liste (« IA → i-a ») ; et un sigle rendu
 * comme UN mot avec un blanc à l'intérieur est une hésitation. Fonctions pures, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { contientMot, substituerPrononciations } from "@/domaine/prononciations";
import type { MotHorodate } from "@/domaine/types";
import { controlerPrise } from "@/moteurs/montage-cas-concret/voix";

const IA = [{ mot: "IA", prononciation: "i-a" }];

describe("L0b · « I.A. » reconnu par la liste des prononciations", () => {
  it("« l'I.A. » est lu « l'i-a » ; « IA » et « l'IA » comme avant", () => {
    expect(substituerPrononciations("Puis l'I.A. écrit l'article.", IA)).toBe("Puis l'i-a écrit l'article.");
    expect(substituerPrononciations("Une I.A. qui travaille, l'IA qui écrit.", IA)).toBe("Une i-a qui travaille, l'i-a qui écrit.");
    expect(substituerPrononciations("Grâce à l'I.A, tout va vite.", IA)).toBe("Grâce à l'i-a, tout va vite.");
  });

  it("un « I.A. » qui finit la phrase garde son point (la voix marque la fin)", () => {
    expect(substituerPrononciations("Tout est fait par l'I.A. Puis on publie.", IA)).toBe("Tout est fait par l'i-a. Puis on publie.");
    expect(substituerPrononciations("Tout est fait par l'I.A.", IA)).toBe("Tout est fait par l'i-a.");
  });

  it("un autre sigle qui contient « I.A. » n'est pas touché", () => {
    expect(substituerPrononciations("Le P.I.A. et le I.A.B. restent.", IA)).toBe("Le P.I.A. et le I.A.B. restent.");
    expect(contientMot("le P.I.A.", "IA")).toBe(false);
    expect(contientMot("Puis l'I.A. écrit", "IA")).toBe(true);
  });
});

/** Mots horodatés : 300 ms par mot ; `longs[i]` : durée (ms) du mot i ; `ecarts[i]` : blanc (ms) après le mot i. */
function mots(texte: string, longs: Record<number, number> = {}, ecarts: Record<number, number> = {}): MotHorodate[] {
  const res: MotHorodate[] = [];
  let t = 0.05;
  texte
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m))
    .forEach((mot, i) => {
      const d = (longs[i] ?? 300) / 1000;
      res.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + d).toFixed(3) });
      t += d + (ecarts[i] ?? 100) / 1000;
    });
  return res;
}

describe("L0b · contrôle de la prise : un sigle coupé en deux est une hésitation", () => {
  it("« l'I.A. » rendu comme un seul mot de près d'une seconde (blanc intérieur) : rejeté, la phrase est nommée", () => {
    const t = "Puis l'I.A. écrit l'article.";
    const r = controlerPrise({ texte: t, mots: mots(t, { 1: 960 }) });
    expect(r).toMatchObject({ rejet: "traine", phrase: t });
    expect((r as { detail: string }).detail).toContain("l'I.A.");
  });

  it("même chose quand la voix a reçu la prononciation (« l'i-a »)", () => {
    const t = "Puis l'i-a écrit l'article.";
    expect(controlerPrise({ texte: t, mots: mots(t, { 1: 960 }) })).toMatchObject({ rejet: "traine" });
  });

  it("« l'I.A. » dit normalement (0,4 s) passe ; « R.G.P.D. » épelé en 0,9 s passe", () => {
    const t = "Puis l'I.A. écrit l'article conforme au R.G.P.D. tout de suite.";
    expect(controlerPrise({ texte: t, mots: mots(t, { 1: 400, 6: 900 }) })).toEqual({ ok: true });
  });

  it("« l'I.A. » au milieu d'une phrase ne la coupe pas : un long blanc après lui est une traîne", () => {
    const t = "Puis l'I.A. écrit l'article.";
    expect(controlerPrise({ texte: t, mots: mots(t, {}, { 1: 700 }) })).toMatchObject({ rejet: "traine", phrase: t });
  });
});
