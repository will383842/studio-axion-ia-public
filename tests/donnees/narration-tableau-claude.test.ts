/**
 * G4-06-b-v20e — Claude (Sonnet) écrit le texte lu du tableau de bord, 0,15 € au plus par vidéo.
 * Aucun appel réel : faux `executer`, `engage`, `taux`, `lire`. DONNÉE ENTIÈREMENT FICTIVE.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { pireCasRequete } from "@/generateur/roles/types";
import { requeteNarrationClaude } from "@/briques/donnees-video/narration-claude";
import { narrationModele } from "@/briques/donnees-video/narration-modele";
import { lireTableauDeBord, type TableauDeBord } from "@/briques/donnees-video/types";
import { chaineMontageDonnees } from "@/moteurs/montage-donnees/chaine";
import {
  ETAPE_NARRATION,
  MODELE_CLAUDE_VIDEO,
  PARAM_NARRATION_CLAUDE,
  PARAM_PLAFOND_NARRATION,
  PLAFONDS_CLAUDE_VIDEO_EUR,
  PLAFOND_TOTAL_CLAUDE_VIDEO_EUR,
  PREFIXES_ETAPE_CLAUDE_VIDEO,
  narrationClaudeActive,
  portNarrationClaude,
  type DepsNarrationClaude,
} from "@/services/narration-tableau-claude";

const RACINE = process.cwd();
const FICHIER = join(RACINE, "src/services/narration-tableau-claude.ts");
const CHAINE = join(RACINE, "src/moteurs/montage-donnees/chaine.ts");

const donnee = (surcharge: Record<string, unknown> = {}) =>
  ({
    version: "tableau-de-bord.v1",
    titre: "Tableau exemple",
    periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
    source: "Outil exemple",
    indicateurs: [
      { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
      { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
      { id: "visites", libelle: "Visites du site", valeur: 3450, unite: "visites", precision: 0, sens: "hausse-bonne" },
      { id: "rebond", libelle: "Taux de rebond", valeur: 42, unite: "%", precision: 0, sens: "baisse-bonne" },
      { id: "clients", libelle: "Nouveaux clients", valeur: 87, unite: "clients", precision: 0, sens: "hausse-bonne" },
    ],
    series: [],
    comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
    alertes: [{ texte: "Le taux de rebond reste à surveiller", indicateurId: "rebond" }],
    calculs: [{ id: "evolution", formule: "ca-mars / ca-fevrier * 100 - 100", resultat: (12480 / 10200) * 100 - 100 }],
    ...surcharge,
  }) as TableauDeBord;

/** Donnée au maximum du schéma : 12 indicateurs, 6 séries de 12 points, 12 comparaisons, 12 alertes, 12 calculs, libellés pleins. */
function donneeMax(): TableauDeBord {
  const lettres = (n: number) => "a".repeat(n);
  const indicateurs = Array.from({ length: 12 }, (_, i) => ({ id: `ind-${i}`, libelle: lettres(60), valeur: 123456.7891, unite: lettres(20), precision: 4, sens: "hausse-bonne" as const }));
  const series = Array.from({ length: 6 }, (_, i) => ({ id: `ser-${i}`, libelle: lettres(60), unite: lettres(20), points: Array.from({ length: 12 }, (_, k) => ({ x: lettres(30), valeur: 1000 + k })) }));
  const d = {
    version: "tableau-de-bord.v1",
    titre: lettres(80),
    periode: { debut: "2026-01-01", fin: "2026-12-31", libelle: lettres(60) },
    source: lettres(60),
    indicateurs,
    series,
    comparaisons: Array.from({ length: 12 }, () => ({ avant: "ind-0", apres: "ind-1" })),
    alertes: Array.from({ length: 12 }, () => ({ texte: lettres(120), indicateurId: "ind-2" })),
    calculs: Array.from({ length: 12 }, (_, i) => ({ id: `calc-${i}`, formule: "ind-1 / ind-0 * 100 - 100", resultat: 1 })),
  };
  return d as unknown as TableauDeBord;
}

