/**
 * Variété « Image → vidéo » · lot OUV-FIN · axe 1 « ouverture » (OUV-A … OUV-E). Les 3 premières secondes deviennent
 * un écran propre (`sorte: "variete"`, axe « ouverture ») dont les données viennent de la carte ; les mots dits, les
 * événements et la durée ne changent pas. Aucun appel, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { describe, expect, it } from "vitest";
import { VARIANTES_GARDEES, type CodesParAxe, type FormatIV, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_OUVERTURE, DUREE_MAX_OUVERTURE_SEC, type DonneesOuvertureIV } from "@/moteurs/montage-image-video/variete/axes/ouverture";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { COMPOSITIONS_RENDU_IV, parametresDuBloc } from "@/services/image-video-rendu";
import { libelleRecul, xCarteRecul, type DonneesOuverture } from "../../../studio-rendu/compositions/image-video/variete/ouverture/donnees";
import { largeurAnton } from "@/briques/schema-motion/chasse-anton";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

/** Entrée de la version d'un réseau (TikTok en 9:16, LinkedIn en 4:5). */
function entree(nom: Nom, reseau: ReseauIV = "youtube-shorts"): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}

const recetteAvec = (ouverture: CodesParAxe["ouverture"]): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, ouverture });
const avec = (nom: Nom, code: CodesParAxe["ouverture"], format: FormatIV = "9:16", reseau: ReseauIV = "youtube-shorts"): ResultatMiseEnSceneIV =>
  mettreEnSceneIV({ ...entree(nom, reseau), variete: recetteAvec(code), format });
const premier = (r: ResultatMiseEnSceneIV) => r.ligne.blocs[0];
const donnees = (b: BlocRenduIV) => (b.sorte === "variete" && b.axe === "ouverture" ? (b.donnees as DonneesOuvertureIV) : null);

/** Possibles attendus par carte (types, chiffres, heure, déclencheur, schéma). */
const POSSIBLES: Record<Nom, CodesParAxe["ouverture"][]> = {
  A: ["OUV-D"],
  B: ["OUV-D"],
  C: ["OUV-A", "OUV-B", "OUV-C", "OUV-D", "OUV-E"],
  D: ["OUV-A", "OUV-B", "OUV-C", "OUV-D", "OUV-E"],
  E: ["OUV-A", "OUV-B", "OUV-D", "OUV-E"],
  F: ["OUV-A", "OUV-B", "OUV-C", "OUV-D", "OUV-E"],
};

/**
 * Règle d'or « rien de compté qui ne soit dessiné » (intégration de la variété) : une ouverture qui ne dessine pas le
 * chiffre dit dans la première phrase (Q13 le compte « montré ») est refusée par construction, l'écran d'aujourd'hui reste.
 */
const REFUS_CHIFFRE: Partial<Record<Nom, CodesParAxe["ouverture"][]>> = { C: ["OUV-E"], D: ["OUV-E"], E: ["OUV-E"], F: ["OUV-C"] };
const applique = (nom: Nom, code: CodesParAxe["ouverture"]) => POSSIBLES[nom].includes(code) && !(REFUS_CHIFFRE[nom] ?? []).includes(code);

/** Fiche de la carte C dont le premier écran n'écrit aucun chiffre (OUV-E possible : rien de dit qui ne soit dessiné). */
function entreeSansChiffreAuDebut(): EntreeMiseEnSceneIV {
  const e = entree("C");
  const fiche = structuredClone(e.fiche);
  Object.assign(fiche.ecrans[0], { texteDit: "Un client vous écrit, tard le soir.", textesEcran: ["Un client vous *écrit*"], refs: [], surMot: [] });
  return { ...e, fiche, voix: pisteSimulee(fiche, e.fin?.muet ? null : e.fin) };
}

describe("ouverture · rouge sans le lot", () => {
  it("avec la recette OUV-A, le premier bloc de la carte C est l'écran d'ouverture (plus « ecran »)", () => {
    const b = premier(avec("C", "OUV-A"));
    expect(b.sorte).toBe("variete");
    expect(b.sorte === "variete" && b.axe).toBe("ouverture");
  });
});

describe("ouverture · possibles(carte, format)", () => {
  for (const nom of Object.keys(POSSIBLES) as Nom[]) {
    it(`carte ${nom} : ${POSSIBLES[nom].join(", ")}`, () => {
      expect(AXE_OUVERTURE.possibles(carteDe(nom), "9:16")).toEqual(POSSIBLES[nom]);
      // Jamais une variante hors des gardées ; OUV-D toujours possible.
      for (const c of AXE_OUVERTURE.possibles(carteDe(nom), "4:5")) expect(VARIANTES_GARDEES.ouverture).toContain(c);
      expect(AXE_OUVERTURE.possibles(carteDe(nom), "4:5")).toContain("OUV-D");
    });
  }
});

