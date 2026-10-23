/**
 * STYLE « reference/1 » (maquette validée par Will le 14/10/2026, `maquettes/tableau-style-reference/`) : une page
 * blanche cassée qui se remplit de haut en bas, bloc après bloc ; trois couleurs ; un petit dessin coloré par idée ; un
 * crayon qui écrit. Jugé sur les QUATRE fiches réelles (`temoins/fiche-*-prod.json`) et sur le témoin du blocage de la
 * fin TikTok et Shorts (`temoins/blocage-fin-tiktok-2026-10-14.json`), passés au nouveau style, dans les cinq sorties.
 * Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { planPageReference, pointA, pointsTrace, poseCrayonReference, silhouetteCrayon, avancementReference, type PointRef } from "../../../src/briques/tableau-scene/reference/animation";
import { COULEURS_DESSINS, COULEURS_REFERENCE, COULEURS_TEXTE_REFERENCE, CRAYON_REFERENCE, RYTHME_REFERENCE } from "../../../src/briques/tableau-scene/reference/charte";
import { RECOLORIAGES, couleursClipart } from "../../../src/briques/tableau-scene/reference/cliparts";
import { TRACES_DESSINS } from "../../../src/briques/dessins/traces";
import { controlerProprietes, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { formatTableauAnime } from "../../../src/formats/tableau-anime";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { chevauchementsReference, couleursHorsStyleReference, textesEnDoubleReference } from "../../../src/moteurs/montage-tableau/controles-reference";
import { habillageDe } from "../../../src/moteurs/montage-tableau/decoupage";
import { STYLE_PAR_DEFAUT_TABLEAU, validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { trousRythme } from "../../../src/moteurs/montage-tableau/regles";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { SITE_FIN } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { ficheReelleBrute } from "../dessin-4/fiches-reelles";
import { FICHES_REELLES, caleeReguliere, contexteDe, ficheReference, temoinReference, type NomFicheReelle } from "./fiches";

const SORTIES: IdSortie[] = ["vertical", "vertical-liens", "portrait", "carre", "horizontal"];
const coche = { coche: true, le: "2026-10-14" };
const fiches = Object.fromEntries(FICHES_REELLES.map((f) => [f.nom, ficheReference(f.nom)])) as Record<NomFicheReelle, FicheTableau>;
const temoin = temoinReference();
const toutes: [string, FicheTableau][] = [...FICHES_REELLES.map((f) => [f.nom, fiches[f.nom]] as [string, FicheTableau]), ["temoin-blocage-fin-tiktok", temoin.fiche]];

/** Mot à commenter de la fiche (fin au mot des Reels), comme à la création. */
const motDe = (f: FicheTableau) => (f.scenes.flatMap((s) => s.ecrans ?? []).find((e) => e.motCommentaire)?.motCommentaire ?? "MOT").toUpperCase();
/** Les sorties d'une fiche, telles que la relecture et la fabrication les préparent (fin propre de TikTok et Shorts). */
const sortiesDe = (f: FicheTableau) => {
  const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: motDe(f) });
  return sortiesRelues(f, SORTIES, (id) => finDeLaSortie(id, choisirFin(f.appelId ?? null, id)));
};

describe("style des nouvelles fiches et des fiches d'avant", () => {
  it("une nouvelle fiche naît au style « reference/3 » (gabarit par parties, 14/10) (le gabarit clair du 14/10, voir `reference-2`) ; le format le demande", () => {
    expect(STYLE_PAR_DEFAUT_TABLEAU).toBe("reference/3");
    expect(habillageDe({})).toBe("reference/3");
    expect(formatTableauAnime.pieces?.habillage).toBe("reference/3");
  });

  it("une fiche d'avant garde son style : « blocs/2 » reste en écrans, « reference/1 » devient une page écrite", () => {
    const avant = ficheReelleBrute("relances");
    expect(avant.habillage).toBe("blocs/2");
    const m2 = mettreEnPage(avant, {});
    expect(m2.styleV2).toBeDefined();
    expect(m2.styleReference).toBeUndefined();
    const mr = mettreEnPage(fiches.relances, {});
    expect(mr.styleReference?.style).toBe("reference/1");
    expect(mr.styleV2).toBeUndefined();
  });
});

