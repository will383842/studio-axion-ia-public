/**
 * Variété « Image → vidéo » · lot F (assemblage) : la recette branchée dans la fabrication, et les écarts entre lots
 * corrigés à l'assemblage. Doubles seulement : aucun appel, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES_VARIETE, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { RECETTE_REFERENCE_IV, recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";
import {
  attendWillIV,
  avancerJusquAArretIV,
  changerVarieteIV,
  ErreurDecisionIV,
  etatInitialIV,
  FORMAT_4X5_PRET_IV,
  FORMATS_PAR_RESEAU_IV,
  historiqueVarieteIV,
  lignesDesVersionsIV,
  recettesDesVersionsIV,
  reprendreIV,
  validerCarteIV,
  validerScriptIV,
  variantesPossiblesIV,
  type DecisionScriptIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { segmentsVoixIV } from "@/moteurs/montage-image-video/voix";
import { ressemblanceRecette } from "@/moteurs/montage-image-video/variete/ressemblance";
import { parametresDuBloc } from "@/services/image-video-rendu";
import { passagesIvoireIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { AXE_CAMERA, tempsCoupeCadreIV } from "@/moteurs/montage-image-video/variete/axes/camera";
import { cartesReseaux, changementsVarieteIV, LIBELLES_VARIANTES, lignesVarieteIV } from "@/components/formats/image-video/vue";
import { REFERENCES, tirablesDe, VARIANTES_GARDEES } from "@/briques/schema-motion/variete";
import { carteFixe, demandeEssai, monde, outilsSimules, type Monde, type OptionsMonde } from "../doubles-fabrication";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

/** Entrée TikTok (première version qui le porte) d'une carte des fixtures. */
function entreeTikTok(nom: Nom): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}

