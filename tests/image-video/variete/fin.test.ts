/**
 * Variété « Image → vidéo » · lot OUV-FIN · axe 8 « fin » (FIN-C boucle, FIN-D le chiffre qui reste ; FIN-A référence).
 * Le moment « phrase-choc » devient un écran propre (`sorte: "variete"`, axe « fin ») : la phrase reste mot pour mot,
 * aux mêmes heures ; la fin propre au réseau (banque) n'est pas touchée. Aucun appel, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CodesParAxe, FormatIV, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_FIN, type DonneesFinIV } from "@/moteurs/montage-image-video/variete/axes/fin";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { COMPOSITIONS_RENDU_IV, parametresDuBloc } from "@/services/image-video-rendu";
import type { DonneesFin } from "../../../studio-rendu/compositions/image-video/variete/fin/donnees";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

function entree(nom: Nom, reseau: ReseauIV = "youtube-shorts"): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const avec = (nom: Nom, fin: CodesParAxe["fin"], ouverture: CodesParAxe["ouverture"] = "OUV-D", format: FormatIV = "9:16", reseau: ReseauIV = "youtube-shorts"): ResultatMiseEnSceneIV =>
  mettreEnSceneIV({ ...entree(nom, reseau), variete: { ...RECETTE_REFERENCE_IV, fin, ouverture } satisfies RecetteVarieteIV, format });

type Moment = Extract<BlocRenduIV, { sorte: "moments" }>["moments"][number];
const phraseChoc = (r: ResultatMiseEnSceneIV) => r.ligne.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments.filter((m): m is Extract<Moment, { sorte: "phrase-choc" }> => m.sorte === "phrase-choc").map((m) => ({ b, m })) : []))[0];
const blocFin = (r: ResultatMiseEnSceneIV) => r.ligne.blocs.find((b): b is Extract<BlocRenduIV, { sorte: "variete" }> => b.sorte === "variete" && b.axe === "fin");

describe("fin · rouge sans le lot", () => {
  it("avec la recette FIN-D, la phrase-choc de la carte C est l'écran de fin de variété", () => {
    const b = blocFin(avec("C", "FIN-D"));
    expect(b?.code).toBe("FIN-D");
  });
});

describe("fin · possibles(carte)", () => {
  it("FIN-A et FIN-C partout ; FIN-D seulement avec un chiffre-clé", () => {
    expect(AXE_FIN.possibles(carteDe("A"), "9:16")).toEqual(["FIN-A", "FIN-C"]);
    expect(AXE_FIN.possibles(carteDe("B"), "9:16")).toEqual(["FIN-A", "FIN-C"]);
    for (const nom of ["C", "D", "E", "F"] as const) expect(AXE_FIN.possibles(carteDe(nom), "9:16")).toEqual(["FIN-A", "FIN-C", "FIN-D"]);
  });
});

describe("fin · carte C", () => {
  const sans = mettreEnSceneIV(entree("C"));
  const ref = phraseChoc(sans);

  it("FIN-A : le moment phrase-choc d'aujourd'hui, inchangé", () => {
    const r = avec("C", "FIN-A");
    expect(blocFin(r)).toBeUndefined();
    expect(phraseChoc(r).m).toEqual(ref.m);
  });

  for (const code of ["FIN-C", "FIN-D"] as const) {
    it(`${code} : même place, phrase-choc mot pour mot aux mêmes heures, composition de variété`, () => {
      const r = avec("C", code, "OUV-C");
      const b = blocFin(r)!;
      expect(b.code).toBe(code);
      expect([b.debut, b.fin]).toEqual([ref.b.debut, ref.b.fin]);
      const d = b.donnees as DonneesFinIV;
      expect(d.phrase).toBe(ref.m.phrase);
      expect(d.heures).toEqual(ref.m.heures);
      expect(d.lignes.reduce((x, y) => x + y, 0)).toBe(ref.m.phrase.split(/\s+/).length);
      // Les mots ponctués reprennent la phrase de la carte (mêmes mots, mêmes lettres).
      expect(d.mots.map((m) => m.replace(/[.,!?…;:]+$/u, ""))).toEqual(ref.m.phrase.replace(/\*/g, "").split(/\s+/));
      expect(d.mots.join(" ")).toBe("Votre client a toujours une réponse. Même à 3h du matin.");
      expect(parametresDuBloc(b, r.ligne).composition).toBe(COMPOSITIONS_RENDU_IV.variete);
      // La fin du réseau (banque) reste là, intacte.
      expect(r.ligne.blocs.slice(r.ligne.blocs.indexOf(b) + 1)).toEqual(sans.ligne.blocs.slice(sans.ligne.blocs.indexOf(ref.b) + 1).map((x) => ({ ...x, variete: r.ligne.blocs[0].variete })));
    });
  }

  it("FIN-C sur une version dont l'ouverture est OUV-C : l'horloge revient (boucle), avec un chiffre déjà dit", () => {
    const r = avec("C", "FIN-C", "OUV-C");
    const d = blocFin(r)!.donnees as DonneesFinIV;
    if (d.code !== "FIN-C") throw new Error(d.code);
    expect(d.boucle.code).toBe("OUV-C");
    expect(d.boucle.code === "OUV-C" && d.boucle.heure).toEqual({ h: 23, m: 14, texte: "23h14" });
    // L'horloge marque l'heure de la phrase-choc (3h) ; l'écran montre un chiffre déjà dit (24h/24), jamais « 3h » avant son mot.
    expect(d.heure).toEqual({ h: 3, m: 0 });
    expect(d.deja?.texte).toBe("24h/24");
    const dit = r.ligne.chiffresDits.find((c) => c.cle === d.deja!.cle)!;
    expect(dit.t).toBeLessThan(blocFin(r)!.debut);
  });

  it("FIN-C reprend chaque ouverture tirée", () => {
    for (const ouv of ["OUV-A", "OUV-B", "OUV-D"] as const) {
      const d = blocFin(avec("C", "FIN-C", ouv))!.donnees as DonneesFinIV;
      expect(d.code === "FIN-C" && d.boucle.code).toBe(ouv);
    }
    // Règle d'or (intégration) : OUV-E ne montre pas « 23:14 » dit dans la première phrase → repli ; FIN-C ne reprend
    // jamais une ouverture qui n'a pas été montrée.
    const r = avec("C", "FIN-C", "OUV-E");
    expect(r.ligne.variete?.replis.some((x) => x.axe === "ouverture" && x.code === "OUV-E")).toBe(true);
    const d = blocFin(r)?.donnees as DonneesFinIV | undefined;
    expect(d?.code === "FIN-C" ? d.boucle.code : null).not.toBe("OUV-E");
  });

  it("FIN-D : le chiffre-clé (80 %), déjà dit avant la phrase-choc", () => {
    const r = avec("C", "FIN-D");
    const b = blocFin(r)!;
    const d = b.donnees as DonneesFinIV;
    if (d.code !== "FIN-D") throw new Error(d.code);
    expect(d.chiffre).toMatchObject({ texte: "80 %", nombre: "80", unite: "%" });
    expect(d.part).toBe(80);
    expect(r.ligne.chiffresDits.some((c) => c.cle === d.chiffre.cle && c.t < b.debut)).toBe(true);
  });

  it("FIN-D en 4:5 (LinkedIn) : même écran au format", () => {
    const r = avec("C", "FIN-D", "OUV-A", "4:5", "linkedin");
    const b = blocFin(r)!;
    expect(b.variete?.format).toBe("4:5");
    expect(parametresDuBloc(b, r.ligne).proprietes).toMatchObject({ largeur: 1080, hauteur: 1350 });
  });
});

