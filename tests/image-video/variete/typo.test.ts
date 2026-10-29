/**
 * Variété « Image → vidéo » · axe 5, écrans de texte (lot TYP-SOU) : TYP-B un mot géant à la fois, TYP-C lignes qui
 * glissent, TYP-D le mot devient l'objet. Chaque mot écrit arrive au plus tard 0,15 s après son mot dit ; un seul mot
 * orange par écran ; ce que la carte montre et dit ne change pas (`invariantsVarieteIV`). Aucun appel, aucune date.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FormatIV, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_TYPO, formeMot, objetDuMot, type DonneesTexteIV } from "@/moteurs/montage-image-video/variete/axes/typo";
import { recettePourVersion, RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "@/services/image-video-rendu";
import { estPonctuationIsolee, rangeesTexte, tailleMotGeant, zonesTexte, type DonneesTexte, type LigneEcrite } from "../../../studio-rendu/compositions/image-video/variete/texte/donnees";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;

/** Les entrées des 6 cartes, une par version du plan des fins. */
function entrees(): { nom: string; entree: EntreeMiseEnSceneIV }[] {
  return Object.entries(IMAGES).flatMap(([nom, id]) => {
    const carte = carteDe(nom);
    const fiche = FICHES_SIMULEES[id];
    const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
    return fins.map((fin) => ({ nom, entree: { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES } }));
  });
}
const TOUTES = entrees();
const TIKTOK = TOUTES.filter((x) => x.entree.reseaux.includes("youtube-shorts"));
const recetteTexte = (texte: RecetteVarieteIV["texte"]): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, texte });
/**
 * Ligne de comparaison : la recette de référence. Elle n'est plus « rien ne change » depuis le lot OUV-FIN (OUV-D
 * remplace la première phrase) : l'axe typo se compare donc à elle, pas à la ligne sans recette.
 */
const reference = (entree: EntreeMiseEnSceneIV) => mettreEnSceneIV({ ...entree, variete: RECETTE_REFERENCE_IV });
const estOuverture = (b: BlocRenduIV) => b.sorte === "variete" && b.axe === "ouverture";

type BlocTexte = Extract<BlocRenduIV, { sorte: "variete" }> & { donnees: DonneesTexteIV };
const blocsTexte = (l: LigneDeTempsIV) => l.blocs.filter((b): b is BlocTexte => b.sorte === "variete" && b.axe === "texte");
/** Blocs d'écran de texte d'une scène émotion (accroche, titre) : ceux que l'axe remplace. */
const ecransEmotion = (l: LigneDeTempsIV) =>
  l.blocs.filter((b) => b.sorte === "ecran" && ["accroche", "titre"].includes((b.ecran as { type: string }).type) && l.plans.some((p) => p.sorte === "emotion" && p.debut <= (b.debut + b.fin) / 2 && (b.debut + b.fin) / 2 < p.fin));

/**
 * L'axe SEUL, appliqué aux blocs de la ligne sans recette (les autres axes, dont l'ouverture, n'y passent pas), avec
 * les mots de la voix (`etape.mots`) = ceux des sous-titres (la voix calée).
 */
function avecVoix(entree: EntreeMiseEnSceneIV, texte: RecetteVarieteIV["texte"], format: FormatIV = "9:16") {
  const ref = mettreEnSceneIV({ ...entree, format }).ligne;
  const mots = ref.sousTitres.groupes.flatMap((g) => g.mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec })));
  const recette = recetteTexte(texte);
  const etape = { blocs: ref.blocs.map((b) => ({ ...b, variete: { recette, format } })), plans: ref.plans, recette, format, carte: entree.carte, fiche: entree.fiche, chiffresDits: ref.chiffresDits, reseaux: entree.reseaux, replis: [], mots };
  return { ref, mots, sortie: AXE_TYPO.appliquer(etape) };
}

