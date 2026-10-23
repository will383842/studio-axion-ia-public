/**
 * Fidélité à la v4 (V4-1, mission B) : l'étape « L'annonce » ne montre plus un téléphone VIDE. L'objet `telephone-capture`
 * reçoit l'image de l'annonce déclarée par le cas (`visuel.image`) ; sans image (absente du cas ou pas déposée), il prend
 * un objet de repli dessiné. Rouge avant `visuels-du-cas.ts` et le champ `image` du cas.
 */
import { describe, expect, it } from "vitest";
import { proprietesEcrans } from "@/briques/ecrans-motion";
import { verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { imagesDuCas, REPLI_TELEPHONE_SANS_IMAGE } from "@/moteurs/montage-cas-concret/visuels-du-cas";
import { zoneProtegeeCombinee } from "@/reseaux";

const IMAGE = recrutementApporteurs.etapes[0].visuel;

/** Fiche minimale : l'étape de l'annonce (téléphone), une étape objet, un écran objet « téléphone ». */
function fiche(): FicheEcrans {
  const commun = { marque: "axion-ia.com", evenements: [], avanceMs: 0 };
  return {
    version: "fiche-ecrans/1",
    formatId: "cas-concret",
    videoId: "v",
    versionId: "w",
    habillage: "charte-duo/1",
    ratio: "9:16",
    offre: "integration",
    origine: "porte-a",
    posture: "chez-nous",
    casId: recrutementApporteurs.id,
    empreinteCas: "cas-x",
    ecrans: [
      { ...commun, id: "e01", type: "etape", fond: "ivoire", texteDit: "voit notre annonce.", numero: 1, total: 6, titre: "L'*annonce*", ligne: "Elle la voit sur Facebook.", visuel: { sorte: "objet", objet: "telephone-capture" }, puces: [] },
      { ...commun, id: "e02", type: "etape", fond: "sombre", texteDit: "reçoit ses e-mails.", numero: 3, total: 6, titre: "Les *e-mails*", ligne: "Ils partent tout seuls.", visuel: { sorte: "objet", objet: "pile-notifications" }, puces: [] },
      { ...commun, id: "e03", type: "objet", fond: "sombre", texteDit: "le téléphone.", titre: "Le *téléphone*", visuel: { sorte: "objet", objet: "telephone-capture" } },
    ],
  } as FicheEcrans;
}

const sansImage = (cas: CasConcret): CasConcret => ({ ...cas, etapes: cas.etapes.map((e) => (e.visuel.sorte === "objet" ? { ...e, visuel: { sorte: "objet" as const, objet: e.visuel.objet } } : e)) });

describe("le cas porte l'image de l'annonce", () => {
  it("le cas « recrutement-apporteurs » déclare l'image de l'annonce à son étape 1", () => {
    expect(IMAGE.sorte).toBe("objet");
    if (IMAGE.sorte !== "objet") return;
    expect(IMAGE.objet).toBe("telephone-capture");
    expect(IMAGE.image).toEqual({ cle: "visuels-cas-concret/recrutement-apporteurs/annonce.png", largeur: 1080, hauteur: 1920 });
    expect(verifierCas(recrutementApporteurs).ok).toBe(true);
  });

  it("une image n'est permise que sur le téléphone, avec une clé de stockage propre", () => {
    const autre = { ...recrutementApporteurs, etapes: recrutementApporteurs.etapes.map((e, i) => (i === 2 ? { ...e, visuel: { sorte: "objet", objet: "pile-notifications", image: { cle: "visuels-cas-concret/x.png", largeur: 1080, hauteur: 1920 } } } : e)) };
    const r = verifierCas(autre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raisons.join(" ")).toMatch(/image/);
    const mauvaiseCle = { ...recrutementApporteurs, etapes: recrutementApporteurs.etapes.map((e, i) => (i === 0 ? { ...e, visuel: { sorte: "objet", objet: "telephone-capture", image: { cle: "../secret.png", largeur: 1080, hauteur: 1920 } } } : e)) };
    expect(verifierCas(mauvaiseCle).ok).toBe(false);
  });
});

describe("imagesDuCas", () => {
  it("image déposée : l'étape de l'annonce montre l'image dans le téléphone", () => {
    const r = imagesDuCas(fiche(), recrutementApporteurs, new Set(["visuels-cas-concret/recrutement-apporteurs/annonce.png"]));
    // La fiche garde son objet (schéma exact) ; l'image est rangée avec les captures, pour cet écran.
    expect(r.fiche.ecrans[0]).toEqual(fiche().ecrans[0]);
    expect(r.captures.e01).toEqual({ cle: "visuels-cas-concret/recrutement-apporteurs/annonce.png", sorte: "image", largeur: 1080, hauteur: 1920 });
    // Les autres écrans ne changent pas ; le téléphone de l'écran `objet` sans étape du cas prend son repli dessiné.
    expect(r.fiche.ecrans[1]).toEqual(fiche().ecrans[1]);
    expect(r.fiche.ecrans[2].type === "objet" && r.fiche.ecrans[2].visuel).toEqual({ sorte: "objet", objet: REPLI_TELEPHONE_SANS_IMAGE });
    expect(r.journal).toEqual(["Téléphone de « Le téléphone » dessiné sans image : le cas ne déclare aucune image pour cette étape."]);
  });

  it("un écran `objet` qui reprend une étape du cas (même titre) montre aussi son image", () => {
    const f = fiche();
    f.ecrans[2] = { ...f.ecrans[2], titre: "L'*annonce*" } as FicheEcrans["ecrans"][number];
    const r = imagesDuCas(f, recrutementApporteurs, new Set(["visuels-cas-concret/recrutement-apporteurs/annonce.png"]));
    expect(r.captures.e03?.cle).toBe("visuels-cas-concret/recrutement-apporteurs/annonce.png");
    expect(r.journal).toEqual([]);
  });

  it("image pas déposée : repli dessiné, et une ligne au journal", () => {
    const r = imagesDuCas(fiche(), recrutementApporteurs, new Set());
    const e01 = r.fiche.ecrans[0];
    expect(e01.type === "etape" && e01.visuel).toEqual({ sorte: "objet", objet: REPLI_TELEPHONE_SANS_IMAGE });
    expect(r.captures.e01).toBeUndefined();
    expect(r.journal[0]).toMatch(/L'annonce.*pas déposée/);
  });

  it("cas sans image : jamais de téléphone vide (repli dessiné)", () => {
    const r = imagesDuCas(fiche(), sansImage(recrutementApporteurs), new Set());
    for (const e of r.fiche.ecrans) if (e.type === "etape" || e.type === "objet") expect(e.visuel).not.toEqual({ sorte: "objet", objet: "telephone-capture" });
    expect(r.journal).toHaveLength(2);
  });

  it("la chaîne d'écrans reçoit l'image : la brique la pose dans le téléphone de l'étape", () => {
    const r = imagesDuCas(fiche(), recrutementApporteurs, new Set(["visuels-cas-concret/recrutement-apporteurs/annonce.png"]));
    const cales = r.fiche.ecrans.map((e, i) => ({ ...e, debutMs: i * 2000, finMs: (i + 1) * 2000 }));
    const ecrans = ecransCales(cales, [], null, r.captures, recrutementApporteurs.faits);
    const props = proprietesEcrans({ ecrans, captures: { [r.captures.e01.cle]: { ...r.captures.e01, src: "annonce.png" } }, zoneProtegee: zoneProtegeeCombinee("9:16", ["facebook"])! });
    const p = props[0];
    expect(p.type === "etape" && p.visuel).toEqual({ capture: { src: "annonce.png", cle: "visuels-cas-concret/recrutement-apporteurs/annonce.png", sorte: "image", largeur: 1080, hauteur: 1920 } });
  });
});
