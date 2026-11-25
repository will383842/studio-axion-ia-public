// S-14-c1 : aperçu commun PUR du chat (0 €, aucun appel). Un test nommé par promesse (a)-(g).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OperationRetouche, TypeOperationRetouche } from "@/briques/operations";
import { TYPES_OPERATIONS_RETOUCHE } from "@/briques/operations";
import { PHRASES } from "@/briques/retouche-portee";
import type { EstimationRefaireVoix } from "@/domaine/refaire-voix";
import {
  apercuCommun,
  sceneALInstant,
  type EntreeApercuCommun,
  FIN_RESUME,
  PHRASE_COUT_INCONNU,
  PHRASE_FORMAT_IMPOSSIBLE,
  PHRASE_GRATUIT,
  PHRASE_IMPACT_NON_FOURNI,
  PHRASE_INSTANT_HORS_SCENE,
  PHRASE_LECTURE,
  PHRASE_PAYANT_REFUSE,
  PHRASE_VOIX_DANS_LA_LIMITE,
  TITRE_RESUME,
} from "@/services/retouche-chat/apercu-commun";
import { controler } from "../../outils/gardes/regles-de-fer.mjs";

const plan = {
  scenes: [
    { id: "s-alpha", debutMs: 0, finMs: 4000 },
    { id: "s-beta", debutMs: 4000, finMs: 9000 },
    { id: "s-gamma", debutMs: 10000, finMs: 12000 },
  ],
} as never;
const motOp = (n = "s-beta"): OperationRetouche => ({ type: "changer-mot", sceneId: n, ancien: "a", nouveau: "b" });
const scriptOp: OperationRetouche = { type: "modifier-script", ancien: "a", nouveau: "b" };
const base = (o: Partial<EntreeApercuCommun> = {}): EntreeApercuCommun => ({
  generateur: "plan-scenes",
  format: "cas-concret",
  operations: [motOp()],
  impact: { scenes: ["s-beta"], total: 3, voixTouchee: false },
  plan,
  ...o,
});
const okVoix: EstimationRefaireVoix = { ok: true, capacite: "voix-entiere", caracteres: 10, centimes: 1 };
const refuseVoix: EstimationRefaireVoix = { ok: false, code: "plafond-depasse", phrase: "Cette nouvelle voix dépasserait la limite prévue pour cette vidéo : rien n'est lancé, votre vidéo reste telle quelle." };

const un = (type: TypeOperationRetouche): OperationRetouche =>
  ({
    "changer-mot": motOp(),
    "ajouter-chiffre": { type, sceneId: "s-alpha", valeur: 1, libelle: "x" },
    "changer-brique": { type, sceneId: "s-alpha", piece: "legende" },
    "decaler-scene": { type, sceneId: "s-alpha", decalageMs: -200 },
    "changer-habillage": { type },
    "ajouter-piece": { type, sceneId: "s-alpha", piece: "legende" },
    "retirer-piece": { type, sceneId: "s-alpha", piece: "legende" },
    "remplacer-piece": { type, sceneId: "s-alpha", ancienne: "legende", nouvelle: "legende" },
    "changer-transition": { type },
    "ajouter-dynamisme": { type, intensite: "leger" },
    "ajuster-zoom": { type, sceneId: "s-gamma" },
    "modifier-script": scriptOp,
    "couper-mots": { type, premier: 1, dernier: 2 },
    "changer-sous-titre": { type, motIndex: 1, nouveau: "x" },
    "retirer-scene": { type, sceneId: "s-gamma" },
    "changer-son": { type, sceneId: "s-alpha", sonId: "x" },
    deplacer: { type, sceneId: "s-alpha", apresSceneId: "s-beta" },
  })[type] as unknown as OperationRetouche;