describe("typo · les écrans de texte deviennent propres à l'IV", () => {
  it("rouge sans le lot : recette TYP-B → les blocs émotion ne sont plus « ecran » (carte C)", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const sans = reference(entree).ligne;
    const avec = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-B") }).ligne;
    expect(ecransEmotion(sans).length).toBeGreaterThan(0);
    expect(ecransEmotion(avec)).toEqual([]);
    expect(blocsTexte(avec).length).toBe(ecransEmotion(sans).length);
  });

  it("TYP-A (référence) : rien ne change (hors ouverture, remplacée par l'axe ouverture)", () => {
    const { entree } = TIKTOK[0];
    const a = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-A") }).ligne;
    expect(blocsTexte(a)).toEqual([]);
    const finOuverture = Math.max(0, ...a.blocs.filter(estOuverture).map((b) => b.fin));
    expect(JSON.stringify(a.blocs.filter((b) => !estOuverture(b)).map((b) => ({ ...b, variete: undefined })))).toBe(JSON.stringify(mettreEnSceneIV(entree).ligne.blocs.filter((b) => b.debut >= finOuverture - 1e-9)));
  });

  it("6 cartes × 5 versions, TYP-B, C, D : mêmes bornes de blocs, invariants tenus (chiffres, textes, voix, contrôles)", { timeout: 120_000 }, () => {
    for (const code of ["TYP-B", "TYP-C", "TYP-D"] as const) {
      for (const { nom, entree } of TOUTES) {
        const sans = reference(entree);
        const avec = mettreEnSceneIV({ ...entree, variete: recetteTexte(code) });
        expect(avec.ligne.blocs.map((b) => [b.id, b.debut, b.fin]), `${code} ${nom}`).toEqual(sans.ligne.blocs.map((b) => [b.id, b.debut, b.fin]));
        expect(invariantsVarieteIV(sans, avec), `${code} ${nom} ${entree.fin?.id}`).toEqual([]);
        // Chaque bloc remplacé garde le fond de son écran (les sous-titres à l'encre sur ivoire en dépendent).
        for (const b of blocsTexte(avec.ligne)) {
          const avant = sans.ligne.blocs.find((x) => x.id === b.id)!;
          expect(avant.sorte === "ecran" && avant.ecran.fond).toBe(b.donnees.fond);
        }
      }
    }
  });

  it("un seul mot orange par écran, et chaque mot écrit de l'écran d'origine est là, dans l'ordre", () => {
    for (const code of ["TYP-B", "TYP-C", "TYP-D"] as const) {
      for (const { nom, entree } of TIKTOK) {
        const sans = reference(entree).ligne;
        const avec = mettreEnSceneIV({ ...entree, variete: recetteTexte(code) }).ligne;
        for (const b of blocsTexte(avec)) {
          const lignesOrange = b.donnees.lignes.filter((l) => l.mots.some((m) => m.orange));
          expect(lignesOrange.length, `${code} ${nom} ${b.id}`).toBeLessThanOrEqual(1);
          for (const l of lignesOrange) {
            const rangs = l.mots.flatMap((m, i) => (m.orange ? [i] : []));
            expect(rangs.at(-1)! - rangs[0] + 1, "un seul groupe orange").toBe(rangs.length);
          }
          const avant = sans.blocs.find((x) => x.id === b.id)!;
          const lignes = avant.sorte === "ecran" ? (avant.ecran as { lignes: string[] }).lignes : [];
          expect(b.donnees.lignes.map((l) => l.mots.map((m) => m.mot).join(" "))).toEqual(lignes.map((x) => x.replace(/\*/g, "").replace(/\s+(?=[^\p{L}\p{N}\s]+(\s|$))/gu, "").split(/\s+/).filter(Boolean).join(" ")));
        }
      }
    }
  }, 60_000);

  it("au rythme de la voix : chaque mot écrit et dit apparaît au plus tard 0,15 s après son mot dit (6 cartes, TYP-B/C/D)", () => {
    let dits = 0;
    let ecrits = 0;
    for (const code of ["TYP-B", "TYP-C", "TYP-D"] as const) {
      for (const { nom, entree } of TIKTOK) {
        const { ref, mots, sortie } = avecVoix(entree, code);
        for (const b of sortie.blocs) {
          if (b.sorte !== "variete" || b.axe !== "texte") continue;
          const d = b.donnees as DonneesTexteIV;
          expect(d.calage).toBe("voix");
          for (const l of d.lignes) {
            for (const m of l.mots) {
              ecrits++;
              if (!m.dit) continue;
              dits++;
              const heure = b.debut + m.t;
              // Le mot dit le plus proche AVANT l'apparition (même forme) : écart ≤ 0,15 s, sauf mot dit avant le bloc
              // (déjà écrit par l'écran précédent, il est là dès le début du bloc).
              // Un chiffre écrit (« 23:14 », « 1er ») est dit en lettres : son heure est celle de son chiffre dit.
              const candidats = /\d/.test(m.mot) ? ref.chiffresDits.map((c) => ({ mot: c.brut, debutSec: c.t })) : mots.filter((x) => formeMot(x.mot) === formeMot(m.mot));
              const dit = candidats.filter((x) => x.debutSec <= heure + 1e-6).sort((x, y) => x.debutSec - y.debutSec).at(-1);
              expect(dit, `${code} ${nom} ${b.id} « ${m.mot} »`).toBeDefined();
              if (dit!.debutSec >= b.debut) expect(heure - dit!.debutSec, `${code} ${nom} ${b.id} « ${m.mot} »`).toBeLessThanOrEqual(0.15);
              else expect(m.t).toBe(0);
            }
          }
        }
      }
    }
    // Les écrans reformulent peu : la grande majorité des mots écrits sont calés sur un mot dit.
    expect(dits / ecrits).toBeGreaterThan(0.6);
  });

  it("chiffre écrit (« 23:14 ») dit en lettres : il arrive sur son chiffre dit, jamais avant", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const { ref, sortie } = avecVoix(entree, "TYP-C");
    const b = sortie.blocs.find((x) => x.sorte === "variete" && (x.donnees as DonneesTexteIV).lignes.some((l) => l.mots.some((m) => m.mot === "23:14")))!;
    const m = (b as BlocTexte).donnees.lignes.flatMap((l) => l.mots).find((x) => x.mot === "23:14")!;
    const c = ref.chiffresDits.find((x) => x.brut.replace(/\D/g, "") === "2314")!;
    expect(c).toBeDefined();
    expect(b.debut + m.t).toBeCloseTo(c.t, 3);
  });

  it("la mise en scène passe les mots de la voix : heures calées sur la voix (carte C)", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const l = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-C") }).ligne;
    expect(blocsTexte(l).length).toBeGreaterThan(0);
    for (const b of blocsTexte(l)) expect(b.donnees.calage).toBe("voix");
  });

  it("sans les mots de la voix (étape à la main) : heures estimées depuis la ligne, jamais avant le bloc ni après sa fin", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const ref = mettreEnSceneIV(entree).ligne;
    const recette = recetteTexte("TYP-C");
    const etape = { blocs: ref.blocs.map((b) => ({ ...b, variete: { recette, format: "9:16" as const } })), plans: ref.plans, recette, format: "9:16" as const, carte: entree.carte, fiche: entree.fiche, chiffresDits: ref.chiffresDits, reseaux: entree.reseaux, replis: [] };
    const l = AXE_TYPO.appliquer(etape);
    for (const b of l.blocs.filter((x): x is BlocTexte => x.sorte === "variete" && x.axe === "texte")) {
      expect(b.donnees.calage).toBe("estime");
      for (const m of b.donnees.lignes.flatMap((x) => x.mots)) {
        expect(m.t).toBeGreaterThanOrEqual(0);
        expect(m.t).toBeLessThanOrEqual(b.fin - b.debut);
      }
    }
  });
});

