/**
 * L11 · Mise en scène déterministe : fiche + heures des mots → ligne de temps, et ses contrôles bloquants.
 * Cartes figées A-F et faux schéma à 16 blocs, fiches simulées de L6, heures des mots SIMULÉES à 3,4 mots/s, plan des
 * fins de L14, sons de la banque (L4). Aucun appel, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { disposerToile, type ProprietesSceneIV } from "@/briques/schema-motion";
import type { CarteImage } from "@/domaine/image-video/carte";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { ECART_MIN_SEC, type BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { calerFiche, ErreurCalageIV, heuresSimulees, pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { compteRythme, controlerCamera, controlerChiffresMontres, controlerRythme, instantsVisibles } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV, type FinIV } from "@/moteurs/montage-image-video/fins";
import { CADRAGE_TOILE_IV, cadrageToile, mettreEnSceneIV, REGLES_SCENE_IV, type BlocRenduIV, type EntreeMiseEnSceneIV, type EvenementTempsIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { bandeSousTitres, controlerSousTitresIV, LIMITES_BAS_SOUS_TITRES_IV } from "@/moteurs/montage-image-video/sous-titres";
import { REGLES_SCENE_IV as REGLES_SOURCE } from "@/moteurs/montage-image-video/regles-scene";
import { BANDE_SOUS_TITRES_IV, ZONE_UTILE_IV } from "@/briques/schema-motion/types";
import { BANDE_SOUS_TITRES_IV as BANDE_COMPOSITIONS, ZONE_UTILE_IV as ZONE_UTILE_COMPOSITIONS } from "../../studio-rendu/compositions/image-video/mise-en-page";
import type { MomentGalerie } from "../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import { BAS_ENTETE, cadrageDeToile, calculerScene, COUDE_MAX, ECART_PART, HAUT_CADRE, PASTILLE_PART, RAYON_PASTILLE, TEMPS_IV, ZOOM_PREFERE_IV } from "../../studio-rendu/compositions/image-video/plan";
import { instantsAdditionneur, instantsNuee, instantsRecherche, planAdditionneur, planFrappeMots, planNuee, type ObjetSceneIV } from "../../studio-rendu/compositions/image-video/plan-objets";
import { empriseObjet } from "../../studio-rendu/compositions/image-video/emprise";
import { controlerMiseEnPage, PLANCHER_PX_IV } from "../../studio-rendu/compositions/image-video/mise-en-page";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f", "faux-16-noeuds": "essai-faux16" } as const;
type Image = keyof typeof IMAGES;
const NOMS = Object.keys(IMAGES) as Image[];

function finsDe(nom: Image): FinIV[] {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  return planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
}

function entreeDe(nom: Image, reseau: ReseauIV = "youtube-shorts", fiche: FicheImage = FICHES_SIMULEES[IMAGES[nom]]): EntreeMiseEnSceneIV {
  const fin = finsDe(nom).find((f) => f.reseaux.includes(reseau))!;
  const voix = pisteSimulee(fiche, fin.muet ? null : fin);
  return { carte: carteDe(nom), fiche, voix, fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}

const resultats = new Map(NOMS.flatMap((nom) => RESEAUX_IV.map((r) => [`${nom}|${r}`, mettreEnSceneIV(entreeDe(nom, r))] as const)));
const ligneDe = (nom: Image, r: (typeof RESEAUX_IV)[number] = "youtube-shorts"): LigneDeTempsIV => resultats.get(`${nom}|${r}`)!.ligne;
const toiles = (l: LigneDeTempsIV) => l.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile");
/** Heure (sur la voix) du k-ième mot de l'écran `id` de la fiche. */
function heureDuMot(nom: Image, id: string, k: number, r: ReseauIV = "youtube-shorts"): number {
  const e = entreeDe(nom, r);
  const cale = calerFiche(e.fiche, e.voix, e.fin && !e.fin.muet ? e.fin : null);
  return cale.ecrans.find((x) => x.id === id)!.mots[k].debutSec;
}

