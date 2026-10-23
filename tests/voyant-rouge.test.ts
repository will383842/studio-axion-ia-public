import { describe, expect, it } from "vitest";
import { avecSecondOuiVoyant, avisMalgreVoyant, demandeConfirmationVoyant, voyantDeVersion } from "@/domaine/voyant-rouge";

const bonne = { note: { globale: 90 }, controles: { violations: [] } };
const faible = { note: { globale: 60 }, controles: { violations: [] } };
const gardeFou = { note: { globale: 95 }, controles: { violations: [{ controle: "C1", bloquant: true }] } };

describe("voyant d'une version (note + garde-fous déjà enregistrés)", () => {
  it("vert, ambre, rouge", () => {
    expect(voyantDeVersion(bonne)).toBe("vert");
    expect(voyantDeVersion({ note: { globale: 75 }, controles: { violations: [] } })).toBe("ambre");
    expect(voyantDeVersion(faible)).toBe("rouge");
  });
  it("un garde-fou échoué rend rouge même avec une bonne note", () => {
    expect(voyantDeVersion(gardeFou)).toBe("rouge");
  });
  it("note absente ou à 0 = « non notée » (l'écran affiche « — ») : pas de rouge, seuls les garde-fous comptent", () => {
    expect(voyantDeVersion({ note: { globale: 0 }, controles: { violations: [] } })).not.toBe("rouge");
    expect(voyantDeVersion({ controles: { violations: [] } })).not.toBe("rouge");
    expect(demandeConfirmationVoyant([{ code: "A", note: { globale: 0 }, controles: { violations: [] } }])).toBeNull();
    expect(voyantDeVersion({ note: { globale: 0 }, controles: { violations: [{ controle: "C1", bloquant: true }] } })).toBe("rouge");
  });
  it("une violation bloquante hors garde-fous ne rend pas rouge à elle seule", () => {
    expect(voyantDeVersion({ note: { globale: 90 }, controles: { violations: [{ controle: "C9999", bloquant: true }] } })).toBe("vert");
  });
});

describe("seconde confirmation avant la voix payante (blocage doux)", () => {
  it("rien à confirmer quand aucun voyant n'est rouge", () => {
    expect(demandeConfirmationVoyant([{ code: "A", ...bonne }])).toBeNull();
  });
  it("demande une confirmation, en français simple, une seule fois pour plusieurs versions rouges", () => {
    const d = demandeConfirmationVoyant([{ code: "A", ...faible }, { code: "B", ...gardeFou }, { code: "C", ...bonne }]);
    expect(d).not.toBeNull();
    expect(d!.codes).toEqual(["A", "B"]);
    // La vraie raison, en français simple (l'écran n'affiche jamais de « voyant rouge » : point ambre ou vert).
    expect(d!.message).toContain("La version A a une note de 60 sur 100");
    expect(d!.message).toContain("Une règle importante n'est pas respectée dans la version B");
    expect(d!.message).not.toMatch(/voyant/i);
    expect(d!.message).toMatch(/Elle est payante/);
  });
  it("une note sous 70 seule demande aussi la confirmation (décision documentée : doux, jamais bloquant)", () => {
    expect(demandeConfirmationVoyant([{ code: "A", ...faible }])).not.toBeNull();
  });
  it("JAMAIS sur un script collé par Will : pris à l'identique, ni contrôlé ni bloqué", () => {
    expect(demandeConfirmationVoyant([{ code: "A", origine: "will", ...faible }, { code: "B", origine: "will", ...gardeFou }])).toBeNull();
  });
  it("mélange : seules les versions de la machine comptent", () => {
    expect(demandeConfirmationVoyant([{ code: "A", origine: "will", ...faible }, { code: "B", ...faible }])!.codes).toEqual(["B"]);
  });
  it("la confirmation donnée est enregistrée dans avisWill.malgreVoyant", () => {
    const a = avisMalgreVoyant(faible, "2026-10-18T10:00:00.000Z");
    expect(a).toEqual({ voyant: "rouge", note: 60, gardeFous: [], le: "2026-10-18T10:00:00.000Z" });
    expect(avisMalgreVoyant(gardeFou, "x").gardeFous).toEqual(["C1"]);
  });
});

describe("l'écran : le second oui demandé une seule fois, sans doublon de message", () => {
  const rouge = { ok: false as const, code: "VOYANT_ROUGE", message: "La version A a une note de 60 sur 100." };
  it("pas de voyant rouge : un seul appel, aucune question", async () => {
    const appels: boolean[] = [];
    const demander = async () => true;
    const r = await avecSecondOuiVoyant(async (m) => (appels.push(m), { ok: true as const }), demander);
    expect(r).toEqual({ ok: true });
    expect(appels).toEqual([false]);
  });
  it("voyant rouge puis oui : la question reprend le message du serveur, l'appel repart une fois avec la confirmation", async () => {
    const appels: boolean[] = [];
    const questions: string[] = [];
    const r = await avecSecondOuiVoyant(async (m) => (appels.push(m), m ? { ok: true as const } : rouge), async (q) => (questions.push(q), true));
    expect(r).toEqual({ ok: true });
    expect(appels).toEqual([false, true]);
    expect(questions).toEqual([rouge.message]);
  });
  it("voyant rouge puis non : rien n'est lancé, une seule phrase « Rien n'a été créé ni payé »", async () => {
    const appels: boolean[] = [];
    const r = await avecSecondOuiVoyant(async (m) => (appels.push(m), rouge), async () => false);
    expect(appels).toEqual([false]);
    expect(r).toEqual({ ok: false, code: "VOYANT_ROUGE", message: "Rien n'a été créé ni payé." });
  });
  it("oui au voyant puis nouvelle confirmation du prix : une seule question voyant", async () => {
    // Le serveur redemande le prix (CONFIRMATION_REQUISE) puis l'écran relance : le oui déjà donné est gardé.
    const oui = { current: false };
    const appels: boolean[] = [];
    const questions: string[] = [];
    const serveur = async (m: boolean) => {
      appels.push(m);
      if (!m) return rouge;
      return appels.filter((x) => x).length === 1 ? { ok: false as const, code: "CONFIRMATION_REQUISE", message: "Prix du jour" } : { ok: true as const };
    };
    const demander = async (q: string) => (questions.push(q), true);
    const r1 = await avecSecondOuiVoyant(serveur, demander, oui);
    expect(r1).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const r2 = await avecSecondOuiVoyant(serveur, demander, oui);
    expect(r2.ok).toBe(true);
    expect(questions).toHaveLength(1);
    expect(appels).toEqual([false, true, true]);
  });
  it("un autre refus passe tel quel, sans question", async () => {
    const autre = { ok: false as const, code: "BUDGET_DEPASSE", message: "Budget dépassé." };
    let posee = false;
    const r = await avecSecondOuiVoyant(async () => autre, async () => ((posee = true), true));
    expect(r).toEqual(autre);
    expect(posee).toBe(false);
  });
});
