/**
 * FIN-C (boucle) dessine la phrase-choc (relecture finale du 23/10/2026, v-6e4a06b9c718 : « phrase-choc absente de toute
 * la vidéo », cause D). L'axe « fin » promet que la phrase reste MOT POUR MOT, aux mêmes heures ; `fin-c.tsx` ne passait à
 * l'ouverture reprise que `boucle`, `heure`, `deja` : `phrase`, `mots`, `heures`, `lignes` n'étaient jamais dessinés, et
 * le test `dessin-du-plan.ts` les comptait pourtant comme dessinés (toute chaîne des données comptait).
 *
 *  1. ce que dessine VRAIMENT un composant de fin (lu dans son source) : FIN-C comme FIN-D lisent la phrase ;
 *  2. le plan : sur les 6 cartes, FIN-C posé avec chaque ouverture, aucun compte de contrôle sans dessin ;
 *  3. la POSITION : chaque zone de phrase (table partagée avec les composants) reste hors de la bande des sous-titres et
 *     au-dessus de 1536 px en 9:16, et la vraie phrase y tient (sans repli, sans ligne plus large que la zone) ;
 *  4. le dessin réel (rendu statique React de `studio-rendu`) : pour chacune des 5 ouvertures reprises, en 9:16 et en
 *     4:5, la phrase arrive mot pour mot à ses heures (jamais un mot avant son heure), un SEUL mot orange (« 3h »).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_DUO } from "@/briques/habillage/charte-duo";
import { CADRES_IV, type CodesParAxe, type FormatIV, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import type { DonneesFinIV } from "@/moteurs/montage-image-video/variete/axes/fin";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import type { DonneesFin } from "../../studio-rendu/compositions/image-video/variete/fin/donnees";
import { FinC } from "../../studio-rendu/compositions/image-video/variete/fin/fin-c";
import type { ChiffreOuverture, DonneesOuverture } from "../../studio-rendu/compositions/image-video/variete/ouverture/donnees";
import { largeurAnton } from "@/briques/schema-motion/chasse-anton";
import { disposerPhraseDetail } from "../../studio-rendu/compositions/image-video/variete/fin/fin-d";
import { ZONES_PHRASE, zonePhrase } from "../../studio-rendu/compositions/image-video/variete/ouverture/phrase-choc";
import { TAILLES_DUO } from "@/briques/habillage/charte-duo";
import { BANDE_SOUS_TITRES_IV, DECALAGE_REFERENCE_4X5_PX, MISE_EN_PAGE_IV } from "@/briques/schema-motion/types";
import { coupePhraseChoc, INTERLIGNE_IV, largeurLignePhraseChoc, MARGE_IV, planPhraseChoc, RESERVE_MARQUE_PHRASE_CHOC, zonePhraseChocIV } from "@/briques/schema-motion/plan-objets";
import { ecransDuScript } from "@/moteurs/montage-image-video/script-colle";
import { champsDessinesParLaFin, comptesNonDessines } from "./dessin-du-plan";

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

function entree(nom: Nom, reseau: ReseauIV): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const avec = (nom: Nom, ouverture: CodesParAxe["ouverture"], format: FormatIV): ResultatMiseEnSceneIV =>
  mettreEnSceneIV({ ...entree(nom, format === "4:5" ? "linkedin" : "youtube-shorts"), variete: { ...RECETTE_REFERENCE_IV, fin: "FIN-C", ouverture } satisfies RecetteVarieteIV, format });
const blocFin = (r: ResultatMiseEnSceneIV) => r.ligne.blocs.find((b): b is Extract<BlocRenduIV, { sorte: "variete" }> => b.sorte === "variete" && b.axe === "fin");

describe("FIN-C · ce que dessine le composant de fin (lu dans son source)", () => {
  it("FIN-C lit la phrase, les mots, les heures et les lignes (avant : seulement boucle, heure, deja)", () => {
    expect(champsDessinesParLaFin("FIN-C")).toEqual(expect.arrayContaining(["phrase", "mots", "heures", "lignes", "boucle", "heure", "deja"]));
  });
  it("FIN-D lit le chiffre, la part et la phrase entière", () => {
    expect(champsDessinesParLaFin("FIN-D")).toEqual(expect.arrayContaining(["phrase", "mots", "heures", "lignes", "chiffre", "part"]));
  });
});

describe("FIN-C · le plan : rien de compté sans dessin", () => {
  const poses: Record<string, number> = {};
  for (const nom of Object.keys(IMAGES) as Nom[]) {
    for (const ouv of ["OUV-A", "OUV-B", "OUV-C", "OUV-D", "OUV-E"] as const) {
      it(`carte ${nom}, FIN-C sur ${ouv} (9:16) : la phrase-choc est dans le dessin du bloc de fin`, () => {
        const r = avec(nom, ouv, "9:16");
        const b = blocFin(r);
        // Repli sur FIN-A : inscrit dans `replis` (fin.test.ts), jamais silencieux.
        if (!b) {
          expect(r.ligne.variete?.replis.some((x) => x.axe === "fin" && x.code === "FIN-C" && x.raison.length > 0), `${nom} ${ouv}`).toBe(true);
          return;
        }
        poses[ouv] = (poses[ouv] ?? 0) + 1;
        const d = b.donnees as DonneesFinIV;
        expect(d.phrase.replace(/\*/g, "").replace(/[.,!?…;:]+(?=\s|$)/gu, "")).toBe(d.mots.map((m) => m.replace(/[.,!?…;:]+$/u, "")).join(" "));
        expect(comptesNonDessines(r, carteDe(nom))).toEqual([]);
      });
    }
  }
  it("FIN-C est bien posé (pas seulement replié) avec OUV-A, B, C et D sur au moins une carte", () => {
    for (const ouv of ["OUV-A", "OUV-B", "OUV-C", "OUV-D"] as const) expect(poses[ouv] ?? 0, ouv).toBeGreaterThan(0);
  });
});

