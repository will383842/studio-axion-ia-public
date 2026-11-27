/**
 * Pinterest, PR 1 : une épingle ne naît que par l'import. Aucun texte mis en stock n'est étiqueté Pinterest, la page
 * « répartir un lot » n'offre pas la case, et les règles de départ de Pinterest disent ce qui n'est pas vérifié.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.hoisted(() => ({ creer: vi.fn(async (...a: unknown[]) => ({ ok: a.length >= 0 })) }));
vi.mock("@/app/(studio)/ecrire/stock/actions", () => ({ creerEntreeStockAction: action.creer }));

const { mettreEnStock } = await import("@/components/ecrire/BoutonMettreEnStock");
const { AjoutStockEnLot } = await import("@/components/ecrire/AjoutStockEnLot");
const { REGLAGES_CADENCE_DEFAUT } = await import("@/domaine/cadence/reglages");

const lire = (p: string) => readFileSync(join(__dirname, "../..", p), "utf-8");

describe("stock : Pinterest volontairement absent", () => {
  beforeEach(() => action.creer.mockClear());

  it("mettreEnStock n'étiquette jamais Pinterest, mais garde les réseaux vidéo", async () => {
    await mettreEnStock("Un texte d'exemple", "essai");
    expect(action.creer).toHaveBeenCalledTimes(1);
    const { reseaux } = action.creer.mock.calls[0]![0] as { reseaux: string[] };
    expect(reseaux).not.toContain("pinterest");
    expect(reseaux).toEqual(expect.arrayContaining(["linkedin", "instagram", "facebook", "tiktok"]));
  });
  it("l'ajout en lot ne propose pas la case Pinterest", () => {
    const html = renderToStaticMarkup(createElement(AjoutStockEnLot as never, {} as never));
    expect(html.toLowerCase()).not.toContain("pinterest");
    expect(html).toContain("TikTok");
  });
  it("les deux sources filtrent Pinterest et portent le commentaire", () => {
    for (const f of ["src/components/ecrire/BoutonMettreEnStock.tsx", "src/components/ecrire/AjoutStockEnLot.tsx"]) {
      const s = lire(f);
      expect(s, f).toContain('RESEAUX_TAXONOMIE.filter((r) => r !== "pinterest")');
      expect(s, f).toContain("Pinterest volontairement absent : une épingle ne naît que par l'import");
    }
  });
});

describe("répartir un lot : pas de case Pinterest", () => {
  it("la page filtre Pinterest du formulaire ET des réseaux lus dans l'adresse", () => {
    const s = lire("src/app/(studio)/calendrier/repartir/page.tsx");
    expect(s).toContain('RESEAUX_CADENCE.filter((r) => r !== "pinterest")');
    expect(s).not.toMatch(/RESEAUX_CADENCE\.map|\(RESEAUX_CADENCE as readonly/);
  });
});

describe("cadence : règles de départ de Pinterest", () => {
  const r = REGLAGES_CADENCE_DEFAUT.regles.pinterest;
  it("premier commentaire : « sans objet », jamais daté", () => {
    expect(r.premierCommentaire.source).toMatch(/sans objet/i);
    expect(r.premierCommentaire.verifieLe).toBeNull();
  });
  it("mots-dièses : source « non vérifiée », cohérente avec LIMITES_MOTS_DIESES.pinterest = inconnu", () => {
    expect(r.motsDieseMax.source).toMatch(/non vérifiée/i);
    expect(r.motsDieseMax.verifieLe).toBeNull();
  });
  it("les autres réseaux ne changent pas", () => {
    expect(REGLAGES_CADENCE_DEFAUT.regles.linkedin.premierCommentaire.source).toMatch(/le premier commentaire peut partir/);
    expect(REGLAGES_CADENCE_DEFAUT.regles.tiktok.motsDieseMax.source).toMatch(/pas encore vérifiée/);
  });
});