describe("les 6 images (et le faux schéma à 16 blocs), heures simulées à 3,4 mots/s : toutes les règles passent", () => {
  for (const nom of NOMS) {
    it(`${nom} : les 5 versions réseau passent tous les contrôles bloquants`, () => {
      for (const r of RESEAUX_IV) {
        const res = resultats.get(`${nom}|${r}`)!;
        expect(res.phrases, `${nom} ${r}`).toEqual([]);
        expect(res.ok).toBe(true);
        const codes = res.rapport.lignes.filter((l) => l.bloquant).map((l) => l.code);
        for (const c of ["Q12", "Q13", "Q14", "Q15", "Q19", "Q20", "Q21", "Q22", "Q23", "Q25", "FOND", "ORANGE", "FIN"]) expect(codes).toContain(c);
      }
    });
  }

  it("déterministe : mêmes entrées, même ligne de temps (au caractère près)", () => {
    for (const nom of NOMS) expect(JSON.stringify(mettreEnSceneIV(entreeDe(nom, "instagram")).ligne)).toBe(JSON.stringify(ligneDe(nom, "instagram")));
  });

  it("rythme : un changement visible toutes les 2,4 s au plus ; aucun plan de plus de 5 s ni deux de suite de plus de 4 s", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      const ts = [0, ...instantsVisibles(l.evenements, l.finVoixSec), l.finVoixSec];
      for (let k = 1; k < ts.length; k++) expect(ts[k] - ts[k - 1], `${nom} vers ${ts[k]}`).toBeLessThanOrEqual(2.4 + 1e-6);
      const plans = l.plans.map((p) => Math.min(p.fin, l.finVoixSec) - p.debut);
      for (let k = 0; k < plans.length; k++) {
        expect(plans[k], `${nom} ${l.plans[k].id}`).toBeLessThanOrEqual(5 + 1e-6);
        if (k > 0) expect(plans[k] > 4 && plans[k - 1] > 4, `${nom} ${l.plans[k].id}`).toBe(false);
      }
    }
  });

  it("la voix finit au moins 1,5 s avant la fin de la vidéo ; plans contigus de 0 à la fin, marque sur chacun", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      expect(l.dureeSec - l.finVoixSec).toBeGreaterThanOrEqual(1.5);
      expect(l.plans[0].debut).toBe(0);
      expect(l.plans.at(-1)!.fin).toBe(l.dureeSec);
      for (let k = 1; k < l.plans.length; k++) expect(l.plans[k].debut).toBeCloseTo(l.plans[k - 1].fin, 6);
      for (const p of l.plans) expect(p.marque).toBe("axion-ia.com");
    }
  });
});

describe("chaque élément apparaît AU MOT qui le nomme", () => {
  it("C : « Ticket clôturé auto » surgit sur « ticket », se coche sur « ferme » ; la décision est posée avant la séparation, sur « deux » (chemins)", () => {
    const l = ligneDe("C");
    const noeud = l.evenements.find((e) => e.genre === "noeud" && e.ref === "n05")!;
    expect(noeud.instantSec).toBeCloseTo(heureDuMot("C", "e09", 2) - REGLES_SCENE_IV.avance, 3);
    // Depuis #224, l'icône est un ticket : la coche vient du libellé, qui le dit fait (« clôturé »).
    const coche = l.evenements.find((e) => e.genre === "coche" && e.ref === "n05")!;
    expect(coche.instantSec).toBeCloseTo(heureDuMot("C", "e09", 4) - REGLES_SCENE_IV.avance + 0.1, 3);
    const sep = l.evenements.find((e) => e.genre === "separation")!;
    expect(sep.instantSec).toBeCloseTo(heureDuMot("C", "e06", 7), 3);
    expect(l.evenements.find((e) => e.genre === "noeud" && e.ref === "n02")!.instantSec).toBeLessThan(sep.instantSec);
  });

  it("D : les vingt e-mails tombent un à un dans l'entonnoir, la nuée coche les seize", () => {
    const l = ligneDe("D");
    expect(l.evenements.filter((e) => e.genre === "chute")).toHaveLength(20);
    expect(l.evenements.filter((e) => e.genre === "coche")).toHaveLength(16);
    const objets = l.blocs.flatMap((b) => (b.sorte === "objets" ? b.objets : []));
    const nuee = objets.find((o) => o.sorte === "nuee");
    expect(nuee?.sorte === "nuee" && nuee.proprietes).toMatchObject({ quantite: 20, cochees: 16 });
  });

  it("E : chaque source surgit sur son nom (e-mail, scan, Drive, WhatsApp, clé USB)", () => {
    const l = ligneDe("E");
    const sources = l.evenements.filter((e) => (e.ecran === "e02" || e.ecran === "e03") && /^n0[1-5]$/.test(e.ref ?? "") && e.genre === "objet");
    expect(sources.map((e) => e.ref)).toEqual(["n01", "n02", "n03", "n04", "n05"]);
    expect(sources[0].instantSec).toBeCloseTo(heureDuMot("E", "e02", 4) - REGLES_SCENE_IV.avance, 3);
  });

  it("chaque chiffre dit apparaît à l'écran entre −0,3 s et +0,6 s autour de son mot (6 images)", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      if (carteDe(nom).chiffres.length) expect(l.chiffresDits.length, nom).toBeGreaterThan(0);
      expect(controlerChiffresMontres(l).ok, nom).toBe(true);
    }
  });

  it("un chiffre dit mais pas montré est refusé (C : « quatre secondes » sans rien qui l'affiche)", () => {
    const fiche = structuredClone(FICHES_SIMULEES["essai-c"]);
    const e08 = fiche.ecrans.find((e) => e.id === "e08")!;
    e08.refs = ["n03"];
    e08.textesEcran = ["Envoyée *vite*"];
    const res = mettreEnSceneIV(entreeDe("C", "youtube-shorts", fiche));
    expect(res.ok).toBe(false);
    // Rien d'autre que les textes de comblement ne pourrait l'afficher : sans eux, Q13 refuse.
    const l = res.ligne;
    const q13 = controlerChiffresMontres({ ...l, evenements: l.evenements.filter((e) => !e.remplissage) });
    expect(q13.ok).toBe(false);
    expect(q13.details.join(" ")).toMatch(/4 secondes.*n'apparaît pas/);
  });
});

