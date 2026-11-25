/**
 * PRONONCIATION-c-v20l : le panneau « Ce mot est mal dit » est monté dans l'onglet Sous-titres de la vidéo, avec
 * « Refaire la voix ». Doubles partout, 0 €, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exigerSession = vi.hoisted(() => vi.fn(async () => undefined));
const lireParametre = vi.hoisted(() => vi.fn<(cle: string, defaut: unknown) => Promise<unknown>>(async (_c, d) => d));
const refaireVoixAvecPrononciation = vi.hoisted(() => vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ ok: true, retoucheId: "r1", travailId: "t1" })));
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/services/auth", () => ({ exigerSession }));
vi.mock("@/services/_commun", () => ({ lireParametre, essayer: async (f: () => Promise<unknown>) => { try { return { ok: true, donnees: await f() }; } catch (e) { return { ok: false, message: String((e as Error).message) }; } } }));
vi.mock("@/services/prononciations", () => ({ listerPrononciations: vi.fn(async () => []), ajouterPrononciation: vi.fn(), modifierPrononciation: vi.fn(), ecouterPrononciation: vi.fn() }));
vi.mock("@/services/refaire-voix", () => ({ PARAM_REFAIRE_AVEC_PRONONCIATION: "voix.refaireAvecPrononciation", refaireVoixAvecPrononciation }));
vi.mock("@/app/(studio)/videos/actions", () => ({ appliquerSousTitresAction: vi.fn(), corrigerMotAction: vi.fn(), demanderRetoucheAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/videos/v1", useSearchParams: () => new URLSearchParams() }));

import { refaireVoixAllumeeAction, refaireVoixMotMalDitAction } from "../../src/components/prononciations/actions-mot-mal-dit";
import { OngletSousTitres } from "../../src/components/videos/fiche/OngletSousTitres";

const RACINE = resolve(__dirname, "../..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const plans = [
  { id: "p1", texte: "Bonjour, Zernio programme vos publications." },
  { id: "p2", texte: "Rien à signaler ici." },
];
const demande = { videoId: "v1", plans, planIds: ["p1"], mot: "Zernio", prononciation: "zèrnio" };

beforeEach(() => {
  vi.clearAllMocks();
  lireParametre.mockImplementation(async (_c, d) => d);
});

describe("(a) l'onglet éteint est celui d'avant", () => {
  const segments = [{ id: "s1", debutSec: 0, finSec: 2, mots: [{ mot: "Zernio", debutSec: 0, finSec: 1, enValeur: false }] }];
  const rendu = () => renderToStaticMarkup(createElement(OngletSousTitres, { videoId: "v1", segments: segments as never, liens: null, plans: [] }));
  it("(a) rendu statique : ni panneau ni « Refaire la voix » tant qu'aucun mot n'est touché", () => {
    const html = rendu();
    expect(html).toContain("Zernio");
    expect(html).not.toMatch(/Ce mot est mal dit|Refaire la voix/);
  });
  it("(a) le libellé « Mal prononcé » reste (attendu par parcours-a1.mjs)", () => {
    expect(lire("src/components/videos/fiche/OngletSousTitres.tsx")).toContain("Mal prononcé ?");
  });
  it("(a) l'ancienne feuille reste montée pour le réglage éteint ; le panneau n'ouvre que réglage allumé", () => {
    const s = lire("src/components/videos/fiche/OngletSousTitres.tsx");
    expect(s).toMatch(/ouverte=\{!!malDit && !panneau\}/);
    expect(s).toMatch(/ouverte=\{!!malDit && panneau\}/);
  });
});

describe("(b) le réglage est reçu par une action serveur du panneau, pas par une prop de la page", () => {
  it("(b) allumé par défaut ; seul `false` l'éteint ; la session est exigée", async () => {
    expect(await refaireVoixAllumeeAction()).toBe(true);
    expect(exigerSession).toHaveBeenCalledTimes(1);
    lireParametre.mockResolvedValueOnce(false);
    expect(await refaireVoixAllumeeAction()).toBe(false);
    lireParametre.mockResolvedValueOnce("true");
    expect(await refaireVoixAllumeeAction()).toBe(true);
  });
  it("(b) lecture en panne : éteint (comportement d'avant)", async () => {
    lireParametre.mockRejectedValueOnce(new Error("panne"));
    expect(await refaireVoixAllumeeAction()).toBe(false);
  });
  it("(b) la page de la vidéo n'est pas touchée : l'onglet ne reçoit aucune prop de réglage", () => {
    expect(lire("src/components/videos/fiche/OngletSousTitres.tsx")).toMatch(/refaireVoixAllumeeAction\(\)/);
    expect(lire("src/app/(studio)/videos/[id]/page.tsx")).not.toMatch(/refaireAvecPrononciation|refaireVoixAllumee/);
  });
});

describe("(c) « Refaire la voix » passe par S2-16-b, une seule fois", () => {
  it("(c) UN appel, plans filtrés, phrases visées relues côté serveur, session exigée", async () => {
    const r = await refaireVoixMotMalDitAction(demande);
    expect(exigerSession).toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, donnees: { ok: true } });
    expect(refaireVoixAvecPrononciation).toHaveBeenCalledTimes(1);
    const [videoId, planIds, consigne, options] = refaireVoixAvecPrononciation.mock.calls[0] as [string, string[], string, { phrasesVisees: string[] }];
    expect(videoId).toBe("v1");
    expect(planIds).toEqual(["p1"]);
    expect(consigne).toContain("Zernio");
    expect(options.phrasesVisees).toEqual([plans[0].texte]);
  });
  it("(c) un plan inconnu ou une liste vide : aucun appel", async () => {
    const r = await refaireVoixMotMalDitAction({ ...demande, planIds: ["inconnu"] });
    expect(r).toMatchObject({ ok: true, donnees: { ok: false } });
    await refaireVoixMotMalDitAction({ ...demande, planIds: [] });
    expect(refaireVoixAvecPrononciation).not.toHaveBeenCalled();
  });
  it("(c) le refus « plafond » revient en phrase, rien n'est relancé", async () => {
    refaireVoixAvecPrononciation.mockResolvedValueOnce({ ok: false, phrase: "Cette voix dépasse la limite prévue pour cette vidéo." });
    const r = await refaireVoixMotMalDitAction(demande);
    expect(r).toMatchObject({ ok: true, donnees: { ok: false, phrase: "Cette voix dépasse la limite prévue pour cette vidéo." } });
    expect(refaireVoixAvecPrononciation).toHaveBeenCalledTimes(1);
  });
  it("(c) une erreur du service revient en échec lisible, sans exception", async () => {
    refaireVoixAvecPrononciation.mockRejectedValueOnce(new Error("Aucune version à retoucher."));
    expect(await refaireVoixMotMalDitAction(demande)).toMatchObject({ ok: false });
  });
});

describe("(d) aucun montant à l'écran", () => {
  const src = lire("src/components/prononciations/PanneauMotMalDit.tsx");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("(d) la source de PanneauMotMalDit.tsx ne contient ni €, ni $ (hors `${}` des gabarits), ni formaterMontant", () => {
    expect(code).not.toMatch(/€|\$(?!\{)|formaterMontant/);
  });
  it("(d) le refus « plafond » passe par messageSansMontant, jamais brut", () => {
    expect(code).toMatch(/notifier\.erreur\(messageSansMontant\(r\.donnees\.phrase\)\)/);
    expect(code).toMatch(/notifier\.erreur\(messageSansMontant\(r\.message\)\)/);
  });
  it("(d) le commentaire faux « coût affiché avant » est corrigé", () => {
    expect(lire("src/components/videos/fiche/OngletSousTitres.tsx")).not.toMatch(/coût affiché avant/);
  });
});

describe("(e) la dépense ne part qu'au clic", () => {
  it("(e) le panneau n'appelle l'action « refaire la voix » que depuis le bouton, et seulement après l'enregistrement", () => {
    const src = lire("src/components/prononciations/PanneauMotMalDit.tsx");
    expect(src.match(/refaireVoixMotMalDitAction\(/g)).toHaveLength(1);
    expect(src).toMatch(/onClick=\{refaireLaVoix\}/);
    expect(src).toMatch(/videoId && aRefaire/);
  });
  it("(e) aucune écriture de réglage dans les fichiers touchés", () => {
    for (const f of ["src/components/prononciations/PanneauMotMalDit.tsx", "src/components/prononciations/actions-mot-mal-dit.ts", "src/components/videos/fiche/OngletSousTitres.tsx"]) {
      expect(lire(f), f).not.toMatch(/ecrireParametre|parametres\.enregistrer/);
    }
  });
});