describe("assemblage · écarts entre lots", () => {
  it("(f) un bloc `moments` sans repère envoie `repere: null` (sinon le « 1/3 » des propriétés par défaut s'affiche)", { timeout: 60_000 }, () => {
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      const ligne = mettreEnSceneIV(entreeTikTok(nom)).ligne;
      for (const b of ligne.blocs) {
        if (b.sorte !== "moments") continue;
        const p = parametresDuBloc(b, ligne).proprietes as { repere?: unknown };
        expect(p, `${nom} ${b.id}`).toHaveProperty("repere");
        if (!ligne.repere) {
          expect(p.repere, `${nom} ${b.id}`).toBeNull();
          vus++;
        }
      }
    }
    expect(vus).toBeGreaterThan(0);
    // Les propriétés par défaut de la composition des moments n'ont pas de repère.
    const source = readFileSync(join(process.cwd(), "studio-rendu/compositions/image-video/Compositions.tsx"), "utf8");
    expect(source).toMatch(/const momentsDefaut: ProprietesGalerieIV = \{ \.\.\.galerieObjets\(\), repere: null \};/);
  });

  it("(e) OUV-B : les sous-titres gardent leur style clair sur la bande nuit de la couture, même si le plan était ivoire", () => {
    const ligne = mettreEnSceneIV({ ...entreeTikTok("C"), variete: { ...RECETTE_REFERENCE_IV, ouverture: "OUV-B" } }).ligne;
    const ouv = ligne.blocs.find((b) => b.sorte === "variete" && b.axe === "ouverture" && b.code === "OUV-B")!;
    expect(ouv).toBeDefined();
    // Tous les plans ivoire : seul le passage de l'ouverture OUV-B reste clair (texte nuit → style clair).
    const ivoire = { ...ligne, plans: ligne.plans.map((p) => ({ ...p, fond: "ivoire" as const })) };
    const passages = passagesIvoireIV(ivoire);
    expect(passages.some((p) => p.debutSec < ouv.fin - 1e-6 && p.finSec > ouv.debut + 1e-6)).toBe(false);
    expect(passages.at(-1)!.finSec).toBeCloseTo(ligne.plans.at(-1)!.fin, 3);
    // Sans blocs (appel d'avant) : inchangé.
    expect(passagesIvoireIV({ plans: ivoire.plans }).length).toBe(ivoire.plans.filter((p) => p.fin > p.debut).length);
  });

  it("(q) CAM-C : la caméra part plus tôt sans laisser une carte coupée sous l'en-tête plus longtemps que la référence", { timeout: 60_000 }, () => {
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      const entree = entreeTikTok(nom);
      if (!AXE_CAMERA.possibles(entree.carte, "9:16").includes("CAM-C")) continue;
      const ref = mettreEnSceneIV({ ...entree, variete: RECETTE_REFERENCE_IV }).ligne;
      const avec = mettreEnSceneIV({ ...entree, variete: { ...RECETTE_REFERENCE_IV, camera: "CAM-C" } }).ligne;
      for (const b of avec.blocs) {
        if (b.sorte !== "toile" || !(b.variete?.donnees as { camera?: unknown } | undefined)?.camera) continue;
        const r = ref.blocs.find((x) => x.id === b.id)!;
        if (r.sorte !== "toile") continue;
        const d = b.proprietes.dureeSec;
        const mouvements = b.trajectoire.images.length;
        expect(tempsCoupeCadreIV(b, b.trajectoire.images, 0, d), `${nom} ${b.id}`).toBeLessThanOrEqual(tempsCoupeCadreIV(r, r.trajectoire.images, 0, d) + 0.1 * mouvements + 1e-9);
        vus++;
      }
    }
    expect(vus).toBeGreaterThan(0);
  });

  it("(q) CAM-B / CAM-C : un seul en-tête (la scène ne pose pas le sien sous le calque caméra)", () => {
    const scene = readFileSync(join(process.cwd(), "studio-rendu/compositions/image-video/Compositions.tsx"), "utf8");
    expect(scene).toMatch(/\{camC \? null : <EnteteVarie /);
    const calque = readFileSync(join(process.cwd(), "studio-rendu/compositions/image-video/variete/camera/calque.tsx"), "utf8");
    expect(calque).not.toMatch(/!identique \|\| vue \? <Entete/);
    expect(calque).toMatch(/hautCadreDe\(height\)/);
  });

  it("(r) première image d'une toile : carte en haut de la bande ; Q12, Q13 (chiffres), Q15 (caméra), Q22 (sous-titres) tenus sur les 6 cartes, toutes versions, 9:16 et 4:5", { timeout: 60_000 }, () => {
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      const carte = carteDe(nom);
      const fiche = FICHES_SIMULEES[IMAGES[nom]];
      for (const fin of planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins) {
        const entree: EntreeMiseEnSceneIV = { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
        for (const format of ["9:16", "4:5"] as const) {
          const r = mettreEnSceneIV({ ...entree, format });
          // 29/10/2026 : le moteur calcule la toile 4:5 à 1350 px (comme le rendu) et voit donc le vrai défaut de la carte F (16 blocs,
          // trois mots à 12,9 s) : Q15 y reste une REMARQUE (ligne zéro blocage), jamais un refus (`cadrage-moteur-4x5.test.ts`).
          const connu = (l: { code: string; phrase: string; details: string[] }) =>
            l.code === "Q15" && format === "4:5" && nom === "F" && /Au mot du bloc n08 \(12\.877 s\)/.test(l.phrase) && l.details.every((d) => /^séquence b05 : /.test(d) && /12[.,]877? ?s|12,9 s|13,2 s/.test(d));
          const rouges = r.rapport.lignes.filter((l) => ["Q12", "Q13", "Q15", "Q22"].includes(l.code) && !l.ok && !connu(l)).map((l) => `${l.code} ${l.phrase} ${l.details.join(" ")}`);
          expect(rouges, `${nom} ${fin.id} ${format}`).toEqual([]);
          // La première carte de chaque toile est posée en haut de la bande, entière.
          for (const b of r.ligne.blocs) {
            if (b.sorte !== "toile" || !b.proprietes.mots.length || format === "4:5") continue;
            const premier = [...b.proprietes.mots].sort((x, y) => x.t - y.t)[0];
            const boite = b.toile.boites.find((x) => x.id === premier.noeud)!;
            const p = b.trajectoire.images[0];
            const haut = 960 + (boite.y - p.cy) * p.zoom;
            expect(haut, `${nom} ${b.id}`).toBeLessThanOrEqual((b.cadrage.bande?.haut ?? 1) * 1920 + 1.5);
          }
        }
      }
    }
  });

  it("ouverture par format : correspondance fixe, trois ouvertures tirées différentes restent différentes en 9:16", () => {
    const r = (ouverture: RecetteVarieteIV["ouverture"]) => recettePourVersion({ ...RECETTE_REFERENCE_IV, ouverture }, ["youtube-shorts"], "9:16").ouverture;
    expect([r("OUV-E"), r("OUV-D"), r("OUV-B")]).toEqual(["OUV-C", "OUV-D", "OUV-A"]);
    const q = (ouverture: RecetteVarieteIV["ouverture"]) => recettePourVersion({ ...RECETTE_REFERENCE_IV, ouverture }, ["linkedin"], "4:5").ouverture;
    expect([q("OUV-D"), q("OUV-C"), q("OUV-A")]).toEqual(["OUV-B", "OUV-E", "OUV-A"]);
  });

  it("(i) le repère « k/N » passe aussi aux blocs `variete` pendant lesquels il change", () => {
    // Aucune carte des fixtures n'a à la fois un repère et un bandeau de chiffres : la ligne de A (repère) reçoit un
    // bloc `variete` posé sur un de ses changements, et un autre hors de tout changement.
    const ligne = mettreEnSceneIV(entreeTikTok("A")).ligne;
    const r = ligne.repere!;
    expect(r.changements.length).toBeGreaterThan(1);
    const t = r.changements[1].t;
    const bloc = (debut: number, fin: number) => ({ id: "v", debut, fin, sorte: "variete" as const, axe: "chiffres" as const, code: "CHI-D" as const, donnees: { fond: "ivoire" } });
    const p = parametresDuBloc(bloc(t - 1, t + 1), ligne).proprietes as { repere?: { total: number; changements: { t: number; numero: number }[] } };
    expect(p.repere?.total).toBe(r.total);
    expect(p.repere!.changements.map((c) => c.numero)).toEqual(r.changements.map((c) => c.numero));
    expect(p.repere!.changements[1].t).toBeCloseTo(1, 3);
    expect(parametresDuBloc(bloc(ligne.dureeSec + 1, ligne.dureeSec + 2), ligne).proprietes).not.toHaveProperty("repere");
  });
});