describe("rythme : la caméra ne compte pas", () => {
  /** Une ligne de temps régulière (un nœud toutes les 2 s) avec un trou de 2,6 s à partir de 20 s. */
  const rythmeAvecTrou = (dans: EvenementTempsIV[] = []) => {
    const l = ligneDe("C");
    const reguliers = Array.from({ length: Math.floor(l.finVoixSec / 2) + 1 }, (_, k) => k * 2).filter((t) => t < 20 || t > 22.6);
    const evenements: EvenementTempsIV[] = [
      ...reguliers.map((t) => ({ id: `n-${t}`, genre: "noeud" as const, instantSec: t, visible: true, plan: "p01", chiffres: [] })),
      { id: "repere-a", genre: "objet" as const, instantSec: 20, visible: true, plan: "p01", chiffres: [] },
      { id: "repere-b", genre: "objet" as const, instantSec: 22.6, visible: true, plan: "p01", chiffres: [] },
      ...dans,
    ];
    return controlerRythme({ evenements, plans: [], finVoixSec: l.finVoixSec })[0];
  };

  it("un trou de 2,6 s sans changement visible est refusé, même s'il contient un panoramique", () => {
    const refus = rythmeAvecTrou([{ id: "panoramique", genre: "camera", instantSec: 21.3, marque: true, visible: false, plan: "p01", chiffres: [] }]);
    expect(refus.ok).toBe(false);
    expect(refus.phrase).toMatch(/2,6 s/);
    expect(refus.phrase).toMatch(/caméra ne compte pas/);
    // Le même trou coupé par une vraie apparition passe.
    expect(rythmeAvecTrou([{ id: "apparition", genre: "noeud", instantSec: 21.3, visible: true, plan: "p01", chiffres: [] }]).ok).toBe(true);
    expect(rythmeAvecTrou([{ id: "fond", genre: "fond", instantSec: 21.3, visible: true, plan: "p01", chiffres: [] }]).ok).toBe(true);
  });

  it("un simple changement d'en-tête ou un texte de comblement ne satisfait PAS le rythme, même classé « objet » ou « chiffre »", () => {
    const entete: EvenementTempsIV = { id: "entete", genre: "objet", instantSec: 21.3, visible: true, plan: "p01", texte: "Le tri|Vos e-mails rangés", chiffres: [], remplissage: true };
    const texteChiffre: EvenementTempsIV = { id: "ligne", genre: "chiffre", instantSec: 21.3, visible: true, plan: "p01", texte: "En *4* secondes", chiffres: ["4|seconde"], remplissage: true };
    expect(rythmeAvecTrou([entete]).ok).toBe(false);
    expect(rythmeAvecTrou([texteChiffre]).ok).toBe(false);
    expect(compteRythme(entete)).toBe(false);
    // Dans les lignes de temps produites : tout en-tête et tout texte de comblement porte la marque et n'est pas compté.
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      const entetes = l.evenements.filter((e) => e.texte?.includes("|"));
      for (const e of entetes) expect(e.remplissage, `${nom} ${e.id}`).toBe(true);
    }
    expect(NOMS.some((nom) => ligneDe(nom).evenements.some((e) => e.texte?.includes("|")))).toBe(true);
  });

  it("un trou d'un écran v4 est relancé par une VRAIE bascule de fond (le texte de comblement ne suffit pas)", () => {
    const l = ligneDe("D");
    const bascules = l.evenements.filter((e) => e.genre === "fond" && l.plans.some((p) => p.coupe === "sous-plan" && Math.abs(p.debut - e.instantSec) < 1e-6));
    expect(bascules.length).toBeGreaterThan(0);
    for (const e of bascules) {
      const k = l.plans.findIndex((p) => Math.abs(p.debut - e.instantSec) < 1e-6);
      expect(l.plans[k].fond).not.toBe(l.plans[k - 1].fond);
      expect(l.plans[k].ecran).toBe(l.plans[k - 1].ecran);
    }
    // Le bloc rendu suit le fond du plan.
    for (const b of l.blocs) if (b.sorte === "ecran") {
      const p = l.plans.find((x) => Math.abs(x.debut - b.debut) < 1e-6 && x.ecran && b.ecran.id.startsWith(x.ecran))!;
      if (p) expect(b.ecran.fond).toBe(p.fond);
    }
  });

  it("les mouvements de caméra sont posés dans la ligne de temps mais exclus du compte", () => {
    const l = ligneDe("C");
    const cameras = l.evenements.filter((e) => e.genre === "camera");
    expect(cameras.length).toBeGreaterThan(0);
    expect(cameras.every((e) => !e.visible)).toBe(true);
    const sansCamera = l.evenements.filter((e) => e.genre !== "camera");
    expect(instantsVisibles(l.evenements, l.finVoixSec)).toEqual(instantsVisibles(sansCamera, l.finVoixSec));
  });
});

