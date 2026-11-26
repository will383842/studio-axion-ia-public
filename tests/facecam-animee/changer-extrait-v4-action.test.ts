/**
 * R4-03-d2b-v20j : action serveur « Changer un extrait » (retouche GRATUITE v4) et panneau monté sur la page de la vidéo, masqué
 * tant que `retoucheChat.facecamAnimeeExtraits` n'est pas `true` exact. Dépôts mémoire ; session, `lancerRetouche` et réglage en
 * doubles : aucun appel réel, aucun rendu, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VersionVideo, Video } from "@/domaine/types";

vi.mock("server-only", () => ({}));
const etat = vi.hoisted(() => ({ reglage: undefined as unknown, leve: false, session: true, revalides: [] as string[] }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void etat.revalides.push(p) }));
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    if (!etat.session) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/connexion;307;" });
    return { id: "s1" };
  },
}));
const lancer = vi.hoisted(() => vi.fn(async (...args: unknown[]) => (void args, { retoucheId: "r1", travailId: "t1" })));
vi.mock("@/services/fabrication", () => ({ lancerRetouche: lancer }));
vi.mock("@/services/_commun", async (orig) => ({
  ...(await orig<object>()),
  lireParametre: async (id: string, defaut: unknown) => {
    if (id !== "retoucheChat.facecamAnimeeExtraits") return defaut;
    if (etat.leve) throw new Error("base indisponible");
    return etat.reglage === undefined ? defaut : etat.reglage;
  },
}));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { demanderChangementExtraitV4Action, changerExtraitV4PourPanneau } = await import("@/app/(studio)/videos/actions-changer-extrait-v4");

const RACINE = join(__dirname, "..", "..");
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const T = "2026-11-25T12:00:00.000Z";
const VIDEO = "vid_extrait";
const ENTREES = { facecamAnimee: { priseCle: "prise/k.mov" }, facecam: { a: 1 } };
const DEMANDE = { action: "remplacer", rang: 0, recherche: "dirigeant devis" };

beforeEach(async () => {
  reinitialiserDepots();
  lancer.mockClear();
  Object.assign(etat, { reglage: undefined, leve: false, session: true, revalides: [] });
  await depots().versions.enregistrer({ id: "ver-2", videoId: VIDEO, creeLe: T, modifieLe: T, commande: { moteurId: "montage-facecam-animee", entrees: ENTREES } } as unknown as VersionVideo);
  await depots().videos.enregistrer({ id: VIDEO, titre: "Ma face caméra", versionChoisieId: "ver-2", creeLe: T, modifieLe: T } as unknown as Video);
});

describe("R4-03-d2b · action serveur", () => {
  it("(a) éteint : réglage absent, \"true\", 1 ou lecture qui lève → refusée, lancerRetouche jamais appelé", async () => {
    for (const [reglage, leve] of [[undefined, false], ["true", false], [1, false], [false, false], [true, true]] as const) {
      Object.assign(etat, { reglage, leve });
      const r = await demanderChangementExtraitV4Action(VIDEO, DEMANDE);
      expect(r).toEqual({ ok: true, donnees: { statut: "refusee", raison: "retouche d'extrait éteinte" } });
      expect(await changerExtraitV4PourPanneau(VIDEO, DEMANDE)).toEqual({ statut: "refusee", raison: "retouche d'extrait éteinte" });
    }
    expect(lancer).not.toHaveBeenCalled();
  });

  it("(b) allumé (`true` en base) : lancerRetouche reçoit les entrées de la version choisie octet pour octet + la demande liée à cette version", async () => {
    etat.reglage = true;
    const r = await demanderChangementExtraitV4Action(VIDEO, DEMANDE);
    expect(r).toEqual({ ok: true, donnees: { statut: "lancee" } });
    expect(lancer).toHaveBeenCalledTimes(1);
    const [videoId, planIds, consigne, options] = lancer.mock.calls[0] as unknown as [string, string[], string, { entrees: Record<string, unknown> }];
    expect([videoId, planIds, consigne]).toEqual([VIDEO, [], "Changer un extrait"]);
    const { retoucheExtraitV4, ...reste } = options.entrees;
    expect(JSON.stringify(reste)).toBe(JSON.stringify(ENTREES));
    expect(retoucheExtraitV4).toMatchObject({ ...DEMANDE, pourVersionId: "ver-2" });
    expect(etat.revalides).toContain(`/videos/${VIDEO}`);
    // Forme du panneau : la même réponse, sans l'enveloppe.
    expect(await changerExtraitV4PourPanneau(VIDEO, DEMANDE)).toEqual({ statut: "lancee" });
  });

  it("(c) session absente : la redirection de exigerSession remonte, rien n'est lancé", async () => {
    etat.reglage = true;
    etat.session = false;
    await expect(demanderChangementExtraitV4Action(VIDEO, DEMANDE)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("(c) une erreur du studio (crédit refusé par lancerRetouche) devient un refus lisible pour le panneau", async () => {
    etat.reglage = true;
    const { ErreurStudio } = await import("@/services/_commun");
    lancer.mockRejectedValueOnce(new ErreurStudio("credit", "Crédit insuffisant."));
    expect(await changerExtraitV4PourPanneau(VIDEO, DEMANDE)).toEqual({ statut: "refusee", raison: "Crédit insuffisant." });
  });
});

describe("R4-03-d2b · page et gardes", () => {
  const page = lire("src/app/(studio)/videos/[id]/page.tsx");
  const action = lire("src/app/(studio)/videos/actions-changer-extrait-v4.ts");

  it("(a) éteint = page identique : le panneau n'est rendu QUE si les données existent (null tant que le réglage n'est pas `true`)", () => {
    expect(page).toMatch(/\{extraitsV4 \? <ChangerExtraitV4 \{\.\.\.extraitsV4\} demander=\{changerExtraitV4PourPanneau\.bind\(null, v\.id\)\} \/> : null\}/);
    expect(page).toMatch(/const extraitsV4 = d\.versionCourante\?\.commande\?\.moteurId === "montage-facecam-animee" \? await donneesChangerExtraitV4\(v\.id, \{ actif: async \(\) => \(await actualiserRetoucheExtraitsFA\(\), \(globalThis as Record<symbol, unknown>\)\[CLE_RETOUCHE_EXTRAITS_FA\] === true\) \}\) : null;/);
    // Le panneau est dans l'onglet « Retouches » existant, après l'onglet des retouches, avant la miniature.
    const i = page.indexOf("<ChangerExtraitV4");
    expect(i).toBeGreaterThan(page.indexOf('valeur: "retouches"'));
    expect(i).toBeLessThan(page.indexOf('valeur: "sous-titres"'));
  });

  it("(d) gardes : l'action n'importe ni videos.ts ni fabrication.ts ; session d'abord ; aucun montant ; 6 onglets inchangés", () => {
    expect(action.startsWith('"use server";')).toBe(true);
    expect(action).not.toMatch(/from "[^"]*(services\/videos|fabrication)"/);
    expect(action.indexOf("await exigerSession()")).toBeLessThan(action.indexOf("demanderRetoucheExtraitV4(videoId"));
    for (const t of [action, page.split("\n").filter((l) => /extraitsV4|ExtraitV4|EXTRAITS_FA|actualiserRetoucheExtraitsFA/.test(l)).join("\n")]) {
      expect(t).not.toMatch(/€|euros?\b|\bEUR\b|centimes|prixUnitaire|montant/i);
    }
    expect([...page.matchAll(/valeur: "([a-z-]+)"/g)].map((m) => m[1])).toEqual(["publier", "retouches", "sous-titres", "script", "resultats", "details"]);
  });

  it("(e) AUDIT ARGENT : la retouche lancée est la retouche gratuite v4 (forfait du studio à ZERO), aucune ligne de prix ajoutée", () => {
    const moteur = lire("src/moteurs/montage-facecam-animee/index.ts");
    expect(moteur).toMatch(/fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO/);
    expect(action).not.toMatch(/credits|budget|depense|plafond|tarif|verifierEtReserver/);
    expect(action).toMatch(/demanderRetoucheExtraitV4\(videoId, demande, \{ actif: extraitsV4Actifs \}\)/);
  });
});