describe("S-14-c1 aperçu commun", () => {
  it("(a) le coût, phrase exacte par cas", () => {
    const cas: [Partial<EntreeApercuCommun>, string, string, boolean][] = [
      [{ operations: [{ type: "changer-brique", sceneId: "s-alpha", piece: "legende" }] }, "gratuite", PHRASE_GRATUIT, true],
      [{ operations: [{ type: "retirer-scene", sceneId: "s-alpha" } as OperationRetouche, { type: "inconnu" } as never] }, "refusee", `${PHRASE_PAYANT_REFUSE} ${PHRASES.ia}`, false],
      [{ operations: [scriptOp], format: "avocat", estimationVoix: okVoix }, "refusee", PHRASE_FORMAT_IMPOSSIBLE, false],
      [{ operations: [scriptOp], estimationVoix: refuseVoix }, "refusee", refuseVoix.phrase, false],
      [{ operations: [scriptOp], estimationVoix: okVoix }, "dans-la-limite", PHRASE_VOIX_DANS_LA_LIMITE, true],
      [{ operations: [scriptOp] }, "inconnue", PHRASE_COUT_INCONNU, false],
      [{ operations: [scriptOp], estimationVoix: null }, "inconnue", PHRASE_COUT_INCONNU, false],
    ];
    for (const [e, famille, phrase, ok] of cas) {
      const r = apercuCommun(base(e));
      expect(r.cout.famille).toBe(famille);
      expect(r.cout.phrases).toEqual([phrase]);
      expect(r.appliquable).toBe(ok);
    }
    expect(apercuCommun(base({ sourceLecture: "claude" })).cout.phrases).toEqual([PHRASE_GRATUIT, PHRASE_LECTURE]);
    for (const s of ["regles", "rien", undefined] as const) expect(apercuCommun(base({ sourceLecture: s })).cout.phrases).toEqual([PHRASE_GRATUIT]);
    expect(PHRASES.claude).toContain("Claude");
  });

  it("(b) aucun montant", () => {
    const phrases: string[] = [];
    for (const t of TYPES_OPERATIONS_RETOUCHE) {
      const r = apercuCommun(base({ operations: [un(t)], estimationVoix: okVoix, sourceLecture: "claude", instant: { ms: 5000 } }));
      phrases.push(r.ceQuiChange, ...r.cout.phrases, ...r.resume, r.instant ?? "");
    }
    for (const e of [{ estimationVoix: refuseVoix }, { format: "avocat" }, {}, { impact: null }, { instant: { ms: 99999 } }])
      for (const ops of [[scriptOp], [{ type: "zzz" } as never]]) {
        const r = apercuCommun(base({ ...e, operations: ops }));
        phrases.push(r.ceQuiChange, ...r.cout.phrases, ...r.resume, r.instant ?? "");
      }
    const verifier = (contenu: string) => (controler([{ chemin: "src/components/retouche-chat/X.tsx", contenu }], { exceptions: {} }) as { defauts: { regle: string }[] }).defauts.map((d) => d.regle);
    expect(phrases.filter((p) => p).length).toBeGreaterThan(40);
    expect(verifier(phrases.filter((p) => p).map((p) => `const t = ${JSON.stringify(p)};`).join("\n"))).not.toContain("montant");
    const temoin = `const t = "Coût : ${2 + 3} ${String.fromCharCode(0x20ac)}";`;
    expect(verifier(temoin)).toContain("montant");
  });

  it("(c) sceneALInstant", () => {
    const p = plan as { scenes: { id: string }[] };
    expect(sceneALInstant(plan, 0)).toEqual({ sceneId: "s-alpha", numero: 1 });
    expect(sceneALInstant(plan, 4000)).toEqual({ sceneId: "s-beta", numero: 2 });
    expect(sceneALInstant(plan, 3999)?.sceneId).toBe(p.scenes[0].id);
    expect(sceneALInstant(plan, 9000)).toBeNull();
    expect(sceneALInstant(plan, 9999)).toBeNull();
    expect(sceneALInstant(plan, 12000)).toBeNull();
    for (const ms of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(sceneALInstant(plan, ms)).toBeNull();
    expect(sceneALInstant({ scenes: [] }, 100)).toBeNull();
    expect(apercuCommun(base({ instant: { ms: 9500 } })).instant).toBe(PHRASE_INSTANT_HORS_SCENE);
    expect(apercuCommun(base({ instant: { ms: 65000 } })).instant).toBe(PHRASE_INSTANT_HORS_SCENE);
    expect(apercuCommun(base({ instant: { ms: 5000 } })).instant).toBe("À 0:05, scène 2.");
    expect(apercuCommun(base({ instant: { ms: 10500 } })).instant).toBe("À 0:10, scène 3.");
    expect(apercuCommun(base({ instant: null })).instant).toBeNull();
    expect(apercuCommun(base({ instant: { ms: 5000 }, plan: null })).instant).toBe(PHRASE_INSTANT_HORS_SCENE);
  });

  it("(d) résumé", () => {
    const n = (k: number) => apercuCommun(base({ operations: Array.from({ length: k }, () => motOp()) })).resume;
    expect(n(1)).toEqual([TITRE_RESUME, "Scène 2 : le mot « a » devient « b ».", FIN_RESUME]);
    expect(n(5)).toHaveLength(7);
    expect(n(6)).toEqual([TITRE_RESUME, ...Array(5).fill("Scène 2 : le mot « a » devient « b »."), "Et 1 autre changement.", FIN_RESUME]);
    expect(n(7).at(-2)).toBe("Et 2 autres changements.");
    expect(n(0)).toEqual([]);
    expect(apercuCommun(base({ operations: [{ type: "zzz" } as never] })).resume).toEqual([]);
    for (const t of TYPES_OPERATIONS_RETOUCHE) {
      const r = apercuCommun(base({ operations: [un(t)] })).resume.join("\n");
      expect(r, t).not.toMatch(/s-(alpha|beta|gamma)/);
      expect(r.length, t).toBeGreaterThan(0);
    }
    expect(apercuCommun(base({ operations: [motOp("s-gamma")] })).resume[1]).toContain("Scène 3");
    expect(apercuCommun(base({ operations: [motOp("s-gamma")], plan: null })).resume[1]).toContain("Une scène");
  });

  it("(e) impact non fourni", () => {
    const r = apercuCommun(base({ impact: null }));
    expect(r.ceQuiChange).toBe(PHRASE_IMPACT_NON_FOURNI);
    expect(r.appliquable).toBe(true);
    expect(apercuCommun(base()).ceQuiChange).toBe("1 scène sur 3 sera refaite, la voix ne change pas.");
  });

  it("(f) voix sans estimation", () => {
    const sans = apercuCommun(base({ operations: [scriptOp] }));
    expect([sans.cout.famille, sans.appliquable]).toEqual(["inconnue", false]);
    const r = apercuCommun(base({ operations: [scriptOp], estimationVoix: { ok: false, code: "plafond-depasse", phrase: refuseVoix.phrase } }));
    expect([r.cout.famille, r.appliquable]).toEqual(["refusee", false]);
    expect(r.cout.phrases[0]).toBe(refuseVoix.phrase);
    expect(() => apercuCommun({} as never)).not.toThrow();
    expect(apercuCommun({} as never)).toMatchObject({ appliquable: false, cout: { famille: "inconnue" } });
  });

  it("(g) sans importeur, pur, 2e appel identique", () => {
    const racine = process.cwd();
    const parcourir = (d: string): string[] =>
      readdirSync(join(racine, d)).flatMap((nom) => {
        const c = join(d, nom);
        return statSync(join(racine, c)).isDirectory() ? parcourir(c) : /\.tsx?$/.test(nom) ? [c] : [];
      });
    const importeurs = parcourir("src").filter((f) => !f.endsWith("apercu-commun.ts") && readFileSync(join(racine, f), "utf8").includes("apercu-commun"));
    expect(importeurs).toEqual([]);
    const chemin = "src/services/retouche-chat/apercu-commun.ts";
    expect(existsSync(join(racine, chemin))).toBe(true);
    const imports = [...readFileSync(join(racine, chemin), "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports)
      for (const interdit of ["lireParametre", "@/fournisseurs", "prisma", "@/lib/db", "depense", "budget", "credits", "tarifs", "VideoAnimeeV4", "briques-v4", "motion-v4/", "interface-claire/", "commun-lot", "registre-v4", "studio-rendu"])
        expect(i, i).not.toContain(interdit);
    expect(readFileSync(join(racine, chemin), "utf8")).not.toContain("lireParametre");
    const e = base({ operations: [scriptOp, motOp()], estimationVoix: okVoix, instant: { ms: 5000 } });
    const copie = JSON.stringify(e);
    expect(apercuCommun(e)).toEqual(apercuCommun(e));
    expect(JSON.stringify(e)).toBe(copie);
  });
});
