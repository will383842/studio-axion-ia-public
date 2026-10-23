/** S3.5 — page « Sur le site » : ce qui est en ligne par générateur ; entrée de menu cachée tant que tout est éteint. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, back: () => undefined }), usePathname: () => "/sur-le-site", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/videos/[id]/actions-site", () => ({ retirerDuSiteAction: async () => ({ ok: true, donnees: undefined }), publierSurLeSiteAction: async () => ({ ok: true, donnees: { etat: "en-ligne" } }) }));

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const pub = await import("@/services/publications");
const { creerSiteFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");
const { navigationLaterale, tuilesPlusMobile } = await import("@/components/coquille/navigation");
const { default: PageSurLeSite } = await import("@/app/(studio)/sur-le-site/page");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
  injecterSiteFactice(creerSiteFactice({ secret: "s" }));
});
afterEach(() => injecterSiteFactice(null));

/** Met une vidéo « en ligne » sans passer par le site (l'état seul compte pour cette page). */
async function mettreEnLigne(videoId: string, etat: "en-ligne" | "retiree" | "echec" = "en-ligne") {
  await pub.obtenirKit(videoId);
  const kit = (await depots().kits.trouver((k) => k.videoId === videoId))!;
  await depots().kits.modifier(kit.id, { site: { choisie: true, etat, versionEnLigne: etat === "retiree" ? undefined : 2, url: etat === "retiree" ? undefined : `https://site-factice.invalid/fr/videos/${videoId}`, fichiersPublics: [], modifieLe: "2026-10-18T10:00:00.000Z" } });
}

const html = async () => renderToStaticMarkup(await PageSurLeSite());

describe("S3.5 listerEnLigne", () => {
  it("rien n'est en ligne par défaut", async () => {
    expect(await site.listerEnLigne()).toEqual([]);
  });

  it("regroupe par générateur ; une vidéo retirée ou jamais publiée est absente", async () => {
    await mettreEnLigne("v-01");
    await mettreEnLigne("v-02", "retiree");
    await mettreEnLigne("v-11"); // podcast
    const groupes = await site.listerEnLigne();
    expect(groupes.map((g) => g.formatId).sort()).toEqual(["avocat", "podcast"]);
    const avocat = groupes.find((g) => g.formatId === "avocat")!;
    expect(avocat.videos.map((v) => v.videoId)).toEqual(["v-01"]);
    expect(avocat.videos[0]).toMatchObject({ versionEnLigne: 2, url: "https://site-factice.invalid/fr/videos/v-01", etat: "en-ligne" });
    expect(avocat.nom).toBeTruthy();
  });

  it("un échec est listé (pour « Réessayer »), pas une vidéo hors ligne", async () => {
    await mettreEnLigne("v-01", "echec");
    const groupes = await site.listerEnLigne();
    expect(groupes[0].videos[0].etat).toBe("echec");
  });
});

describe("S3.5 la page", () => {
  it("vide : une phrase, aucun tableau", async () => {
    const h = await html();
    expect(h).toContain("Sur le site");
    expect(h).toContain("Rien n&#x27;est encore sur le site");
  });

  it("liste par générateur : titre, version, lien ↗, vues « — », « Retirer »", async () => {
    await mettreEnLigne("v-01");
    await mettreEnLigne("v-02", "retiree");
    const h = await html();
    expect(h).toContain((await depots().videos.obtenir("v-01"))!.titre.slice(0, 20));
    expect(h).not.toContain((await depots().videos.obtenir("v-02"))!.titre.slice(0, 25));
    expect(h).toContain('href="https://site-factice.invalid/fr/videos/v-01"');
    expect(h).toContain("↗");
    expect(h).toContain("Version 2");
    expect(h).toContain("—");
    expect(h).toContain("Retirer");
  });
});

describe("S3.5 menu", () => {
  const formats = [{ id: "avocat", statut: "actif" as const }];
  it("caché tant que tout est éteint, visible dès qu'un générateur est allumé", async () => {
    expect(await site.surLeSiteVisible()).toBe(false);
    expect(navigationLaterale(formats, false).some((e) => e.href === "/sur-le-site")).toBe(false);
    await site.definirSiteGenerateur("avocat", true);
    expect(await site.surLeSiteVisible()).toBe(true);
    expect(navigationLaterale(formats, true).some((e) => e.href === "/sur-le-site")).toBe(true);
    expect(tuilesPlusMobile(true).some((e) => e.href === "/sur-le-site")).toBe(true);
    expect(tuilesPlusMobile(false).some((e) => e.href === "/sur-le-site")).toBe(false);
    await site.definirSiteGenerateur("avocat", false);
    expect(await site.surLeSiteVisible()).toBe(false);
  });
  it("sans l'option, la navigation est exactement celle d'avant", () => {
    expect(navigationLaterale(formats)).toEqual(navigationLaterale(formats, false));
    expect(createElement).toBeTruthy();
  });
});