const MOT = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
const phrasesDe = (n: number): string[] => Array.from({ length: n / 10 }, () => `${MOT}.`);
/** Réponse valide de Claude : 100 mots, aucun nombre. */
const BONNE = JSON.stringify({ phrases: phrasesDe(100) });

interface Calls {
  executer: ReturnType<typeof vi.fn>;
  engage: ReturnType<typeof vi.fn>;
}
/** Doubles : `engagements` = centimes de $ déjà engagés par usage. */
function doubles(opts: { engagements?: Partial<Record<"dmpln" | "tbnar" | "tblec", number>>; reponse?: unknown; taux?: number; lire?: (id: string) => unknown } = {}) {
  const engagements = { dmpln: 0, tbnar: 0, tblec: 0, ...opts.engagements };
  const executer = vi.fn(async () => opts.reponse ?? { ok: true, simule: false, texte: BONNE, coutUsd: 0.05, modele: "claude-sonnet-5-5" });
  const engage = vi.fn(async (_v: string, p: { id: "dmpln" | "tbnar" | "tblec" }) => engagements[p.id]);
  const taux = vi.fn(async () => opts.taux ?? 0.9);
  const lire = vi.fn(async (id: string, defaut: unknown) => (opts.lire ? opts.lire(id) : id === PARAM_NARRATION_CLAUDE ? true : defaut));
  return { executer, engage, taux, lire } as unknown as DepsNarrationClaude & { executer: Calls["executer"]; engage: Calls["engage"] };
}
const origine = "usine" as const;

describe("a) interrupteur tableau.narrationClaude : allumé si true exact ou absent, tout le reste éteint", () => {
  it("la clé", () => {
    expect(PARAM_NARRATION_CLAUDE).toBe("tableau.narrationClaude");
    expect(PARAM_PLAFOND_NARRATION).toBe("tableau.plafondNarrationUsd");
  });
  it.each([
    [true, true],
    [false, false],
    ["false", false],
    ["true", false],
    [0, false],
    [1, false],
    [{}, false],
    [[], false],
    ["", false],
    [undefined, true],
    [null, true],
  ])("valeur %j → %s", async (valeur, attendu) => {
    expect(await narrationClaudeActive((async () => valeur) as never)).toBe(attendu);
  });
  it("lecture en échec → éteint", async () => {
    expect(await narrationClaudeActive((async () => { throw new Error("base"); }) as never)).toBe(false);
  });
});

