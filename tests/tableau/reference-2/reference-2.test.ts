/**
 * STYLE « reference/2 » : la page écrite au crayon du style « reference/1 », avec un GABARIT DE PAGE CLAIR (maquette
 * `maquettes/tableau-gabarit-clair/`, regard de Will du 14/10/2026 : « pas de titres, pas de hiérarchie, les étapes
 * dites ne sont pas écrites ; je veux la perfection : très clair, structuré »). Jugé sur les QUATRE fiches réelles
 * réécrites au gabarit et sur la fiche « réponses types » de la maquette (7 pages), dans les cinq sorties. Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { avancementReference, planPageReference } from "../../../src/briques/tableau-scene/reference/animation";
import { COULEURS_REFERENCE, TAILLES_GABARIT } from "../../../src/briques/tableau-scene/reference/charte";
import { controlerProprietes, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { formatTableauAnime } from "../../../src/formats/tableau-anime";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { CONSIGNE_DECOUPAGE, habillageDe, jugerFiche, remettreEnForme, roleDecoupageTableau, type EntreeDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { pageTropChargee } from "../../../src/moteurs/montage-tableau/densite";
import { STYLE_PAR_DEFAUT_TABLEAU, idNumero, validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { numerosDits } from "../../../src/moteurs/montage-tableau/gabarit";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { couperGauche } from "../../../src/moteurs/montage-tableau/mise-en-page-gabarit";
import { trousRythme } from "../../../src/moteurs/montage-tableau/regles";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { SITE_FIN } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { FICHES_REFERENCE_2, caleeReguliere, contexteDe, ficheReference2, ficheReference2Brute } from "./fiches";

const SORTIES: IdSortie[] = ["vertical", "vertical-liens", "portrait", "carre", "horizontal"];
const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;
const coche = { coche: true, le: "2026-10-14" };
const toutes = FICHES_REFERENCE_2.map((nom) => [nom, ficheReference2(nom)] as const);
const fiche = (nom: (typeof FICHES_REFERENCE_2)[number]) => toutes.find(([n]) => n === nom)![1];

/** Mot à commenter de la fiche (celui de son appel), comme à la création. */
const motDe = (f: FicheTableau) => /Écrivez (\S+) en commentaire/.exec(f.scenes.at(-1)!.texteDit)?.[1] ?? "MOT";
const sortiesDe = (f: FicheTableau) => {
  const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: motDe(f) });
  return sortiesRelues(f, SORTIES, (id) => finDeLaSortie(id, choisirFin(f.appelId ?? null, id)));
};
const texte = (e: { lignes: { texte: string }[] }) => e.lignes.map((l) => l.texte).join(" ");

describe("style des nouvelles fiches", () => {
  it("une nouvelle fiche naît au style « reference/3 » (gabarit par parties, 14/10) ; le format le demande ; les fiches d'avant gardent le leur", () => {
    expect(STYLE_PAR_DEFAUT_TABLEAU).toBe("reference/3");
    expect(habillageDe({})).toBe("reference/3");
    expect(formatTableauAnime.pieces?.habillage).toBe("reference/3");
    const avant = { ...ficheReference2Brute("relances"), habillage: "reference/1" };
    // Au style « reference/1 », le gabarit est refusé (champs propres à « reference/2 »), jamais lu en silence.
    const v = validerFicheTableau(avant, contexteDe(avant));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problemes.some((p) => /« gabarit » n'existe qu'au style « reference\/2 »/.test(p.message))).toBe(true);
  });

  it("la consigne du découpage décrit le gabarit, avec un exemple complet, et toujours les numéros dits", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(10);
    for (const m of ["GABARIT DE PAGE CLAIR", '"bloc":"titre"', '"bloc":"avant"', "L'IDÉE de la vidéo en UNE phrase clé", '"bloc":"appel"', "TOUJOURS, pour chaque numéro dit", "JAMAIS le contredire"]) expect(CONSIGNE_DECOUPAGE).toContain(m);
  });
});

