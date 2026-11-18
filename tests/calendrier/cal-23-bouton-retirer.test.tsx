/**
 * CAL-23 · le geste « Retirer » d'une publication programmée chez le diffuseur (entrée de créneau) appelle retirerProgrammationAction :
 * confirmation avant, phrase claire par cas (retiré / à vérifier / à retirer à la main / reste programmé), jamais de faux succès.
 * Et : après un déplacement, l'ancien envoi est retiré chez le diffuseur AVANT d'être marqué « annulé » (aucun brouillon orphelin).
 * Sans DOM (crochets factices) ; aucun appel réel.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
type Rep = { ok: true; donnees: { creneauId: string; annulableJusquA: string; message: string } } | { ok: false; message: string; code?: string };
const retirerProgrammationAction = vi.fn(async (_c: string, _k: string): Promise<Rep> => ({ ok: true, donnees: { creneauId: "c1", annulableJusquA: "x", message: "Retirée du calendrier. Vous la retrouvez dans « À placer »." } }));
const annulerRetraitAction = vi.fn(async (_id: string) => ({ ok: true as const, donnees: { creneauId: "c1", message: "Remise au calendrier à la même date." } }));
vi.mock("@/app/(studio)/calendrier/actions/retirer", () => ({ annulerRetraitAction: (i: string) => annulerRetraitAction(i), retirerProgrammationAction: (c: string, k: string) => retirerProgrammationAction(c, k), retirerDuCalendrier: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { RetirerProgrammation } = await import("@/components/calendrier/RetirerProgrammation");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");
const { FicheEntree } = await import("@/components/calendrier/FicheEntree");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const AUJOURDHUI = "2026-11-14";
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const CLE = "creneau:cre_1|linkedin";
const entree = (sur: Partial<Entree> = {}): Entree => ({ cle: CLE, jour: "2026-11-16", reseau: "linkedin", type: "carrousel", etat: "programme", heure: "08:30", titre: "Carrousel", texte: "Un texte.", media: { genre: "image", url: "https://exemple.fr/a.png" }, ...sur });
const panneau = (e: Entree) => rendre(<ApercuPublication entree={e} aujourdhui={AUJOURDHUI} onPrecedente={() => {}} onSuivante={() => {}} onFermer={() => {}} onChangerDate={() => {}} />);
const fiche = (sur: Record<string, unknown> = {}, e: Partial<Entree> = {}) => rendre(<FicheEntree entree={{ ...entree(e), texte: "Un texte." } as never} aujourdhui={AUJOURDHUI} {...sur} />);

const monde_ = (cle: string) => monter(RetirerProgrammation, { cle });
const cliquer = (m: { rendre: () => unknown }, filtre: (t: string) => boolean) => {
  const b = trouver(m.rendre() as never, (x) => typeof x.props.onClick === "function" && filtre(texteDe(x)))[0];
  return b.props.onClick as () => Promise<void> | void;
};

describe("RetirerProgrammation : le geste", () => {
  it("premier rendu : « Retirer » seul ; clic : la phrase, « Oui, retirer » et « Non, garder », rien n'est appelé", () => {
    retirerProgrammationAction.mockClear();
    const m = monter(RetirerProgrammation, { cle: CLE });
    expect(lisible(rendre(m.rendre() as ReactElement))).not.toContain("Oui, retirer");
    cliquer(m, (t) => t.includes("Retirer"))();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain("Oui, retirer");
    expect(html).toContain("Non, garder");
    expect(html).toContain("Elle ne partira pas à l'heure prévue");
    expect(retirerProgrammationAction).not.toHaveBeenCalled();
  });

  it("« Oui » appelle l'action avec (clé, « retirer ») et dit le succès rendu par l'action", async () => {
    retirerProgrammationAction.mockClear();
    const m = monter(RetirerProgrammation, { cle: CLE });
    cliquer(m, (t) => t.includes("Retirer"))();
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    expect(retirerProgrammationAction).toHaveBeenCalledWith(CLE, "retirer");
    expect(lisible(rendre(m.rendre() as ReactElement))).toContain("Retirée du calendrier");
  });

  it.each([
    ["RETRAIT_A_VERIFIER", "relisez-la", "À vérifier."],
    ["RETRAIT_A_LA_MAIN", "retirez-la", "À retirer à la main."],
    ["RETRAIT_RESTE_PROGRAMME", "reste programmée", "Pas retirée."],
    ["RETRAIT_REFUSE", "elle ne se retire plus", "Pas retirée."],
  ])("refus %s : phrase claire, jamais de succès", async (code, morceau, titre) => {
    retirerProgrammationAction.mockResolvedValueOnce({ ok: false, code, message: `Phrase : ${morceau}.` });
    const m = monter(RetirerProgrammation, { cle: CLE });
    cliquer(m, (t) => t.includes("Retirer"))();
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain(titre);
    expect(html).toContain(morceau);
    expect(html).not.toContain("Retirée du calendrier");
    expect(html).not.toContain("C'est fait");
  });

  it("l'action plante (réseau) : « pas pu être confirmé », jamais « retirée »", async () => {
    retirerProgrammationAction.mockRejectedValueOnce(new Error("coupé"));
    const m = monter(RetirerProgrammation, { cle: CLE });
    cliquer(m, (t) => t.includes("Retirer"))();
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain("À vérifier.");
    expect(html).not.toContain("Retirée");
  });

  it.each([["code inconnu", { ok: false as const, code: "AUTRE", message: "Réessayez." }], ["sans code", { ok: false as const, message: "Un souci est survenu. Réessayez dans un instant." }]])("%s : « À vérifier », jamais un simple « réessayez »", async (_n, rep) => {
    retirerProgrammationAction.mockResolvedValueOnce(rep);
    const m = monde_(CLE);
    cliquer(m, (t) => t.includes("Retirer"))();
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain("À vérifier.");
    expect(html).not.toContain("Retirée");
  });

  it("retrait partiel : aucun titre « Pas retirée » devant la phrase de l'action", async () => {
    retirerProgrammationAction.mockResolvedValueOnce({ ok: false, code: "RETRAIT_RESTE_PROGRAMME", message: "Retrait partiel. Retiré chez le diffuseur : LinkedIn. Reste programmé : Facebook." });
    const m = monde_(CLE);
    cliquer(m, (t) => t.includes("Retirer"))();
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    const html = lisible(rendre(m.rendre() as ReactElement));
    expect(html).toContain("Retrait partiel.");
    expect(html).not.toContain("Pas retirée");
  });

  it("succès : « Annuler » proposé, il appelle annulerRetraitAction avec le créneau ; jamais avant le succès", async () => {
    annulerRetraitAction.mockClear();
    retirerProgrammationAction.mockResolvedValueOnce({ ok: true, donnees: { creneauId: "c1", annulableJusquA: new Date(Date.now() + 10_000).toISOString(), message: "Retirée du calendrier." } });
    const m = monde_(CLE);
    cliquer(m, (t) => t.includes("Retirer"))();
    expect(lisible(rendre(m.rendre() as ReactElement))).not.toContain("Annuler");
    await cliquer(m, (t) => t.includes("Oui"))();
    await attendre();
    expect(lisible(rendre(m.rendre() as ReactElement))).toContain("Annuler");
    await cliquer(m, (t) => t === "Annuler")();
    await attendre();
    expect(annulerRetraitAction).toHaveBeenCalledWith("c1");
  });

  it("succès : pas de rafraîchissement tant que « Annuler » est proposé (l'aperçu garderait sinon son message)", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    try {
      retirerProgrammationAction.mockResolvedValueOnce({ ok: true, donnees: { creneauId: "c1", annulableJusquA: new Date(Date.now() + 10_000).toISOString(), message: "Retirée du calendrier." } });
      const m = monde_(CLE);
      cliquer(m, (t) => t.includes("Retirer"))();
      await cliquer(m, (t) => t.includes("Oui"))();
      await attendre();
      expect(lisible(rendre(m.rendre() as ReactElement))).toContain("Annuler");
      expect(reload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aucun bouton orange (un seul par écran) et mots simples", () => {
    const m = monter(RetirerProgrammation, { cle: CLE });
    cliquer(m, (t) => t.includes("Retirer"))();
    const html = rendre(m.rendre() as ReactElement);
    expect(html).not.toContain("bg-orange");
    expect(lisible(html)).not.toMatch(/Buffer|Zernio|diffuseur|API|erreur|supprim/i);
  });
});

describe("où le geste paraît", () => {
  it("aperçu : entrée de créneau programmée à venir = « Retirer » ; l'ancien « Retirer du calendrier » n'y est pas", () => {
    const h = lisible(panneau(entree()));
    expect(h).toContain("Retirer");
    expect(h).not.toContain("Retirer du calendrier");
  });
  it("aperçu : une publication locale garde l'ancien geste local, pas le nouveau", () => {
    const h = lisible(panneau(entree({ cle: "publication:pub_envoi:vis_1:linkedin:v1|linkedin" })));
    expect(h).toContain("Retirer du calendrier");
    expect(h).not.toContain("Elle ne partira pas");
  });
  it.each([["jour passé", { jour: "2026-11-10" }], ["publiée", { etat: "publie" as const }]])("aperçu : pas pour %s", (_n, sur) => {
    expect(panneau(entree(sur as Partial<Entree>))).not.toContain('data-geste="retirer-programme"');
  });
  it("fiche : le geste paraît seulement quand l'hôte l'allume (retraitProgrammation)", () => {
    expect(fiche()).not.toContain('data-geste="retirer-programme"');
    expect(fiche({ retraitProgrammation: true })).toContain('data-geste="retirer-programme"');
    expect(fiche({ retraitProgrammation: true }, { cle: "publication:p1|linkedin" })).not.toContain('data-geste="retirer-programme"');
    expect(fiche({ retraitProgrammation: true }, { etat: "a_valider" })).not.toContain('data-geste="retirer-programme"');
  });
});

describe("déplacement : retiré chez le diffuseur AVANT d'être marqué « annulé »", () => {
  it("l'ordre des événements : retrait confirmé, puis seulement l'écriture « annule » ; retrait raté : aucune écriture", async () => {
    const { deplacerProgrammation } = await import("@/services/deplacer-programmation");
    const MIN = 60_000;
    const arrondi = (x: number) => Math.floor(x / MIN) * MIN;
    const heure = (j: number) => new Date(arrondi(Date.now() + j * 86_400_000)).toISOString().replace(/\.\d{3}Z$/, "Z");
    const CLE_V0 = "envoi:vis_1:linkedin:v0";
    const mk = (issue: "retire" | "a-verifier") => {
      const journal: string[] = [];
      const envoi = { id: CLE_V0, cle: CLE_V0, creneauId: "cre_1", videoId: "vis_1", reseau: "linkedin", statut: "programme", versionCreneau: 0, cleDiffuseur: CLE_V0, jour: heure(2).slice(0, 10) };
      const creneau = { id: "cre_1", jourVise: heure(2).slice(0, 10), heuresParReseau: { linkedin: heure(2) }, compteCible: "c", textes: { linkedin: { texte: "t", premierCommentaire: "" } }, statut: "programme", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur" };
      const deps = {
        diffuseur: { retirer: async () => (journal.push("retrait"), issue) },
        reglagesOuverts: async () => true,
        creneau: async () => creneau,
        envois: async () => [envoi],
        visuel: async () => null,
        appliquer: async (lot: { enregistrer: { collection: string; entite: { statut?: string } }[] }) => void journal.push(lot.enregistrer.some((x) => x.collection === "envoisPlanifies" && x.entite.statut === "annule") ? "ecriture-annule" : "ecriture"),
        niveau: async () => ({ niveau: "programme" as const }),
        publicationsDeCles: async () => [],
        etats: { lire: async () => undefined, noter: async () => undefined },
        notifier: async () => undefined,
        maintenant: () => new Date(),
      };
      return { deps, journal };
    };
    const ok = mk("retire");
    const r = await deplacerProgrammation(ok.deps as never, { creneauId: "cre_1", nouveauJour: heure(4).slice(0, 10), cle: "f1" });
    expect(r.ok).toBe(true);
    expect(ok.journal).toEqual(["retrait", "ecriture-annule"]);
    const rate = mk("a-verifier");
    const r2 = await deplacerProgrammation(rate.deps as never, { creneauId: "cre_1", nouveauJour: heure(4).slice(0, 10), cle: "f2" });
    expect(r2.ok).toBe(false);
    expect(rate.journal).toEqual(["retrait"]);
  });

  it("le port réel : un post au-delà de la première page est retrouvé ; sans post sous la clé : « à vérifier », jamais « retiré »", async () => {
    const { portRetraitDepuisClient } = await import("@/services/deplacer-programmation");
    const pleine = Array.from({ length: 100 }, (_, i) => ({ _id: `p${i}`, metadata: { studioCle: `autre${i}` } }));
    const retirer = vi.fn(async () => ({ etat: "retire" }));
    const client = (cible: boolean) => ({
      listerPosts: async (q: { status: string; page: number }) => (q.status === "draft" ? (q.page === 1 ? pleine : cible ? [{ _id: "cible", metadata: { studioCle: "K" } }] : []) : []),
      retirer,
    });
    const env = { cle: "K", cleDiffuseur: "K" } as never;
    expect(await portRetraitDepuisClient((() => client(true)) as never).retirer(env)).toBe("retire");
    expect(retirer).toHaveBeenCalledWith({ postId: "cible", cleJournal: "K" });
    retirer.mockClear();
    expect(await portRetraitDepuisClient((() => client(false)) as never).retirer(env)).toBe("a-verifier");
    expect(retirer).not.toHaveBeenCalled();
  });
});