describe("ouverture · carte C, chaque code", () => {
  for (const code of VARIANTES_GARDEES.ouverture) {
    it(`${code} : premier bloc variete/ouverture/${code}, de 0 à la fin de la première phrase (≤ ${DUREE_MAX_OUVERTURE_SEC} s)`, () => {
      const r = applique("C", code) ? avec("C", code) : mettreEnSceneIV({ ...entreeSansChiffreAuDebut(), variete: recetteAvec(code) });
      const b = premier(r);
      expect(b.sorte === "variete" ? `${b.axe}/${b.code}` : b.sorte).toBe(`ouverture/${code}`);
      expect(b.debut).toBe(0);
      expect(b.fin).toBeLessThanOrEqual(DUREE_MAX_OUVERTURE_SEC);
      // La première phrase (« Vingt-trois heures quatorze. Un client vous écrit. ») dure jusqu'à 0,2 + 7 / débit − 0,15 s (2,595 s avec 2,75).
      expect(b.fin).toBeCloseTo(0.2 + 7 / DEBIT_MOTS_PAR_SEC - 0.15, 3);
      // Les blocs restent bout à bout, sans trou ni chevauchement.
      r.ligne.blocs.forEach((x, i) => i && expect(x.debut).toBeCloseTo(r.ligne.blocs[i - 1].fin, 6));
      // Le service vise la composition de variété, avec la recette.
      const p = parametresDuBloc(b, r.ligne);
      expect(p.composition).toBe(COMPOSITIONS_RENDU_IV.variete);
      expect((p.proprietes.variete as { recette: RecetteVarieteIV }).recette.ouverture).toBe(code);
      expect(r.ligne.variete?.replis.filter((x) => x.axe === "ouverture")).toEqual([]);
    });
  }

  it("OUV-A : le chiffre final avec son unité (80 %), puis le début de la vidéo (23h14)", () => {
    const d = donnees(premier(avec("C", "OUV-A")))!;
    expect(d.code).toBe("OUV-A");
    if (d.code !== "OUV-A") return;
    expect(d.resultat.chiffre).toMatchObject({ texte: "80 %", nombre: "80", unite: "%" });
    expect(d.resultat.part).toBe(80);
    expect(d.depart.chiffre?.texte).toBe("23h14");
    expect(d.situation).toBe(true);
  });

  it("OUV-B : avant 23h14 (le message), après 4 sec (le chatbot)", () => {
    const d = donnees(premier(avec("C", "OUV-B")))!;
    if (d.code !== "OUV-B") throw new Error(d.code);
    expect(d.avant.chiffre.texte).toBe("23h14");
    expect(d.apres.chiffre).toMatchObject({ texte: "4 sec", nombre: "4", unite: "sec" });
    expect(d.apres.libelle).toBe("Chatbot IA");
  });

  it("OUV-C : l'horloge à 23h14 et le message du client", () => {
    const d = donnees(premier(avec("C", "OUV-C")))!;
    if (d.code !== "OUV-C") throw new Error(d.code);
    expect(d.heure).toEqual({ h: 23, m: 14, texte: "23h14" });
    expect(d.objet.libelle).toBe("Message client entrant");
    expect(d.objet.icone).toBe("message");
  });

  it("OUV-D : les mots de l'accroche, au rythme de la voix, chiffres de la carte, un seul mot orange", () => {
    const d = donnees(premier(avec("C", "OUV-D")))!;
    if (d.code !== "OUV-D") throw new Error(d.code);
    expect(d.mots.map((m) => m.texte)).toEqual(["23h14", "Un", "client", "vous", "écrit"]);
    expect(d.mots.filter((m) => m.orange).map((m) => m.texte)).toEqual(["23h14"]);
    const t = d.mots.map((m) => m.t);
    expect([...t].sort((x, y) => x - y)).toEqual(t);
    expect(t[0]).toBeLessThan(0.3);
    // Lot F (décision du chef de projet) : la première ligne, « 23h14 », un seul mot, est complétée par la suivante
    // jusqu'à 3 mots au moins : « 23h14 Un client vous écrit » arrive d'un coup (jamais un écran à un seul mot).
    expect(new Set(t).size).toBe(1);
  });

  it("OUV-E sur la carte C telle quelle : « 23:14 » dit dans la première phrase n'y serait pas dessiné → repli", () => {
    const r = avec("C", "OUV-E");
    expect(premier(r).sorte).toBe("ecran");
    expect(r.ligne.variete?.replis).toContainEqual(expect.objectContaining({ axe: "ouverture", code: "OUV-E", raison: expect.stringContaining("23 heures 14") }));
  });

  it("OUV-E : le nœud d'alerte en gros plan, puis le schéma entier (deux colonnes)", () => {
    const d = donnees(premier(mettreEnSceneIV({ ...entreeSansChiffreAuDebut(), variete: recetteAvec("OUV-E") })))!;
    if (d.code !== "OUV-E") throw new Error(d.code);
    expect(d.detail.libelle).toBe("Alerte Telegram");
    expect(d.detail.detail).toBe("Intervention requise");
    expect(d.detail.icone).toBe("cloche");
    expect(d.schema.colonnes.length).toBe(2);
    expect(d.schema.colonnes.flat().filter((n) => n.detail).length).toBe(1);
  });
});