describe("les cinq fiches au gabarit clair : acceptées dans les cinq sorties", () => {
  for (const [nom, f] of toutes)
    it(`${nom} : valide, et la relecture d'avant la fabrication dit « Tout est bon »`, async () => {
      const v = validerFicheTableau(f, contexteDe(f));
      // Lot B2b : la fiche réelle « habitude-equipe » (1 670 caractères dits, enregistrée le 12/10) dépasse la limite de 90 s au
      // débit de la voix à 165 mots/min (1 520 caractères) : elle est désormais REFUSÉE, et seulement pour sa durée.
      if (nom === "habitude-equipe") {
        expect(v.ok ? [] : v.problemes.map((p) => p.message.replace(/^.*?règle « ([^»]*) ».*$/, "$1"))).toEqual(["durée de 90 secondes au plus"]);
        return;
      }
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
      const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: motDe(f) });
      const r = await relireFicheTableau({ fiche: f, contexte: contexteDe(f), dejaVu: coche, sorties: SORTIES, choisirFin });
      expect(r.points.map((p) => p.message)).toEqual([]);
      expect(r.ok).toBe(true);
    }, 30_000);

  it("les contrôles de page passent, sortie par sortie (lignes nommées)", () => {
    for (const [nom, f] of toutes)
      for (const s of sortiesDe(f)) {
        const lignes = controlerImageSortie(s.fiche, { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options });
        for (const libelle of ["Rien ne dépasse", "Aucun chevauchement", "Titre présent", "Numéros écrits", "Tailles minimales", "Couleurs du style", "Texte écrit une fois", "Blocs courts", "Page non vide", "Page remplie", "Zone sûre", "Taille du texte", "Contraste", "Première image"]) {
          const l = lignes.find((x) => x.libelle === libelle);
          expect.soft(l?.etat, `${nom} · ${s.id} · ${libelle} : ${l?.raison}`).toBe("reussi");
        }
      }
  }, 60_000);

  it("chaque fiche se cale sans trou de rythme, et ses scènes se préparent sans un seul problème (quatre formats)", () => {
    for (const [nom, f] of toutes) {
      const c = caleeReguliere(f, nom);
      expect(trousRythme(c.fiche), nom).toEqual([]);
      for (const format of FORMATS) {
        const mise = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
        const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
        expect(props.flatMap(controlerProprietes), `${nom} · ${format}`).toEqual([]);
        expect(props.every((p) => p.styleReference?.style === "reference/2")).toBe(true);
      }
    }
  }, 60_000);

  it("fin de TikTok et Shorts : plus d'appel au commentaire ; leur demande en grand dans le cadre vert, l'adresse du site dessous (14/10)", () => {
    for (const [nom, f] of toutes) {
      const liens = sortiesDe(f).find((s) => s.id === "vertical-liens")!;
      const mise = mettreEnPage(liens.fiche, liens.options);
      const textes = mise.pages.at(-1)!.elements.filter((e) => e.lignes.length);
      expect(texte(textes.at(-1)!), nom).toBe(SITE_FIN);
      // Écrite en clair dans le cadre vert plein de la demande, comme l'appel des Reels.
      expect(textes.at(-1)!.couleurFond).toBe(COULEURS_REFERENCE.sauge);
      expect([textes.at(-1)!.gabarit?.sorte, textes.at(-2)!.gabarit?.sorte], nom).toContain("appel");
      expect(mise.pages.flatMap((p) => p.elements).some((e) => /commentaire/i.test(texte(e))), nom).toBe(false);
    }
  });
});

