/**
 * Chaîne de fabrication de la plus petite première version du tableau animé (TB-06a), avec doubles seulement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPOSITION_SCENE, ErreurFabrication, ETAPES_FABRICATION, ID_SCENE_FIN, fabriquerTableau, type EtapeFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ParametresDemandeComposition } from "../../../src/briques/composition/scene";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { EXEMPLES, copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "./doubles";

const FIN = "Enregistrez cette vidéo pour la refaire";

it("l'identifiant de la composition d'une scène est celui inscrit par TB-05", () => {
  // Lu dans le source (l'importer tirerait Remotion et les polices dans les tests).
  const source = readFileSync(join(__dirname, "../../../studio-rendu/compositions/tableau/Compositions.tsx"), "utf8");
  expect(source).toContain(`scene: "${COMPOSITION_SCENE}"`);
});

async function erreurDe(p: Promise<unknown>): Promise<ErreurFabrication> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurFabrication);
    return e as ErreurFabrication;
  }
  throw new Error("La fabrication aurait dû s'arrêter.");
}

describe("chaîne complète sur les 4 fiches d'exemple", () => {
  for (const [structure, fiche] of Object.entries(EXEMPLES)) {
    it(`fabrique « ${structure} » : voix lue une fois, chaque scène et la fin rendues, une composition complète`, async () => {
      const d = doubles(fiche, { fin: FIN });
      const r = await fabriquerTableau(d.outils);

      expect(d.lectures()).toBe(1);
      expect(r.etapes.map((e) => e.etape)).toEqual([...ETAPES_FABRICATION]);
      expect(r.etapes.every((e) => e.statut === "faite")).toBe(true);
      const ids = [...fiche.scenes.map((s) => s.id), ID_SCENE_FIN];
      expect(r.scenes.rendues).toEqual(ids);
      expect(r.scenes.reprises).toEqual([]);
      expect(d.scenesSoumises()).toHaveLength(ids.length);
      expect(d.compositionsSoumises()).toHaveLength(1);
      expect(r.controles.verdict).toBe("livrable");
      expect(r.coutCentimes).toBeGreaterThan(0);
      expect(r.estimation.caracteres).toBe(fiche.scenes.map((s) => s.texteDit).join(" ").length);

      // Scènes : composition TableauScene, sans mode, file longue, clé par empreinte.
      for (const s of d.scenesSoumises()) {
        expect(s.file).toBe("longue");
        expect((s.parametres as { composition: string }).composition).toBe(COMPOSITION_SCENE);
        expect(s.sortie.cle).toMatch(new RegExp(`^studio/dev/scenes/${fiche.videoId}/[0-9a-f]{32}\\.mp4$`));
      }
      expect(Object.values(r.cles.scenes).sort()).toEqual(d.scenesSoumises().map((s) => s.sortie.cle).sort());

      // Composition complète : scènes bout à bout comme plans, page de la charte, voix, sous-titres dans la bande.
      const p = d.compositionsSoumises()[0].parametres as unknown as Extract<ParametresDemandeComposition, { mode: "complet" }>;
      expect(p.ratio).toBe("9:16");
      expect(p.image.plans).toHaveLength(ids.length);
      expect(p.image.plans.every((pl) => pl.type === "illustration" && pl.illustration?.video)).toBe(true);
      expect(p.image.plans[0].debutSec).toBe(0);
      expect(p.image.plans.at(-1)!.finSec).toBeCloseTo(p.dureeSec, 3);
      for (let i = 1; i < p.image.plans.length; i++) expect(p.image.plans[i].debutSec).toBeCloseTo(p.image.plans[i - 1].finSec, 3);
      expect(p.image.decor).toMatchObject({ teinte: COULEURS_VIDEO.page });
      expect(p.image.decor.image).toBeUndefined();
      expect(p.image.doubles.principal.type).toBe("video");
      expect(p.son.lufs).toBe(-14);
      expect(p.son.entreeVoix).toBe("voix");
      expect(d.compositionsSoumises()[0].entrees.voix).toContain(r.cles.voix);
      expect(p.texte.sousTitres?.segments.length).toBeGreaterThan(0);
      expect(p.couleurs).toMatchObject({ luts: [], grainPct: 0, vignettePct: 0 });
      expect(r.cles.video).toBe(d.compositionsSoumises()[0].sortie.cle);
      expect(r.dureeSec).toBeCloseTo(p.dureeSec, 3);
    });
  }

  it("sans phrase de fin : aucune scène de fin", async () => {
    const d = doubles(ficheDemonstration);
    const r = await fabriquerTableau(d.outils);
    expect(r.scenes.rendues).toEqual(ficheDemonstration.scenes.map((s) => s.id));
    const p = d.compositionsSoumises()[0].parametres as unknown as Extract<ParametresDemandeComposition, { mode: "complet" }>;
    expect(p.image.plans).toHaveLength(ficheDemonstration.scenes.length);
  });

  it("la fin affiche la phrase donnée, rien n'est écrit en dur", async () => {
    const phrase = "Une phrase de fin donnée";
    const d = doubles(ficheDemonstration, { fin: phrase });
    await fabriquerTableau(d.outils);
    const fin = d.scenesSoumises().find((s) => JSON.stringify(s.parametres).includes(`"id":"${ID_SCENE_FIN}"`));
    const proprietes = (fin?.parametres as { proprietes: { page: { elements: { lignes: { texte: string }[] }[] } } }).proprietes;
    expect(proprietes.page.elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ")).toBe(phrase);
  });
});

describe("arrêts avant toute dépense", () => {
  it("fiche invalide : arrêt à l'étape « fiche » avec ses raisons, avant la voix, 0 appel", async () => {
    const f = copie(ficheDemonstration);
    f.scenes[0].texteDit = `${f.scenes[0].texteDit} et encore des mots en plus`;
    const d = doubles(f);
    d.outils.contexte = { ...d.outils.contexte, texteScript: ficheDemonstration.scenes.map((s) => s.texteDit).join(" ") };
    const e = await erreurDe(fabriquerTableau(d.outils));
    expect(e.etape).toBe("fiche");
    expect(e.raisons.length).toBeGreaterThan(0);
    expect(d.lectures()).toBe(0);
    expect(d.soumises).toHaveLength(0);
  });

  it("budget refusé : arrêt à l'étape « voix », 0 appel à la voix ni au rendu", async () => {
    const d = doubles(ficheDemonstration, { budgetRefuse: true, fin: FIN });
    const e = await erreurDe(fabriquerTableau(d.outils));
    expect(e.etape).toBe("voix");
    expect(e.message).toContain("budget");
    expect(d.lectures()).toBe(0);
    expect(d.soumises).toHaveLength(0);
  });

  it("déjà-vu non coché : arrêt à l'étape « script », 0 appel", async () => {
    const d = doubles(ficheDemonstration);
    d.outils.dejaVu = undefined;
    const e = await erreurDe(fabriquerTableau(d.outils));
    expect(e.etape).toBe("script");
    expect(d.lectures()).toBe(0);
    expect(d.soumises).toHaveLength(0);
  });
});

describe("reprise", () => {
  const etapesPayantes: EtapeFabrication[] = ["fiche", "script", "voix", "calage", "mise-en-page", "fin", "scenes", "composition"];
  for (const panne of etapesPayantes) {
    it(`panne après l'étape « ${panne} » : la relance reprend les étapes déjà faites sans les refaire`, async () => {
      const d1 = doubles(ficheDemonstration, { fin: FIN });
      d1.pannes.journalApres = panne;
      const e = await erreurDe(fabriquerTableau(d1.outils));
      expect(e.etape).toBe(panne);

      const d2 = doubles(ficheDemonstration, { fin: FIN, partage: d1 });
      const r = await fabriquerTableau(d2.outils);
      const rang = ETAPES_FABRICATION.indexOf(panne);
      for (const x of r.etapes) {
        const i = ETAPES_FABRICATION.indexOf(x.etape);
        if (i < rang) expect(x.statut, x.etape).toBe("reprise");
      }
      // La voix n'est jamais relue ni repayée ; chaque scène n'est rendue qu'une fois en tout.
      expect(d1.lectures() + d2.lectures()).toBe(1);
      // Une voix payée au premier lancement n'est pas comptée de nouveau.
      if (rang >= ETAPES_FABRICATION.indexOf("voix")) expect(r.coutCentimes).toBe(0);
      expect(d1.scenesSoumises().length + d2.scenesSoumises().length).toBe(ficheDemonstration.scenes.length + 1);
      expect(d1.compositionsSoumises().length + d2.compositionsSoumises().length).toBe(1);
      expect(r.controles.verdict).toBe("livrable");
    });
  }

  it("panne du rendu pendant la composition : les scènes rendues ne sont pas refaites", async () => {
    const d1 = doubles(ficheDemonstration, { fin: FIN });
    d1.pannes.renduOperation = "composition-complet";
    const e = await erreurDe(fabriquerTableau(d1.outils));
    expect(e.etape).toBe("composition");
    const d2 = doubles(ficheDemonstration, { fin: FIN, partage: d1 });
    const r = await fabriquerTableau(d2.outils);
    expect(d2.lectures()).toBe(0);
    expect(d2.scenesSoumises()).toHaveLength(0);
    expect(d2.compositionsSoumises()).toHaveLength(1);
    expect(r.etapes.find((x) => x.etape === "scenes")?.statut).toBe("reprise");
  });

  it("2e lancement identique : 0 voix, 0 rendu", async () => {
    const d1 = doubles(ficheDemonstration, { fin: FIN });
    const r1 = await fabriquerTableau(d1.outils);
    const d2 = doubles(ficheDemonstration, { fin: FIN, partage: d1 });
    const r2 = await fabriquerTableau(d2.outils);
    expect(d2.lectures()).toBe(0);
    expect(d2.soumises).toHaveLength(0);
    expect(r2.coutCentimes).toBe(0);
    expect(r2.scenes.rendues).toEqual([]);
    expect(r2.cles).toEqual(r1.cles);
    expect(r2.etapes.filter((x) => x.etape !== "controles").every((x) => x.statut === "reprise")).toBe(true);
  });

  it("2e lancement sans journal (perdu) : les scènes déjà déposées ne sont pas rendues de nouveau", async () => {
    const d1 = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(d1.outils);
    const d2 = doubles(ficheDemonstration, { fin: FIN, partage: { fichiers: d1.fichiers, journal: { valeur: null } } });
    const r = await fabriquerTableau(d2.outils);
    expect(d2.scenesSoumises()).toHaveLength(0);
    expect(r.scenes.rendues).toEqual([]);
    expect(r.scenes.reprises).toHaveLength(ficheDemonstration.scenes.length + 1);
  });

  it("une scène modifiée (la fin) : 1 rendu de scène + 1 composition, rien d'autre", async () => {
    const d1 = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(d1.outils);
    const d2 = doubles(ficheDemonstration, { fin: "Envoyez-la à un collègue", partage: d1 });
    const r = await fabriquerTableau(d2.outils);
    expect(d2.lectures()).toBe(0);
    expect(d2.scenesSoumises()).toHaveLength(1);
    expect(r.scenes.rendues).toEqual([ID_SCENE_FIN]);
    expect(d2.compositionsSoumises()).toHaveLength(1);
  });

  it("une ligne modifiée dans la dernière scène : seules les scènes de sa page sont rendues, + 1 composition", async () => {
    const d1 = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(d1.outils);
    const f = copie(ficheDemonstration);
    const derniere = f.scenes.at(-1)!;
    const ligne = derniere.elements.find((e) => e.type === "ligne");
    if (!ligne || ligne.type !== "ligne") throw new Error("ligne absente");
    ligne.texte = `${ligne.texte} !`;
    const d2 = doubles(f, { fin: FIN, partage: d1 });
    const r = await fabriquerTableau(d2.outils);
    expect(d2.lectures()).toBe(0);
    const memePage = f.scenes.filter((s) => s.page === derniere.page).map((s) => s.id);
    expect(r.scenes.rendues).toEqual(memePage);
    expect(d2.compositionsSoumises()).toHaveLength(1);
  });
});