describe("typo · variantes", () => {
  it("TYP-B : un écran trop long passe en TYP-C, avec un repli inscrit ; 4:5 → jamais TYP-B", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "A")!;
    const l = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-B") }).ligne;
    const codes = blocsTexte(l).map((b) => b.code);
    expect(codes).toContain("TYP-B");
    for (const b of blocsTexte(l)) if (b.code === "TYP-C") expect(l.variete!.replis.some((r) => r.code === "TYP-B" && r.raison.startsWith(`bloc ${b.id} `)), b.id).toBe(true);
    for (const b of blocsTexte(l)) if (b.code === "TYP-B") expect(b.donnees.lignes.flatMap((x) => x.mots).length).toBeLessThanOrEqual(8);
    expect(AXE_TYPO.possibles(entree.carte, "4:5")).not.toContain("TYP-B");
    expect(AXE_TYPO.possibles(entree.carte, "9:16")).toContain("TYP-B");
    const r45 = recettePourVersion(recetteTexte("TYP-B"), ["linkedin"], "4:5");
    expect(r45.texte).toBe("TYP-C");
  });

  it("TYP-D, carte C : « 23:14 » devient l'horloge (23 h 14) ; les autres écrans glissent (TYP-C)", () => {
    // L'axe seul : avec la recette complète, « 23:14 » est dans la première phrase, que l'ouverture prend.
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const { sortie } = avecVoix(entree, "TYP-D");
    const l = { blocs: sortie.blocs, variete: { replis: sortie.replis } } as unknown as LigneDeTempsIV;
    const d = blocsTexte(l).filter((b) => b.code === "TYP-D");
    expect(d.length).toBe(1);
    expect(d[0].donnees.objet).toMatchObject({ nom: "horloge", heure: { h: 23, m: 14 } });
    expect(d[0].donnees.lignes[d[0].donnees.objet!.ligne].mots[d[0].donnees.objet!.mot].mot).toBe("23:14");
    expect(blocsTexte(l).filter((b) => b.code !== "TYP-D").every((b) => b.code === "TYP-C")).toBe(true);
    expect(l.variete!.replis).toEqual([]);
  });

  it("TYP-D : les objets connus ; sans aucun mot-objet à l'écran, TYP-C partout et repli inscrit", () => {
    expect(objetDuMot("alerte")?.nom).toBe("cloche");
    expect(objetDuMot("E-mail")?.nom).toBe("enveloppe");
    expect(objetDuMot("e-mails,")?.nom).toBe("enveloppe");
    expect(objetDuMot("24h")).toEqual({ nom: "horloge" });
    expect(objetDuMot("3h.")).toEqual({ nom: "horloge", heure: { h: 3, m: 0 } });
    expect(objetDuMot("23:14")).toEqual({ nom: "horloge", heure: { h: 23, m: 14 } });
    expect(objetDuMot("client")).toBeNull();
    expect(objetDuMot("80")).toBeNull();
    let sansObjet = 0;
    for (const { nom, entree } of TIKTOK) {
      const l = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-D") }).ligne;
      const t = blocsTexte(l);
      if (t.some((b) => b.code === "TYP-D")) continue;
      sansObjet++;
      expect(t.every((b) => b.code === "TYP-C"), nom).toBe(true);
      expect(l.variete!.replis.some((r) => r.axe === "texte" && r.code === "TYP-D"), nom).toBe(true);
    }
    expect(sansObjet).toBeGreaterThan(0);
  });

  it("possibles : TYP-D seulement si la carte a un mot-objet ; TYP-C toujours", () => {
    const c = carteDe("C");
    expect(AXE_TYPO.possibles(c, "9:16")).toEqual(["TYP-B", "TYP-C", "TYP-D"]);
    const nue: CarteImage = { ...c, titre: "Tri des devis", phraseChoc: "Rien ne se perd.", noeuds: c.noeuds.map((n) => ({ ...n, libelle: "Étape", detail: undefined })) };
    expect(AXE_TYPO.possibles(nue, "9:16")).toEqual(["TYP-B", "TYP-C"]);
    expect(AXE_TYPO.possibles(nue, "4:5")).toEqual(["TYP-C"]);
  });

  it("rendu : un bloc texte vise ImageVideoVariete avec ses données ; la forme du moteur s'assigne à celle de la composition", () => {
    const { entree } = TIKTOK.find((x) => x.nom === "C")!;
    const l = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-C") }).ligne;
    const b = blocsTexte(l)[0];
    const p = parametresDuBloc(b, l);
    expect(p.composition).toBe("ImageVideoVariete");
    expect(p.proprietes).toMatchObject({ bloc: { axe: "texte", code: "TYP-C", donnees: b.donnees } });
    const compo: DonneesTexte = b.donnees;
    expect(compo.lignes.length).toBeGreaterThan(0);
  });

  it("mise en page (9:16 et 4:5) : rangées TYP-C dans la zone et la largeur, texte ≥ 58 px, mot orange ≥ 96 px ; mot géant TYP-B ≥ 150 px", () => {
    for (const { nom, entree } of TIKTOK) {
      for (const format of ["9:16", "4:5"] as FormatIV[]) {
        const z = zonesTexte(format === "9:16" ? 1920 : 1350);
        const l = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-C"), format }).ligne;
        for (const b of blocsTexte(l)) {
          const rs = rangeesTexte(b.donnees.lignes, z.haut, z.bas, 920, 280);
          expect(rs.flatMap((r) => r.mots.map((i) => b.donnees.lignes[r.ligne].mots[i].mot))).toEqual(b.donnees.lignes.flatMap((x) => x.mots.map((m) => m.mot)));
          for (const r of rs) {
            const ou = `${nom} ${format} ${b.id} rangée ${r.ligne}`;
            expect(r.y, ou).toBeGreaterThanOrEqual(z.haut - 1e-6);
            expect(r.y + r.taille, ou).toBeLessThanOrEqual(z.bas + 1e-6);
            expect(r.largeur, ou).toBeLessThanOrEqual(920 + 1e-6);
            expect(r.taille, ou).toBeGreaterThanOrEqual(58);
            if (r.mots.some((i) => b.donnees.lignes[r.ligne].mots[i].orange)) expect(r.taille, ou).toBeGreaterThanOrEqual(96);
          }
        }
      }
      const lb = mettreEnSceneIV({ ...entree, variete: recetteTexte("TYP-B") }).ligne;
      for (const b of blocsTexte(lb).filter((x) => x.code === "TYP-B")) for (const m of b.donnees.lignes.flatMap((x) => x.mots)) expect(tailleMotGeant(m.mot, 860, 620), `${nom} ${m.mot}`).toBeGreaterThanOrEqual(150);
    }
  });
});

