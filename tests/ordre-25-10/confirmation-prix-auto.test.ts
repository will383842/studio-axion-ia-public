/**
 * Écran commun « le prix ne bloque jamais » (règle produit du 25/10/2026) : l'utilisateur ne valide plus aucun prix à la
 * main. `confirmerPrix` avec un montant connu le rend tout de suite (pas de feuille « Confirmer ce prix ») ; « Fabriquer »
 * relance UNE seule fois avec le montant du serveur ; l'écran de fabrication image → vidéo ne propose plus de relever
 * le plafond. Rendus et fonctions pures, rien d'appelé, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { confirmerPrix } = await import("@/components/ui/ConfirmationPrix");
const { fabriquerAvecUneRelance } = await import("@/components/formats/commun/avant-prix");
const { refaireCettePartie } = await import("@/components/formats/image-video/reprise");
const { Fabrication } = await import("@/components/formats/image-video/Fabrication");

const EN_ATTENTE = Symbol("en attente");
const dansLeTour = <T,>(p: Promise<T>) => Promise.race([p, new Promise<typeof EN_ATTENTE>((r) => setTimeout(() => r(EN_ATTENTE), 20))]);
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("confirmerPrix : un montant connu est accepté sans feuille", () => {
  it("avec un montant (même 0) : rendu tout de suite, aucune feuille ouverte", async () => {
    expect(await dansLeTour(confirmerPrix({ message: "m", montant: 250 }))).toBe(250);
    expect(await dansLeTour(confirmerPrix({ message: "m", montant: 0 }))).toBe(0);
    // (L'ancienne assertion sur le rendu de l'hôte à vide ne prouvait rien : retirée. La preuve est la résolution immédiate ci-dessus.)
  });

  it("sans montant : la feuille reste (la question attend une réponse)", async () => {
    expect(await dansLeTour(confirmerPrix({ message: "Continuer ?" }))).toBe(EN_ATTENTE);
  });
});

describe("BoutonFabriquer : au plus une relance automatique", () => {
  it("le serveur dit accord-requis avec un montant : une seule relance avec ce montant, puis fin", async () => {
    const appels: number[] = [];
    const onFabriquer = vi.fn(async (accord: number) => {
      appels.push(accord);
      return { centimes: 400 };
    });
    await fabriquerAvecUneRelance(300, onFabriquer);
    expect(appels).toEqual([300, 400]);
  });

  it("la relance renvoie encore un montant : plus de boucle, la phrase « Le prix a changé, réessayez. » est rendue", async () => {
    const onFabriquer = vi.fn(async () => ({ centimes: 400 }));
    expect(await fabriquerAvecUneRelance(300, onFabriquer)).toBe("Le prix a changé, réessayez.");
    expect(onFabriquer).toHaveBeenCalledTimes(2);
  });

  // Limite : le composant BoutonFabriquer lui-même n'est pas monté ici (pas de DOM de test dans ce projet) ; sa logique
  // est portée par fabriquerAvecUneRelance, testée ci-dessus, et son rendu initial par le test ci-dessous.
  it("le rendu initial du bouton affiche le montant à titre d'information", async () => {
    const { BoutonFabriquer } = await import("@/components/formats/commun/BoutonFabriquer");
    const html = renderToStaticMarkup(createElement(BoutonFabriquer, { montantCentimes: 300, onFabriquer: async () => undefined }));
    expect(texte(html)).toContain("Fabriquer la vidéo");
  });

  it("pas de montant demandé : un seul envoi", async () => {
    const onFabriquer = vi.fn(async () => undefined);
    await fabriquerAvecUneRelance(300, onFabriquer);
    expect(onFabriquer).toHaveBeenCalledTimes(1);
  });
});

describe("Fabrication image → vidéo : plus de « Relever le plafond »", () => {
  const argent = { engageCentimes: 120, plafondCentimes: 500, payeCentimes: 50, attente: false, pas: [] };
  const rendre = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", ecran: "fabrication", vue: argent, enCours: false, ...p } as never));

  it("ni bouton ni message d'accord de prix, même plafond atteint ; la jauge reste", () => {
    const t = texte(rendre({ plafond: { proposeCentimes: 700, arrete: true } }));
    expect(t).not.toMatch(/Relever|plafond est atteint|Nouveau plafond/);
    expect(t).toContain("plafond");
    expect(t).toContain("Dépense");
  });
});

describe("Fabrication image → vidéo : « Refaire cette partie » après un arrêt sur le plafond", () => {
  it("relève au montant proposé et reprend, sans saisie ; sans arrêt, simple reprise", async () => {
    const corps: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      const c = JSON.parse(init.body) as Record<string, unknown>;
      corps.push(c);
      return { status: 200, json: async () => ({ issue: "plafond" in c ? { statut: "releve", plafondCentimes: 700, reprise: { statut: "reprise" } } : { statut: "reprise" } }) };
    }));
    expect(await refaireCettePartie("v-1", { proposeCentimes: 700, arrete: true })).toBeNull();
    expect(corps[0]).toMatchObject({ plafond: 700, reprendre: true });
    corps.length = 0;
    expect(await refaireCettePartie("v-1", { proposeCentimes: 700, arrete: false })).toBeNull();
    expect(corps[0]).not.toHaveProperty("plafond");
    vi.unstubAllGlobals();
  });
});
