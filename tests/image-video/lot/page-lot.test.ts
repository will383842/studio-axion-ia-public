/**
 * LOT D'IMAGES · L9 — la page du lot (plan § e.2 à e.5) : titre et compteurs, barre d'étapes, sections « À relire » puis
 * « Le lot », pastilles d'état, une seule action par état, liens « Voir » / vers la nouvelle vidéo, accès depuis
 * l'écran de dépôt, phrase de mise de côté sur la page d'une vidéo. Rendu statique, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LotIV, StatutVideoLotIV } from "@/domaine/image-video/lot";
import { mockHeaders } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video/lot/x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const service = await import("@/services/image-video-lot");
const { SuiviLot } = await import("@/components/formats/image-video/SuiviLot");
const { construireVueImageVideo } = await import("@/services/image-video-ecran");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

function lotDe(statuts: StatutVideoLotIV[], surcharge: Partial<LotIV> = {}): LotIV {
  return {
    version: "lot-iv/1",
    id: "lot-iv-0123456789ab",
    creeLe: "2026-10-17T10:00:00.000Z",
    cleIdempotence: "c",
    reseaux: ["linkedin"],
    prixParVideoCentimes: 220,
    accordCentimes: 220 * statuts.length,
    plafondCentimes: 220 * statuts.length,
    tauxUsdEur: 0.9,
    statut: "en-cours",
    pannesDeSuite: 0,
    journal: [],
    videos: statuts.map((statut, i) => ({
      rang: i + 1,
      videoId: `v${i + 1}`,
      fichierId: `f${i + 1}`,
      nom: `image-${i + 1}.png`,
      statut,
      ...(statut === "mise-de-cote" ? { miseDeCote: { porte: "carte" as const, motif: "Un point de l'image est incertain.", phrases: [] } } : {}),
      ...(statut === "refaite" ? { refaiteEn: "v-neuve" } : {}),
    })),
    ...surcharge,
  };
}
const vueDe = (lot: LotIV) => service.construireVueLotIV(lot, { imageUrl: (v) => `https://stockage.test/${v.fichierId}`, etape: (v) => (v.statut === "en-fabrication" ? "La voix" : undefined) });
const rendre = (lot: LotIV) => renderToStaticMarkup(createElement(SuiviLot, { vue: vueDe(lot) }));

describe("vue du lot (PUR)", () => {
  it("titre, compteurs, étape de la barre", () => {
    const v = vueDe(lotDe(["faite", "faite", "mise-de-cote", "en-fabrication", "en-attente"]));
    expect(v.titre).toBe("Lot de 5 images");
    expect(v.sousTitre).toBe("2 faites · 1 mise de côté · 2 à venir");
    expect(v.etape).toBe(1);
    expect(vueDe(lotDe(["faite", "faite"], { statut: "termine" })).etape).toBe(2);
    expect(vueDe(lotDe(["faite", "en-attente"], { statut: "arrete" })).etape).toBe(2);
  });

  it("une seule action par état du lot", () => {
    expect(vueDe(lotDe(["en-fabrication", "en-attente"])).action).toBe("arreter");
    expect(vueDe(lotDe(["en-attente", "en-attente"], { statut: "en-pause", pause: { raison: "credit", phrase: "Crédit insuffisant." } })).action).toBe("reprendre");
    expect(vueDe(lotDe(["faite", "mise-de-cote"], { statut: "termine" })).action).toBe("relire");
    expect(vueDe(lotDe(["faite", "mise-de-cote"], { statut: "arrete" })).action).toBe("relire");
    expect(vueDe(lotDe(["faite", "faite"], { statut: "termine" })).action).toBeNull();
  });

  it("« relire » mène à la première mise de côté", () => {
    const v = vueDe(lotDe(["faite", "mise-de-cote", "mise-de-cote"], { statut: "termine" }));
    expect(v.premiereARelire).toBe("/image-video/v2");
  });
});

describe("page du lot", () => {
  it("« À relire » vient avant « Le lot » ; chaque mise de côté a son motif, « Voir » et « Refaire »", () => {
    const html = rendre(lotDe(["faite", "mise-de-cote", "en-attente"]));
    const t = texte(html);
    expect(t.indexOf("À relire")).toBeGreaterThan(-1);
    expect(t.indexOf("À relire")).toBeLessThan(t.indexOf("Le lot"));
    expect(t).toContain("Un point de l'image est incertain.");
    expect(t).toContain("Mise de côté");
    expect(t).toContain("Refaire");
    expect(html).toContain('href="/image-video/v2"');
  });

  it("« À relire » est masquée quand rien n'est mis de côté", () => {
    const t = texte(rendre(lotDe(["faite", "en-fabrication", "en-attente"])));
    expect(t).not.toContain("À relire");
    expect(t).toContain("Le lot");
  });

  it("les pastilles disent l'état de chaque vidéo, par rang", () => {
    const t = texte(rendre(lotDe(["faite", "en-fabrication", "en-attente", "mise-de-cote", "refaite"])));
    for (const p of ["Faite", "La voix", "À venir", "Mise de côté", "Refaite"]) expect(t).toContain(p);
    expect(t.indexOf("image-1.png")).toBeLessThan(t.indexOf("image-2.png"));
    expect(t.indexOf("image-4.png")).toBeLessThan(t.indexOf("image-5.png"));
  });

  it("« Voir » sur les faites, lien vers la nouvelle vidéo sur les refaites", () => {
    const html = rendre(lotDe(["faite", "refaite"]));
    expect(html).toContain('href="/image-video/v1"');
    expect(html).toContain('href="/image-video/v-neuve"');
    expect(texte(html)).toContain("Voir la nouvelle");
  });

  it("une seule action principale : « Arrêter le lot » en cours, « Reprendre le lot » en pause avec sa phrase", () => {
    const enCours = texte(rendre(lotDe(["en-fabrication", "en-attente"])));
    expect(enCours).toContain("Arrêter le lot");
    expect(enCours).not.toContain("Reprendre le lot");
    const pause = texte(rendre(lotDe(["en-attente", "en-attente"], { statut: "en-pause", pause: { raison: "credit", phrase: "Le crédit HeyGen ne suffit plus." } })));
    expect(pause).toContain("Reprendre le lot");
    expect(pause).toContain("Le crédit HeyGen ne suffit plus.");
    expect(pause).not.toContain("Arrêter le lot");
    const fini = texte(rendre(lotDe(["faite", "mise-de-cote"], { statut: "termine" })));
    expect(fini).toContain("Relire la première mise de côté");
    expect(fini).not.toContain("Arrêter le lot");
    expect(texte(rendre(lotDe(["faite", "faite"], { statut: "termine" })))).not.toMatch(/Arrêter le lot|Reprendre le lot|Relire la première/);
  });

  it("aucun identifiant technique à l'écran", () => {
    const t = texte(rendre(lotDe(["faite", "mise-de-cote", "en-fabrication", "en-attente"])));
    expect(t).not.toMatch(/\b(lot-iv-|mise-de-cote|en-fabrication|en-attente|IV_[A-Z_]+|undefined|null|NaN)\b/);
  });
});

describe("page d'une vidéo du lot", () => {
  it("la vue d'une vidéo mise de côté porte la phrase « Mise de côté : motif »", () => {
    const etat = { version: "fabrication-iv/1", etape: "carte-a-valider", demande: { reseaux: ["linkedin"] }, caisse: { plafondCentimes: 500, reservations: [] }, tentatives: {}, journal: [], miseDeCote: { porte: "carte", motif: "Un point de l'image est incertain.", phrases: [] } };
    const travail = { id: "t1", statut: "echec", etapes: [], parametres: { imageVideo: etat } } as never;
    const vue = construireVueImageVideo({ id: "v1", titre: "Essai" }, travail, null);
    expect(vue.miseDeCote).toBe("Mise de côté : Un point de l'image est incertain.");
  });
  it("sans mise de côté, la vue ne change pas", () => {
    const etat = { version: "fabrication-iv/1", etape: "lecture", demande: { reseaux: ["linkedin"] }, caisse: { plafondCentimes: 500, reservations: [] }, tentatives: {}, journal: [] };
    expect(construireVueImageVideo({ id: "v1", titre: "Essai" }, { id: "t1", statut: "en_cours", etapes: [], parametres: { imageVideo: etat } } as never, null).miseDeCote).toBeUndefined();
  });
});

describe("accès aux lots depuis le dépôt", () => {
  it("la ligne d'un lot récent dit le nombre d'images, les faites et les mises de côté", () => {
    expect(service.ligneDuLotIV(lotDe(["faite", "faite", "mise-de-cote", "en-attente"]))).toBe("Lot de 4 images · 2 faites · 1 mise de côté");
  });
});
