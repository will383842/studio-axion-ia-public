/**
 * S-15-b3-v21s : le pont (sans appelant) entre le chat et `lancerRetouche` pour les plaquettes de la face caméra animée.
 * `lancerRetouche` doublé ; aucun appel réel, 0 €.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CONSIGNE_PLAQUETTES_FA, PHRASE_REFUS_PLAQUETTES_FA, depsPlaquettesStudio, lancerRetouchePlaquettesFA } from "@/services/retouche-chat/pont-plaquettes-fa";
import { controler } from "../../outils/gardes/regles-de-fer.mjs";

const FICHIER = "src/services/retouche-chat/pont-plaquettes-fa.ts";
const OPS = [{ type: "retirer", uid: "badge-1" }];

describe("S-15-b3 · (f) pont vers lancerRetouche", () => {
  it("une seule opération plaquettesV4 portant les opérations telles quelles, aucun plan, consigne fixe", async () => {
    const lancerRetouche = vi.fn(async () => ({ travailId: "trav-9" }));
    expect(await lancerRetouchePlaquettesFA("v-1", OPS, { lancerRetouche })).toEqual({ statut: "lancee", travailId: "trav-9" });
    expect(lancerRetouche).toHaveBeenCalledTimes(1);
    expect(lancerRetouche).toHaveBeenCalledWith("v-1", [], CONSIGNE_PLAQUETTES_FA, { operations: [{ type: "plaquettesV4", operations: OPS }] });
  });

  it("erreur (même avec un montant dans le message) ou réponse sans travail ⇒ refus SANS le message d'origine", async () => {
    for (const lancerRetouche of [vi.fn(async () => { throw new Error("Budget dépassé : 12,40 € demandés"); }), vi.fn(async () => null), vi.fn(async () => ({ travailId: "" })), vi.fn(async () => ({ travailId: 3 }))]) {
      const r = await lancerRetouchePlaquettesFA("v-1", OPS, { lancerRetouche });
      expect(r).toEqual({ statut: "refusee", phrase: PHRASE_REFUS_PLAQUETTES_FA });
      expect(JSON.stringify(r)).not.toMatch(/€|\d+,\d\d/);
    }
  });

  it("aucun montant écrit dans le fichier (règles de fer) ; les dépendances du studio n'appellent rien à la construction", () => {
    const r = controler([{ chemin: FICHIER, contenu: readFileSync(FICHIER, "utf8") }], { exceptions: {} }) as { defauts: { regle: string }[] };
    expect(r.defauts.filter((d) => d.regle === "montant")).toEqual([]);
    expect(controler([{ chemin: "src/components/retouche-chat/fictif-s15b3.tsx", contenu: 'const t = "12 €";' }], { exceptions: {} }).defauts.some((d: { regle: string }) => d.regle === "montant")).toBe(true);
    expect(typeof depsPlaquettesStudio().lancerRetouche).toBe("function");
  });
});

describe("S-15-b3 · (g) sans importeur, rien d'interdit", () => {
  it("aucun fichier de src/** ne cite pont-plaquettes-fa ; le pont n'importe ni réglage, ni argent, ni pièce v4 protégée", () => {
    const trouves = execSync(`git grep -l --untracked "pont-plaquettes-fa" -- src || true`, { encoding: "utf8" }).split("\n").filter(Boolean);
    expect(trouves).toEqual([]);
    const texte = readFileSync(FICHIER, "utf8");
    const imports = [...texte.matchAll(/(?:from\s+|import\()"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(["../fabrication", "@/moteurs/types"]);
    expect(texte).not.toMatch(/lireParametre|credits|depense|budget|VideoAnimeeV4|briques-v4|registre-v4|motion-v4|GEOMETRIE_V4/);
    expect(texte.split("\n").length).toBeLessThanOrEqual(50);
  });
});
