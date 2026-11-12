/**
 * NEW-ARG-01e · aucun montant à l'écran (lot e) : phrases du coût Face caméra animée, reprise et suivi Image-vidéo,
 * dépôt de prises, voix du tableau animé. Les coûts restent enregistrés ; seuls les textes rendus changent.
 * Rendu serveur seulement ; aucun appel réel (fetch remplacé).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAFOND_CLAUDE_FA_USD, estimationDuLot } from "@/services/facecam-animee";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";

const confirmations: string[] = [];
vi.mock("@/components/ui/ConfirmationPrix", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/ConfirmationPrix")>();
  return { ...original, confirmerPrix: vi.fn(async (r: { message: string; montant?: number }) => { confirmations.push(r.message); return typeof r.montant === "number" ? r.montant : true; }) };
});

const { lignesCout, phrasePaye } = await import("@/components/formats/facecam-animee/cout");
const { CoutVoixTableau } = await import("@/components/formats/tableau-anime/CoutVoix");
const { jusquALaReprise, releverPlafond, envoyerReprise } = await import("@/components/formats/image-video/reprise");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const ARGENT = /€|\$|\b(?:euros?|dollars?|USD|EUR)\b|\d\s*(?:€|\$)/i;

afterEach(() => vi.unstubAllGlobals());

describe("Face caméra animée · phrases du coût", () => {
  const e = estimationDuLot([{ dureeSec: 80 }, { dureeSec: 60 }], PLAFOND_CLAUDE_FA_USD, TAUX_USD_EUR_PAR_DEFAUT);
  it.each([1, 2])("%i vidéo(s) : aucune phrase ne contient de montant", (n) => {
    const est = n === 1 ? estimationDuLot([{ dureeSec: 80 }], PLAFOND_CLAUDE_FA_USD, TAUX_USD_EUR_PAR_DEFAUT) : e;
    const tout = [...Object.values(lignesCout(est)), phrasePaye()].join(" ");
    expect(tout).not.toMatch(ARGENT);
    expect(tout).not.toMatch(/\d+,\d{2}/);
  });
});

describe("Tableau animé · voix", () => {
  it.each(["neuve", "reutilisee", "relue"] as const)("voix « %s » : aucun montant rendu", (voix) => {
    const t = texte(renderToStaticMarkup(createElement(CoutVoixTableau, { centimes: 123, voix, onLancer: () => {} })));
    expect(t).not.toMatch(ARGENT);
    expect(t).not.toMatch(/\d/);
  });
});

describe("Image-vidéo · reprise : une phrase du serveur avec un prix est masquée", () => {
  const reponse = (issue: unknown) => vi.fn(async () => new Response(JSON.stringify({ issue }), { status: 200 }));
  it("refus avec montant : phrase finale sans montant", async () => {
    vi.stubGlobal("fetch", reponse({ statut: "refusee", phrase: "Il faudrait 4,20 € de plus pour cette partie." }));
    const fin = await jusquALaReprise("v1", await envoyerReprise("v1"));
    expect(fin).toBeTruthy();
    expect(fin).not.toMatch(ARGENT);
    expect(fin).not.toMatch(/\d+,\d{2}/);
  });
  it("accord requis : la commande n'est pas bloquée, la phrase confirmée est sans montant", async () => {
    confirmations.length = 0;
    const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ issue: { statut: "accord-requis", centimes: 420, phrase: "Cette partie coûte environ 4,20 €." } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ issue: { statut: "reprise" } })));
    vi.stubGlobal("fetch", f);
    expect(await jusquALaReprise("v1", await envoyerReprise("v1"))).toBeNull();
    expect(confirmations.join(" ")).not.toMatch(ARGENT);
  });
  it("relever le plafond : refus avec montant masqué", async () => {
    vi.stubGlobal("fetch", reponse({ statut: "refusee", phrase: "Plafond de 12 euros dépassé." }));
    const fin = await releverPlafond("v1", 1200, true);
    expect(fin).not.toMatch(ARGENT);
  });
});
