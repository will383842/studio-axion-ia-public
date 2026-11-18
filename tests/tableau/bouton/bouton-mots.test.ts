/**
 * FIX-TABLEAU-BOUTON-MOTS (18/11) : le bouton de la page d'appel garde les mots de l'utilisateur ; repli sur la
 * constante seulement si ces mots ne tiennent pas (plus de 48 caractères ou plus large que le bouton).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUTON_APPEL_3 } from "../../../src/briques/tableau-scene/reference/charte";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { texteDuBouton } from "../../../src/moteurs/montage-tableau/mise-en-page-v3";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { centreBandePct, commandeTableau, pagesDuStyle, plansTableau, RECETTE_COMPOSITION_TABLEAU, segmentsSousTitresTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { validerFicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { bandeDe, sousTitresTableau, supplementsSousTitresTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { contexteBanc, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { motsRealistes } from "../reference-3/fiches";
import { ficheVfc3 } from "../titre-seul/fiche-vfc3";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

/** Le témoin dont la ligne écrite d'appel est remplacée (le texte dit ne change pas). */
function avecLigneAppel(texte: string): FicheTableau {
  return {
    ...temoin,
    scenes: temoin.scenes.map((s, i) =>
      i === temoin.scenes.length - 1 ? { ...s, elements: s.elements.map((e) => (e.type === "ligne" && e.bloc === "appel" ? { ...e, texte } : e)) } : s,
    ),
  } as FicheTableau;
}
const pageAppel = (f: FicheTableau) => mettreEnPage(f, {}).pages.at(-1)!;
const bouton = (f: FicheTableau) => pageAppel(f).elements.find((e) => e.gabarit?.sorte === "bouton");
const textes = (f: FicheTableau) => pageAppel(f).elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ");

describe("texteDuBouton (fonction pure)", () => {
  it("reprend les mots, point final retiré ; repli au-delà de 48 caractères", () => {
    expect(texteDuBouton("Réservez votre appel gratuit de 15 minutes.")).toBe("Réservez votre appel gratuit de 15 minutes");
    expect(texteDuBouton("Réservez un appel de diagnostic")).toBe(BOUTON_APPEL_3);
    expect(texteDuBouton("Réservez votre appel gratuit de quinze minutes avec nous dès ce soir")).toBe(BOUTON_APPEL_3);
    expect(texteDuBouton("   ")).toBe(BOUTON_APPEL_3);
  });
});

describe("la page d'appel, par la vraie mise en page", () => {
  it("(a) « Réservez votre appel gratuit de 15 minutes. » : le bouton écrit exactement cela, sans « de diagnostic »", () => {
    const f = avecLigneAppel("Réservez votre appel gratuit de 15 minutes.");
    const b = bouton(f)!;
    expect(b).toBeDefined();
    expect(b.lignes.map((l) => l.texte).join(" ")).toBe("Réservez votre appel gratuit de 15 minutes");
    expect(textes(f)).not.toContain("Réservez un appel de diagnostic");
  });

  it("(e) le texte du bouton tient dans son cadre (largeur ≤ bouton)", () => {
    const b = bouton(avecLigneAppel("Réservez votre appel gratuit de 15 minutes."))!;
    if (b.gabarit?.sorte !== "bouton") throw new Error("bouton");
    for (const l of b.lignes) expect(l.px.largeur).toBeLessThanOrEqual(b.gabarit.cadre.largeur);
  });

  it("(b) 70 caractères : repli sur la constante", () => {
    const longue = "Réservez dès maintenant votre appel gratuit de quinze minutes avec nous";
    expect(longue.length).toBeGreaterThan(48);
    const f = avecLigneAppel(longue);
    expect(bouton(f)!.lignes.map((l) => l.texte).join(" ")).toBe(BOUTON_APPEL_3);
  });

  it("(c) la ligne est déjà « Réservez un appel de diagnostic » : page identique à master", () => {
    expect(bouton(temoin)!.lignes.map((l) => l.texte).join(" ")).toBe(BOUTON_APPEL_3);
    expect(JSON.stringify(mettreEnPage(avecLigneAppel("Réservez un appel de diagnostic"), {}).pages)).toBe(JSON.stringify(mettreEnPage(temoin, {}).pages));
  });
});

/** Remplace la ligne d'appel de la dernière scène (null : la retire). */
function appelDe(f: FicheTableau, texte: string | null): FicheTableau {
  const estAppel = (e: { type: string; bloc?: string }) => e.type === "ligne" && e.bloc === "appel";
  return {
    ...f,
    scenes: f.scenes.map((s, i, t) =>
      i === t.length - 1 ? { ...s, elements: texte === null ? s.elements.filter((e) => !estAppel(e)) : s.elements.map((e) => (estAppel(e) ? { ...e, texte } : e)) } : s,
    ),
  } as FicheTableau;
}