/* ---------- la position ---------- */

/** Bande des sous-titres (qui restent affichés pendant FIN-C) et hauteur utile : lues dans `CADRES_IV`, pas recopiées. */
/** Repère du cadre 4:5 réduit de `Ecran` : échelle 0,98 et décalage de 170 − 262 × 0,98 px. */
const versCadre = (y: number, cadre45: boolean) => (cadre45 ? y * 0.98 + 170 - 262 * 0.98 : y);
const FORMATS_OUV: Record<string, string> = { A: "OUV-A", B: "OUV-B", "C-horloge": "OUV-C-horloge", "C-telephone": "OUV-C-telephone", D: "OUV-D", E: "OUV-E" };

describe("FIN-C · la position de la phrase", () => {
  it("la table couvre les 6 dessins × 2 formats", () => {
    expect(Object.keys(ZONES_PHRASE).sort()).toEqual(Object.values(FORMATS_OUV).flatMap((o) => [`${o}|4:5`, `${o}|9:16`]).sort());
  });
  for (const ouv of Object.values(FORMATS_OUV)) {
    for (const format of ["9:16", "4:5"] as const) {
      const z = zonePhrase(ouv, format);
      it(`${ouv} (${format}) : le cadre (plaque comprise) ne touche pas la bande des sous-titres et reste au-dessus du bas utile`, () => {
        const haut = versCadre(z.y - z.plaque, z.cadre45);
        const bas = versCadre(z.y + z.hauteurMax + z.plaque, z.cadre45);
        const { sousTitres, utile } = CADRES_IV[format];
        expect(bas <= sousTitres.haut || haut >= sousTitres.bas, `cadre ${haut.toFixed(1)} → ${bas.toFixed(1)} px, bande ${sousTitres.haut} → ${sousTitres.bas}`).toBe(true);
        expect(bas, "bas du cadre").toBeLessThanOrEqual(utile.bas);
        expect(haut, "haut du cadre").toBeGreaterThanOrEqual(utile.haut);
        // Dans l'écran (largeur 1080) avec la plaque.
        expect(z.x - (z.plaque > 0 ? 28 : 0)).toBeGreaterThanOrEqual(0);
        expect(z.x + z.largeur + (z.plaque > 0 ? 28 : 0)).toBeLessThanOrEqual(1080);
      });
      it(`${ouv} (${format}) : la vraie phrase y tient en entier, sans repli, sans ligne plus large que la zone`, () => {
        const { lignes, repli } = disposerPhraseDetail({ mots: MOTS, lignes: [6, 5] }, z.hauteurMax, z.largeur);
        expect(repli, "repli utilisé : la zone est trop petite pour la phrase").toBe(false);
        const hauteur = lignes.reduce((h, l) => h + l.taille * l.interligne + l.marge, 0);
        expect(hauteur, "hauteur de la phrase").toBeLessThanOrEqual(z.hauteurMax);
        expect(lignes.flatMap((l) => l.mots.map((m) => m.texte))).toEqual(MOTS);
        for (const l of lignes) {
          const largeur = l.mots.reduce((w, m) => w + largeurAnton(m.texte, l.taille), 0) + 0.22 * l.taille * (l.mots.length - 1);
          expect(largeur, l.mots.map((m) => m.texte).join(" ")).toBeLessThanOrEqual(z.largeur);
          expect(l.taille).toBeGreaterThanOrEqual(58);
        }
      });
    }
  }

  it("même avec très peu de hauteur, le repli coupe les lignes à la largeur et garde 58 px", () => {
    const { lignes, repli } = disposerPhraseDetail({ mots: MOTS, lignes: [6, 5] }, 40, 600);
    expect(repli).toBe(true);
    expect(lignes.flatMap((l) => l.mots.map((m) => m.texte))).toEqual(MOTS);
    for (const l of lignes) {
      expect(l.taille).toBe(58);
      expect(l.mots.reduce((w, m) => w + largeurAnton(m.texte, l.taille), 0) + 0.22 * l.taille * (l.mots.length - 1)).toBeLessThanOrEqual(600);
    }
  });
});