describe("les fiches réelles et le témoin, au style « reference/1 » : acceptés dans les cinq sorties", () => {
  for (const [nom, f] of toutes)
    it(`${nom} : la relecture d'avant la fabrication dit « Tout est bon »`, async () => {
      const choisirFin = choisirFinTableau({}, { sorties: SORTIES, mot: motDe(f) });
      const r = await relireFicheTableau({ fiche: f, contexte: contexteDe(f), dejaVu: coche, sorties: SORTIES, choisirFin });
      // Lot B2b : la fiche réelle « habitude-equipe » (1 670 caractères dits, enregistrée le 12/10) dépasse la limite de 90 s au
      // débit de la voix à 165 mots/min (1 520 caractères) : elle est désormais REFUSÉE, et seulement pour sa durée.
      if (nom === "habitude-equipe") {
        expect(r.ok).toBe(false);
        expect(r.points.map((p) => p.message.replace(/^Règle « ([^»]*) ».*$/, "$1"))).toEqual(["durée de 90 secondes au plus"]);
        return;
      }
      expect(r.points.map((p) => p.message)).toEqual([]);
      expect(r.ok).toBe(true);
    });

  it("les contrôles propres au style passent, sortie par sortie (lignes nommées)", () => {
    for (const [nom, f] of toutes)
      for (const s of sortiesDe(f)) {
        const lignes = controlerImageSortie(s.fiche, { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options });
        for (const libelle of ["Rien ne dépasse", "Aucun chevauchement", "Un dessin par idée", "Couleurs du style", "Texte écrit une fois", "Blocs courts", "Page non vide", "Page remplie", "Zone sûre", "Taille du texte", "Contraste", "Première image"]) {
          const l = lignes.find((x) => x.libelle === libelle);
          expect.soft(l?.etat, `${nom} · ${s.id} · ${libelle} : ${l?.raison}`).toBe("reussi");
        }
      }
  }, 60_000);

  it("chaque fiche se cale, et ses scènes se préparent sans un seul problème", () => {
    for (const [nom, f] of toutes) {
      const c = caleeReguliere(f, nom);
      expect(trousRythme(c.fiche), nom).toEqual([]);
      for (const format of ["vertical", "portrait", "carre", "horizontal"] as const) {
        const mise = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
        const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
        expect(props.flatMap(controlerProprietes), `${nom} · ${format}`).toEqual([]);
        expect(props.every((p) => p.styleReference && !p.pagePrecedente)).toBe(true);
      }
    }
  }, 60_000);

  it("témoin du 14/10 : les deux sorties verticales se calent sur leurs VRAIES voix (le blocage de TikTok et Shorts est levé)", () => {
    const [principale, liens] = sortiesDe(temoin.fiche).filter((s) => s.id === "vertical" || s.id === "vertical-liens");
    const a = calerFicheTableau(principale.fiche, temoin.voix.mots, { contexte: contexteDe(principale.fiche), dureeSec: temoin.voix.dureeSec });
    expect(a.ok ? [] : a.problemes).toEqual([]);
    const b = calerFicheTableau(liens.fiche, temoin.voixTikTok.mots, { contexte: contexteDe(liens.fiche), dureeSec: temoin.voixTikTok.dureeSec });
    expect(b.ok ? [] : b.problemes).toEqual([]);
    if (b.ok) expect(trousRythme(b.fiche)).toEqual([]);
  });

  it("fin de TikTok et Shorts : plus d'appel au commentaire ; l'adresse du site est écrite en vert à la fin de la dernière page", () => {
    for (const [nom, f] of toutes) {
      const liens = sortiesDe(f).find((s) => s.id === "vertical-liens")!;
      const mise = mettreEnPage(liens.fiche, liens.options);
      const derniere = mise.pages.at(-1)!;
      const textes = derniere.elements.filter((e) => e.type !== "dessin");
      expect(textes.at(-1)?.lignes.map((l) => l.texte).join(" "), nom).toBe(SITE_FIN);
      expect(textes.at(-1)?.couleurTexte).toBe(COULEURS_REFERENCE.sauge);
      expect(mise.pages.flatMap((p) => p.elements).some((e) => e.lignes.some((l) => /commentaire/i.test(l.texte))), nom).toBe(false);
      expect(mise.styleReference?.pagesSansSignature).toEqual([derniere.page]);
    }
  });
});

