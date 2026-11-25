/**
 * S2-16-a : « refaire la voix » (module pur, éteint, sans importeur, 0 €). Quel format sait redire quoi, estimation au
 * pire cas, plafond par vidéo INJECTÉ, refus en phrases simples sans montant, avant tout appel.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listerCodes } from "../../src/formats/registre-codes";
import { CAPACITE_REFAIRE_VOIX, capaciteRefaireVoix, estimerRefaireVoix } from "../../src/domaine/refaire-voix";

const RACINE = resolve(__dirname, "../..");
const TARIF = 0.03; // centimes par caractère (0,30 pour 1 000)
const base = { texteLu: "Première phrase. Deuxième phrase plus longue. Troisième.", phrasesVisees: ["Deuxième phrase plus longue."], tarifCentimesParCaractere: TARIF, plafondCentimes: 1000, dejaEngageCentimes: 0 };

describe("table des capacités", () => {
  it("couvre TOUS les formats du registre des codes", () => {
    for (const e of listerCodes()) expect(Object.keys(CAPACITE_REFAIRE_VOIX), e.formatId).toContain(e.formatId);
  });
  it("couvre chaque dossier de format de src/formats", () => {
    const dossiers = readdirSync(join(RACINE, "src/formats")).filter((f) => statSync(join(RACINE, "src/formats", f)).isDirectory() && !f.startsWith("_") && f !== "familles");
    for (const d of dossiers) expect(Object.keys(CAPACITE_REFAIRE_VOIX), d).toContain(d);
  });
  it("valeurs fermées ; cas concret et tableau = voix entière (prise unique relue en entier) ; visage et avatar = impossible", () => {
    for (const v of Object.values(CAPACITE_REFAIRE_VOIX)) expect(["phrase", "voix-entiere", "impossible"]).toContain(v);
    expect(capaciteRefaireVoix("cas-concret")).toBe("voix-entiere");
    expect(capaciteRefaireVoix("tableau-anime")).toBe("voix-entiere");
    for (const f of ["facecam", "facecam-animee", "avocat", "image-video", "selfie", "ugc"]) expect(capaciteRefaireVoix(f), f).toBe("impossible");
  });
  it("un format inconnu est impossible (jamais une propriété héritée)", () => {
    expect(capaciteRefaireVoix("inconnu")).toBe("impossible");
    expect(capaciteRefaireVoix("constructor")).toBe("impossible");
    expect(capaciteRefaireVoix("__proto__")).toBe("impossible");
  });
});

const refus100 = () => estimerRefaireVoix({ ...base, format: "cas-concret", texteLu: "a".repeat(100) });

describe("estimation au pire cas", () => {
  it("cas concret : une phrase visée = TOUT le texte lu est relu et compté (voix en une prise)", () => {
    const r = estimerRefaireVoix({ ...base, format: "cas-concret" });
    expect(r).toEqual({ ok: true, capacite: "voix-entiere", caracteres: base.texteLu.length, centimes: Math.ceil(base.texteLu.length * TARIF) });
  });
  it("cas concret, 1 phrase visée de 20 caractères dans un texte lu de 300 : 300 caractères (jamais 20)", () => {
    const r = estimerRefaireVoix({ ...base, format: "cas-concret", texteLu: "a".repeat(300), phrasesVisees: ["b".repeat(20)] });
    expect(r).toEqual({ ok: true, capacite: "voix-entiere", caracteres: 300, centimes: 9 });
  });
  it("plusieurs phrases visées : le coût reste celui du texte lu entier", () => {
    const r = estimerRefaireVoix({ ...base, format: "cas-concret", phrasesVisees: ["Première phrase.", "Troisième."] });
    expect(r).toMatchObject({ ok: true, caracteres: base.texteLu.length });
  });
  it("voix entière : UNE phrase visée = tout le texte lu est relu et compté", () => {
    const r = estimerRefaireVoix({ ...base, format: "tableau-anime" });
    expect(r).toMatchObject({ ok: true, capacite: "voix-entiere", caracteres: base.texteLu.length });
    if (r.ok) expect(r.centimes).toBe(Math.ceil(base.texteLu.length * TARIF));
  });
  it("arrondi au centime SUPÉRIEUR (jamais en dessous du coût)", () => {
    const r = estimerRefaireVoix({ ...base, format: "cas-concret", texteLu: "a".repeat(1000) });
    expect(r).toMatchObject({ ok: true, caracteres: 1000, centimes: 30 });
    const r2 = estimerRefaireVoix({ ...base, format: "cas-concret", texteLu: "a".repeat(1001) });
    expect(r2).toMatchObject({ ok: true, centimes: 31 });
    // 100 × 0,03 vaut 3,0000000000000004 en flottant : pas un centime de plus pour une erreur d'arrondi machine.
    expect(refus100()).toMatchObject({ ok: true, caracteres: 100, centimes: 3 });
  });
});

describe("refus, avant tout appel, sans montant", () => {
  const refus = (o: object) => estimerRefaireVoix({ ...base, format: "cas-concret", ...o });
  it("format qui ne sait pas : phrase claire, rien sur le visage", () => {
    const r = estimerRefaireVoix({ ...base, format: "facecam" });
    expect(r).toMatchObject({ ok: false, code: "format-impossible" });
  });
  it("plafond dépassé (en comptant l'engagé)", () => {
    const r = refus({ plafondCentimes: 10, dejaEngageCentimes: 10 });
    expect(r).toMatchObject({ ok: false, code: "plafond-depasse" });
    expect(refus({ plafondCentimes: 11, dejaEngageCentimes: 10 })).toMatchObject({ ok: false, code: "plafond-depasse" });
    expect(refus({ plafondCentimes: 12, dejaEngageCentimes: 10 }).ok).toBe(true);
    expect(refus({ plafondCentimes: 1, dejaEngageCentimes: 0 })).toMatchObject({ ok: false, code: "plafond-depasse" });
    expect(refus({ plafondCentimes: 2, dejaEngageCentimes: 0 }).ok).toBe(true);
    expect(refus({ plafondCentimes: 0, dejaEngageCentimes: 0 })).toMatchObject({ ok: false, code: "plafond-depasse" });
  });
  it("rien à refaire (aucune phrase, phrases vides, texte vide)", () => {
    expect(refus({ phrasesVisees: [] })).toMatchObject({ ok: false, code: "rien-a-refaire" });
    expect(refus({ phrasesVisees: ["  "] })).toMatchObject({ ok: false, code: "rien-a-refaire" });
    expect(estimerRefaireVoix({ ...base, format: "tableau-anime", texteLu: "" })).toMatchObject({ ok: false, code: "rien-a-refaire" });
  });
  it("tarif ou plafond illisibles : refus, jamais gratuit par erreur", () => {
    for (const v of [Number.NaN, -1, Infinity, 0, -0]) expect(refus({ tarifCentimesParCaractere: v })).toMatchObject({ ok: false, code: "tarif-illisible" });
    for (const v of [Number.NaN, -5, Infinity]) expect(refus({ plafondCentimes: v })).toMatchObject({ ok: false, code: "plafond-illisible" });
    for (const v of [Number.NaN, -1, Infinity]) expect(refus({ dejaEngageCentimes: v })).toMatchObject({ ok: false, code: "plafond-illisible" });
  });
  it("aucune phrase de refus ne contient de montant ni de devise", () => {
    const cas = [
      estimerRefaireVoix({ ...base, format: "facecam" }),
      refus({ plafondCentimes: 0 }),
      refus({ phrasesVisees: [] }),
      refus({ tarifCentimesParCaractere: Number.NaN }),
      refus({ plafondCentimes: Number.NaN }),
    ];
    for (const r of cas) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.phrase).toMatch(/\S/);
        expect(r.phrase).not.toMatch(/\d|€|\$|euro|centime|dollar/i);
      }
    }
  });
});

describe("module pur, sans importeur", () => {
  const source = readFileSync(join(RACINE, "src/domaine/refaire-voix.ts"), "utf8");
  it("aucun import de fournisseur, d'argent, de service ni de réglage", () => {
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports) expect(i, i).toMatch(/^\.\.?\/(?!fournisseurs|services|donnees)/);
    expect(source).not.toMatch(/lireParametre\(|depenserSelonOrigine|reserverPourUsine|verifierBudgetEtCredits/);
  });
  it("aucun fichier de src/ n'importe refaire-voix", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts)$/.test(f) && !p.endsWith("domaine/refaire-voix.ts") && /refaire-voix/.test(readFileSync(p, "utf8"))) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    expect(vus).toEqual([]);
  });
});