/* ---------- le dessin réel ---------- */

const CH = (texte: string, nombre: string, unite: string, cle: string): ChiffreOuverture => ({ texte, nombre, unite, cle });
const BASE = { situation: false, duree: 2, bascule: 1 } as const;
const OUVERTURES: Record<string, DonneesOuverture> = {
  "OUV-A": { ...BASE, code: "OUV-A", resultat: { chiffre: CH("80 %", "80", "%", "k80"), libelle: "répondus", part: 80 }, depart: { chiffre: null, libelle: "Chatbot IA", icone: null }, suite: [] },
  "OUV-B": { ...BASE, code: "OUV-B", avant: { chiffre: CH("23h14", "23", "h14", "k2314"), libelle: "La boutique est fermée", icone: null }, apres: { chiffre: CH("80 %", "80", "%", "k80"), libelle: "Réponse connue", icone: null } },
  "OUV-C horloge": { ...BASE, code: "OUV-C", heure: { h: 23, m: 14, texte: "23h14" }, objet: { libelle: "Message client", icone: "robot", chiffre: null }, moteur: "robot" },
  "OUV-C téléphone": { ...BASE, code: "OUV-C", heure: null, objet: { libelle: "Message client", icone: "robot", chiffre: null }, moteur: "robot" },
  "OUV-D": { ...BASE, code: "OUV-D", mots: [{ texte: "Que", t: 0, orange: false }, { texte: "faire", t: 0.3, orange: true }], nuit: true, icone: null },
  "OUV-E": { ...BASE, code: "OUV-E", detail: { libelle: "Alerte Telegram", detail: null, icone: null }, suivant: null, schema: { haut: [], colonnes: [] } },
};
const MOTS = ["Votre", "client", "a", "toujours", "une", "réponse.", "Même", "à", "3h", "du", "matin."];
const HEURES = [0.2, 0.5, 0.7, 0.9, 1.3, 1.6, 2.4, 2.7, 3.0, 3.2, 3.6];
const PHRASE = "Votre client a toujours une réponse. Même à *3h* du matin.";

function finC(ouverture: DonneesOuverture): Extract<DonneesFin, { code: "FIN-C" }> {
  return { code: "FIN-C", phrase: PHRASE, mots: MOTS, heures: HEURES, lignes: [6, 5], boucle: ouverture, deja: ouverture.code === "OUV-C" ? CH("24h/24", "24", "h/24", "k24") : null, heure: ouverture.code === "OUV-C" ? { h: 3, m: 0 } : null };
}

const decoder = (s: string) => s.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
/** Les mots de la phrase réellement dessinés : rang, couleur, texte. */
function motsDessines(html: string): { k: number; couleur: string; texte: string }[] {
  return [...html.matchAll(/<span data-mot="(\d+)" style="color:([^"]*)">(.*?)<\/span>/g)].map((m) => ({ k: Number(m[1]), couleur: m[2].toLowerCase(), texte: decoder(m[3]).trim() }));
}
const dessiner = (d: DonneesFin, t: number, format: FormatIV) => renderToStaticMarkup(createElement(FinC, { d: d as Extract<DonneesFin, { code: "FIN-C" }>, t, format }));
const ORANGES = [COULEURS_DUO.orange.toLowerCase(), COULEURS_DUO.orangeVif.toLowerCase()];

