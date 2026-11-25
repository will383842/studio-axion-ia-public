// S-14-c1 : aperçu commun du chat. Pur, 0 €, aucun appel réel.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controler } from "../../outils/gardes/regles-de-fer.mjs";
import { PHRASES } from "@/briques/retouche-portee";
import { estimerRefaireVoix } from "@/domaine/refaire-voix";
import type { OperationRetouche } from "@/briques/operations";
import * as M from "@/services/retouche-chat/apercu-commun";
import { apercuCommun, sceneALInstant, type EntreeApercuCommun } from "@/services/retouche-chat/apercu-commun";

const sc = (id: string, debutMs: number, finMs: number) => ({ id, debutMs, finMs });
const plan = { scenes: [sc("a", 0, 1000), sc("b", 1000, 2000), sc("c", 3000, 4000)] } as never;
const gratuit: OperationRetouche = { type: "changer-mot", sceneId: "b", ancien: "un", nouveau: "deux" };
const voix: OperationRetouche = { type: "modifier-script", ancien: "x", nouveau: "y" };
// Dans le vocabulaire « chat », seul un type inconnu est de portée « ia » (le plus prudent) ; aucun type n'est « claude ».
const ia = { type: "type-inconnu" } as unknown as OperationRetouche;
const base = (o: Partial<EntreeApercuCommun>): EntreeApercuCommun => ({ generateur: "plan-scenes", format: "cas-concret", operations: [gratuit], impact: { scenes: ["b"], total: 3, voixTouchee: false }, plan, ...o });
const ok = { ok: true, capacite: "voix-entiere", caracteres: 10, centimes: 5 } as const;
const refus = estimerRefaireVoix({ format: "cas-concret", texteLu: "abc", phrasesVisees: ["abc"], tarifCentimesParCaractere: 1, plafondCentimes: 0, dejaEngageCentimes: 0 });