describe("le gabarit d'une page", () => {
  const rt = fiche("reponses-types");
  const v = mettreEnPage(rt, {});

  it("« réponses types » : 7 pages, problème, 4 étapes numérotées, exemple, « À retenir » — titres de la maquette", () => {
    expect(v.pages.map((p) => p.page)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const titres = v.pages.map((p) => texte(p.elements.find((e) => e.gabarit?.sorte === "titre")!));
    expect(titres).toEqual(["Le problème", "Relisez", "Écrivez une fois", "Rangez", "Automatisez", "Un plombier", "À retenir"]);
    const pastilles = v.pages.map((p) => p.elements.find((e) => e.gabarit?.sorte === "pastille")).map((e) => (e?.gabarit?.sorte === "pastille" ? e.gabarit.n : null));
    expect(pastilles).toEqual([null, 1, 2, 3, 4, null, null]);
    // Repère : 4 points sur les étapes, le courant plus gros ; bandeau sur l'exemple.
    for (const p of v.pages.slice(1, 5)) {
      const r = p.elements.find((e) => e.gabarit?.sorte === "repere")!.gabarit!;
      if (r.sorte !== "repere") throw new Error("repère attendu");
      expect(r.points).toHaveLength(4);
      expect(r.points.filter((q) => q.courant)).toHaveLength(1);
      expect(r.points.findIndex((q) => q.courant)).toBe(p.page - 2);
    }
    expect(texte(v.pages[5].elements.find((e) => e.gabarit?.sorte === "bandeau")!)).toBe("Exemple illustratif");
    expect(v.pages[5].elements.filter((e) => e.gabarit?.sorte === "etiquette").map(texte)).toEqual(["AVANT", "APRÈS"]);
    // « À retenir » : la liste numérotée 1 à 4, puis l'appel en grand dans son cadre vert.
    const p7 = v.pages[6];
    expect(p7.elements.filter((e) => e.gabarit?.sorte === "puce").map(texte)).toEqual(["1", "2", "3", "4"]);
    const appel = p7.elements.find((e) => e.gabarit?.sorte === "appel")!;
    expect(texte(appel)).toBe("Écrivez REPONSES en commentaire");
    expect(appel.couleurTexte).toBe(COULEURS_REFERENCE.fond);
    expect(appel.couleurFond).toBe(COULEURS_REFERENCE.sauge);
  });

  it("ordre fixe, texte aligné à gauche : repère, titre souligné, phrase clé, détails (filet à gauche)", () => {
    for (const p of v.pages.slice(0, 5)) {
      const ordre = p.elements.filter((e) => e.gabarit && e.type !== "dessin").sort((a, b) => a.px.y - b.px.y).map((e) => e.gabarit!.sorte);
      const sansRepere = ordre.filter((x) => x !== "repere" && x !== "pastille");
      expect(sansRepere[0], `page ${p.page}`).toBe("titre");
      expect(sansRepere[1]).toBe("phrase");
      expect(sansRepere.slice(2).every((x) => x === "detail")).toBe(true);
      const titre = p.elements.find((e) => e.gabarit?.sorte === "titre")!;
      expect(titre.marque).toBe("souligne");
      expect(titre.couleurMarque).toBe(p.page === 1 ? COULEURS_REFERENCE.terracotta : COULEURS_REFERENCE.sauge);
      for (const e of p.elements.filter((x) => x.gabarit?.sorte === "detail")) {
        const g = e.gabarit!;
        if (g.sorte !== "detail") continue;
        expect(g.filet.x + g.filet.largeur).toBeLessThan(e.px.x);
        // Aligné à gauche : toutes les rangées partent du même bord.
        expect(new Set(e.lignes.map((l) => l.px.x)).size).toBe(1);
      }
    }
  });

  it("texte grand (titre ~90, phrase clé ~72, détails ~54) et page remplie à 85-90 % de la zone sûre (vertical, 14/10)", () => {
    for (const [nom, f] of toutes) {
      const m = mettreEnPage(f, {});
      for (const p of m.pages) {
        const de = (sorte: string) => p.elements.filter((e) => e.gabarit?.sorte === sorte).map((e) => e.taillePx!);
        for (const t of de("titre")) expect(t, `${nom} · page ${p.page}`).toBeGreaterThanOrEqual(TAILLES_GABARIT.titreMin);
        for (const t of de("phrase")) expect(t, `${nom} · page ${p.page}`).toBeGreaterThanOrEqual(TAILLES_GABARIT.phraseMin);
        for (const t of de("detail")) expect(t, `${nom} · page ${p.page}`).toBeGreaterThanOrEqual(TAILLES_GABARIT.detailMin);
        expect(p.occupation, `${nom} · page ${p.page}`).toBeGreaterThanOrEqual(0.75);
        // Le texte (du premier élément écrit, dessins à part, au bas de la page) couvre 85 % de la zone sûre au moins.
        const ecrits = p.elements.filter((e) => e.type !== "dessin");
        const couvert = Math.max(...p.elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur)) - Math.min(...ecrits.map((e) => e.encombrement.px.y));
        // (une page très chargée à deux dessins garde son dessin en haut : 83 % au moins ; le témoin réel, 85 %.)
        expect(couvert / m.zoneSure.px.hauteur, `${nom} · page ${p.page}`).toBeGreaterThanOrEqual(0.83);
      }
    }
    // « réponses types », pages 1 à 5 : les tailles de la consigne (± 5 %), pages remplies à 85 % au moins.
    for (const p of v.pages.slice(0, 5)) {
      const t = (sorte: string) => p.elements.find((e) => e.gabarit?.sorte === sorte)!.taillePx!;
      expect(t("titre")).toBeGreaterThanOrEqual(90);
      expect(t("titre")).toBeLessThanOrEqual(99);
      expect(t("phrase")).toBeGreaterThanOrEqual(72);
      expect(t("detail")).toBeGreaterThanOrEqual(54);
      expect(p.occupation).toBeGreaterThanOrEqual(0.85);
      expect(p.occupation).toBeLessThanOrEqual(0.95);
    }
  });

  it("une page commence en haut ; une page restée courte (écarts ouverts au plus) est centrée dans la zone sûre (14/10)", () => {
    for (const [nom, f] of toutes)
      for (const format of FORMATS) {
        const m = mettreEnPage(f, format === "vertical" ? {} : { format });
        for (const p of m.pages) {
          const haut = Math.min(...p.elements.map((e) => e.encombrement.px.y)) - m.cadre.px.y;
          const bas = m.cadre.px.y + m.cadre.px.hauteur - Math.max(...p.elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
          // En haut, ou centrée : jamais plus de vide en haut qu'en bas.
          if (haut > 2) expect(haut, `${nom} · ${format} · page ${p.page}`).toBeLessThanOrEqual(bas + 4);
        }
      }
  });

  it("la typographie française : apostrophe courbe, espace insécable devant « : » et dans les guillemets", () => {
    const tous = v.pages.flatMap((p) => p.elements).flatMap((e) => e.lignes.map((l) => l.texte));
    expect(tous.some((t) => t.includes("’"))).toBe(true);
    expect(tous.some((t) => t.includes("'"))).toBe(false);
    expect(tous.filter((t) => / [:;!?»]/.test(t) || /« /.test(t))).toEqual([]);
  });

  it("coupe à gauche : le moins de rangées, sans petit mot en fin de rangée quand c'est évitable", () => {
    const r = couperGauche("Automatisez la question la plus fréquente.", 69, 789)!.map((x) => x.texte);
    expect(r).toHaveLength(3);
    expect(r.slice(0, -1).every((x) => !/ (la|de|le|à)$/.test(x))).toBe(true);
    expect(couperGauche("Anticonstitutionnellementissime", 84, 300)).toBeNull();
  });
});

describe("les étapes dites sont écrites, au moment où la voix les dit", () => {
  it("« Un. », « Deux : », « Étape 3. » sont des numéros ; « Un chantier déborde. », « Trois semaines passent. » non", () => {
    expect(numerosDits("Un. Relisez vos messages.")).toEqual([{ n: 1, ancre: 0 }]);
    expect(numerosDits("Bien. Deux : écrivez une fois.")).toEqual([{ n: 2, ancre: 1 }]);
    expect(numerosDits("Étape 3. Rangez-les.")).toEqual([{ n: 3, ancre: 1 }]);
    expect(numerosDits("Un chantier déborde. Trois semaines passent.")).toEqual([]);
  });

  it("la pastille numérotée part au mot du numéro : le crayon trace le rond, puis le chiffre s'écrit", () => {
    const c = caleeReguliere(fiche("reponses-types"), "reponses-types");
    const mise = mettreEnPage(c.fiche, {});
    const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
    for (const s of c.fiche.scenes.filter((x) => x.gabarit?.numero)) {
      const id = idNumero(s.id);
      const heure = c.elements.find((e) => e.elementId === id)!.debutMs;
      // Le mot du numéro, dans la voix : la pastille part à son début.
      const premier = c.fiche.scenes.slice(0, c.fiche.scenes.indexOf(s)).reduce((n, x) => n + x.texteDit.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length, 0);
      expect(heure).toBe(Math.round(c.mots[premier + s.gabarit!.numero!.ancre].debutSec * 1000));
      const p = props.find((x) => x.scene.id === s.id)!;
      const plan = planPageReference(p.page, p.styleReference!);
      const rond = plan.actions.find((a) => a.id === id && a.partie === "rond")!;
      const chiffre = plan.actions.find((a) => a.id === id && a.partie === "ligne:0")!;
      expect(rond.debut).toBeGreaterThanOrEqual(heure / 1000 - 1e-9);
      expect(rond.debut).toBeLessThan(heure / 1000 + 0.5);
      expect(chiffre.debut).toBeGreaterThanOrEqual(rond.debut + rond.duree);
      expect(avancementReference(plan, id, "ligne:0", rond.debut)).toBe(0);
      expect(avancementReference(plan, id, "ligne:0", chiffre.debut + chiffre.duree)).toBeCloseTo(1, 6);
      // Le titre s'écrit après le numéro.
      const titre = p.page.elements.find((e) => e.gabarit?.sorte === "titre")!;
      expect(plan.actions.find((a) => a.id === titre.elementId && a.partie === "ligne:0")!.debut).toBeGreaterThanOrEqual(chiffre.debut + chiffre.duree);
    }
  });

  it("une étape dite sans numéro écrit est refusée, avec ce qu'il faut écrire", () => {
    const f = structuredClone(ficheReference2Brute("reponses-types"));
    delete f.scenes[1].gabarit!.numero;
    const v = validerFicheTableau(f, contexteDe(f));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problemes.map((p) => p.message).join("\n")).toContain('la voix dit le numéro 1 (mot 1) : écrivez-le, avec « gabarit » { "role": "etape", "numero": { "n": 1, "ancre": 0 } }');
  });

  it("titre trop long, phrase clé qui ne reprend pas la voix, nombre écrit non dit : refusés", () => {
    const f = structuredClone(ficheReference2Brute("reponses-types"));
    const ligne = (i: number, j: number) => f.scenes[i].elements[j] as { texte: string };
    ligne(1, 0).texte = "Relisez bien tous vos messages";
    ligne(1, 1).texte = "Supprimez tout et recommencez demain matin.";
    ligne(2, 3).texte = "Faites-le une seule fois, en 5 minutes.";
    const v = validerFicheTableau(f, contexteDe(f));
    expect(v.ok).toBe(false);
    const msg = v.ok ? "" : v.problemes.map((p) => p.message).join("\n");
    expect(msg).toContain("le titre « Relisez bien tous vos messages » fait 5 mots ; 3 au plus");
    expect(msg).toContain("ne reprend pas le texte dit de sa page");
    expect(msg).toContain("écrit « 5 », que la voix ne dit pas");
  });
});