describe("une page du style", () => {
  const sorties = (f: FicheTableau) => sortiesDe(f).map((s) => ({ id: s.id, mise: mettreEnPage(s.fiche, s.options) }));
  const toutesMises: { nom: string; id: string; mise: MiseEnPageTableau }[] = toutes.flatMap(([nom, f]) => sorties(f).map((s) => ({ nom, ...s })));

  it("un fond, trois couleurs de texte, une police ; texte grand : 52 px de base (44 à 60), titres un peu plus grands", () => {
    for (const { nom, id, mise } of toutesMises) {
      for (const p of mise.pages) {
        const textes = p.elements.filter((e) => e.type !== "dessin");
        const base = textes.filter((e) => e.role !== "titre").map((e) => e.taillePx!);
        // Une seule taille de base par page ; les titres, une taille au-dessus.
        expect(new Set(base).size, `${nom} · ${id} · page ${p.page}`).toBeLessThanOrEqual(1);
        for (const e of textes) {
          expect(e.taillePx!, `${nom} · ${id} · page ${p.page}`).toBeGreaterThanOrEqual(44);
          expect(e.taillePx!).toBeLessThanOrEqual(e.role === "titre" ? 64 : 60);
        }
        for (const e of textes) expect(COULEURS_TEXTE_REFERENCE).toContain(e.couleurTexte);
        for (const e of textes) expect(e.couleurFond).toBe(COULEURS_REFERENCE.fond);
      }
      expect(couleursHorsStyleReference(mise)).toEqual([]);
    }
    // La plupart des pages restent à la taille de base ou au-dessus (52 px).
    const pages = toutesMises.flatMap((m) => m.mise.pages);
    const grandes = pages.filter((p) => (p.elements.find((e) => e.type !== "dessin" && e.role !== "titre")?.taillePx ?? 52) >= 52);
    expect(grandes.length / pages.length).toBeGreaterThan(0.85);
  });

  it("la page commence en haut (vertical : premier bloc vers y = 140) et se remplit vers le bas, sans chevauchement", () => {
    for (const { nom, id, mise } of toutesMises) {
      expect(chevauchementsReference(mise), `${nom} · ${id}`).toEqual([]);
      for (const p of mise.pages) {
        const haut = Math.min(...p.elements.map((e) => e.encombrement.px.y));
        expect(haut - mise.cadre.px.y, `${nom} · ${id} · page ${p.page} : en haut`).toBeLessThanOrEqual(2);
        if (!mise.format) expect(Math.abs(haut - 140), `${nom} · page ${p.page}`).toBeLessThanOrEqual(8);
        const textes = p.elements.filter((e) => e.type !== "dessin").sort((a, b) => a.ordre - b.ordre);
        // Les lignes d'un bloc sont centrées entre elles.
        for (const e of textes) {
          const centres = e.lignes.map((l) => l.px.x + l.px.largeur / 2);
          expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(1);
        }
        // De haut en bas, dans l'ordre d'écriture (deux colonnes en horizontal : la seconde repart du haut).
        for (let i = 1; i < textes.length; i++) if (textes[i].px.y <= textes[i - 1].px.y) expect(mise.format, `${nom} · ${id} · page ${p.page}`).toBe("horizontal");
        // Une page de 3 blocs ou plus est remplie au moins aux 2/3 de sa hauteur utile.
        if (textes.length >= 3) expect(p.occupation, `${nom} · ${id} · page ${p.page}`).toBeGreaterThanOrEqual(2 / 3);
      }
    }
  });

  it("un dessin par idée, à côté de son bloc, en alternance gauche / droite", () => {
    for (const { nom, id, mise } of toutesMises)
      for (const p of mise.pages) {
        const dessins = p.elements.filter((e) => e.type === "dessin" && e.rattache);
        expect(new Set(dessins.map((d) => d.rattache)).size).toBe(dessins.length);
        const cotes = dessins.sort((a, b) => a.ordre - b.ordre).map((d) => d.cote);
        // Alternance (un bloc coché garde sa droite libre pour la coche : seule exception).
        const coches = new Set(p.gestes.filter((g) => g.geste === "cocher").map((g) => g.cibleId));
        cotes.forEach((c, i) => {
          if (i > 0 && !coches.has(dessins[i].rattache!)) expect.soft(c, `${nom} · ${id} · page ${p.page}`).not.toBe(cotes[i - 1]);
        });
        for (const d of dessins) {
          const bloc = p.elements.find((e) => e.elementId === d.rattache)!;
          const milieu = (r: { y: number; hauteur: number }) => r.y + r.hauteur / 2;
          expect(Math.abs(milieu(d.px) - milieu(bloc.px))).toBeLessThanOrEqual(bloc.px.hauteur / 2 + 2);
          // ~120 px, jamais collé au texte (30 px au moins), tout près de lui (au plus 30 px + l'entouré).
          expect(d.px.largeur).toBe(Math.round(120 * (mise.styleReference?.k ?? 1)));
          const ecart = d.cote === "gauche" ? bloc.encombrement.px.x - (d.px.x + d.px.largeur) : d.px.x - (bloc.encombrement.px.x + bloc.encombrement.px.largeur);
          expect(ecart, `${nom} · ${id} · page ${p.page} · ${d.dessinId}`).toBeGreaterThanOrEqual(29);
          expect(ecart).toBeLessThanOrEqual(31);
        }
      }
  });

  it("un même texte n'est écrit qu'une fois par page (« Exemple illustratif » de deux scènes)", () => {
    for (const { nom, id, mise } of toutesMises) expect(textesEnDoubleReference(mise), `${nom} · ${id}`).toEqual([]);
    const m = mettreEnPage(fiches["habitude-equipe"], {});
    expect(m.styleReference?.ecritsUneFois.length).toBeGreaterThan(0);
  });

  it("horizontal : page large (lignes plus longues, moins de rangées) ou deux colonnes ; tout reste dans la zone sûre", () => {
    for (const [nom, f] of toutes) {
      const v = mettreEnPage(f, {});
      const h = mettreEnPage(f, { format: "horizontal" });
      const rangees = (m: MiseEnPageTableau) => m.pages.flatMap((p) => p.elements).reduce((s, e) => s + e.lignes.length, 0);
      expect(rangees(h), nom).toBeLessThan(rangees(v));
      expect(h.cadre.px.largeur).toBeGreaterThan(v.cadre.px.largeur);
      for (const m of [v, h, mettreEnPage(f, { format: "portrait" }), mettreEnPage(f, { format: "carre" })]) {
        const z = m.zoneSure.px;
        expect(m.cadre.px.x).toBeGreaterThanOrEqual(z.x);
        expect(m.cadre.px.x + m.cadre.px.largeur).toBeLessThanOrEqual(z.x + z.largeur);
        // Colonne jusqu'à ~85 % de la largeur (dans la zone sûre).
        if (!m.format || m.format === "portrait" || m.format === "carre") expect(m.cadre.px.largeur).toBeGreaterThanOrEqual(Math.min(918, z.largeur) - 1);
      }
    }
  });

  it("chaque dessin de la banque a ses aplats, dans la palette du style", () => {
    for (const id of Object.keys(TRACES_DESSINS)) {
      expect(RECOLORIAGES[id as keyof typeof RECOLORIAGES], id).toBeDefined();
      for (const c of couleursClipart(id)) expect(COULEURS_DESSINS, id).toContain(c);
    }
  });
});

