/**
 * L7 · Plan des composants (pur) sur la galerie de l'image C : données conformes à la carte figée, caméra dans ses
 * bornes, aucun texte sous le plancher, nœuds absents avant leur mot, embranchement qui compte jusqu'à 80/20, branche
 * active et retour au point de décision, scène « Ensemble » de 1,5 s au plus sans texte à lire.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import { BORNES_CAMERA, controlerEnsemble, controlerLisibiliteToile, mesurerTrajectoire } from "@/briques/schema-motion";
import { INSTANTS_GALERIE_C, sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { brancheActive, calculerScene, cheminFleche, enteteA, ensembleA, etatFleche, etatNoeud, noeudCourant, partsEmbranchement } from "../../studio-rendu/compositions/image-video/plan";

const carteC: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const p = sceneGalerieC();
const s = calculerScene(p);
const instant = (nom: string) => INSTANTS_GALERIE_C.find((i) => i.nom === nom)!.t;

describe("données de la galerie = carte figée de l'image C", () => {
  it("mêmes nœuds (texte exact), mêmes liens, mêmes groupes ; icônes résolues par la table de L1", () => {
    expect(p.schema.noeuds.map((n) => [n.id, n.libelle, n.detail, n.couleur, n.groupe, n.ordre])).toEqual(carteC.noeuds.map((n) => [n.id, n.libelle, n.detail, n.couleur, n.groupe, n.ordre]));
    for (const n of carteC.noeuds) expect(p.schema.noeuds.find((x) => x.id === n.id)!.icone, n.id).toBe(n.icone ? iconeDe(n.icone) : undefined);
    expect(p.schema.liens.map((l) => [l.id, l.de, l.vers, l.part, l.couleur, l.style, l.etiquette])).toEqual(carteC.liens.map((l) => [l.id, l.de, l.vers, l.part, l.couleur, l.style, l.etiquette]));
    expect(p.schema.groupes).toEqual(carteC.groupes);
  });
  it("mêmes chiffres que la carte, un pour un et dans le même ordre (9, dont « 80 % » deux fois : lien et bandeau)", () => {
    expect(p.schema.chiffres).toHaveLength(carteC.chiffres.length);
    expect(p.schema.chiffres!.map((c) => [c.brut, c.dansNoeud, c.aDire])).toEqual(carteC.chiffres.map((c) => [c.brut, c.dansNoeud, c.aDire]));
  });
  it("chaque nœud est dit au moins une fois, dans l'ordre de la maquette (tronc, branche A, retour, branche B)", () => {
    expect(p.mots.map((m) => m.noeud)).toEqual(["n01", "n02", "n03", "n04", "n05", "n06", "n02", "n07", "n08", "n09", "n10"]);
  });
});

describe("caméra et lisibilité", () => {
  it("aucune alerte, vitesse et zoom dans les bornes, aucun texte sous le plancher à aucun instant", () => {
    expect(s.trajectoire.alertes).toEqual([]);
    const m = mesurerTrajectoire(s.trajectoire);
    expect(m.vitesseMax).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-9);
    expect(m.zoomMin).toBeGreaterThanOrEqual(BORNES_CAMERA.zoomMin);
    expect(m.zoomMax).toBeLessThanOrEqual(BORNES_CAMERA.zoomMax);
    expect(controlerLisibiliteToile(s.toile, s.trajectoire)).toEqual([]);
  });
});

describe("nœuds, flèches, embranchement", () => {
  it("un nœud est absent avant son mot, actif quand on le dit, grisé ensuite", () => {
    expect(etatNoeud(s, "n03", 6).etat).toBe("absent");
    expect(etatNoeud(s, "n03", 7).etat).toBe("actif");
    expect(etatNoeud(s, "n03", 8.5).etat).toBe("vu");
    expect(etatNoeud(s, "n02", instant("4-retour")).etat).toBe("actif");
  });
  it("une flèche se dessine avant son nœud d'arrivée, la pointe en dernier", () => {
    const l03 = s.toile.fleches.find((f) => f.id === "l03")!;
    expect(etatFleche(s, l03, 7.1).trace).toBe(0);
    const pendant = etatFleche(s, l03, 7.5);
    expect(pendant.trace).toBeGreaterThan(0);
    expect(pendant.trace).toBeLessThan(1);
    expect(pendant.pointe).toBeLessThan(pendant.trace);
    expect(etatFleche(s, l03, 7.8)).toMatchObject({ trace: 1, pointe: 1 });
  });
  it("à la séparation, les deux flèches partent ensemble et les parts comptent jusqu'à 80 et 20", () => {
    const ts = p.separations![0].t;
    for (const id of ["l02", "l06"]) expect(etatFleche(s, s.toile.fleches.find((f) => f.id === id)!, ts + 0.25).trace).toBeGreaterThan(0);
    expect(partsEmbranchement(s, "n02", ts - 0.01)).toEqual([]);
    const pendant = partsEmbranchement(s, "n02", ts + 0.8).map((x) => x.valeur);
    expect(pendant[0]).toBeGreaterThan(0);
    expect(pendant[0]).toBeLessThan(80);
    const fin = partsEmbranchement(s, "n02", instant("2-separation"));
    expect(fin.map((x) => [x.branche, x.valeur, x.couleur, x.cote])).toEqual([
      ["g-branche-a", 80, "orange", "gauche"],
      ["g-branche-b", 20, "noir", "droite"],
    ]);
    expect(fin.every((x) => x.allumee)).toBe(true);
  });
  it("branche A allumée pendant qu'on la parcourt, B pendant le retour et après", () => {
    expect(brancheActive(s, instant("3-branche-a"))).toBe("g-branche-a");
    expect(noeudCourant(s, instant("4-retour"))).toBe("n02");
    expect(brancheActive(s, instant("4-retour"))).toBe("g-branche-b");
    expect(partsEmbranchement(s, "n02", instant("4-retour")).map((x) => x.allumee)).toEqual([false, true]);
    expect(brancheActive(s, instant("5-branche-b"))).toBe("g-branche-b");
    expect(etatFleche(s, s.toile.fleches.find((f) => f.id === "l03")!, instant("5-branche-b")).opacite).toBeLessThan(1);
  });
  it("une flèche de retour (vers le haut) passe par le flanc, jamais à travers les cartes", () => {
    const [a, b] = [s.parId.get("n06")!, s.parId.get("n02")!];
    const ch = cheminFleche(a, b);
    expect(ch.milieu[0]).toBeGreaterThan(Math.max(a.x + a.largeur, b.x + b.largeur));
  });
});

describe("en-têtes et scène « Ensemble »", () => {
  it("un en-tête à chaque instant, un seul mot orange par titre", () => {
    for (const i of INSTANTS_GALERIE_C) expect(enteteA(p, i.t), i.nom).not.toBeNull();
    for (const e of p.entetes!) expect(e.titre.split("*").length - 1, e.titre).toBe(2);
  });
  it("« Ensemble » dure 1,5 s au plus, sous l'en-tête, sans texte à lire", () => {
    for (const e of p.ensembles!) expect(e.fin - e.debut).toBeLessThanOrEqual(1.5);
    const e = ensembleA(p, s, instant("6-ensemble"))!;
    expect(e.fondu).toBe(1);
    expect(e.disposition.pastilles).toHaveLength(10);
    expect(controlerEnsemble(e.disposition)).toEqual([]);
    for (const x of e.disposition.pastilles) expect(x.cy - x.rayon).toBeGreaterThan(0.245 * 1920);
    expect(e.disposition.chiffresCles.map((c) => c.texte)).toEqual(["80 %", "20 %"]);
    expect(ensembleA(p, s, instant("5-branche-b"))).toBeNull();
  });
  it("déterministe : même scène, même résultat, 20 fois", () => {
    const premier = JSON.stringify(calculerScene(sceneGalerieC()).trajectoire);
    for (let i = 0; i < 20; i++) expect(JSON.stringify(calculerScene(sceneGalerieC()).trajectoire)).toBe(premier);
  });
});

describe("embranchement dont les liens n'ont pas de part (part: null, cas réel des cartes)", () => {
  const p2 = { ...p, schema: { ...p.schema, liens: p.schema.liens.map((l) => ({ ...l, part: null })) } } as unknown as typeof p;
  const s2 = calculerScene(p2);
  it("aucune pastille de part, ni « 0 % » figé : partsEmbranchement rend []", () => {
    const ts = p2.separations![0].t;
    expect(partsEmbranchement(s2, "n02", ts + 2)).toEqual([]);
    expect(partsEmbranchement(s2, "n02", instant("2-separation"))).toEqual([]);
  });
  it("aucune étiquette de toile `part-*` n'est réservée (elles gonfleraient le cadrage pour rien)", () => {
    expect((s2.cadrage.etiquettes ?? []).filter((e) => e.id.startsWith("part-"))).toEqual([]);
  });
  it("avec des parts (80/20), les étiquettes `part-*` existent toujours", () => {
    expect((s.cadrage.etiquettes ?? []).filter((e) => e.id.startsWith("part-")).length).toBe(2);
  });
});
