/**
 * Refus « page lisible » persistant du 23/10/2026 (série Automatisations) : le refus de la règle 4 ne disait pas POURQUOI
 * la page de plus automatique n'avait pas pu passer, ni quoi faire quand la page n'a qu'une scène.
 *
 * Cas 1 à 5 : fonction pure `pourquoiPasDePageDePlus` sur de petites fiches « reference/3 » bâties à partir du témoin
 * (aucune mise en page réelle n'est nécessaire).
 * Cas 6 : ATTENTION, la mise en page est SIMULÉE (vi.mock remonté, comme dans pages-dans-le-style-23-10) : elle refuse
 * la page de la scène témoin en « tableau-blanc ». Aucune vraie fiche ne reproduit le cas ; ce test prouve le texte du
 * refus, pas que la vraie page ne tient pas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { jugerFiche, partiesDuDecoupage, variableRelance, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { pourquoiPasDePageDePlus } from "@/moteurs/montage-tableau/densite";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";


const etat = vi.hoisted(() => ({ refuserSansOptions: false, refuserDeuxScenes: false, refuserSiDessin: false }));

vi.mock("@/moteurs/montage-tableau/mise-en-page", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/moteurs/montage-tableau/mise-en-page")>();
  return {
    ...original,
    mettreEnPage: ((fiche: { styleTableau?: string; scenes: { page: number; texteDit: string }[] }, options?: unknown) => {
      // Mode « règle seule » : la règle 4 appelle la mise en page SANS options, la réparation avec { } : seule la règle refuse.
      if (etat.refuserSansOptions && options === undefined && fiche.styleTableau === "tableau-blanc") throw new original.ErreurMiseEnPage("Page 8 · scène s09 · la page ne tient pas au-dessus de la bande des sous-titres (simulé)", 8);
      if (etat.refuserDeuxScenes && fiche.styleTableau === "tableau-blanc") {
        const a = fiche.scenes.find((x) => x.texteDit.startsWith("Une collaboratrice comptable"));
        const b = fiche.scenes.find((x) => x.texteDit.startsWith("Avant, elle fouillait"));
        if (a && b && a.page === b.page) throw new original.ErreurMiseEnPage(`Page ${a.page} · scène s08 · la page ne tient pas au-dessus de la bande des sous-titres (simulé)`, a.page);
      }
      if (etat.refuserSiDessin && fiche.styleTableau === "tableau-blanc") {
        const d = (fiche.scenes as { texteDit: string; page: number; elements?: { type: string }[] }[]).find((y) => y.texteDit.startsWith("Un dossier connu d'une seule") && y.elements?.some((e) => e.type === "dessin"));
        if (d) throw new original.ErreurMiseEnPage(`Page ${d.page} · scène s09 · la page ne tient pas au-dessus de la bande des sous-titres (simulé)`, d.page);
        return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
      }
      const s = fiche.scenes.find((x) => x.texteDit === "Un dossier connu d'une seule personne s'arrête avec elle.");
      if (!etat.refuserSansOptions && !etat.refuserDeuxScenes && fiche.styleTableau === "tableau-blanc" && s) throw new original.ErreurMiseEnPage(`Page ${s.page} · scène ${(s as { id?: string }).id} · la page ne tient pas au-dessus de la bande des sous-titres (simulé)`, s.page);
      return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
    }) as typeof original.mettreEnPage,
  };
});

const temoin: FicheTableau = JSON.parse(readFileSync(join(__dirname, "..", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8"));
const copie = () => structuredClone(temoin) as FicheTableau & { scenes: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("pourquoiPasDePageDePlus : la raison, quand la page de plus ne passe pas", () => {
  it("1 · page d'une seule scène qui ne dit qu'une phrase", () => {
    const f = copie();
    f.scenes[1].texteDit = "On leur a donné l'outil, pas ce qu'il faut lui demander.";
    expect(pourquoiPasDePageDePlus(f, 2)).toContain("ne dit qu'une phrase");
  });

  it("2 · une coupe laisserait une page qui n'écrit rien : la raison cite la règle de page et le mot de la coupe", () => {
    const f = copie();
    const s = f.scenes[1];
    s.texteDit = "On leur a donné l'outil. Le compte rendu, tapé à la main.";
    s.elements = [
      { ...s.elements[0], texte: "On leur a donné l'outil.", ancre: 0 },
      { ...s.elements[1], texte: "donné l'outil", ancre: 3 },
      { id: "e90", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 6 },
    ];
    const raison = pourquoiPasDePageDePlus(f, 2);
    expect(raison).toContain("n'écrit rien");
    expect(raison).toContain("avant « Le »");
  });

  it("3 · 18 scènes : « 18 scènes au plus » ; 14 pages : « plus de page libre »", () => {
    const f = copie();
    f.scenes[1].texteDit = "Une seule phrase ici. Et une autre là.";
    const clones = Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(f.scenes[4]), id: `s${11 + i}`, page: 5 }));
    f.scenes = [...f.scenes, ...clones];
    expect(f.scenes).toHaveLength(18);
    expect(pourquoiPasDePageDePlus(f, 2)).toContain("18 scènes au plus");
    const g = copie();
    g.scenes[9].page = 14;
    expect(pourquoiPasDePageDePlus(g, 2)).toContain("plus de page libre");
  });

  it("4 · page de deux scènes dont le déplacement casse la règle de page : la raison cite la scène et le détail", () => {
    const f = copie();
    f.scenes[7].elements = [{ id: "e19", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 0 }];
    const raison = pourquoiPasDePageDePlus(f, 7);
    expect(raison).toContain("s08");
    expect(raison).toContain("n'écrit rien");
  });

  it("4 bis · scène calée sur un temps fixé : la raison le dit (jamais « une phrase »)", () => {
    const f = copie();
    f.scenes[1].debutMs = 1000;
    expect(pourquoiPasDePageDePlus(f, 2)).toContain("temps fixé");
  });

  it("4 ter · scène portant l'écran d'appel : la raison le dit", () => {
    const f = copie();
    f.scenes[1].ecrans = [{ moment: "appel" }];
    expect(pourquoiPasDePageDePlus(f, 2)).toContain("écran d'appel");
  });

  it("5 · garde-fou : une page que la réparation sait faire passer n'a aucune raison (null)", () => {
    expect(pourquoiPasDePageDePlus(copie(), 7)).toBeNull();
  });

  it("5 bis · jamais d'exception : fiche absurde, page vide", () => {
    expect(pourquoiPasDePageDePlus(copie(), 99)).toBeNull();
    expect(() => pourquoiPasDePageDePlus({ habillage: "reference/3" } as never, 1)).not.toThrow();
    expect(pourquoiPasDePageDePlus({ habillage: "reference/3" } as never, 1)).toMatch(/erreur/);
  });
});

describe("refus de la règle 4 expliqué (mise en page SIMULÉE)", () => {
  const cas = JSON.parse(readFileSync(join(__dirname, "temoins", "decoupage-v-365dd2ae67ee.json"), "utf8"));
  cas.reponse.serie = { code: "automatisations", nom: "Automatisations" };
  const b = cas.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  const parties = partiesDuDecoupage(cas.parties);
  const entree = {
    texteScript: cas.texteScript, structure: b.structure, serie: b.serie, douleur: b.douleur, gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })),
    dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId, versionId: b.versionId, habillage: b.habillage, stylo: b.stylo, ratio: b.ratio,
    controle: {
      aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [],
      matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })),
      ...(cas.motsDouleur ? { motsDouleur: cas.motsDouleur } : {}),
    },
    ...(parties ? { parties } : {}),
  } as EntreeDecoupage;

  it("6 · le refus dit pourquoi la page de plus a échoué et quoi faire", () => {
    const j = jugerFiche(cas.reponse, entree);
    expect(j.ok).toBe(false);
    if (j.ok) return;
    const refus = j.refus.find((r) => r.includes("La page de plus automatique a échoué"));
    expect(refus, j.refus.join("\n")).toBeDefined();
    expect(refus).toContain("ne dit qu'une phrase");
    expect(refus).toContain("UN détail OU le visuel");
    expect(refus).not.toContain("Coupez la scène s09");
  });

  const refusPageDePlus = (reponse: unknown) => {
    const j = jugerFiche(reponse, entree);
    expect(j.ok).toBe(false);
    return j.ok ? undefined : j.refus.find((r) => r.includes("La page de plus automatique a échoué"));
  };

  it("6 bis · plus de page libre : le refus propose de réunir deux pages courtes, jamais de couper", () => {
    const reponse = structuredClone(cas.reponse);
    const vide = { id: "e90", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 0 };
    for (let p = 10; p <= 14; p++) reponse.scenes.push({ ...structuredClone(reponse.scenes[0]), id: `s${p + 1}`, page: p, texteDit: "Oui.", elements: [{ ...vide, id: `e9${p}` }] });
    const refus = refusPageDePlus(reponse);
    expect(refus).toContain("plus de page libre");
    expect(refus).toContain("Réunissez deux pages courtes");
    expect(refus).not.toContain("oupez la scène");
  });

  it("6 ter · 18 scènes : le refus propose de réunir deux scènes voisines", () => {
    const reponse = structuredClone(cas.reponse);
    const vide = { id: "e90", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 0 };
    const clones = Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(reponse.scenes[0]), id: `s${11 + i}`, texteDit: "Oui.", elements: [{ ...vide, id: `e9${i}` }] }));
    reponse.scenes.splice(1, 0, ...clones);
    const refus = refusPageDePlus(reponse);
    expect(refus).toContain("18 scènes au plus");
    expect(refus).toContain("Réunissez deux scènes voisines");
  });

  it("6 quater · refus de la règle 4 sur une page que la réparation ne juge pas trop chargée : aucun complément", () => {
    etat.refuserSansOptions = true;
    try {
      const j = jugerFiche(cas.reponse, entree);
      expect(j.ok).toBe(false);
      if (j.ok) return;
      expect(j.refus.some((r) => r.includes("page lisible"))).toBe(true);
      expect(j.refus.join(" ")).not.toContain("La page de plus automatique a échoué");
    } finally {
      etat.refuserSansOptions = false;
    }
  });

  it("6 quinquies · page de plusieurs scènes dont la page de plus casse une règle : « seule sur une page NEUVE »", () => {
    const reponse = structuredClone(cas.reponse);
    reponse.scenes[7].elements = [{ id: "e90", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 0 }]; // la scène s08 ne porte plus qu'un dessin
    etat.refuserDeuxScenes = true;
    try {
      const refus = refusPageDePlus(reponse);
      expect(refus).toContain("seule sur une page NEUVE");
      expect(refus).toContain("en respectant la règle citée");
    } finally {
      etat.refuserDeuxScenes = false;
    }
  });

  it("6 sexies · intégration : page d'une phrase qui ne tient pas à cause d'un dessin → allégée, acceptée (vrai verifier), retraits notés, texte dit identique", () => {
    etat.refuserSiDessin = true;
    try {
      const reponse = structuredClone(cas.reponse);
      const s9 = reponse.scenes[8];
      s9.elements = [...s9.elements, { id: "e90", type: "dessin", dessinId: DESSINS[0].id, cote: "droite", ancre: 3 }];
      const j = jugerFiche(reponse, entree);
      expect(j.ok ? "ok" : j.refus.join(" "), "refus").toBe("ok");
      if (!j.ok) return;
      expect(j.retraits).toEqual([{ page: 8, sceneId: "s09", elementId: "e90", type: "dessin" }]);
      expect(j.fiche.scenes.map((s) => s.texteDit)).toEqual(cas.reponse.scenes.map((s: { texteDit: string }) => s.texteDit));
      expect(j.fiche.scenes.find((s) => s.id === "s09")!.elements.map((e) => e.type)).toEqual(["ligne"]);
    } finally {
      etat.refuserSiDessin = false;
    }
  });

  it("7 · la relance prévient que les numéros cités sont ceux d'après la réparation", () => {
    expect(variableRelance("<x/>", "{}", ["refus"])).toContain("APRÈS la réparation automatique");
  });
});