// ── Défauts visuels de la vidéo v-0339175a9f88 (25/10/2026, compositions-iv/11) : D4 et D5 ───────────────────────────
describe("typo · TYP-C : rangées serrées, expression gardée d'un bloc (D4, D5)", () => {
  const ligne = (texte: string): LigneEcrite => ({ texte, t: 0, mots: texte.split(" ").map((mot, i) => ({ mot, t: i * 0.3, dit: true })) });
  const zones = { 1350: zonesTexte(1350), 1920: zonesTexte(1920) } as const;

  it("D5 · « Au matin » reste sur UNE rangée en 4:5 (il tient à 268 px, il n'est plus coupé en AU / MATIN)", () => {
    const z = zones[1350];
    expect(rangeesTexte([ligne("Au matin")], z.haut, z.bas, 920, 280)).toHaveLength(1);
  });

  for (const hauteur of [1350, 1920] as const) {
    for (const textes of [["Avant même d'avoir commencé"], ["Voici", "comment"]]) {
      it(`D4 · cadre ${hauteur} · ${textes.join(" / ")} : trou entre deux rangées ≤ 0,46 × taille, filet compris dans la zone`, () => {
        const z = zones[hauteur];
        const rs = rangeesTexte(textes.map(ligne), z.haut, z.bas, 920, 280);
        expect(rs.length).toBeGreaterThan(0);
        rs.forEach((r, k) => {
          if (k > 0) {
            const prec = rs[k - 1];
            expect(r.y - (prec.y + prec.taille), `trou avant la rangée ${k}`).toBeLessThanOrEqual(0.46 * prec.taille + 1e-6);
          }
          // Le filet de la rangée (lignes.tsx : top + taille + 12, 6 px de haut) reste dans la zone.
          expect(r.y + r.taille + 18, `rangée ${k}`).toBeLessThanOrEqual(z.bas + 1e-6);
        });
      });
    }
  }
});