describe("FIN-C · le dessin réel : la phrase mot pour mot, un seul mot orange", () => {
  for (const [nom, ouverture] of Object.entries(OUVERTURES)) {
    for (const format of ["9:16", "4:5"] as const) {
      it(`${nom} reprise en boucle (${format}) : toute la phrase à la fin, un seul mot orange « 3h »`, () => {
        const d = finC(ouverture);
        const dessin = motsDessines(dessiner(d, 4, format));
        expect(dessin.map((m) => m.texte)).toEqual(MOTS);
        expect(dessin.map((m) => m.k)).toEqual(MOTS.map((_, i) => i));
        const oranges = dessin.filter((m) => ORANGES.includes(m.couleur));
        expect(oranges.map((m) => m.texte)).toEqual(["3h"]);
      });

      it(`${nom} reprise en boucle (${format}) : un mot à la fois, à son heure, jamais avant`, () => {
        const d = finC(ouverture);
        // Avant le premier mot : le premier seulement (comme FIN-D).
        expect(motsDessines(dessiner(d, 0, format)).map((m) => m.k)).toEqual([0]);
        for (let k = 0; k < MOTS.length; k++) {
          // Juste avant l'heure du mot k : k mots (au moins un) ; à son heure : k + 1 mots, dans l'ordre.
          if (k > 0) expect(motsDessines(dessiner(d, HEURES[k] - 0.1, format)).map((m) => m.k)).toEqual(MOTS.slice(0, Math.max(1, k)).map((_, i) => i));
          const apres = motsDessines(dessiner(d, HEURES[k], format));
          expect(apres.map((m) => m.k)).toEqual(MOTS.slice(0, k + 1).map((_, i) => i));
          expect(apres.at(-1)!.texte).toBe(MOTS[k]);
        }
      });
    }
  }

  it("sans phrase transmise (aperçu, banc), l'ouverture reprise se dessine comme avant : aucun mot de phrase", async () => {
    const { DessinOuverture } = await import("../../studio-rendu/compositions/image-video/variete/ouverture/ecran");
    const html = renderToStaticMarkup(createElement(DessinOuverture, { d: OUVERTURES["OUV-A"], t: 4, format: "9:16", boucle: { heure: null, deja: null } }));
    expect(motsDessines(html)).toEqual([]);
    expect(decoder(html)).toContain("répondus");
  });
});

describe("FIN-C · le dessin réel avec les vraies données du moteur (carte C)", () => {
  for (const ouv of ["OUV-A", "OUV-B", "OUV-C", "OUV-D"] as const) {
    for (const format of ["9:16", "4:5"] as const) {
      it(`${ouv} (${format}) : « Même à 3h du matin. » est dessinée, un seul mot orange`, () => {
        const r = avec("C", ouv, format);
        const b = blocFin(r);
        expect(b, `FIN-C posé sur ${ouv} en ${format} (sinon repli sur FIN-A)`).toBeDefined();
        const d = b!.donnees as DonneesFinIV;
        const dessin = motsDessines(dessiner(d as DonneesFin, b!.fin - b!.debut, format));
        expect(dessin.map((m) => m.texte)).toEqual(d.mots);
        expect(dessin.map((m) => m.texte).join(" ")).toBe("Votre client a toujours une réponse. Même à 3h du matin.");
        // Un seul mot orange : celui que la phrase marque (`*mot*`).
        const rang = d.phrase.split(/\s+/).findIndex((m) => /\*/.test(m));
        expect(dessin.filter((m) => ORANGES.includes(m.couleur)).map((m) => m.texte)).toEqual(rang >= 0 ? [d.mots[rang]] : []);
      });
    }
  }
});

/**
 * Phrase-choc de la galerie (K19) en 4:5 et en 9:16 : la phrase finale d'un script collé (cabinet de kinésithérapie,
 * script fictif) tient dans sa zone, au-dessus de la bande des sous-titres, sans ligne plus large que le cadre.
 */
