/**
 * PRONONCIATION-b-v21m : « Ce mot est mal dit » : action serveur + panneau, branchés sur la base de prononciations
 * EXISTANTE (ajoute, ou remplace en archivant l'ancienne ; rien n'est effacé). Monté nulle part (éteint, 0 €).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prononciation } from "../../src/domaine/types";

const exigerSession = vi.hoisted(() => vi.fn(async () => undefined));
const listerPrononciations = vi.hoisted(() => vi.fn(async (): Promise<Prononciation[]> => []));
const ajouterPrononciation = vi.hoisted(() => vi.fn(async () => "pr-neuve"));
const modifierPrononciation = vi.hoisted(() => vi.fn(async () => "pr-remplacante"));
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/services/auth", () => ({ exigerSession }));
vi.mock("@/services/prononciations", () => ({ listerPrononciations, ajouterPrononciation, modifierPrononciation, ecouterPrononciation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { enregistrerMotMalDitAction, previsualiserMotMalDitAction } from "../../src/components/prononciations/actions-mot-mal-dit";
import { PanneauMotMalDit } from "../../src/components/prononciations/PanneauMotMalDit";

const RACINE = resolve(__dirname, "../..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const SANS_ARGENT = /\b(prix|budget|plafond|coût|couts?|tarif|devis|payé|payer|centimes?)\b|€/i;
const plans = [
  { id: "p1", texte: "Bonjour, Zernio programme vos publications." },
  { id: "p2", texte: "Rien à signaler ici." },
];
const entree = (p: Partial<Prononciation> & { mot: string; prononciation: string }): Prononciation => ({ id: `p-${p.mot}`, creeLe: "2026-11-01T00:00:00Z", modifieLe: "2026-11-01T00:00:00Z", ...p }) as Prononciation;

beforeEach(() => {
  vi.clearAllMocks();
  listerPrononciations.mockResolvedValue([]);
});

describe("action serveur : aperçu", () => {
  it("la session est exigée AVANT tout, et l'aperçu n'écrit rien", async () => {
    const r = await previsualiserMotMalDitAction({ plans, mot: "Zernio", prononciation: "zèrnio" });
    expect(exigerSession).toHaveBeenCalledTimes(1);
    expect(r.ok && r.donnees.action).toBe("ajouter");
    expect(r.ok && r.donnees.phrases[0]?.luApres).toBe("Bonjour, zèrnio programme vos publications.");
    expect(r.ok && r.donnees.phrases[0]?.ecrit).toBe(plans[0].texte);
    expect(ajouterPrononciation).not.toHaveBeenCalled();
    expect(modifierPrononciation).not.toHaveBeenCalled();
  });
});

describe("action serveur : enregistrer", () => {
  it("mot neuf : UNE entrée ajoutée, source « video », rien d'autre", async () => {
    const r = await enregistrerMotMalDitAction({ plans, mot: "Zernio", prononciation: "zèrnio" });
    expect(exigerSession).toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, donnees: { action: "ajouter", id: "pr-neuve" } });
    expect(ajouterPrononciation).toHaveBeenCalledTimes(1);
    expect(ajouterPrononciation).toHaveBeenCalledWith("Zernio", "zèrnio", expect.objectContaining({ source: "video" }));
    expect(modifierPrononciation).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("mot déjà présent : l'entrée existante est remplacée par le service (qui archive l'ancienne), jamais un refus", async () => {
    listerPrononciations.mockResolvedValue([entree({ mot: "zernio", prononciation: "zernyo" })]);
    const r = await enregistrerMotMalDitAction({ plans, mot: "Zernio", prononciation: "zèrnio" });
    expect(r).toMatchObject({ ok: true, donnees: { action: "modifier", id: "pr-remplacante" } });
    expect(modifierPrononciation).toHaveBeenCalledTimes(1);
    expect(modifierPrononciation).toHaveBeenCalledWith("p-zernio", expect.objectContaining({ mot: "Zernio", prononciation: "zèrnio", source: "video" }));
    expect(ajouterPrononciation).not.toHaveBeenCalled();
  });

  it("action « rien » (déjà enregistré, vide, identique, mot absent) : aucune écriture, le message est rendu", async () => {
    listerPrononciations.mockResolvedValue([entree({ mot: "Zernio", prononciation: "zèrnio" })]);
    const dejaLa = await enregistrerMotMalDitAction({ plans, mot: "Zernio", prononciation: "zèrnio" });
    expect(dejaLa).toMatchObject({ ok: true, donnees: { action: "rien", message: "Cette prononciation est déjà enregistrée pour ce mot." } });
    const absent = await enregistrerMotMalDitAction({ plans, mot: "Teleos", prononciation: "té-lé-osse" });
    expect(absent).toMatchObject({ ok: true, donnees: { action: "rien" } });
    const vide = await enregistrerMotMalDitAction({ plans, mot: "Zernio", prononciation: "  " });
    expect(vide).toMatchObject({ ok: true, donnees: { action: "rien", message: "Écrivez comment le mot se prononce." } });
    expect(ajouterPrononciation).not.toHaveBeenCalled();
    expect(modifierPrononciation).not.toHaveBeenCalled();
  });

  it("la portée choisie (voix ou personnage) est transmise au service", async () => {
    await enregistrerMotMalDitAction({ plans, mot: "Zernio", prononciation: "zèrnio", portee: { voixId: "v1" } });
    expect(ajouterPrononciation).toHaveBeenCalledWith("Zernio", "zèrnio", expect.objectContaining({ portee: { voixId: "v1", personnageId: undefined } }));
  });

  it("les entrées trop longues sont coupées avant d'être traitées", async () => {
    const r = await enregistrerMotMalDitAction({ plans, mot: "Zernio".padEnd(500, "x"), prononciation: "z".repeat(900) });
    expect(r.ok).toBe(true);
    const appels = ajouterPrononciation.mock.calls as unknown as [string, string][];
    for (const [m, p] of appels) {
      expect(m.length).toBeLessThanOrEqual(60);
      expect(p.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("panneau", () => {
  const html = renderToStaticMarkup(createElement(PanneauMotMalDit, { plans, mot: "Zernio" }));
  const texte = html.replace(/<[^>]+>/g, " ");

  it("affiche le mot, le champ « comment le dire » et les boutons Avant / Après", () => {
    expect(texte).toContain("Zernio");
    expect(texte).toMatch(/Comment le dire/);
    expect(texte).toMatch(/Avant/);
    expect(texte).toMatch(/Après/);
  });

  it("aucun montant, aucun mot d'argent dans le rendu", () => {
    expect(texte).not.toMatch(SANS_ARGENT);
  });

  it("source : aucun symbole d'argent, aucune erreur serveur affichée brute, aucun jargon d'argent", () => {
    const src = lire("src/components/prononciations/PanneauMotMalDit.tsx");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/formaterMontant|centimes|€/);
    expect(code.split("\n").filter((l) => /notifier\.erreur\(\s*(?:r|res)\.message/.test(l))).toEqual([]);
    expect(code).toContain("messageSansMontant");
  });
});

describe("éteint : monté nulle part", () => {
  it("aucun fichier de src/ n'importe le panneau (ni, hors de l'action, le module de calcul)", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts)$/.test(f) && !p.endsWith("PanneauMotMalDit.tsx") && /PanneauMotMalDit/.test(readFileSync(p, "utf8"))) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    expect(vus).toEqual([]);
  });

  it("les fichiers déjà là ne bougent pas : actions.ts n'a aucune action « mot mal dit »", () => {
    expect(lire("src/components/prononciations/actions.ts")).not.toMatch(/MotMalDit/);
  });
});