describe("b) le port : un appel, rôle Sonnet, repli gratuit sinon", () => {
  it("éteint (false exact, échec de lecture) : null et 0 appel", async () => {
    for (const valeur of [false, "false", "true", 0, 1, {}]) {
      const d = doubles({ lire: (id) => (id === PARAM_NARRATION_CLAUDE ? valeur : undefined) });
      expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
      expect(d.executer).toHaveBeenCalledTimes(0);
      expect(d.engage).toHaveBeenCalledTimes(0);
    }
    const d = doubles();
    const casse = { ...d, lire: (async () => { throw new Error("base"); }) as never };
    expect(await portNarrationClaude("v1", origine, casse)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(0);
  });

  it("réglage absent → allumé : 1 appel", async () => {
    const d = doubles({ lire: () => undefined });
    expect(await portNarrationClaude("v1", origine, d)(donnee())).not.toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(1);
  });

  it("allumé : 1 appel, rôle claude-sonnet-5-5, maxTokens 4000, étape et origine", async () => {
    const d = doubles();
    const r = await portNarrationClaude("v1", origine, d)(donnee());
    expect(r).not.toBeNull();
    expect(r!.phrases.length).toBe(10);
    expect(d.executer).toHaveBeenCalledTimes(1);
    const [videoId, role, entree, options] = d.executer.mock.calls[0] as [string, { modele: string; maxTokens: number; consigne: string }, { variable: string }, { etape: string; origine: string; plafondPropre: Record<string, unknown> }];
    expect(videoId).toBe("v1");
    expect(role.modele).toBe("claude-sonnet-5-5");
    expect(role.modele).toBe(MODELE_CLAUDE_VIDEO);
    expect(role.maxTokens).toBe(4000);
    expect(role.consigne).toBe(requeteNarrationClaude(donnee(), MODELE_CLAUDE_VIDEO).systeme[0]!.texte);
    expect(entree.variable).toBe(JSON.stringify(donnee()));
    expect(options.etape).toBe(ETAPE_NARRATION);
    expect(options.etape).toBe("Tableau de bord · narration");
    expect(options.origine).toBe(origine);
    expect(options.plafondPropre).toMatchObject({ id: "tbnar", parametre: PARAM_PLAFOND_NARRATION, defautUsd: 0.15, prefixeEtape: "Tableau de bord · narration" });
  });

  it("réponse avec un nombre hors donnée → null (garde des chiffres)", async () => {
    const d = doubles({ reponse: { ok: true, simule: false, texte: JSON.stringify({ phrases: [...phrasesDe(90), "Le chiffre est 98765."] }), coutUsd: 0.05, modele: "claude-sonnet-5-5" } });
    expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(1);
  });

  it("JSON cassé, texte vide, simulé, ok:false, exception → null, jamais de levée", async () => {
    const cas: unknown[] = [
      { ok: true, simule: false, texte: "{pas du json", coutUsd: 0, modele: "m" },
      { ok: true, simule: false, texte: "  ", coutUsd: 0, modele: "m" },
      { ok: true, simule: true, texte: BONNE, coutUsd: 0, modele: "simulation" },
      { ok: false, arret: "plafond-video", message: "x" },
      { ok: false, arret: "budget-usine", message: "x" },
    ];
    for (const reponse of cas) {
      const d = doubles({ reponse });
      expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
      expect(d.executer).toHaveBeenCalledTimes(1);
    }
    const d = doubles();
    d.executer.mockRejectedValueOnce(new Error("réseau"));
    await expect(portNarrationClaude("v1", origine, d)(donnee())).resolves.toBeNull();
    const e = doubles();
    e.engage.mockRejectedValue(new Error("base"));
    await expect(portNarrationClaude("v1", origine, e)(donnee())).resolves.toBeNull();
    expect(e.executer).toHaveBeenCalledTimes(0);
    const t = doubles();
    t.taux = (async () => { throw new Error("taux"); }) as never;
    await expect(portNarrationClaude("v1", origine, t)(donnee())).resolves.toBeNull();
    expect(t.executer).toHaveBeenCalledTimes(0);
  });
});

describe("b) plafond dur : refus AVANT l'appel", () => {
  const demandeDe = (d: TableauDeBord): number => {
    const r = requeteNarrationClaude(d, MODELE_CLAUDE_VIDEO);
    const role = { id: "tableau-narration", version: 1, consigne: r.systeme[0]!.texte, modele: MODELE_CLAUDE_VIDEO, effort: r.effort, maxTokens: r.maxTokens, sansPhrasesFixes: true, simuler: () => "" };
    return Math.ceil(pireCasRequete(role as never, { contexte: {}, variable: r.messages[0]!.contenu }) * 100 * 1.2);
  };

  it("la table d'argent est littérale et totalise 1,25 €", () => {
    expect(PLAFONDS_CLAUDE_VIDEO_EUR).toEqual({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 });
    expect(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR).toBe(1.25);
    expect(PREFIXES_ETAPE_CLAUDE_VIDEO).toEqual({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" });
    expect(Object.isFrozen(PLAFONDS_CLAUDE_VIDEO_EUR)).toBe(true);
    expect(Object.isFrozen(PREFIXES_ETAPE_CLAUDE_VIDEO)).toBe(true);
    expect(PLAFONDS_CLAUDE_VIDEO_EUR.dmpln + PLAFONDS_CLAUDE_VIDEO_EUR.tbnar + PLAFONDS_CLAUDE_VIDEO_EUR.tblec).toBeCloseTo(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR, 10);
  });

  it("la demande en pire cas × 1,2 tient dans 0,15 € à taux 0,9 et 1,1 (donnée au maximum du schéma)", () => {
    expect(lireTableauDeBord(donneeMax()).ok).toBe(true);
    const demande = demandeDe(donneeMax());
    for (const t of [0.9, 1.1]) expect(demande).toBeLessThanOrEqual(Math.floor((0.15 * 100) / t));
    expect(demandeDe(donnee())).toBeLessThanOrEqual(demande);
  });

  it("la donnée au maximum du schéma est acceptée quand rien n'est engagé (0,9 et 1,1)", async () => {
    for (const t of [0.9, 1.1]) {
      const d = doubles({ taux: t });
      await portNarrationClaude("v1", origine, d)(donneeMax());
      expect(d.executer).toHaveBeenCalledTimes(1);
    }
  });

  it("engage(tbnar) + demande > plafond propre → 0 appel, repli", async () => {
    // Plafond propre à taux 0,9 : floor(15 / 0,9) = 16 centimes de $ ; 11 engagés + la demande (≥ 6) dépasse.
    const d = doubles({ engagements: { tbnar: 11 } });
    expect(demandeDe(donnee())).toBeGreaterThan(5);
    expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(0);
  });

  it("la limite exacte : juste assez de place = 1 appel, un centime de moins = 0 appel", async () => {
    const demande = demandeDe(donnee());
    const plafond = Math.floor((0.15 * 100) / 0.9);
    const juste = doubles({ engagements: { tbnar: plafond - demande } });
    await portNarrationClaude("v1", origine, juste)(donnee());
    expect(juste.executer).toHaveBeenCalledTimes(1);
    const trop = doubles({ engagements: { tbnar: plafond - demande + 1 } });
    expect(await portNarrationClaude("v1", origine, trop)(donnee())).toBeNull();
    expect(trop.executer).toHaveBeenCalledTimes(0);
  });

  it("les AUTRES usages (dmpln + tblec) ne laissent plus la place pour la demande → 0 appel même si tbnar est vide", async () => {
    // Total à taux 0,9 : floor(125 / 0,9) = 138 centimes de $ ; il manque un centime pour la demande.
    const reste = 138 - demandeDe(donnee());
    const d = doubles({ engagements: { dmpln: reste - 20 + 1, tblec: 20 } });
    expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(0);
  });

  it("total 1,25 € atteint par les autres usages seuls : 0 appel à 0,9 comme à 1,1", async () => {
    for (const t of [0.9, 1.1]) {
      const total = Math.floor((125) / t);
      const d = doubles({ taux: t, engagements: { dmpln: total, tblec: 0 } });
      expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
      expect(d.executer).toHaveBeenCalledTimes(0);
    }
  });

  it("juste assez de place dans le total (autres usages) : 1 appel", async () => {
    const reste = 138 - demandeDe(donnee());
    const d = doubles({ engagements: { dmpln: reste - 20, tblec: 20 } });
    await portNarrationClaude("v1", origine, d)(donnee());
    expect(d.executer).toHaveBeenCalledTimes(1);
  });

  it("mode budget indicatif / quotaSeul simulé (faux executer qui accepte tout) : refus quand même, executer jamais appelé", async () => {
    const d = doubles({ engagements: { tbnar: 16 } });
    d.executer.mockImplementation(async () => ({ ok: true, simule: false, texte: BONNE, coutUsd: 0, modele: "claude-sonnet-5-5" }));
    expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(0);
  });

  it("réglage de plafond monté à 5 $ : refus quand même (le réglage n'est jamais lu ni écrit)", async () => {
    const d = doubles({ engagements: { tbnar: 16 }, lire: (id) => (id === PARAM_NARRATION_CLAUDE ? true : id === PARAM_PLAFOND_NARRATION ? 5 : undefined) });
    expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
    expect(d.executer).toHaveBeenCalledTimes(0);
    expect(d.lire).not.toHaveBeenCalledWith(PARAM_PLAFOND_NARRATION, expect.anything());
  });

  it("un engagement illisible (NaN, négatif) ne lève pas et ne laisse jamais passer l'appel", async () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const d = doubles({ engagements: { tbnar: v } });
      expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
      expect(d.executer).toHaveBeenCalledTimes(0);
    }
  });

  it("taux invalide (0, négatif, NaN) : refus sans appel", async () => {
    for (const t of [0, -1, Number.NaN]) {
      const d = doubles({ taux: t });
      expect(await portNarrationClaude("v1", origine, d)(donnee())).toBeNull();
      expect(d.executer).toHaveBeenCalledTimes(0);
    }
  });
});

describe("c) la chaîne, avec et sans port", () => {
  const entrees = (d: unknown) => ({ montageDonnees: { donnee: d, muette: true } });
  const petite = donnee({ indicateurs: donnee().indicateurs.slice(0, 3), comparaisons: [], alertes: [], calculs: [] });
  const moyenne = donnee();
  const maximum = donneeMax();

  it("sans port : sortie identique à celle d'avant (3 données)", async () => {
    for (const d of [petite, moyenne, maximum]) {
      const a = await chaineMontageDonnees(entrees(d));
      const b = await chaineMontageDonnees(entrees(d), {});
      expect(b).toEqual(a);
      if (a.ok) expect(a.texteDit).toBe(narrationModele(d).texte);
    }
  });

  it("port qui rend une narration valide → texteDit = ce texte", async () => {
    const phrases = phrasesDe(100);
    const texte = phrases.join(" ");
    const narration = vi.fn(async () => ({ texte, phrases, dureeEstimeeSec: 40, remarques: [] }));
    const r = await chaineMontageDonnees(entrees(moyenne), { narration });
    expect(narration).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texteDit).toBe(texte);
      expect(r.remarques.some((m) => m.startsWith("Narration par l'IA indisponible"))).toBe(false);
    }
  });

  it("port qui rend null ou qui lève → narration modèle + 1 remarque, sans montant", async () => {
    const reference = await chaineMontageDonnees(entrees(moyenne));
    for (const narration of [vi.fn(async () => null), vi.fn(async () => { throw new Error("boum"); })]) {
      const r = await chaineMontageDonnees(entrees(moyenne), { narration });
      expect(narration).toHaveBeenCalledTimes(1);
      expect(r.ok).toBe(true);
      if (r.ok && reference.ok) {
        expect(r.texteDit).toBe(reference.texteDit);
        const dites = r.remarques.filter((m) => m === "Narration par l'IA indisponible : texte modèle.");
        expect(dites).toHaveLength(1);
        expect(r.remarques.join(" ")).not.toMatch(/€|\$|euro|dollar/i);
      }
    }
  });

  it("le texte de Claude passe quand même la garde des chiffres de la chaîne", async () => {
    const texte = "Le chiffre est 98765.";
    const narration = vi.fn(async () => ({ texte, phrases: [texte], dureeEstimeeSec: 5, remarques: [] }));
    const r = await chaineMontageDonnees(entrees(moyenne), { narration });
    expect(r.ok).toBe(false);
  });
});