describe("phrase-choc de la galerie · zone, sous-titres et largeur", () => {
  const SCRIPT = "Vous gérez une petite entreprise. Vous perdez du temps sur des tâches répétitives. Le client attend. Vous gagnez du temps. Votre équipe respire. Merci. Vous perdez du temps chaque jour, alors que tout est fait pour vous.";
  const fin = ecransDuScript(SCRIPT).at(-1)!.join(" ");
  const mots = fin.split(/\s+/);
  const CAS = [
    { nom: "9:16", hauteur: 1920, decalage: 0, bande: BANDE_SOUS_TITRES_IV.haut * 1920 },
    { nom: "4:5", hauteur: 1350, decalage: DECALAGE_REFERENCE_4X5_PX, bande: MISE_EN_PAGE_IV["4:5"].bandeSousTitres.haut * 1350 },
  ];

  it("la phrase finale fait 8 mots au plus, coupée à la virgule, tous les mots du script gardés", () => {
    expect(mots.length).toBeLessThanOrEqual(8);
    expect(fin).toBe("alors que tout est fait pour vous.");
    expect(ecransDuScript(SCRIPT).flat().join(" ")).toBe(SCRIPT);
  });

  for (const c of CAS) {
    it(`${c.nom} : le bas du texte et de la marque est sous le haut de la bande des sous-titres, chaque ligne tient entre les marges, la marque reste dans la zone`, () => {
      const zone = zonePhraseChocIV(c.hauteur);
      const p = planPhraseChoc({ phrase: fin, debut: 0, zone }, 60);
      expect(p.alertes).toEqual([]);
      const hauteur = p.lignes.length * p.taille * INTERLIGNE_IV;
      const haut = (zone.haut + zone.bas - RESERVE_MARQUE_PHRASE_CHOC) / 2 - hauteur / 2;
      const basMarque = haut + hauteur + 24 + 1.2 * TAILLES_DUO.marque * 1920 * 1.5;
      expect(haut).toBeGreaterThanOrEqual(zone.haut);
      expect(basMarque).toBeLessThanOrEqual(zone.bas);
      expect(basMarque - c.decalage).toBeLessThan(c.bande);
      for (const l of p.lignes) expect(largeurLignePhraseChoc(l.map((m) => m.mot), p.taille)).toBeLessThanOrEqual(1080 - 2 * MARGE_IV + 1e-6);
      expect(p.lignes.flat().map((m) => m.mot).join(" ").toUpperCase()).toBe(fin.toUpperCase());
    });
  }

  it("la hauteur du texte est bornée par la zone moins 110 px (4:5)", () => {
    const zone = zonePhraseChocIV(1350);
    const a = coupePhraseChoc("UN DEUX TROIS QUATRE CINQ SIX SEPT HUIT NEUF DIX ONZE DOUZE TREIZE QUATORZE QUINZE SEIZE".split(" "), zone);
    expect(a.lignes.length * a.taille * INTERLIGNE_IV).toBeLessThanOrEqual(zone.bas - zone.haut - RESERVE_MARQUE_PHRASE_CHOC + 1e-6);
  });

  it("une zone étroite {haut: 400, bas: 900} contraint vraiment : texte plus 110 px de marque dans la zone, plus bas que sans zone", () => {
    const mots16 = "UN DEUX TROIS QUATRE CINQ SIX SEPT HUIT NEUF DIX ONZE DOUZE TREIZE QUATORZE QUINZE SEIZE".split(" ");
    const etroite = { haut: 400, bas: 900 };
    const libre = coupePhraseChoc(mots16);
    const a = coupePhraseChoc(mots16, etroite);
    const hauteurLibre = libre.lignes.length * libre.taille * INTERLIGNE_IV;
    expect(hauteurLibre).toBeGreaterThan(etroite.bas - etroite.haut - RESERVE_MARQUE_PHRASE_CHOC);
    expect(a.lignes.length * a.taille * INTERLIGNE_IV).toBeLessThanOrEqual(etroite.bas - etroite.haut - RESERVE_MARQUE_PHRASE_CHOC + 1e-6);
    expect(a.taille).toBeLessThan(libre.taille);
  });

  it("zonePhraseChocIV(1350) reste calculée depuis la mise en page 4:5 : 180 → 1075", () => {
    const z = zonePhraseChocIV(1350);
    expect(z.haut).toBeCloseTo(180, 6);
    expect(z.bas).toBeCloseTo(1075, 6);
  });

  it("aucun mot : pas d'alerte, pas de ligne", () => {
    const a = coupePhraseChoc([]);
    expect(a.alerte).toBeNull();
    expect(a.lignes).toEqual([]);
  });
});