/* ------------------------------------------------------------------ */
/* Fabrication complète en doubles                                       */
/* ------------------------------------------------------------------ */

const decisionScript = (e: EtatFabricationIV, plus: Partial<DecisionScriptIV> = {}): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
  ...plus,
});

/** Jusqu'à la vidéo prête (ou un arrêt) : carte et script validés tels quels ; `script` : décision changée par Will. */
async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV, script: (e: EtatFabricationIV) => Partial<DecisionScriptIV> = () => ({})): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-17T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e, script(e))), o);
    else break;
  }
  return e;
}

/** Une fabrication de la carte C, tous réseaux ; `formats` : le 4:5 allumé pour ce test (éteint par défaut). */
function demarrer(o: { videoId?: string; formats?: boolean; historique?: readonly EtatFabricationIV[]; monde?: OptionsMonde } = {}) {
  const carte = carteFixe("C");
  const m: Monde = monde();
  const outils: OutilsFabricationIV = { ...outilsSimules(carte, m, o.monde), historiqueVariete: async () => historiqueVarieteIV(o.historique ?? []) };
  const e = etatInitialIV(demandeEssai(carte, { ...(o.videoId ? { videoId: o.videoId } : {}), ...(o.formats ? { formats: FORMATS_PAR_RESEAU_IV } : {}) }));
  return { carte, m, outils, e };
}