describe("S-14-c1 aperçu commun", () => {
  it("(a) le coût, phrase exacte par cas", () => {
    expect(apercuCommun(base({})).cout).toEqual({ famille: "gratuite", phrases: [M.PHRASE_GRATUIT] });
    expect(M.PHRASE_GRATUIT).toBe("Gratuit : rien n'est payé.");
    const v = (extra: Partial<EntreeApercuCommun>) => apercuCommun(base({ operations: [voix], ...extra })).cout;
    expect(v({ estimationVoix: ok })).toEqual({ famille: "dans-la-limite", phrases: ["La voix sera refaite : c'est payant, dans la limite prévue pour cette vidéo."] });
    expect(v({ estimationVoix: undefined })).toEqual({ famille: "inconnue", phrases: ["Ce que coûte cette retouche n'est pas connu pour ce format : rien n'est lancé."] });
    expect(v({ estimationVoix: null }).famille).toBe("inconnue");
    const imp = v({ format: "avocat", estimationVoix: ok });
    expect(imp.famille).toBe("refusee");
    expect(imp.phrases).toEqual([(estimerRefaireVoix({ format: "avocat", texteLu: "", phrasesVisees: [], tarifCentimesParCaractere: 1, plafondCentimes: 1, dejaEngageCentimes: 0 }) as { phrase: string }).phrase]);
    expect(refus.ok).toBe(false);
    expect(v({ estimationVoix: refus })).toEqual({ famille: "refusee", phrases: [(refus as { phrase: string }).phrase] });
    expect(apercuCommun(base({ operations: [ia, gratuit] })).cout.phrases[0]).toBe(`Payant : refusé. ${PHRASES.ia}`);
    for (const s of ["claude", "regles", "rien", undefined] as const) {
      const p = apercuCommun(base({ sourceLecture: s })).cout.phrases;
      expect(p.includes(M.PHRASE_LECTURE_CLAUDE)).toBe(s === "claude");
      expect(p[0]).toBe(M.PHRASE_GRATUIT);
    }
  });

  it("(b) aucun montant, et le témoin rougit", () => {
    const types = ["changer-mot", "ajouter-chiffre", "changer-brique", "decaler-scene", "changer-habillage", "ajouter-piece", "retirer-piece", "remplacer-piece", "changer-transition", "ajouter-dynamisme", "ajuster-zoom", "modifier-script", "couper-mots", "changer-sous-titre", "retirer-scene", "changer-son", "deplacer", "inconnu"];
    const ops = types.map((t) => ({ type: t, sceneId: "a" }) as unknown as OperationRetouche);
    const textes: string[] = (Object.values(M) as unknown[]).filter((v): v is string => typeof v === "string");
    for (let n = 1; n <= 7; n++) textes.push(...apercuCommun(base({ operations: ops.slice(0, 5).concat(Array(n).fill(gratuit)), sourceLecture: "claude", instant: { ms: n * 400 } })).resume);
    for (const e of [base({ operations: [voix], estimationVoix: ok }), base({ operations: [voix] }), base({ operations: [voix], format: "avocat" }), base({ operations: [ia] }), base({ instant: { ms: 2500 } }), base({ impact: null })]) {
      const a = apercuCommun(e);
      textes.push(a.ceQuiChange, ...a.cout.phrases, ...a.resume, a.instant ?? "");
    }
    textes.push(...ops.map((o) => apercuCommun(base({ operations: [o] })).resume.join(" ")));
    const defauts = (c: string) => (controler([{ chemin: "src/components/retouche-chat/X.tsx", contenu: c }], { exceptions: {} }) as { defauts: { regle: string }[] }).defauts.map((d) => d.regle);
    expect(textes.length).toBeGreaterThan(40);
    expect(defauts(textes.map((t) => `const t = ${JSON.stringify(t)};`).join("\n"))).toEqual([]);
    expect(defauts(`const t = "Coût : ${2 + 4},${3 + 3}0 ${String.fromCharCode(0x20ac)} par vidéo";`)).toContain("montant");
  });

  it("(c) sceneALInstant", () => {
    expect(sceneALInstant(plan, 0)).toEqual({ sceneId: "a", numero: 1 });
    expect(sceneALInstant(plan, 1000)).toEqual({ sceneId: "b", numero: 2 });
    expect(sceneALInstant(plan, 999)?.sceneId).toBe("a");
    expect(sceneALInstant(plan, 2500)).toBeNull();
    for (const ms of [-1, NaN, Infinity]) expect(sceneALInstant(plan, ms)).toBeNull();
    expect(sceneALInstant({ scenes: [] } as never, 10)).toBeNull();
    expect(apercuCommun(base({ instant: { ms: 2500 } })).instant).toBe("Le moment choisi ne tombe dans aucune scène : écrivez la scène voulue.");
    expect(apercuCommun(base({ instant: { ms: 1500 } })).instant).toBe("À 0:01, scène 2.");
    expect(apercuCommun(base({ instant: { ms: 3 * 60000 + 3500 } })).instant).toBe("Le moment choisi ne tombe dans aucune scène : écrivez la scène voulue.");
    expect(apercuCommun(base({ instant: null })).instant).toBeNull();
  });

  it("(d) résumé", () => {
    const n = (k: number) => apercuCommun(base({ operations: Array(k).fill(gratuit) })).resume;
    expect(n(0)).toEqual([]);
    expect(n(1)).toEqual(["Voici ce que je vais faire :", "Scène 2 : le mot « un » devient « deux ».", "Rien ne sera fait tant que vous n'avez pas cliqué « Appliquer »."]);
    expect(n(5)).toHaveLength(7);
    expect(n(6)).toContain("Et 1 autre changement.");
    expect(n(6)).toHaveLength(8);
    expect(n(7)).toContain("Et 2 autres changements.");
    const dec = (decalageMs: number) => apercuCommun(base({ operations: [{ type: "decaler-scene", sceneId: "a", decalageMs }] })).resume[1];
    expect(dec(-200)).toBe("Scène 1 : elle commence plus tôt.");
    expect(dec(200)).toBe("Scène 1 : elle commence plus tard.");
    const inc = apercuCommun(base({ operations: [{ type: "zzz" } as never, gratuit] })).resume;
    expect(inc).toHaveLength(3);
    expect(apercuCommun(base({ operations: [{ type: "retirer-scene", sceneId: "c" }, { type: "deplacer", sceneId: "a", apresSceneId: "c" }] })).resume.join("|")).not.toMatch(/\b[abc]\b(?! scène)(?=\s*:)/);
    expect(apercuCommun(base({ operations: [{ type: "retirer-scene", sceneId: "zzz-brut" }] })).resume.join("")).not.toContain("zzz-brut");
  });

  it("(e) impact non fourni", () => {
    const a = apercuCommun(base({ impact: null }));
    expect(a.ceQuiChange).toBe("Ce qui change n'est pas fourni pour ce format.");
    expect(a.appliquable).toBe(true);
    expect(apercuCommun(base({})).ceQuiChange).toBe("1 scène sur 3 sera refaite, la voix ne change pas.");
  });

  it("(f) voix sans estimation ou refusée", () => {
    const a = apercuCommun(base({ operations: [voix] }));
    expect([a.cout.famille, a.appliquable]).toEqual(["inconnue", false]);
    const r = apercuCommun(base({ operations: [voix], estimationVoix: { ok: false, code: "plafond-depasse", phrase: "P" } }));
    expect([r.cout.famille, r.cout.phrases, r.appliquable]).toEqual(["refusee", ["P"], false]);
    expect(apercuCommun(base({ operations: [voix], estimationVoix: ok })).appliquable).toBe(true);
    expect(apercuCommun(base({ operations: [ia] })).appliquable).toBe(false);
  });

  it("(g) sans importeur, pur, stable, ne lève jamais", () => {
    const liste = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? liste(join(d, n)) : [join(d, n)]));
    const importeurs = liste("src").filter((f) => /\.tsx?$/.test(f) && !f.endsWith("apercu-commun.ts") && /apercu-commun/.test(readFileSync(f, "utf8")));
    expect(importeurs).toEqual([]);
    const src = readFileSync("src/services/retouche-chat/apercu-commun.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^import /.test(l)).join("\n");
    for (const m of ["lireParametre", "@/fournisseurs", "prisma", "@/db", "credits", "budget", "tarifs", "depense", "VideoAnimeeV4", "briques-v4", "studio-rendu", "registre-v4"]) expect(imports).not.toContain(m);
    expect(src.split("\n").length).toBeLessThanOrEqual(160);
    const e = base({ operations: [gratuit, voix], estimationVoix: ok, instant: { ms: 500 } });
    const copie = JSON.stringify(e);
    expect(apercuCommun(e)).toEqual(apercuCommun(e));
    expect(JSON.stringify(e)).toBe(copie);
    for (const x of [null, undefined, {}, { operations: null }] as never[]) {
      expect(apercuCommun(x).appliquable).toBe(false);
    }
    for (const x of [{ operations: [null, 3] }] as never[]) {
      expect(apercuCommun(x).resume).toEqual([]);
    }
  });
});