describe("d) gardes statiques", () => {
  const source = readFileSync(FICHIER, "utf8");
  const chaine = readFileSync(CHAINE, "utf8");
  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((f) => {
      const p = join(dossier, f);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx|mjs)$/.test(f) ? [p] : [];
    });

  it("chaine.ts n'importe ni src/services ni narration-claude", () => {
    expect(chaine).not.toMatch(/services\//);
    expect(chaine).not.toMatch(/narration-claude/);
  });
  it("le fichier neuf : sans haiku / fable / opus, sans fetch(, sans client.ts en valeur", () => {
    expect(source).not.toMatch(/haiku|fable|opus/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/appelerClaude/);
    for (const l of source.split("\n").filter((x) => /^\s*(import|export)\b.*from\s+["']@\/fournisseurs/.test(x))) expect(l).toMatch(/^import type /);
    expect(source).toMatch(/claude-sonnet-5-5/);
    expect(source).toMatch(/^import "server-only";/m);
  });
  it("la table d'argent est écrite en toutes lettres, identique à la fiche", () => {
    expect(source).toContain("Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const)");
    expect(source).toContain("PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25");
    expect(source).toContain('Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const)');
  });
  it("le seul importeur de narration-claude dans src/ est ce service (liste exacte)", () => {
    const importeurs = fichiers(join(RACINE, "src")).filter((p) => p !== join(RACINE, "src/briques/donnees-video/narration-claude.ts") && /narration-claude/.test(readFileSync(p, "utf8")));
    expect(importeurs).toEqual([FICHIER]);
  });
});