describe("assemblage · la variété dans la fabrication (doubles, aucun appel payant)", { timeout: 240_000 }, () => {
  it("le 4:5 est allumé par défaut (décision de Will du 24/10/2026 : LinkedIn et fil Facebook en 4:5)", () => {
    expect(FORMAT_4X5_PRET_IV).toBe(true);
    expect(etatInitialIV(demandeEssai(carteFixe("C"))).demande.formats).toEqual(FORMATS_PAR_RESEAU_IV);
  });

  it("4 réseaux (4:5 allumé) → 5 fichiers dont Facebook ×2, une seule voix payée, chaque version avec sa recette", async () => {
    const { m, outils, e } = demarrer({ formats: true });
    const fin = await jusquAuBout(e, outils);
    expect(fin.refus).toBeUndefined();
    expect(fin.etape).toBe("prete");
    // Rouge sans le lot : l'état de fabrication porte la recette tirée (avant le lot F, aucune).
    expect(fin.variete?.par).toBe("tirage");
    expect(Object.keys(fin.variete!.recette).sort()).toEqual([...AXES_VARIETE].sort());
    // 4 fichiers rendus (26/10/2026 : Facebook et LinkedIn disent la même fin, le 4:5 est UN fichier commun) : Shorts et
    // Instagram en 9:16, Facebook en Reel 9:16, et le 4:5 de LinkedIn qui est aussi le fil de Facebook.
    const fichiers = new Set(m.rendus.map((r) => r.version));
    expect(fichiers.size).toBe(4);
    const fb = fin.livraison!.find((l) => l.reseau === "facebook")!;
    expect(fb.fichierCle).toBeTruthy();
    expect(fb.fichierCleFil).toBeTruthy();
    expect(fb.fichierCleFil).not.toBe(fb.fichierCle);
    expect(fin.livraison!.find((l) => l.reseau === "linkedin")!.format).toBe("4:5");
    expect(fin.livraison!.find((l) => l.reseau === "linkedin")!.fichierCle).toBe(fb.fichierCleFil);
    expect(m.rendus.filter((r) => r.ligne.hauteur === 1350).length).toBe(1);
    // Une seule voix : autant de lectures (et de réservations HeyGen) que sans le 4:5 ; les versions 4:5 reprennent
    // les pistes du 9:16.
    const seul916 = demarrer();
    await jusquAuBout(seul916.e, seul916.outils);
    expect(m.lus).toEqual(seul916.m.lus);
    expect(m.depenses.filter((d) => d.fournisseur === "heygen").length).toBe(m.lus.length);
    expect(segmentsVoixIV(fin.script!.fiche, fin.plan!).corps.length).toBeGreaterThan(0);
    const pistes = new Map(fin.pistes!.map((p) => [p.version, p.cle]));
    for (const r of m.rendus) expect(pistes.get(r.piste.version), r.version).toBe(r.piste.cle);
    // Chaque version reçoit sa recette (4:5 : substitutions du cadre bas, ouverture de son format).
    const lignes = lignesDesVersionsIV(fin);
    const recettes = recettesDesVersionsIV(fin);
    expect(lignes.length).toBe(4);
    for (const l of lignes) {
      const r = recettes.find((x) => x.version === l.version)!;
      expect(l.ligne.variete?.recette, l.version).toEqual(r.recette);
      expect(l.ligne.variete?.format).toBe(l.format);
      if (l.format === "4:5") expect(["OUV-B", "OUV-E", "OUV-A"]).toContain(r.recette.ouverture);
      // Le récit est celui du script, le même pour toutes les versions.
      expect(r.recette.recit).toBe(fin.variete!.recette.recit);
    }
    // Le récit tiré a été donné à l'écriture (partie variable de l'appel).
    const ecriture = m.appelsClaude.filter((a) => a.role === "ecriture-image-video");
    expect(ecriture.length).toBeGreaterThan(0);
    const recit = fin.variete!.recette.recit;
    for (const a of ecriture) expect(a.variable.includes(`<recit>${recit} `)).toBe(recit !== "REC-A");
    expect(fin.journal.filter((x) => x.startsWith("Variété tirée")).length).toBe(1);
  });

  it("reprise : la recette reste la même après un arrêt (jamais retirée), même avec un autre historique", async () => {
    const { outils, e } = demarrer({ monde: { pannesVoix: [1, 2] } });
    const arret = await jusquAuBout(e, outils);
    expect(arret.etape).toBe("refusee");
    expect(arret.refus?.etape).toBe("voix");
    const avant = arret.variete!;
    const autre = { ...outils, historiqueVariete: async () => [avant.recette, avant.recette] };
    const fin = await jusquAuBout(JSON.parse(JSON.stringify(reprendreIV(arret))), autre);
    expect(fin.etape).toBe("prete");
    // `effective` (recette après replis) est posée à la mise en scène, après l'arrêt : le tirage, lui, ne bouge pas.
    const { effective: _effective, ...tirage } = fin.variete!;
    expect(tirage).toEqual(avant);
    expect(fin.journal.filter((x) => x.startsWith("Variété tirée")).length).toBe(1);
  });

  it("deux vidéos à la suite : la 2ᵉ voit la 1ʳᵉ, ressemblance < 60 %, autre ouverture", async () => {
    const un = demarrer({ videoId: "v-assemblage-1" });
    const premiere = await jusquAuBout(un.e, un.outils);
    expect(premiere.etape).toBe("prete");
    const deux = demarrer({ videoId: "v-assemblage-2", historique: [premiere] });
    const seconde = await jusquAuBout(deux.e, deux.outils);
    expect(seconde.etape).toBe("prete");
    expect(seconde.variete!.historique).toBe(1);
    expect(ressemblanceRecette(seconde.variete!.recette, premiere.variete!.recette)).toBeLessThan(0.6);
    expect(seconde.variete!.recette.ouverture).not.toBe(premiere.variete!.recette.ouverture);
  });

  it("Will change une variante avant la voix ; le récit, déjà dans le script, ne change plus", async () => {
    const { carte, outils, e } = demarrer();
    let etat = await avancerJusquAArretIV(e, outils);
    etat = await avancerJusquAArretIV(validerCarteIV(etat, { proposition: etat.propositionCarte!.empreinte, le: "2026-10-17T08:00:00.000Z" }), outils);
    expect(attendWillIV(etat)).toBe("script");
    const tiree = etat.variete!.recette;
    const possibles = variantesPossiblesIV(carte);
    const matiere = possibles.matiere.find((c) => c !== tiree.matiere) as RecetteVarieteIV["matiere"];
    expect(matiere).toBeDefined();
    expect(() => changerVarieteIV(tiree, { recit: possibles.recit.find((c) => c !== tiree.recit) as RecetteVarieteIV["recit"] }, carte)).toThrow(ErreurDecisionIV);
    expect(() => changerVarieteIV(tiree, { camera: "CAM-D" as never }, carte)).toThrow(ErreurDecisionIV);
    const valide = validerScriptIV(etat, decisionScript(etat, { variete: { matiere } }));
    expect(valide.variete).toMatchObject({ par: "will", recette: { ...tiree, matiere } });
    expect(valide.journal.at(-2)).toMatch(/^Variété changée par Will/);
  });

  it("historique : seules les vidéos prêtes, la plus récente d'abord, au plus 10, sans la vidéo en cours", () => {
    const etat = (videoId: string, etape: EtatFabricationIV["etape"], ouverture = "OUV-A") => ({ etape, demande: { videoId }, variete: { recette: { ouverture } as never, par: "tirage" as const, historique: 0 } });
    const h = historiqueVarieteIV([etat("a", "prete", "OUV-B"), etat("b", "rendu"), etat("c", "prete", "OUV-C"), { etape: "prete", demande: { videoId: "d" } }, ...Array.from({ length: 12 }, (_, i) => etat(`x${i}`, "prete"))], "c");
    expect(h.length).toBe(10);
    expect(h[0].ouverture).toBe("OUV-B");
    expect(h.slice(1).every((r) => r.ouverture === "OUV-A")).toBe(true);
  });
});