describe("rythme : les micro-animations des composants sont de vrais événements (D, E, F)", () => {
  const objetsDe = (l: LigneDeTempsIV) => l.blocs.flatMap((b) => (b.sorte === "objets" ? b.objets.map((o) => ({ b, o })) : []));
  const momentsDe = (l: LigneDeTempsIV) => l.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments.map((m) => ({ b, m })) : []));
  const compte = (l: LigneDeTempsIV, t: number) => l.evenements.some((e) => compteRythme(e) && Math.abs(e.instantSec - t) < 2e-3);

  it("D · nuée : chaque coche et chaque enveloppe « pour vous » qui se distingue est un événement compté, aux instants du plan pur", () => {
    for (const r of RESEAUX_IV) {
      const l = ligneDe("D", r);
      const nuees = objetsDe(l).filter(({ o }) => o.sorte === "nuee");
      expect(nuees.length).toBeGreaterThan(0);
      for (const { b, o } of nuees) {
        if (o.sorte !== "nuee") continue;
        expect(o.proprietes.distinctions, r).toHaveLength(o.proprietes.quantite - o.proprietes.cochees);
        const instants = instantsNuee(o.proprietes);
        expect(instants).toHaveLength(o.proprietes.quantite);
        for (const t of instants) expect(compte(l, b.debut + t), `${r} nuée à ${b.debut + t}`).toBe(true);
        // Échelonnées, une par une, et le plan les montre bien (contour orange) sur les objets hors du groupe.
        const d = o.proprietes.distinctions!;
        for (let k = 1; k < d.length; k++) expect(d[k] - d[k - 1]).toBeGreaterThanOrEqual(0.4);
        const fin = planNuee(o.proprietes, o.fin);
        expect(fin.objets.filter((x) => !x.dansGroupe).every((x) => x.distinction === 1)).toBe(true);
        expect(planNuee(o.proprietes, d[0] - 0.01).objets.every((x) => x.distinction === 0)).toBe(true);
      }
    }
  });

  it("E · recherche : la requête se tape mot par mot (chaque mot compté), puis « Trouvé »", () => {
    for (const r of RESEAUX_IV) {
      const l = ligneDe("E", r);
      const recherches = momentsDe(l).filter(({ m }) => m.sorte === "recherche");
      expect(recherches.length).toBeGreaterThan(0);
      for (const { b, m } of recherches) {
        if (m.sorte !== "recherche") continue;
        expect(m.mots, r).toHaveLength(m.requete.split(/\s+/).length);
        for (const t of instantsRecherche({ requete: m.requete, debut: m.frappe, mots: m.mots, trouve: m.trouve })) expect(compte(l, b.debut + t), `${r} recherche à ${b.debut + t}`).toBe(true);
        // Le plan pur tape chaque mot à son heure : rien avant le premier, la requête entière à la fin.
        expect(planFrappeMots(m.requete, m.mots![0] - 0.01, m.mots!).texte).toBe("");
        expect(planFrappeMots(m.requete, m.mots![1] + 0.01, m.mots!).texte.split(" ")).toHaveLength(2);
        expect(planFrappeMots(m.requete, m.mots!.at(-1)! + 2, m.mots!)).toMatchObject({ texte: m.requete, fini: true });
      }
    }
  });

  it("F · additionneur : minuteurs, total, puis le détail lu sur la carte (« risque erreur », « élevé ») sont comptés et tiennent dans la zone utile", () => {
    for (const r of RESEAUX_IV) {
      const l = ligneDe("F", r);
      const adds = objetsDe(l).filter(({ o }) => o.sorte === "additionneur");
      expect(adds.length).toBeGreaterThan(0);
      for (const { b, o } of adds) {
        if (o.sorte !== "additionneur") continue;
        expect(o.proprietes.detail, r).toMatchObject({ libelle: "risque erreur", valeur: "élevé" });
        for (const t of instantsAdditionneur(o.proprietes)) expect(compte(l, b.debut + t), `${r} additionneur à ${b.debut + t}`).toBe(true);
        const fin = o.fin - 0.01;
        const plan = planAdditionneur(o.proprietes, fin);
        expect(plan.detail!.entree).toBe(1);
        expect(plan.detail!.entreeValeur).toBe(1);
        expect(controlerMiseEnPage(empriseObjet(o as ObjetSceneIV, fin))).toEqual([]);
        for (const x of Object.values(plan.tailles)) expect(x).toBeGreaterThanOrEqual(PLANCHER_PX_IV - 1e-9);
        expect(plan.detail!.taille).toBeGreaterThanOrEqual(PLANCHER_PX_IV - 1e-9);
      }
    }
  });

  it("aucun trou de plus de 2,4 s sur les 6 cartes × 5 réseaux, sans compter caméra, en-têtes ni textes de comblement", () => {
    for (const nom of ["A", "B", "C", "D", "E", "F"] as const) {
      for (const r of RESEAUX_IV) {
        const l = ligneDe(nom, r);
        const ts = [0, ...instantsVisibles(l.evenements, l.finVoixSec).filter((t) => t > 0), l.finVoixSec];
        for (let k = 1; k < ts.length; k++) expect(ts[k] - ts[k - 1], `${nom} ${r} vers ${ts[k]}`).toBeLessThanOrEqual(REGLES_SCENE_IV.ecartMax + 1e-6);
        const q = resultats.get(`${nom}|${r}`)!.rapport.lignes.filter((x) => x.code === "Q14" || x.code === "Q22");
        for (const x of q.filter((x) => x.bloquant)) expect(x.ok, `${nom} ${r} ${x.code} ${x.phrase}`).toBe(true);
      }
    }
  });
});