describe("typo · TYP-C : ponctuation isolée rattachée au mot précédent", () => {
  const mot = (m: string, i: number, orange = false) => ({ mot: m, t: i * 0.3, dit: true, ...(orange ? { orange: true as const } : {}) });
  const z = zonesTexte(1350);
  const textesRangees = (l: LigneEcrite[]) => rangeesTexte(l, z.haut, z.bas, 920, 280).map((r) => r.mots.map((k) => l[r.ligne].mots[k].mot));

  it("reconnaît ? ! : ; % … et ..., avec ou sans espace (normale, insécable fine ou non), jamais un vrai mot", () => {
    for (const p of ["?", "!", ":", ";", "%", "…", "...", "\u00a0?", " ?", "\u202f!", "?!", "»", "\u00a0»", ")", "”", "’"]) expect(estPonctuationIsolee(p), JSON.stringify(p)).toBe(true);
    for (const p of ["oui?", "80", "%a", "a", ""]) expect(estPonctuationIsolee(p), JSON.stringify(p)).toBe(false);
  });

  for (const p of ["?", "!", ":", ";", "%", "…"]) {
    it(`« ${p} » après un mot orange : même rangée que lui, jamais seul`, () => {
      const l: LigneEcrite[] = [{ texte: `Quoi ${p}`, t: 0, mots: [mot("Quoi", 0), mot("neuf", 1, true), mot(p, 2)] }];
      const rs = textesRangees(l);
      expect(rs.some((r) => r.length === 1 && r[0] === p)).toBe(false);
      expect(rs.find((r) => r.includes(p))).toContain("neuf");
    });
    it(`« ${p} » en fin de phrase longue : jamais en tête de rangée`, () => {
      const l: LigneEcrite[] = [{ texte: "x", t: 0, mots: ["Pourquoi", "personne", "ne", "vous", "rappelle", "jamais", "après", "la", "séance", p].map((m, i) => mot(m, i)) }];
      for (const r of textesRangees(l)) expect(estPonctuationIsolee(r[0]), r.join(" ")).toBe(false);
    });
  }

  it("guillemet fermant après un mot orange : même rangée que lui, jamais seul", () => {
    const l: LigneEcrite[] = [{ texte: "Quoi ? »", t: 0, mots: [mot("Quoi", 0), mot("neuf", 1, true), mot("?", 2, true), mot("»", 3)] }];
    const rs = textesRangees(l);
    expect(rs.some((r) => r.every((m) => estPonctuationIsolee(m)))).toBe(false);
    expect(rs.find((r) => r.includes("»"))).toContain("neuf");
  });

  it("ponctuation en tête de ligne suivie d'un mot orange : pas de rangée de ponctuation seule", () => {
    for (const p of ["…", "?", "«"]) {
      const l: LigneEcrite[] = [{ texte: `${p} neuf`, t: 0, mots: [mot(p, 0), mot("neuf", 1, true), mot("tôt", 2)] }];
      const rs = textesRangees(l);
      expect(rs.some((r) => r.every((m) => estPonctuationIsolee(m))), p).toBe(false);
      expect(rs.flat()).toEqual([p, "neuf", "tôt"]);
    }
  });

  it("point d'exclamation et deux-points isolés : le texte affiché garde l'ordre et tous les mots", () => {
    const l: LigneEcrite[] = [{ texte: "Attention : stop !", t: 0, mots: [mot("Attention", 0), mot(":", 1), mot("stop", 2, true), mot("!", 3)] }];
    expect(textesRangees(l).flat()).toEqual(["Attention", ":", "stop", "!"]);
  });

  it("un texte sans ponctuation isolée est coupé comme avant", () => {
    const l: LigneEcrite[] = [{ texte: "x", t: 0, mots: [mot("Au", 0), mot("matin", 1, true), mot("tôt", 2)] }];
    expect(textesRangees(l)).toEqual([["Au"], ["matin"], ["tôt"]]);
  });
});