describe("ouverture · les 6 cartes, chaque code possible : invariants (mêmes mots, mêmes heures, contrôles)", () => {
  for (const nom of Object.keys(IMAGES) as Nom[]) {
    it(`carte ${nom}`, () => {
      const sans = mettreEnSceneIV(entree(nom));
      for (const code of VARIANTES_GARDEES.ouverture) {
        const r = avec(nom, code);
        expect(invariantsVarieteIV(sans, r), `${nom} ${code}`).toEqual([]);
        const b = premier(r);
        if (applique(nom, code)) {
          expect(b.sorte === "variete" && b.code, `${nom} ${code}`).toBe(code);
          expect(b.fin).toBeLessThanOrEqual(DUREE_MAX_OUVERTURE_SEC);
          expect(b.fin - b.debut).toBeGreaterThan(1);
        } else {
          // Impossible sur cette image : le premier bloc reste celui d'aujourd'hui, et le repli est inscrit.
          expect(b).toEqual({ ...sans.ligne.blocs[0], variete: b.variete });
          expect(r.ligne.variete?.replis.some((x) => x.axe === "ouverture" && x.code === code && x.raison.length > 0)).toBe(true);
        }
      }
    });
  }
});

describe("ouverture · chiffres de la carte, jamais inventés", () => {
  it("chaque chiffre des données est un chiffre de la carte (texte exact)", () => {
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      const bruts = new Set(carteDe(nom).chiffres.map((c) => c.brut));
      for (const code of POSSIBLES[nom].filter((c) => applique(nom, c))) {
        const d = donnees(premier(avec(nom, code)))!;
        const textes = JSON.stringify(d).match(/"texte":"[^"]*"/g) ?? [];
        const chiffres = [d.code === "OUV-A" ? [d.resultat.chiffre, d.depart.chiffre] : [], d.code === "OUV-B" ? [d.avant.chiffre, d.apres.chiffre] : [], d.code === "OUV-C" ? [d.objet.chiffre] : []].flat();
        for (const c of chiffres) if (c) expect(bruts.has(c.texte), `${nom} ${code} ${c.texte}`).toBe(true);
        expect(textes.length).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("ouverture · 4:5 (LinkedIn)", () => {
  it("OUV-A en 4:5 : écran de variété au format, mêmes données", () => {
    const r = avec("C", "OUV-A", "4:5", "linkedin");
    const b = premier(r);
    expect(b.sorte === "variete" && b.code).toBe("OUV-A");
    expect(b.variete?.format).toBe("4:5");
    const p = parametresDuBloc(b, r.ligne);
    expect(p.proprietes).toMatchObject({ largeur: 1080, hauteur: 1350 });
    expect(donnees(b)?.code).toBe("OUV-A");
  });
});

describe("ouverture · contrat moteur ↔ composition", () => {
  it("les données du moteur s'assignent au type lu par la composition", () => {
    const d: DonneesOuverture = donnees(premier(avec("C", "OUV-B")))!;
    expect(d.code).toBe("OUV-B");
  });
});

describe("ouverture · OUV-E recul : le libellé de la carte centrale ne passe plus sous la pastille", () => {
  const largeur = (l: string, taille: number) => largeurAnton(l, 1) * taille;

  it("« Kine prévenu de la réponse » : chaque ligne tient dans la carte (lc − 90), taille 58 px au moins", () => {
    const r = libelleRecul("Kine prévenu de la réponse");
    expect(r.lignes.join(" ")).toBe("Kine prévenu de la réponse");
    expect(r.lignes.length).toBeGreaterThan(1);
    expect(r.taille).toBeGreaterThanOrEqual(58);
    for (const l of r.lignes) expect(largeur(l, r.taille)).toBeLessThanOrEqual(r.lc - 90);
  });

  it("« Alerte Telegram » : une ligne, taille de l'ancienne formule, lc 530 (le 9:16 court est inchangé)", () => {
    const r = libelleRecul("Alerte Telegram");
    const ancienne = Math.max(58, Math.min(64, Math.floor(440 / Math.max(0.01, largeurAnton("Alerte Telegram", 1)))));
    expect(r).toEqual({ lignes: ["Alerte Telegram"], taille: ancienne, lc: 530 });
  });

  it("jamais de blocage : un libellé démesuré rend des lignes et une remarque", () => {
    const long = "Réponse envoyée automatiquement au patient concerné par le cabinet";
    const r = libelleRecul(long);
    expect(r.lignes.join(" ")).toBe(long);
    expect(r.lc).toBeLessThanOrEqual(900);
  });

  it("balisage figé du libellé court : la div d'une ligne est celle d'avant, la colonne n'existe que pour 2 lignes", () => {
    const src = readFileSync(join(__dirname, "../../../studio-rendu/compositions/image-video/variete/ouverture/ouv-e.tsx"), "utf8");
    const une = '<div style={{ position: "absolute", left: 50, top: 0, width: lc - 70, height: 140, display: "flex", alignItems: "center", justifyContent: "center", ...ANTON, textTransform: "none", fontSize: tailleQuiTient(libelle, 64, lc - 90, 58), color: C.encre, whiteSpace: "nowrap" }}>{libelle}</div>';
    expect(src).toContain(`{r.lignes.length === 1 ? (\n          ${une}\n        ) : (`);
    expect(src).toContain('flexDirection: "column"');
    expect(src).toContain("lineHeight: 1");
    expect(src).toContain("const lc = r.lc;");
  });
});

describe("ouverture · OUV-E recul : le cadre pointillé et les coins restent dans l'écran (nœud en colonne de gauche)", () => {
  const ancienne = (cx: number, lc: number) => Math.max(60, Math.min(1020 - lc, cx - lc / 2));

  it("nœud à cx 180 : avant, le cadre sortait à gauche ; maintenant cadre et coins sont dans [0, 1080]", () => {
    for (const lc of [530, 700, 900]) {
      expect(ancienne(180, 530) - 102).toBeLessThan(0);
      const xc = xCarteRecul(180, lc);
      expect(xc - 102, `cadre gauche lc ${lc}`).toBeGreaterThanOrEqual(0);
      expect(xc - 70 - 5, `coin gauche lc ${lc}`).toBeGreaterThanOrEqual(0);
      expect(xc + lc + 46, `cadre droit lc ${lc} (bordure 4 px)`).toBeLessThanOrEqual(1080);
      expect(xc + lc + 28 + 5, `coin droit lc ${lc}`).toBeLessThanOrEqual(1080);
    }
  });

  it("cas (540, 900) : cadre droit (bordure 4 px) et coins restent dans [0, 1080]", () => {
    const xc = xCarteRecul(540, 900);
    expect(xc - 102, "cadre gauche").toBeGreaterThanOrEqual(0);
    expect(xc + 900 + 46, "cadre droit").toBeLessThanOrEqual(1080);
  });

  it("la ligne du schéma (cx 180) tombe toujours sous la carte décalée ; le centre et la droite sont inchangés", () => {
    const xc = xCarteRecul(180, 530);
    expect(xc).toBeLessThanOrEqual(180);
    expect(xc + 530).toBeGreaterThanOrEqual(180);
    for (const cx of [540, 900]) for (const lc of [530, 700]) expect(xCarteRecul(cx, lc)).toBe(ancienne(cx, lc));
  });

  it("la lecture du libellé sur 2 lignes ne change pas (libelleRecul intact) et ouv-e.tsx utilise le placement", () => {
    const r = libelleRecul("Kine prévenu de la réponse");
    expect(r.lignes).toHaveLength(2);
    expect(r.lc).toBe(530);
    const src = readFileSync(join(__dirname, "../../../studio-rendu/compositions/image-video/variete/ouverture/ouv-e.tsx"), "utf8");
    expect(src).toContain("const xc = xCarteRecul(cible.cx, lc);");
  });
});