describe("caméra et lisibilité (Q15)", () => {
  const schemaC = () => toiles(ligneDe("C"))[0].proprietes.schema;

  it("un texte lisible à zoom 0,8 sous le plancher effectif est refusé", () => {
    const toile = disposerToile(schemaC());
    const b = toile.boites[0];
    const pose = { cx: b.x + b.largeur / 2, cy: b.y + b.hauteur / 2, zoom: 0.8 };
    const trajectoire = { images: [{ t: 0, ...pose }, { t: 2, ...pose }], alertes: [] };
    // À la taille de la charte, la pose passe ; à 0,035 × 0,8 = 0,028 (< 0,03), elle est refusée.
    expect(controlerCamera({ id: "essai", toile, trajectoire, mots: [] }).q15.filter((x) => /trop petit/.test(x))).toEqual([]);
    b.textes = b.textes.map((x) => ({ ...x, taille: 0.035 }));
    expect(controlerCamera({ id: "essai", toile, trajectoire, mots: [] }).q15.some((x) => /trop petit/.test(x))).toBe(true);
  });

  it("chaque séquence de toile, rendue par le plan de L7 (`calculerScene`), garde la caméra dans ses bornes et chaque bloc entier", () => {
    for (const nom of NOMS) {
      for (const b of toiles(ligneDe(nom))) {
        const s = calculerScene(b.proprietes);
        const r = controlerCamera({ id: b.id, toile: s.toile, trajectoire: s.trajectoire, mots: s.mots, cadrage: s.cadrage });
        expect(r.q15, `${nom} ${b.id}`).toEqual([]);
        expect(r.coupes, `${nom} ${b.id}`).toEqual([]);
      }
    }
  });

  it("le cadrage recopié de L7 suit ses réglages (zoom, en-tête, décors, avance)", () => {
    expect(CADRAGE_TOILE_IV.zoomPrefere).toBe(ZOOM_PREFERE_IV);
    expect(CADRAGE_TOILE_IV.basEntete).toBe(BAS_ENTETE);
    expect(CADRAGE_TOILE_IV.hautCadre).toBeCloseTo(HAUT_CADRE, 9);
    expect(CADRAGE_TOILE_IV.rayonPastille).toBe(RAYON_PASTILLE);
    expect(CADRAGE_TOILE_IV.apparition).toBe(TEMPS_IV.avanceNoeud);
    expect(REGLES_SCENE_IV.avance).toBe(TEMPS_IV.avanceNoeud);
    expect(CADRAGE_TOILE_IV.coudeMax).toBe(COUDE_MAX);
    expect(CADRAGE_TOILE_IV.ecartPart).toBe(ECART_PART);
    expect(CADRAGE_TOILE_IV.dessinFleche).toBe(TEMPS_IV.dessinFleche);
    expect(CADRAGE_TOILE_IV.pastille).toEqual({ padX: PASTILLE_PART.padX, padHaut: PASTILLE_PART.padHaut, padBas: PASTILLE_PART.padBas, signe: PASTILLE_PART.signe });
  });

  it("la caméra contrôlée est exactement celle que rend L7 (disposition, pastilles de part, trajectoire)", () => {
    for (const nom of NOMS) {
      for (const b of toiles(ligneDe(nom))) {
        const s = calculerScene(b.proprietes);
        expect(s.variante, `${nom} ${b.id}`).toBe(calculerScene(b.proprietes).variante);
        expect(cadrageToile(b.proprietes, s.toile).etiquettes).toEqual(cadrageDeToile(s.toile, b.proprietes).etiquettes);
        expect(s.trajectoire, `${nom} ${b.id}`).toEqual(b.trajectoire);
      }
    }
  });

  it("liens sans part (part: null) : serveur et studio ne réservent AUCUNE pastille de part, et s'accordent", () => {
    let vues = 0;
    for (const nom of NOMS) {
      for (const b of toiles(ligneDe(nom))) {
        const sansPart = { ...b.proprietes, schema: { ...b.proprietes.schema, liens: b.proprietes.schema.liens.map((l) => ({ ...l, part: null })) } } as unknown as typeof b.proprietes;
        const s = calculerScene(sansPart);
        const serveur = cadrageToile(sansPart, s.toile).etiquettes ?? [];
        expect(serveur.filter((e) => e.id.startsWith("part-")), `${nom} ${b.id}`).toEqual([]);
        expect(serveur).toEqual(cadrageDeToile(s.toile, sansPart).etiquettes ?? []);
        vues++;
      }
    }
    expect(vues).toBeGreaterThan(0);
  });
});