describe("assemblage · écrans « Votre script » et « Vos vidéos »", () => {
  it("la recette en libellés (jamais un code), le déroulé figé, seuls les changements partent", () => {
    const carte = carteFixe("C");
    const recette = { ouverture: "OUV-A", recit: "REC-B", chiffres: "CHI-B", camera: "CAM-C", texte: "TYP-C", apparition: "APP-B", transitions: "TRA-C", fin: "FIN-D", matiere: "MAT-B", sousTitres: "SOU-B" } as RecetteVarieteIV;
    const lignes = lignesVarieteIV(recette, variantesPossiblesIV(carte));
    expect(lignes.map((l) => l.axe)).toEqual([...AXES_VARIETE]);
    for (const l of lignes) {
      expect(l.libelle, l.axe).not.toMatch(/[A-Z]{3}-[A-E]/);
      for (const c of l.choix) expect(c.libelle).not.toMatch(/[A-Z]{3}-[A-E]/);
    }
    expect(lignes.find((l) => l.axe === "recit")).toMatchObject({ modifiable: false, choix: [], libelle: "Le résultat, puis « comment »" });
    expect(lignes.find((l) => l.axe === "matiere")!.choix.length).toBeGreaterThan(1);
    expect(changementsVarieteIV(recette, { matiere: "MAT-B", camera: "CAM-B", recit: "REC-C" })).toEqual({ camera: "CAM-B" });
    expect(changementsVarieteIV(recette, {})).toBeUndefined();
    // Chaque variante tirable a son libellé.
    for (const axe of AXES_VARIETE) for (const c of [...tirablesDe(axe), ...VARIANTES_GARDEES[axe], ...(REFERENCES[axe] ? [REFERENCES[axe]!] : [])]) expect(LIBELLES_VARIANTES[c], c).toBeTruthy();
  });

  it("(l) Facebook : la carte montre ses deux fichiers (Reel 9:16 et fil 4:5) ; LinkedIn en 4:5", () => {
    const cartes = cartesReseaux([
      { reseau: "facebook", version: "longue", fichierCle: "final/fb.mp4", dureeSec: 40, fichierCleFil: "final/fb-4x5.mp4", dureeSecFil: 40, texteFil: "Texte du fil", consigneLienFil: "en commentaire" },
      { reseau: "linkedin", version: "longue", fichierCle: "final/li-4x5.mp4", dureeSec: 38, format: "4:5" },
    ]);
    const fb = cartes.find((c) => c.reseau === "facebook")!;
    expect(fb.fichierCle).toBe("final/fb.mp4");
    expect(fb.fil).toEqual({ fichierCle: "final/fb-4x5.mp4", duree: "40 s", texte: "Texte du fil", consigneLien: "en commentaire" });
    expect(cartes.find((c) => c.reseau === "linkedin")).toMatchObject({ format: "4:5", fichierCle: "final/li-4x5.mp4" });
    expect(cartes.find((c) => c.reseau === "linkedin")).not.toHaveProperty("fil");
  });
});