describe("(e) rendu « par instants » : la page d'appel de la fiche de l'essai (chaîne réelle : calage, mise en page, propriétés de scène, calque texte)", () => {
  const VOS_MOTS = "Réservez votre appel gratuit de quinze minutes.";
  function rendre(f: FicheTableau) {
    const lue = pagesDuStyle(f) as FicheTableau;
    const mots = motsRealistes(lue, 20.5);
    const cal = calerFicheTableau(lue, mots, { contexte: contexteBanc(lue, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
    if (!cal.ok) throw new Error(`calage refusé : ${cal.problemes.join(" | ")}`);
    const fc = cal.fiche;
    const mise = mettreEnPage(fc, {});
    const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fc.scenes as SceneCalee[], heures: cal.elements, stylo: fc.stylo, mots, temps3: tempsReference3(fc, mots) });
    const fs = formatSortie("vertical");
    const reseaux = reseauxVerticaux();
    const texte = fc.scenes.map((s) => s.texteDit).join(" ");
    const dureeSec = props.at(-1)!.scene.finMs / 1000;
    const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
    const bande = bandeDe(mise, fs.ratio, true, reseaux);
    const st = sousTitresTableau({ fiche: fc, positionPct: centreBandePct(mise), bande });
    const c = commandeTableau({ videoId: "v-bouton", fiche: fc, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio, bandeSousTitres: bande, intensite: "sobre" });
    const supplements = supplementsSousTitresTableau({ st, mise, ratio: fs.ratio, verticale: true, dynamiques: true });
    const segments = segmentsSousTitresTableau({ c, st, dynamiques: true, texte, dureeSec, mots, ratio: fs.ratio, reseaux, scenes, mise, supplements });
    const calque = parametresComposition(c, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: scenes[0].cle }, ...supplements }, RECETTE_COMPOSITION_TABLEAU).texte;
    return { mise, props, calque };
  }

  it("le bouton posé dans les propriétés de la dernière scène porte le texte EXACT, dans son cadre ; le calque texte de la vidéo se rend par instants", () => {
    const { mise, props, calque } = rendre(appelDe(ficheVfc3(), VOS_MOTS));
    const derniere = props.at(-1)!;
    const page = mise.pages.find((p) => p.page === derniere.page.page)!;
    const b = page.elements.find((e) => e.gabarit?.sorte === "bouton")!;
    expect(b).toBeDefined();
    if (b.gabarit?.sorte !== "bouton") throw new Error("bouton");
    expect(b.lignes.map((l) => l.texte).join(" ")).toBe("Réservez votre appel gratuit de quinze minutes");
    for (const l of b.lignes) expect(l.px.largeur).toBeLessThanOrEqual(b.gabarit.cadre.largeur);
    // Ce que reçoit la scène rendue : la même page d'appel, et nulle part les mots de la constante.
    const dessine = (derniere.page as unknown as { elements: { gabarit?: { sorte: string }; lignes: { texte: string }[] }[] }).elements;
    const bDessine = dessine.find((e) => e.gabarit?.sorte === "bouton")!;
    expect(bDessine.lignes.map((l) => l.texte).join(" ")).toBe("Réservez votre appel gratuit de quinze minutes");
    expect(dessine.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ")).not.toContain("de diagnostic");
    const rendu = instantsTexte(calque as never);
    expect(rendu.instants.length).toBeGreaterThan(1);
    expect(rendu.durees.reduce((x, y) => x + y, 0)).toBe((calque as { images: number }).images);
  });
});

describe("(d) le contrôle « Phrase non choisie » ne refuse pas une fiche acceptée dont le bouton garde vos mots", () => {
  const sorties = sortiesDesReseaux(["instagram", "tiktok", "youtube-shorts", "linkedin"]);
  const relire = (f: FicheTableau) =>
    relireFicheTableau({ fiche: f, contexte: contexteBanc(f, MOTS_DOULEUR_V6616), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin: choisirFinTableau({}, { sorties } as never) });
  const cas: [string, string][] = [
    ["vos mots (47 caractères)", "Réservez votre appel gratuit de quinze minutes."],
    ["ligne longue (> 48 caractères, le bouton se replie)", "Réservez dès maintenant votre appel gratuit de quinze minutes avec nous"],
  ];
  for (const [nom, texte] of cas)
    it(`${nom} : fiche acceptée, 0 « Phrase non choisie »`, async () => {
      const f = appelDe(ficheVfc3(), texte);
      expect(validerFicheTableau(f, contexteBanc(f, MOTS_DOULEUR_V6616)).ok).toBe(true);
      const r = await relire(f);
      expect(r.rapport.bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
    }, 30_000);
});

describe("(c) fiche sans ligne d'appel : les pages sont celles de master", () => {
  it("les pages de la mise en page sont identiques à l'instantané pris sur origin/master (avant ce correctif)", () => {
    const pages = JSON.stringify(mettreEnPage(appelDe(temoin, null), {}).pages);
    const chemin = join(process.cwd(), "tests", "tableau", "bouton", "pages-sans-appel-master.json");
    expect(existsSync(chemin)).toBe(true);
    expect(pages).toBe(readFileSync(chemin, "utf8").trim());
  });
});