describe("le crayon écrit", () => {
  const scenes: ProprietesTableauScene[] = FICHES_REELLES.flatMap(({ nom }) => {
    const c = caleeReguliere(fiches[nom], nom);
    const mise = mettreEnPage(c.fiche, {});
    return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
  });

  it("chaque bloc démarre à l'heure de son mot d'ancre, jamais avant ; tout est écrit à la fin de sa scène", () => {
    for (const p of scenes) {
      const plan = planPageReference(p.page, p.styleReference!);
      for (const a of plan.actions) {
        expect(a.debut * 1000 + 1).toBeGreaterThanOrEqual(p.styleReference!.heuresPage[a.id]);
        const s = p.styleReference!.scenesPage.find((x) => x.id === p.page.elements.concat().find((e) => e.elementId === a.id)?.sceneId || x.id === p.page.gestes.find((g) => g.elementId === a.id)?.sceneId)!;
        expect((a.debut + a.duree) * 1000).toBeLessThanOrEqual(s.finMs);
      }
      for (const e of p.page.elements.filter((x) => x.sceneId === p.scene.id && x.type !== "dessin"))
        for (let i = 0; i < e.lignes.length; i++) expect(avancementReference(plan, e.elementId, `ligne:${i}`, p.scene.finMs / 1000)).toBe(1);
    }
  });

  it("la pointe suit le bord du texte ; le crayon ne cache jamais la ligne en cours", () => {
    const dedans = (q: PointRef, poly: PointRef[]) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i].y > q.y !== poly[j].y > q.y && q.x < ((poly[j].x - poly[i].x) * (q.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c;
      return c;
    };
    for (const p of scenes.slice(0, 12)) {
      const plan = planPageReference(p.page, p.styleReference!);
      for (const a of plan.actions.filter((x) => x.trace === "ecrire")) {
        for (const u of [0.2, 0.5, 0.8]) {
          const t = a.debut + u * a.duree;
          const pose = poseCrayonReference(plan, t)!;
          const bord = pointA(pointsTrace(a, plan.k), u);
          expect(Math.hypot(pose.pointe.x - bord.x, pose.pointe.y - bord.y)).toBeLessThanOrEqual(3);
          // Ce qui est déjà écrit de la ligne (à gauche du bord, 2 px de marge) n'est jamais sous le crayon.
          const poly = silhouetteCrayon(pose.pointe, pose.angle, plan.k);
          for (let x = a.cible.x; x < bord.x - 4; x += 6)
            for (const y of [a.cible.y + 2, a.cible.y + a.cible.hauteur / 2, a.cible.y + a.cible.hauteur - 2]) expect(dedans({ x, y }, poly)).toBe(false);
        }
      }
    }
  });

  it("le crayon (70 % de la maquette) ne sort jamais de l'image et ne couvre presque jamais un texte déjà écrit, dans les quatre formats", () => {
    expect(CRAYON_REFERENCE.longueur).toBe(185);
    let images = 0;
    let couvre = 0;
    for (const { nom } of FICHES_REELLES) {
      const c = caleeReguliere(fiches[nom], nom);
      for (const format of ["vertical", "portrait", "carre", "horizontal"] as const) {
        const mise = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
        const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
        for (const p of props) {
          const plan = planPageReference(p.page, p.styleReference!);
          for (let t = p.scene.debutMs / 1000; t < p.scene.finMs / 1000; t += 0.25) {
            const pose = poseCrayonReference(plan, t, { largeur: p.largeur, hauteur: p.hauteur });
            if (!pose) continue;
            images++;
            const poly = silhouetteCrayon(pose.pointe, pose.angle, plan.k);
            for (const q of poly) {
              expect(q.x, `${nom} · ${format} · ${t.toFixed(2)} s`).toBeGreaterThanOrEqual(0);
              expect(q.y).toBeGreaterThanOrEqual(0);
              expect(q.x).toBeLessThanOrEqual(p.largeur);
              expect(q.y).toBeLessThanOrEqual(p.hauteur);
            }
            // Le milieu du corps et la gomme ne sont pas sur une ligne déjà écrite.
            const bout = { x: (poly[2].x + poly[3].x) / 2, y: (poly[2].y + poly[3].y) / 2 };
            const milieu = { x: (poly[1].x + bout.x) / 2, y: (poly[1].y + bout.y) / 2 };
            const ecrites = plan.actions.filter((a) => a.trace === "ecrire" && a.debut + a.duree <= t);
            if (ecrites.some((a) => [bout, milieu].some((q) => q.x > a.cible.x && q.x < a.cible.x + a.cible.largeur && q.y > a.cible.y + 8 && q.y < a.cible.y + a.cible.hauteur - 8))) couvre++;
          }
        }
      }
    }
    expect(images).toBeGreaterThan(1000);
    expect(couvre / images).toBeLessThan(0.005);
  }, 120_000);

  it("entre deux blocs, le crayon glisse en 0,3 s au plus ; un dessin : contour 0,5 s puis couleur 0,3 s", () => {
    for (const p of scenes.slice(0, 12)) {
      const plan = planPageReference(p.page, p.styleReference!);
      for (const a of plan.actions.filter((x) => x.trace === "contour")) {
        expect(a.duree).toBeLessThanOrEqual(RYTHME_REFERENCE.contourSec + 1e-9);
        expect(plan.couleurs[a.id]).toBeCloseTo(a.debut + a.duree, 5);
      }
    }
  });

  it("la dernière scène : le crayon se pose sous la page finie, puis l'image s'efface", () => {
    const derniere = scenes.filter((p) => p.styleReference!.derniere);
    expect(derniere).toHaveLength(FICHES_REELLES.length);
    for (const p of derniere) {
      const plan = planPageReference(p.page, p.styleReference!);
      expect(plan.pose).not.toBeNull();
      const pose = poseCrayonReference(plan, p.scene.finMs / 1000 - 0.01)!;
      expect(pose.angle).toBeLessThan(0);
      expect(pose.pointe.y).toBeGreaterThan(Math.max(...p.page.elements.map((e) => e.px.y + e.px.hauteur)));
    }
  });
});

describe("refus utiles", () => {
  it("une page trop chargée est refusée en nommant la page et quoi faire", () => {
    const f = structuredClone(fiches.relances);
    for (const s of f.scenes) s.page = 1;
    const v = validerFicheTableau(f, contexteDe(f));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problemes.map((p) => p.message).join(" ")).toMatch(/page 1/);
  });

  it("les contrôles voient un chevauchement, une couleur hors style et un texte écrit deux fois", () => {
    const m = mettreEnPage(fiches.relances, {});
    const p = m.pages[0];
    const [a, b] = p.elements.filter((e) => e.type !== "dessin");
    const fausse: MiseEnPageTableau = { ...m, pages: [{ ...p, elements: [a, { ...b, px: a.px, encombrement: a.encombrement, couleurTexte: "#FF00FF", lignes: a.lignes }] }] };
    expect(chevauchementsReference(fausse).length).toBeGreaterThan(0);
    expect(couleursHorsStyleReference(fausse).length).toBeGreaterThan(0);
    expect(textesEnDoubleReference(fausse).length).toBeGreaterThan(0);
  });
});

