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

const { confirmerPrix, HoteConfirmationPrix } = await import("@/components/ui/ConfirmationPrix");
const { fabriquerAvecUneRelance } = await import("@/components/formats/commun/avant-prix");
const { Fabrication } = await import("@/components/formats/image-video/Fabrication");

const EN_ATTENTE = Symbol("en attente");
const dansLeTour = <T,>(p: Promise<T>) => Promise.race([p, new Promise<typeof EN_ATTENTE>((r) => setTimeout(() => r(EN_ATTENTE), 20))]);
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("confirmerPrix : un montant connu est accepté sans feuille", () => {
  it("avec un montant (même 0) : rendu tout de suite, aucune feuille ouverte", async () => {
    expect(await dansLeTour(confirmerPrix({ message: "m", montant: 250 }))).toBe(250);
    expect(await dansLeTour(confirmerPrix({ message: "m", montant: 0 }))).toBe(0);
    expect(renderToStaticMarkup(createElement(HoteConfirmationPrix))).not.toContain("Confirmer ce prix");
  });

  it("sans montant : la feuille reste (la question attend une réponse)", async () => {
    expect(await dansLeTour(confirmerPrix({ message: "Continuer ?" }))).toBe(EN_ATTENTE);
    await confirmerPrix({ message: "autre" }).then(() => undefined, () => undefined).catch(() => undefined);
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