describe("scène « Ensemble », bénéfices, repère", () => {
  it("C (embranchement) : une vue d'ensemble de 1,5 s au plus après les branches, avec les parts 80 % et 20 %, avant le bandeau", () => {
    const l = ligneDe("C");
    // Les vues d'ensemble de relance du rythme (coupe « relance ») sont à part.
    const ens = l.plans.filter((p) => p.sorte === "ensemble" && p.coupe !== "relance");
    expect(ens).toHaveLength(1);
    for (const p of l.plans.filter((x) => x.coupe === "relance")) expect(p.fin - p.debut).toBeLessThanOrEqual(1.5);
    expect(ens[0].fin - ens[0].debut).toBeLessThanOrEqual(1.5);
    expect(ens[0].textes).toEqual(["80 %", "20 %"]);
    const dernierBranche = l.evenements.filter((e) => e.ref && ["n07", "n08", "n09", "n10"].includes(e.ref)).at(-1)!;
    expect(ens[0].debut).toBeGreaterThan(dernierBranche.instantSec);
    expect(l.plans[l.plans.indexOf(ens[0]) + 1].scene).toBe("bandeau-chiffres");
    expect(toiles(l).some((b) => b.proprietes.ensembles?.some((x) => x.chiffresCles?.join() === "80 %,20 %"))).toBe(true);
  });

  it("très complexe : une vue d'ensemble (1,5 s au plus) ouvre chacun des 3 chapitres ; repère « 1/3 » → « 3/3 »", () => {
    const l = ligneDe("faux-16-noeuds");
    expect(l.repere).toMatchObject({ total: 3 });
    expect(l.repere!.changements.map((c) => c.numero)).toEqual([1, 2, 3]);
    for (const c of l.repere!.changements) {
      const ens = l.plans.find((p) => p.sorte === "ensemble" && Math.abs(p.debut - c.t) < 1e-6);
      expect(ens, `chapitre ${c.numero}`).toBeDefined();
      expect(ens!.fin - ens!.debut).toBeLessThanOrEqual(1.5);
    }
  });

  it("bénéfices : une grande carte à la fois (repère k/5), son micro-objet, puis le récapitulatif", () => {
    for (const nom of ["A", "B"] as const) {
      const l = ligneDe(nom);
      const moments = l.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments : []));
      const cartes = moments.find((m) => m.sorte === "benefices");
      expect(cartes?.sorte, nom).toBe("benefices");
      if (cartes?.sorte !== "benefices") return;
      expect(cartes.benefices).toHaveLength(5);
      expect([...cartes.heures].sort((x, y) => x - y)).toEqual(cartes.heures);
      expect(new Set(cartes.microObjets.map((m) => m.nom)).size).toBe(5);
      expect(l.repere).toMatchObject({ total: 5 });
      expect(l.repere!.changements.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5]);
      const recap = l.plans.findIndex((p) => p.sorte === "recap");
      expect(recap, nom).toBeGreaterThan(0);
      expect(l.plans.slice(recap + 1).some((p) => p.scene === "carte-benefice" && p.sorte !== "recap")).toBe(false);
      expect(l.plans.slice(0, recap).filter((p) => p.coupe === "ecran" && p.scene === "carte-benefice")).toHaveLength(5);
    }
  });
});