describe("fin · les 6 cartes : invariants et replis", () => {
  for (const nom of Object.keys(IMAGES) as Nom[]) {
    it(`carte ${nom}`, () => {
      const sans = mettreEnSceneIV(entree(nom));
      for (const code of ["FIN-C", "FIN-D"] as const) {
        for (const ouv of ["OUV-A", "OUV-C", "OUV-D"] as const) {
          const r = avec(nom, code, ouv);
          expect(invariantsVarieteIV(sans, r), `${nom} ${code} ${ouv}`).toEqual([]);
          const b = blocFin(r);
          if (b) {
            const d = b.donnees as DonneesFinIV;
            expect(d.phrase).toBe(phraseChoc(sans).m.phrase);
          } else {
            // Impossible ici : la phrase-choc d'aujourd'hui, et le repli inscrit.
            expect(phraseChoc(r).m).toEqual(phraseChoc(sans).m);
            expect(r.ligne.variete?.replis.some((x) => x.axe === "fin" && x.code === code && x.raison.length > 0), `${nom} ${code} ${ouv}`).toBe(true);
          }
        }
      }
      // FIN-D sur une image à chiffre-clé : toujours posé.
      if (nom !== "A" && nom !== "B") expect(blocFin(avec(nom, "FIN-D"))?.code).toBe("FIN-D");
    });
  }
});

describe("fin · contrat moteur ↔ composition", () => {
  it("les données du moteur s'assignent au type lu par la composition", () => {
    const d: DonneesFin = blocFin(avec("C", "FIN-C", "OUV-C"))!.donnees as DonneesFinIV;
    expect(d.code).toBe("FIN-C");
  });
});