describe("réparation automatique avant refus (refus du 14/10 au matin : « scène s07 : 9 éléments », « page 6 trop chargée »)", () => {
  const entree = (f: FicheTableau): EntreeDecoupage => ({
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
    structure: f.structure,
    serie: f.serie,
    douleur: f.douleur,
    gesteMinute: f.gesteMinute,
    preuves: [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))].map((id) => ({ id, resume: "démonstration" })),
    dessins: [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "dessin" ? [e.dessinId] : [])))].map((id) => ({ id, motsCles: [] })),
    videoId: f.videoId,
    versionId: f.versionId,
    habillage: f.habillage,
    stylo: f.stylo,
    ratio: f.ratio,
    controle: { ...contexteDe(f), texteScript: undefined } as unknown as EntreeDecoupage["controle"],
  });

  it("une scène de plus de 6 éléments est coupée en deux à une fin de phrase, au lieu d'être refusée", () => {
    const f = structuredClone(ficheReference2Brute("reponses-types"));
    // « À retenir » en UNE scène de 8 éléments (titre, 4 éléments, dessin, détail, appel).
    const [a, b] = f.scenes.slice(-2);
    const fondue = { ...a, role: "fin" as const, texteDit: `${a.texteDit} ${b.texteDit}`, elements: [...a.elements, ...b.elements.map((e) => ("ancre" in e ? { ...e, ancre: e.ancre + a.texteDit.split(/\s+/).length } : e))] };
    f.scenes.splice(-2, 2, fondue);
    expect(fondue.elements.length).toBe(8);
    expect(validerFicheTableau(f, contexteDe(f)).ok).toBe(false);
    const r = remettreEnForme(f);
    expect(r.scenes.every((s) => s.elements.length <= 6)).toBe(true);
    const v = validerFicheTableau(r, contexteDe(r));
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
  });

  it("une page trop chargée passe à une page de plus, au lieu d'être refusée (page écrite « reference/1 » et « reference/2 »)", () => {
    // « reference/1 » : les étapes 1, 2 et 3 des relances sur la même page (trop de lignes pour une page).
    const f1 = structuredClone(ficheReference2Brute("relances"));
    f1.habillage = "reference/1";
    for (const s of f1.scenes) {
      delete s.gabarit;
      for (const e of s.elements) if (e.type === "ligne") delete e.bloc;
    }
    const i = f1.scenes.findIndex((s) => /^Deux\./.test(s.texteDit));
    for (const s of f1.scenes.slice(i)) s.page -= 1;
    for (const s of f1.scenes.slice(i + 1)) s.page -= 1;
    // « reference/2 » : un détail de plus sur la page « exemple » : elle ne tient plus dans la sortie carrée.
    const f2 = structuredClone(ficheReference2Brute("reponses-types"));
    const k = f2.scenes.findIndex((s) => s.role === "preuve");
    f2.scenes[k].elements.push({ id: "e90", type: "ligne", texte: "Il ne retape plus ses délais sur le chantier.", niveau: "texte", role: "resultat", bloc: "detail", ancre: 18 });
    for (const [f, page] of [
      [f1, f1.scenes[i].page],
      [f2, f2.scenes[k].page],
    ] as const) {
      expect(pageTropChargee(f), f.habillage).toBe(page);
      const r = remettreEnForme(f);
      expect(pageTropChargee(r), f.habillage).toBeNull();
      expect(r.scenes.length, f.habillage).toBe(f.scenes.length);
      expect(Math.max(...r.scenes.map((s) => s.page)), f.habillage).toBeGreaterThan(Math.max(...f.scenes.map((s) => s.page)));
      const v = validerFicheTableau(r, contexteDe(r));
      expect(v.ok ? [] : v.problemes.map((p) => p.message), f.habillage).toEqual([]);
    }
  });

  it("ce qui ne se répare pas est refusé avec ce qu'il faut faire", () => {
    const f = structuredClone(ficheReference2Brute("reponses-types"));
    // Une seule phrase dite pour 8 éléments : aucune fin de phrase où couper.
    const s = f.scenes[1];
    s.texteDit = "Un. Relisez vos messages envoyés de la semaine et notez chaque question qui revient au moins deux fois.";
    const extra = [0, 1, 2, 3].map((k) => ({ id: `x${k}`, type: "geste" as const, geste: "souligner" as const, cibleId: s.elements[1].id, ancre: 3 + k }));
    s.elements.push(...extra);
    const j = jugerFiche(f, entree(f));
    expect(j.ok).toBe(false);
    if (!j.ok) expect(j.refus.join("\n")).toMatch(/\d éléments ; il en faut de 1 à 6\. La coupe automatique n'a trouvé aucune fin de phrase où couper : coupez la scène en deux/);
  });
});