describe("fonds, mot orange, sous-titres, bruitages", () => {
  it("fonds sombre et ivoire alternés ; bandeau et phrase-choc sur fond sombre ; un mot orange au plus par plan", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      let changements = 0;
      for (let k = 1; k < l.plans.length; k++) if (l.plans[k].fond !== l.plans[k - 1].fond) changements++;
      expect(changements, nom).toBeGreaterThanOrEqual(3);
      for (const p of l.plans) {
        if (p.scene === "bandeau-chiffres" || p.scene === "phrase-choc") expect(p.fond).toBe("sombre");
        expect(p.textes.join(" ").match(/\*[^*]+\*/g)?.length ?? 0, `${nom} ${p.id}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("sous-titres mot à mot (2 à 4 mots), tous les mots dits, mot fort en orange, dans la bande de la mise en page (#224)", () => {
    for (const r of RESEAUX_IV) expect(ligneDe("C", r).sousTitres.bande).toEqual({ ...BANDE_SOUS_TITRES_IV });
    const l = ligneDe("C", "instagram");
    expect(l.sousTitres.bande.haut).toBeGreaterThanOrEqual(ZONE_UTILE_IV.bas);
    expect(l.sousTitres.groupes.every((g) => g.mots.length >= 1 && g.mots.length <= 4)).toBe(true);
    const corps = motsDits(FICHES_SIMULEES["essai-c"].ecrans.map((e) => e.texteDit).join(" ")).length;
    expect(l.sousTitres.groupes.flatMap((g) => g.mots).filter((m) => m.debutSec < l.segmentFin.debut)).toHaveLength(corps);
    expect(l.sousTitres.groupes.some((g) => g.mots.some((m) => m.orange))).toBe(true);
  });

  it("une seule source : la bande des sous-titres et la zone utile sont celles des compositions (aucune valeur recopiée)", () => {
    expect(BANDE_SOUS_TITRES_IV).toBe(BANDE_COMPOSITIONS);
    expect(ZONE_UTILE_IV).toBe(ZONE_UTILE_COMPOSITIONS);
    expect(bandeSousTitres()).toEqual({ haut: 0.6, bas: 0.67 });
    expect(ZONE_UTILE_IV.bas).toBeCloseTo(0.58, 9);
    expect(REGLES_SCENE_IV.avance).toBe(TEMPS_IV.avanceNoeud);
    expect(REGLES_SCENE_IV).toBe(REGLES_SOURCE);
    const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    const moteur = ["sous-titres.ts", "controles-scene.ts", "mise-en-scene.ts", "regles-scene.ts"].map((f) => lire(`src/moteurs/montage-image-video/${f}`)).join("\n");
    expect(moteur).not.toMatch(/0\.67|0\.58|0\.71|0\.79|0\.69|0\.68|avance: 0\.15|apparition: 0\.15/);
    // Les seuils ne sont écrits qu'une fois (regles-scene.ts) : ni la mise en scène ni les contrôles ne les retapent.
    for (const f of ["controles-scene.ts", "mise-en-scene.ts"]) expect(lire(`src/moteurs/montage-image-video/${f}`)).not.toMatch(/ecartMax: 2\.4|planMax: 5|chiffreApres: 0\.6/);
  });

  it("Q22 (bloquant) : la bande unique est au-dessus de la zone masquée de CHAQUE réseau, sous le contenu ; sinon refusée", () => {
    // Table des limites (registre `src/reseaux`) : Instagram et Facebook 68 %, TikTok 72 %, YouTube Shorts 78 %, LinkedIn 80 %.
    expect(LIMITES_BAS_SOUS_TITRES_IV.instagram).toBeCloseTo(0.68, 9);
    expect(LIMITES_BAS_SOUS_TITRES_IV.facebook).toBeCloseTo(0.68, 9);
    expect(LIMITES_BAS_SOUS_TITRES_IV.tiktok).toBeCloseTo(0.72, 9);
    expect(LIMITES_BAS_SOUS_TITRES_IV["youtube-shorts"]).toBeCloseTo(0.78, 9);
    expect(LIMITES_BAS_SOUS_TITRES_IV.linkedin).toBeCloseTo(0.8, 9);
    for (const r of RESEAUX_IV) {
      expect(BANDE_SOUS_TITRES_IV.bas, r).toBeLessThan(LIMITES_BAS_SOUS_TITRES_IV[r]);
      expect(controlerSousTitresIV({ bande: bandeSousTitres(), taille: 0.036 }, [r]), r).toEqual([]);
    }
    expect(BANDE_SOUS_TITRES_IV.haut).toBeGreaterThan(ZONE_UTILE_IV.bas);
    // L'ancienne bande (#224, 71-79 %) descend dans la zone masquée de Shorts, Instagram, Facebook : refusée.
    const ancienne = controlerSousTitresIV({ bande: { haut: 0.71, bas: 0.79 }, taille: 0.036 }).join(" ");
    expect(ancienne).toMatch(/zone masquée de youtube-shorts, instagram, facebook/);
    expect(controlerSousTitresIV({ bande: { haut: 0.71, bas: 0.79 }, taille: 0.036 }, ["linkedin"]).join(" ")).not.toMatch(/zone masquée/);
    expect(controlerSousTitresIV({ bande: { haut: 0.55, bas: 0.62 }, taille: 0.036 }).join(" ")).toMatch(/contenu/);
    expect(controlerSousTitresIV({ bande: { haut: 0.76, bas: 0.81 }, taille: 0.036 }).join(" ")).toMatch(/20 % du bas/);
    expect(controlerSousTitresIV({ bande: bandeSousTitres(), taille: 0.02 }).join(" ")).toMatch(/trop petit/);
    for (const r of RESEAUX_IV) {
      const q22 = resultats.get(`C|${r}`)!.rapport.lignes.filter((x) => x.code === "Q22");
      expect(q22).toHaveLength(1);
      expect(q22[0].bloquant).toBe(true);
      expect(q22[0].ok, r).toBe(true);
    }
  });

  it("bruitages posés par L4 sur les changements visibles, jamais deux à moins de 0,1 s, aucune musique", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom);
      expect(l.bruitages.length).toBeGreaterThan(10);
      for (let k = 1; k < l.bruitages.length; k++) expect(l.bruitages[k].debutSec - l.bruitages[k - 1].debutSec).toBeGreaterThanOrEqual(ECART_MIN_SEC - 1e-9);
      expect(JSON.stringify(l)).not.toMatch(/musique/i);
    }
  });

  it("aucun son validé : refus explicite (Q20), jamais une vidéo muette", () => {
    const res = mettreEnSceneIV({ ...entreeDe("D"), bruitagesValides: [] });
    expect(res.ok).toBe(false);
    expect(res.rapport.lignes.find((x) => x.code === "Q20")!.phrase).toMatch(/aucun bruitage validé/);
  });
});

describe("segment de fin : question de commentaire, rien sur LinkedIn", () => {
  it("IG, FB, YS : la question propre à l'image ouvre le segment de fin, puis la fin de la banque", () => {
    for (const r of ["instagram", "facebook", "youtube-shorts"] as const) {
      const l = ligneDe("C", r);
      const fin = l.plans.filter((p) => p.partie === "fin");
      expect(fin[0].scene, r).toBe("question");
      expect(fin[0].textes).toContain(FICHES_SIMULEES["essai-c"].questionCommentaire.texteEcran);
      expect(fin.length).toBeGreaterThanOrEqual(2);
      const ecran = l.blocs.find((b) => b.sorte === "ecran" && b.ecran.type === "question");
      expect(ecran?.sorte === "ecran" && ecran.ecran.type === "question" && ecran.ecran.question).toBe(FICHES_SIMULEES["essai-c"].questionCommentaire.texteEcran);
    }
  });

  it("LinkedIn : ni question ni fin, la vidéo s'arrête sur la phrase-choc et la marque", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom, "linkedin");
      expect(l.segmentFin.muet).toBe(true);
      expect(l.plans.some((p) => p.partie === "fin")).toBe(false);
      expect(JSON.stringify(l.plans)).not.toContain(FICHES_SIMULEES[IMAGES[nom]].questionCommentaire.texteEcran);
      expect(l.plans.at(-1)!.scene).toBe("phrase-choc");
    }
  });
});

describe("calage sur la voix (heures de la piste voix seule, tempo final)", () => {
  it("un mot que l'aligneur a écrit autrement prend une heure interpolée entre ses voisins", () => {
    const fiche = FICHES_SIMULEES["essai-c"];
    const voix = heuresSimulees(fiche.ecrans.map((e) => e.texteDit));
    const modifiee: MotHorodate[] = voix.map((m, k) => (k === 5 ? { ...m, mot: "XXXX" } : m));
    const cale = calerFiche(fiche, { mots: modifiee, motsCorps: modifiee.length });
    const mots = cale.ecrans.flatMap((e) => e.mots);
    expect(mots[5].cale).toBe(false);
    expect(mots[5].debutSec).toBeGreaterThanOrEqual(mots[4].finSec);
    expect(mots[5].debutSec).toBeLessThanOrEqual(mots[6].debutSec);
    expect(cale.partCalee).toBeGreaterThan(0.99);
  });

  it("une voix qui ne suit pas le script est refusée (moins de 90 % des mots retrouvés)", () => {
    const fiche = FICHES_SIMULEES["essai-c"];
    const voix = heuresSimulees(fiche.ecrans.map((e) => e.texteDit)).map((m, k) => (k % 4 === 0 ? { ...m, mot: `autre${k}` } : m));
    expect(() => calerFiche(fiche, { mots: voix, motsCorps: voix.length })).toThrow(ErreurCalageIV);
  });

  it("une voix bien plus lente que prévu : le contrôle du rythme refuse la ligne de temps plutôt que de la livrer", () => {
    const e = entreeDe("C");
    const res = mettreEnSceneIV({ ...e, voix: pisteSimulee(e.fiche, e.fin, { debit: 1.4 }) });
    expect(res.ok).toBe(false);
    expect(res.rapport.lignes.find((x) => x.code === "Q14")!.ok).toBe(false);
  });
});

describe("données de rendu compatibles avec les compositions de studio-rendu (composants inchangés)", () => {
  it("toile → ProprietesSceneIV, objets → ObjetSceneIV, moments → MomentGalerie", () => {
    let vus = 0;
    for (const nom of NOMS) {
      for (const b of ligneDe(nom, "facebook").blocs) {
        if (b.sorte === "toile") {
          const p: ProprietesSceneIV = b.proprietes;
          expect(p.dureeSec).toBeCloseTo(b.fin - b.debut, 2);
        } else if (b.sorte === "objets") {
          const o: ObjetSceneIV[] = b.objets;
          expect(o.length).toBeGreaterThan(0);
        } else if (b.sorte === "moments") {
          const m: MomentGalerie[] = b.moments;
          expect(m.every((x) => x.fin > x.debut)).toBe(true);
        }
        vus++;
      }
    }
    expect(vus).toBeGreaterThan(50);
  });
});
