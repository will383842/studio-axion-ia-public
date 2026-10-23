/**
 * VISUELS DESSINÉS ET PEPS DU STYLE « reference/3 » (maquette validée par Will le 15/10/2026 : « parfait », PR #260) :
 * la banque fermée des 16 visuels (`visuels-3.ts`), les champs facultatifs `visuel` et `bloc` de la fiche, leurs règles,
 * la place réservée du visuel (35 à 45 % de la largeur, jamais sur le texte ni dans la bande des sous-titres), le plan
 * d'animation (le crayon suit les traits, la touche orange s'anime, la poussée part au mot dit), les contrôles, et la
 * rétrocompatibilité : une fiche sans ces champs se met en page et s'anime EXACTEMENT comme sur master.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { planPage3, poseCrayon3, poussee3, blocOrange3, etatVisuel3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { COULEURS_REFERENCE_3, VISUELS_GABARIT_3 } from "../../../src/briques/tableau-scene/reference/charte";
import { EXEMPLES_VISUELS_3, IDS_VISUELS_3, VISUELS_3, aplatirChemin3, dessinVisuel3, encreVisuel3, etapesVisuel3, portionsChemins3, tempsVisuel3 } from "../../../src/briques/tableau-scene/reference/visuels-3";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { couleurHorsFamille, problemesAnimation3, visuelsPeps3 } from "../../../src/moteurs/montage-tableau/controles-v3";
import { CONSIGNE_DECOUPAGE } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { ficheReference2 } from "../reference-2/fiches";
import { caleeEcritureALHeure, caleeFormationV3, caleeGabaritCadre, caleeGabaritCadreVisuels, caleeTemoin3, contexteGabaritCadreVisuels, ficheGabaritCadreVisuels } from "./fiches";

const refus = (f: FicheTableau) => {
  const v = validerFicheTableau(f, contexteGabaritCadreVisuels(f));
  return v.ok ? [] : v.problemes.map((p) => p.message);
};
const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;
const propsDe = (c: ReturnType<typeof caleeGabaritCadreVisuels>, format: (typeof FORMATS)[number] = "vertical"): ProprietesTableauScene[] => {
  const m = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
  return proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots, temps3: tempsReference3(c.fiche, c.mots) });
};

describe("banque fermée des 16 visuels (visuels-3.ts)", () => {
  it("16 identifiants, numérotés 1 à 16 dans l'ordre de la maquette, chacun avec son nom, son usage et ce qui bouge", () => {
    expect(IDS_VISUELS_3).toHaveLength(16);
    expect(IDS_VISUELS_3.map((id) => VISUELS_3[id].numero)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    for (const id of IDS_VISUELS_3) for (const k of ["nom", "usage", "anime"] as const) expect(VISUELS_3[id][k].length, `${id}.${k}`).toBeGreaterThan(3);
  });

  for (const id of IDS_VISUELS_3)
    it(`${id} : des traits bruns lisibles, UNE touche orange, tout dans la grille, le temps du tracé de la maquette`, () => {
      const d = dessinVisuel3(id, EXEMPLES_VISUELS_3[id]);
      expect(d.traits.length).toBeGreaterThan(0);
      for (const t of [...d.traits, ...(d.fleau ?? [])]) expect(aplatirChemin3(t).flat().length, t).toBeGreaterThan(1);
      const etapes = etapesVisuel3(d);
      // Une seule touche orange : une sorte, à la fin, tracée (un ou plusieurs traits) ou animée seule.
      expect(etapes.at(-1)!.sorte).toBe("orange");
      expect(new Set(etapes.filter((e) => e.sorte === "orange").map((e) => e.crayon)).size).toBe(1);
      // L'encre (mouvements compris) reste dans la grille, à peu près (le grain et la flèche qui arrive débordent un peu).
      const E = encreVisuel3(d);
      expect(E.x).toBeGreaterThan(-15);
      expect(E.y).toBeGreaterThan(-15);
      expect(E.x + E.l).toBeLessThan(415);
      expect(E.y + E.h).toBeLessThan(415);
      // Répartition du temps (maquette) : traits, hachures, textes, puis l'orange, qui finit à la fin.
      const t = tempsVisuel3(etapes, 1.7);
      expect(t.at(-1)!.t1).toBeCloseTo(1.7, 6);
      for (let i = 1; i < t.length; i++) expect(t[i].t0).toBeGreaterThanOrEqual(t[i - 1].t1 - 1e-9);
      // Les champs d'exemple sont ceux que le visuel lit.
      for (const c of Object.keys(EXEMPLES_VISUELS_3[id])) expect(VISUELS_3[id].champs).toContain(c);
    });

  it("un champ absent n'écrit rien (aucun texte inventé) ; les tracés sont ceux de la maquette", () => {
    expect(dessinVisuel3("chrono").textes).toEqual([]);
    expect(dessinVisuel3("email-envoye").textes).toEqual([]);
    expect(dessinVisuel3("document-barre").traits[0]).toBe("M64 30 H270 L336 96 V372 H64 Z");
    expect(dessinVisuel3("bouclier-coche").orange).toEqual({ sorte: "trace", traces: ["M128 204 L184 258 L284 136"], epaisseur: 15 });
    expect(dessinVisuel3("schema-a-b", { gauche: "personne", droite: "A" }).textes.map((x) => x.t)).toEqual(["A"]);
  });

  it("la pointe et le trait vont ensemble : la part visible de chaque sous-chemin suit le parcours, sauts compris", () => {
    const c = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
    ];
    expect(portionsChemins3(c, 0.25)).toEqual([0.75, 0]);
    expect(portionsChemins3(c, 0.5)).toEqual([1, 0]);
    expect(portionsChemins3(c, 1)).toEqual([1, 1]);
  });
});

describe("fiche : champs facultatifs « visuel » et « bloc », leurs règles", { timeout: 60_000 }, () => {
  it("la fiche témoin AVEC visuels dit le même texte que l'exemple validé, passe toutes les règles et se cale", () => {
    const f = ficheGabaritCadreVisuels();
    const sans = caleeGabaritCadre().fiche;
    expect(f.scenes.map((s) => s.texteDit).join(" ")).toBe(sans.scenes.map((s) => s.texteDit).join(" "));
    expect(refus(f)).toEqual([]);
    expect(() => caleeGabaritCadreVisuels()).not.toThrow();
  });

  const avec = (modifier: (f: FicheTableau) => void) => {
    const f = structuredClone(ficheGabaritCadreVisuels());
    modifier(f);
    return refus(f);
  };
  it("un visuel hors de la banque est refusé par le schéma", () => {
    expect(avec((f) => ((f.scenes[3].gabarit as Record<string, unknown>).visuel = { id: "fusee" })).length).toBeGreaterThan(0);
  });
  it("au plus UN visuel et UN bloc orange par page ; jamais sur la page d'appel", () => {
    const page = (f: FicheTableau, n: number) => f.scenes.filter((s) => s.page === n);
    expect(avec((f) => (page(f, 8)[0].gabarit!.visuel = { id: "liste-cochee" })).some((m) => /un seul visuel par page/.test(m))).toBe(true);
    expect(avec((f) => (page(f, 8).forEach((s) => (s.gabarit!.bloc = { texte: "relance" })))).some((m) => /un seul bloc orange par page/.test(m))).toBe(true);
    expect(avec((f) => (f.scenes.at(-1)!.gabarit!.visuel = { id: "equipe" })).some((m) => /page d'appel/.test(m))).toBe(true);
  });
  it("un visuel n'écrit que ses champs ; le chiffre entouré a son chiffre", () => {
    expect(avec((f) => (f.scenes[3].gabarit!.visuel = { id: "liste-cochee", libelle: "Trois réflexes" })).some((m) => /n'écrit pas de « libelle »/.test(m))).toBe(true);
    expect(avec((f) => (f.scenes[3].gabarit!.visuel = { id: "chiffre-entoure" })).some((m) => /donnez-lui « chiffre »/.test(m))).toBe(true);
  });
  it("un chiffre affiché suit la règle des sources (élément chiffre sourcé) et doit être dit", () => {
    // Sans l'élément chiffre sourcé de la scène : refus (règle 7).
    expect(avec((f) => (f.scenes[0].elements = f.scenes[0].elements.filter((e) => e.type !== "chiffre"))).some((m) => /sans élément chiffre sourcé/.test(m))).toBe(true);
    // Un chiffre que la voix ne dit pas : refus.
    expect(
      avec((f) => {
        f.scenes[0].gabarit!.bloc!.compteur = { de: 0, a: 5 };
        f.scenes[0].elements = f.scenes[0].elements.map((e) => (e.type === "chiffre" ? { ...e, valeur: "5" } : e));
      }).some((m) => /écrit « 5 », que la voix ne dit pas/.test(m)),
    ).toBe(true);
  });
  it("le bloc orange : 4 mots au plus, repris du texte dit, un compteur qui défile, et il compte pour un des 3 blocs", () => {
    expect(avec((f) => (f.scenes[0].gabarit!.bloc!.texte = "données de trop ici dedans")).some((m) => /4 au plus/.test(m))).toBe(true);
    expect(avec((f) => (f.scenes[0].gabarit!.bloc!.texte = "factures impayées")).some((m) => /ne reprend pas le texte dit/.test(m))).toBe(true);
    expect(avec((f) => (f.scenes[0].gabarit!.bloc!.compteur = { de: 3, a: 3 })).some((m) => /ne défile pas/.test(m))).toBe(true);
    // Étape 2 : titre, phrase clé, liste cochée = 3 blocs ; un bloc orange en plus fait 4.
    expect(avec((f) => (f.scenes.find((s) => s.gabarit?.numero?.n === 2)!.gabarit!.bloc = { texte: "les coordonnées" })).some((m) => /montre 4 blocs/.test(m))).toBe(true);
  });
  it("« visuel » et « bloc » n'existent qu'au style reference/3", () => {
    const f = ficheReference2("relances");
    f.scenes[1].gabarit = { ...f.scenes[1].gabarit!, visuel: { id: "email-envoye" } };
    const v = validerFicheTableau(f, { aujourdhui: "2026-10-15", sourcesChiffres: [], preuves: [], matieres: [], texteScript: f.scenes.map((s) => s.texteDit).join(" "), motsDouleur: [] });
    expect(v.ok ? [] : v.problemes.map((p) => p.message).filter((m) => /n'existent qu'au style « reference\/3 »/.test(m))).toHaveLength(1);
  });
});

describe("mise en page : la place réservée du visuel, le bloc orange, la flèche, le marqueur", () => {
  for (const format of FORMATS)
    it(`${format} : chaque visuel est dessiné, à 35-45 % de la largeur, à 12 px au moins du texte, hors de la bande ; aucun échec bloquant`, () => {
      const c = caleeGabaritCadreVisuels();
      const m = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
      const visuels = m.pages.flatMap((p) => p.elements.filter((e) => e.gabarit?.sorte === "visuel"));
      // Portrait et carré : l'étape aux deux cartes « avant → après » (et, en carré, l'exemple) n'a pas la place d'un
      // visuel à 35 % de la largeur ; il y est laissé de côté, et le contrôle « Visuel dessiné » le SIGNALE.
      const manquants: Record<string, string[]> = { vertical: [], horizontal: [], portrait: ["schema-a-b"], carre: ["schema-a-b", "bouclier-coche"] };
      const tous = ["document-barre", "liste-cochee", "schema-a-b", "document-barre", "email-envoye", "bouclier-coche"];
      expect(visuels.map((v) => (v.gabarit?.sorte === "visuel" ? v.gabarit.id : ""))).toEqual(tous.filter((id) => !manquants[format].includes(id)));
      expect(visuelsPeps3(m)).toEqual([]);
      const lignes = controlerImageSortie(c.fiche, { id: format, libelle: format, options: format === "vertical" ? {} : { format } });
      expect(lignes.filter((l) => l.etat === "echoue" && l.bloquant).map((l) => `${l.libelle} : ${l.raison}`)).toEqual([]);
      const dessine = lignes.find((l) => l.libelle === "Visuel dessiné")!;
      expect(dessine.bloquant).toBe(false);
      expect(dessine.etat).toBe(manquants[format].length ? "echoue" : "reussi");
      for (const id of manquants[format]) expect(dessine.raison).toContain(`« ${id} » ne tient pas sur la page`);
      // Le visuel remplace l'icône de sa page.
      for (const p of m.pages) if (p.elements.some((e) => e.gabarit?.sorte === "visuel")) expect(p.elements.some((e) => e.type === "dessin")).toBe(false);
    });

  it("vertical, accroche : « Ce devis collé dans ChatGPT contient : », le bloc orange « 3 données de trop. » (compteur 0 → 3, deux rangées), la flèche vers le document", () => {
    const m = mettreEnPage(caleeGabaritCadreVisuels().fiche);
    const p1 = m.pages[0];
    const bloc = p1.elements.find((e) => e.gabarit?.sorte === "bloc-orange")!;
    const vis = p1.elements.find((e) => e.gabarit?.sorte === "visuel")!;
    expect(bloc.lignes.map((l) => l.texte)).toEqual(["données", "de trop."]);
    expect(bloc.gabarit?.sorte === "bloc-orange" && bloc.gabarit.compteur).toMatchObject({ de: 0, a: 3 });
    expect(bloc.couleurTexte).toBe(COULEURS_REFERENCE_3.fond);
    expect(vis.gabarit?.sorte === "visuel" && vis.gabarit.fleche?.corps.length).toBeGreaterThan(10);
    // Le chiffre sourcé est montré par le bloc, pas écrit une seconde fois.
    expect(p1.elements.some((e) => e.lignes.some((l) => l.texte === "3"))).toBe(false);
    // Aucune ligne orange sur une page avec peps : l'orange est au bloc et au visuel.
    expect(p1.elements.some((e) => (e.gabarit?.sorte === "titre" || e.gabarit?.sorte === "phrase") && e.gabarit.accent !== undefined)).toBe(false);
  });

  it("le contrôle trouve un visuel trop petit, trop grand, collé au texte, dans la bande, et une couleur verte", () => {
    const m = mettreEnPage(caleeGabaritCadreVisuels().fiche);
    const casse = (f: (g: Extract<NonNullable<MiseBrique["pages"][number]["elements"][number]["gabarit"]>, { sorte: "visuel" }>, m: MiseBrique) => void) => {
      const x = structuredClone(m);
      const v = x.pages[0].elements.find((e) => e.gabarit?.sorte === "visuel")!;
      f(v.gabarit as never, x as unknown as MiseBrique);
      return visuelsPeps3(x).map((y) => y.message).join(" | ");
    };
    expect(casse((g) => (g.encre.largeur = 300))).toMatch(/occupe 28 %/);
    expect(casse((g) => (g.encre.largeur = 540))).toMatch(/occupe 50 %/);
    expect(casse((g) => (g.encre.y -= 400))).toMatch(/px de/);
    expect(casse((g, x) => (g.encre.y = x.bandeSousTitres.px.y - 100))).toMatch(/bande des sous-titres/);
    expect(couleurHorsFamille("#3F7A55")).toBe(true);
    expect(couleurHorsFamille("#2F6FB0")).toBe(true);
    for (const c of Object.values(COULEURS_REFERENCE_3)) expect(couleurHorsFamille(c), c).toBe(false);
  });

  it("étape : marqueur orange franc sous le mot-clé (la ligne reste à l'encre), pastille qui rebondit", () => {
    const m = mettreEnPage(caleeGabaritCadreVisuels().fiche);
    const p = m.pages.find((x) => x.elements.some((e) => e.gabarit?.sorte === "visuel" && e.gabarit.id === "schema-a-b"))!;
    const phrase = p.elements.find((e) => e.gabarit?.sorte === "phrase")!;
    expect(phrase.gabarit).toMatchObject({ sorte: "phrase", marqueur: true });
    expect(phrase.gabarit?.sorte === "phrase" && phrase.gabarit.accent).toBeUndefined();
    expect(p.elements.find((e) => e.gabarit?.sorte === "pastille")?.gabarit).toMatchObject({ peps: true });
  });
});

describe("animation : le crayon trace le visuel, la touche orange s'anime, les gestes au mot dit", () => {
  const c = caleeGabaritCadreVisuels();
  const props = propsDe(c);
  const t3 = tempsReference3(c.fiche, c.mots);

  it("les contrôles de l'animation passent (accroche pleine, blocs à l'heure, aucune page vide, appel)", () => {
    expect(problemesAnimation3(props)).toEqual([]);
  });

  it("le crayon suit les traits du visuel (la pointe est sur le dessin), s'écarte pendant la touche orange animée seule, puis quitte la page", () => {
    const vues = new Set<number>();
    for (const p of props) {
      if (vues.has(p.page.page)) continue;
      vues.add(p.page.page);
      const v = p.page.elements.find((e) => e.gabarit?.sorte === "visuel");
      if (!v || v.gabarit?.sorte !== "visuel") continue;
      const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
      const traits = plan.actions.filter((a) => a.id === v.elementId && a.partie.startsWith("visuel:") && !a.sansCrayon);
      expect(traits.length, v.gabarit.id).toBeGreaterThan(2);
      const b = v.gabarit.boite;
      for (const a of traits) {
        const q = poseCrayon3(plan, a.debut + a.duree / 2)!;
        expect(q, `${v.gabarit.id} ${a.partie}`).not.toBeNull();
        expect(q.pointe.x).toBeGreaterThanOrEqual(b.x - 5);
        expect(q.pointe.x).toBeLessThanOrEqual(b.x + b.largeur + 5);
        expect(q.pointe.y).toBeGreaterThanOrEqual(b.y - 5);
        expect(q.pointe.y).toBeLessThanOrEqual(b.y + b.hauteur + 5);
      }
      // L'orange vient après les traits bruns ; une fois tout fini, la page vit encore (souffle) puis s'apaise.
      const fin = Math.max(...plan.actions.filter((a) => a.id === v.elementId).map((a) => a.debut + a.duree));
      const orange = plan.actions.filter((a) => a.id === v.elementId && a.partie.startsWith("visuel:orange"));
      expect(Math.min(...orange.map((a) => a.debut))).toBeGreaterThanOrEqual(Math.max(...plan.actions.filter((a) => a.id === v.elementId && a.partie.startsWith("visuel:trait")).map((a) => a.debut + a.duree)) - 1e-6);
      for (const a of orange.filter((x) => x.sansCrayon)) expect(poseCrayon3(plan, a.debut + a.duree / 2)?.ecrit ?? false).toBe(false);
      expect(etatVisuel3(plan, v.elementId, fin + 1).apres).toBeCloseTo(1, 6);
      // Plus rien à faire : le crayon a quitté la page (jamais posé sur les sous-titres).
      const derniere = Math.max(...plan.actions.map((a) => a.debut + a.duree));
      if (derniere + 0.4 < plan.finPage) expect(poseCrayon3(plan, derniere + 0.4)).toBeNull();
    }
  });

  it("le bloc orange : rebond, compteur 0 → 3, poussée ×1,06 quand la voix dit « trois »", () => {
    const p = props[0];
    const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
    const id = "s01~bloc";
    const dit = t3[`${id}~mot:0`] / 1000;
    const mot = c.mots.find((m) => Math.abs(m.debutSec - dit) < 1e-6)!;
    expect(mot.mot).toBe("trois");
    expect(plan.poussees[id]).toBeGreaterThanOrEqual(dit - 1e-6);
    expect(plan.poussees[id] - dit).toBeLessThan(0.6);
    expect(poussee3(plan, id, plan.poussees[id] + 0.25)).toBeCloseTo(1.06, 3);
    expect(poussee3(plan, id, plan.poussees[id] + 0.6)).toBe(1);
    const a = plan.apparitions[id];
    expect(blocOrange3(plan, id, a + 0.02, { de: 0, a: 3 }).valeur).toBe(0);
    expect(blocOrange3(plan, id, a + 1, { de: 0, a: 3 })).toEqual({ o: 1, echelle: 1, valeur: 3 });
  });

  it("la flèche part une fois le bloc arrivé, et précède la fin de la page", () => {
    const p = props[0];
    const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
    const fl = plan.actions.find((a) => a.partie === "fleche-visuel")!;
    expect(fl.debut).toBeGreaterThan(plan.apparitions["s01~bloc"]);
    expect(fl.debut + fl.duree).toBeLessThan(plan.finPage);
  });

  it("le marqueur balaie quand la voix dit le mot-clé, et sa ligne se pousse au même instant", () => {
    const p = props.find((x) => x.page.elements.some((e) => e.gabarit?.sorte === "visuel" && e.gabarit.id === "schema-a-b"))!;
    const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
    const phrase = p.page.elements.find((e) => e.gabarit?.sorte === "phrase")!;
    const cle = p.styleReference!.temps3![`${phrase.elementId}~cle`] / 1000;
    const m = plan.actions.find((a) => a.id === phrase.elementId && a.trace === "surligne")!;
    expect(m.couleur).toBe(COULEURS_REFERENCE_3.marqueur);
    expect(Math.abs(m.debut - cle)).toBeLessThan(0.3);
    expect(plan.poussees[phrase.elementId]).toBeCloseTo(cle, 3);
  });

  it("au plus un bloc orange et un visuel par page, la largeur visée de la charte", () => {
    for (const p of props) {
      expect(p.page.elements.filter((e) => e.gabarit?.sorte === "bloc-orange").length).toBeLessThanOrEqual(1);
      expect(p.page.elements.filter((e) => e.gabarit?.sorte === "visuel").length).toBeLessThanOrEqual(1);
    }
    expect(VISUELS_GABARIT_3.partMin).toBe(0.35);
    expect(VISUELS_GABARIT_3.partMax).toBe(0.45);
  });
});

describe("rétrocompatibilité : une fiche sans visuel ni bloc se rend comme sur master", () => {
  // Empreintes calculées sur master (5e575f42) : mise en page, propriétés des scènes (sans les nouvelles heures
  // `~cle`) et plans d'animation, des 4 fiches témoins dans les 4 sorties. Identiques ici. Recalculées le 16/10/2026
  // (vidéo d'essai v-667edcd8e3a8, défaut (c)) : la phrase d'une étape ne reprend plus son titre (« Listez » puis « les
  // documents que… ») ; c'est le seul changement du texte écrit de ces fiches (« formation » : inchangée).
  // Recalculées au lot B2b pour « formation » seulement (propriétés et plans : 2e et 3e empreintes ; mise en page inchangée) :
  // ses heures de scène viennent de l'estimateur de durée, passé de 20,5 à 16,9 caractères par seconde (voix-tableau/3).
  const MASTER: Record<string, string> = {
    "temoin/vertical": "44dc28e26f22972e 594b134daa9b4e28 5aab84c7178f9889",
    "temoin/portrait": "a111e60b0b5646a2 45065fb363063a94 5652f507fac15047",
    "temoin/carre": "2a8bd08a2c26fdfa 575214c9152bc6c9 586c83145a2d6cc1",
    "temoin/horizontal": "5af62dc6a98fdc8c 71885eb38e494f3f 48b3c6c6a896146a",
    "formation/vertical": "d0be86a7a6de29cb f46c80e65d844b29 5e651200a514e0a2",
    "formation/portrait": "d8b3e6685ee27189 ecb7f343d311f782 b0aa3d5d1cf85f59",
    "formation/carre": "4d20843aef23dca8 8d8a75c6af7c3575 6b85980832d8e0c9",
    "formation/horizontal": "a28a47f2b3b6fb1e b36d07e36b0db052 b82bb4c091ef7959",
    "ecriture/vertical": "e62d51030458622a bf2bc86b17d4442c 4402f893c758bc34",
    "ecriture/portrait": "488ed040b328ba63 f5e4084bfd1ecf86 8d6f4033fd66cc8e",
    "ecriture/carre": "0b56fbb63d0b950a 91cdbca72e605410 5df3feffa4b69431",
    "ecriture/horizontal": "6eb8ed462ee9b699 3efc1c32dc63df8c d9c0fbecc519ccb1",
    "gabarit/vertical": "e977afa88b5a8f79 43426e58e9783502 7071298d2ecb5823",
    "gabarit/portrait": "09967c8d13febaca 1aeaa897dd5ab9f9 57037c50d5a77c53",
    "gabarit/carre": "4e4068b19e7af4a4 c1c63b3b968d29d3 f5bbc1dabd66756f",
    "gabarit/horizontal": "82a696965d7bdba9 7e0a439716a993b9 a004ab5c0f46f3d5",
  };
  const h = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
  for (const [nom, calee] of Object.entries({ temoin: caleeTemoin3, formation: caleeFormationV3, ecriture: caleeEcritureALHeure, gabarit: caleeGabaritCadre }))
    it(`${nom} : mise en page, propriétés et plans identiques à master, dans les 4 sorties`, () => {
      const { fiche, mots, elements } = calee();
      for (const format of FORMATS) {
        const m = mettreEnPage(fiche, format === "vertical" ? {} : { format });
        const props = proprietesScenes({ miseEnPage: m as never, scenes: fiche.scenes as never, heures: elements, stylo: fiche.stylo, mots, temps3: tempsReference3(fiche, mots) });
        const p = h(props.map((x) => ({ ...x, styleReference: { ...x.styleReference, temps3: Object.fromEntries(Object.entries(x.styleReference?.temps3 ?? {}).filter(([k]) => !k.endsWith("~cle"))) } })));
        const plans = h(
          props.map((x) => {
            const pl = planPage3(x.page, x.styleReference!, { largeur: x.largeur, hauteur: x.hauteur });
            expect(Object.keys(pl.poussees)).toEqual([]);
            return { actions: pl.actions, apparitions: pl.apparitions, couleurs: pl.couleurs, debutPage: pl.debutPage, finTransition: pl.finTransition, battement: pl.battement };
          }),
        );
        expect(`${h(m)} ${p} ${plans}`, `${nom}/${format}`).toBe(MASTER[`${nom}/${format}`]);
      }
    });
});

describe("consigne du découpage (version 13) : visuels et bloc orange", () => {
  it("donne la banque fermée, les règles de choix, un visuel et un bloc au plus par page, et des exemples", () => {
    for (const id of IDS_VISUELS_3) expect(CONSIGNE_DECOUPAGE).toContain(`« ${id} »`);
    expect(CONSIGNE_DECOUPAGE).toMatch(/un par page AU PLUS, aucune page obligée/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/BLOC ORANGE \(facultatif, UN par page au plus/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/des données retirées, ce qu'on ne colle pas → « document-barre »/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/« schema-a-b » \(« gauche » : « personne » ou un mot court/);
    expect(CONSIGNE_DECOUPAGE).toContain('"visuel":{"id":"liste-cochee"}');
  });
});
