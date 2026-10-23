/**
 * Refus IV_CONTROLES de v-6e4a06b9c718 (23/10/2026) : la voix disait bien le script, la COMPARAISON se trompait (« 80% »
 * transcrit « 4 » « -20 » « % », « 24h sur 24 », « e-mail » écrit « email »). Les transcriptions Whisper réelles sont
 * rejouées ici. AUCUN seuil n'est assoupli : les mots que Whisper a vraiment mal entendus restent des manques.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { texteDuCorps } from "@/domaine/image-video/fiche";
import { clesChiffresDits, comparerAuScript, formeDite, formesComparables, recollerMotsWhisper, SEUILS_ECOUTE_IV, transcriptionUtile } from "@/moteurs/montage-image-video/ecoute";

interface Piste { version: string; finVoixSec: number; fin: { muet?: boolean; question?: { dit?: string }; appels: { dit: string }[] }; transcription: { mot: string; debutSec: number; finSec: number }[] }
const FIXTURE = JSON.parse(readFileSync(join(__dirname, "fixtures", "ecoute-v-6e4a06b9c718.json"), "utf8")) as { fiche: Parameters<typeof texteDuCorps>[0]; pistes: Piste[] };

/** Même assemblage que `controles.ts` : corps + fin lue. */
const scriptDe = (p: Piste): string => {
  const fin = p.fin && !p.fin.muet ? [p.fin.question?.dit ?? "", ...p.fin.appels.map((a) => a.dit)] : [];
  return [texteDuCorps(FIXTURE.fiche), ...fin].map((t) => t.trim()).filter(Boolean).join(" ");
};

const mot = (m: string, t = 0) => ({ mot: m, debutSec: t, finSec: t + 0.2 });
const mots = (...l: string[]) => l.map((m, i) => mot(m, i));

describe("v-6e4a06b9c718 : transcriptions réelles rejouées", () => {
  it("garde-fou : le seuil d'écoute reste à 97 %", () => {
    expect(SEUILS_ECOUTE_IV.retrouvesMin).toBe(0.97);
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : 97 % atteints, aucun chiffre inventé ni manquant, 24h/24 et 80 % entendus", (_v, p) => {
    const script = scriptDe(p);
    const u = transcriptionUtile(p.transcription, { finVoixSec: p.finVoixSec, script });
    const c = comparerAuScript(script, u.mots);
    expect(c.part).toBeGreaterThanOrEqual(0.97);
    expect(c.chiffresInventes).toEqual([]);
    expect(c.chiffresNonEntendus).toEqual([]);
    const cles = clesChiffresDits(u.mots.map((m) => m.mot).join(" "));
    expect(cles).toContain("plage|24h/24");
    expect(cles).toContain("80|%");
    expect(cles).not.toContain("4|nombre");
    expect(cles).not.toContain("24|h");
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : les mots vraiment mal entendus par Whisper restent des manques (aucun assouplissement caché)", (v, p) => {
    const script = scriptDe(p);
    const u = transcriptionUtile(p.transcription, { finVoixSec: p.finVoixSec, script });
    const c = comparerAuScript(script, u.mots);
    const attendus = ["sans", "ia", "dort", "telegram", "en"];
    if (v !== "fin-linkedin") attendus.push("aux");
    expect([...c.manques].sort()).toEqual([...attendus].sort());
  });
});

describe("recollerMotsWhisper : « quatre-vingts » coupé par Whisper", () => {
  const texte = (l: ReturnType<typeof mots>) => recollerMotsWhisper(l).map((m) => m.mot);
  it("« 4 » « -20 » « % » donne « 80% »", () => expect(texte(mots("4", "-20", "%"))).toEqual(["80%"]));
  it("« 4 » « -20 » « -5 » donne « 85 »", () => expect(texte(mots("4", "-20", "-5"))).toEqual(["85"]));
  it("« 60 » « -10 » donne « 70 »", () => expect(texte(mots("60", "-10"))).toEqual(["70"]));
  it("des nombres qui ne sont pas des compositions ne changent pas", () => {
    expect(texte(mots("10", "-15"))).toEqual(["10", "-15"]);
    expect(texte(mots("4", "-2"))).toEqual(["4", "-2"]);
    expect(texte(mots("4", "-200"))).toEqual(["4", "-200"]);
    expect(texte(mots("14", "-20"))).toEqual(["14", "-20"]);
  });
  it("un mot déjà entier n'est pas converti, et la suite est bornée (« -20h » n'est pas « quatre-vingts »)", () => {
    expect(texte(mots("60-12"))).toEqual(["60-12"]);
    expect(texte(mots("4-20"))).toEqual(["4-20"]);
    expect(texte(mots("4", "-20h"))).toEqual(["4", "-20h"]);
  });
  it("les recollages existants restent valables", () => {
    expect(texte(mots("Vingt", "-trois"))).toEqual(["Vingt-trois"]);
    expect(texte(mots("80", "%"))).toEqual(["80%"]);
  });
});

describe("chiffres : « 24h sur 24 » vaut « 24h/24 », jamais sans unité", () => {
  const cle = (t: string) => clesChiffresDits(t);
  it.each(["24h sur 24", "24 h sur 24", "24 heures sur 24", "24h/24"])("« %s » donne la plage 24h/24", (t) => expect(cle(t)).toContain("plage|24h/24"));
  it.each(["7j sur 7", "7 jours sur 7", "7j/7"])("« %s » donne la plage 7j/7", (t) => expect(cle(t)).toContain("plage|7j/7"));
  it("« 24 sur 24 » (sans unité) reste deux nombres : la règle « valeur ET unité » est gardée", () => {
    const c = cle("24 sur 24");
    expect(c).not.toContain("plage|24h/24");
    expect(c.filter((k) => k === "24|nombre").length).toBeGreaterThan(0);
  });
});

describe("e-mail / email : même mot des deux côtés", () => {
  it("formesComparables ne dépend pas du trait d'union", () => expect(formesComparables("un e-mail")).toEqual(formesComparables("un email")));
  it("formeDite remet le trait d'union des mots composés courants écrits d'un bloc, et est idempotente", () => {
    expect(formeDite("email")).toBe("e-mail");
    expect(formeDite("e-mail")).toBe("e-mail");
    expect(formeDite("weekend")).toBe("week-end");
    expect(formeDite(formeDite("emails"))).toBe("e-mails");
    expect(formeDite("vingt-trois")).toBe("vingt-trois");
    expect(formeDite("mailing")).toBe("mailing");
  });
  it("« Il rédige un e-mail. » entendu « email » ou « e » « mail » : 100 %", () => {
    expect(comparerAuScript("Il rédige un e-mail.", mots("Il", "rédige", "un", "email.")).part).toBe(1);
    expect(comparerAuScript("Il rédige un e-mail.", mots("Il", "rédige", "un", "e", "mail.")).part).toBe(1);
  });
  it("« week-end » entendu « week » « end » ou « weekend » : 100 % (pas de refus à tort)", () => {
    expect(comparerAuScript("Un week-end entier.", mots("Un", "week", "end", "entier.")).part).toBe(1);
    expect(comparerAuScript("Un week-end entier.", mots("Un", "weekend", "entier.")).part).toBe(1);
  });
  it("un mot vraiment non dit reste un manque", () => {
    expect(comparerAuScript("Il rédige un e-mail.", mots("Il", "rédige", "un", "courrier.")).part).toBeLessThan(1);
  });
});
