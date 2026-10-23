/**
 * 17/10 · Prod (master 78b4555 puis d8fb3b1) : carte « chatbot support client » (comme la carte C), voix du 15/10 enfin
 * acceptée (#283), puis MISE EN SCÈNE refusée sur les 5 réseaux, IV_MISE_EN_SCENE non réessayable :
 *   « le bloc « Réponse générée » n'apparaît jamais (et 13 autres) », « le chiffre « 23 heures 14 » est dit à 2,6 s
 *   (écran e02) mais n'apparaît pas à l'écran à ce moment-là », « de 2,1 s à 9,8 s, rien de nouveau n'apparaît ».
 *
 * Diagnostic sans données de prod :
 * 1. Les fixtures A-F passent (mise-en-scene*.test.ts, moteur.test.ts, rendu-reel.test.ts) ; aucun fichier de la mise
 *    en scène n'a changé depuis le 15/10 (16ac9bd) : seuls `assemblage.ts` (#283) et `ecriture.ts` (coût) ont bougé.
 * 2. La voix n'y est pour rien : une reprise depuis l'étape voix (état gardé en JSON) rattache chaque mot à son écran,
 *    et Q12 (« bloc jamais montré ») ne dépend d'AUCUNE heure (voix étirée, mots inconnus, décalée : jamais Q12).
 * 3. La fiche, si : la scène « micro-objet » est permise à Claude sur TOUTE carte (`SCENES_COMMUNES`), mais la mise en
 *    scène ne la dessinait que pour un bloc « bénéfice ». Sur une carte sans bénéfice (C), un écran « micro-objet »
 *    n'affiche rien : bloc jamais montré, chiffre dit sans être montré, rythme trop lent — les trois refus de la prod,
 *    avec une voix parfaite. Correctif : un écran de bénéfice (« micro-objet », « carte-benefice ») qui ne cite aucun
 *    bénéfice est mis en scène sur la toile.
 */
import { describe, expect, it, vi } from "vitest";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { diagnostiquerMiseEnSceneIV, diagnostiquerVersionIV } from "@/moteurs/montage-image-video/diagnostic";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { attendWillIV, avancerJusquAArretIV, BRUITAGES_V4_IV, entreesMiseEnSceneIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";

vi.setConfig({ testTimeout: 120_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Image = keyof typeof IMAGES;

function entreeDe(nom: Image, fiche: FicheImage = FICHES_SIMULEES[IMAGES[nom]], reseau = "youtube-shorts"): EntreeMiseEnSceneIV {
  const carte = carteFixe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau as never))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV };
}

/** Le script de la carte C où l'écran « Il l'écrit, il l'envoie en quatre secondes » (n03, n04, c02) est un micro-objet. */
const ficheMicroObjetC = (): FicheImage => ({ ...FICHES_SIMULEES["essai-c"], ecrans: FICHES_SIMULEES["essai-c"].ecrans.map((e) => (e.id === "e08" ? { ...e, scene: "micro-objet" as const } : e)) });

/** Jusqu'à l'arrêt : carte validée telle quelle, script validé (formules gardées, fiche éventuellement modifiée par Will). */
/**
 * Variété (intégration) : la fabrication tire une recette avant d'écrire, et le récit tiré fixe la forme du script. La
 * fiche modifiée à la main ici suit le récit de référence (REC-A) : la recette de référence est posée dans l'état, comme
 * si elle avait été tirée (une reprise ne retire jamais).
 */
const recitReference = (e: EtatFabricationIV): EtatFabricationIV => ({ ...e, variete: { recette: RECETTE_REFERENCE_IV, par: "tirage", historique: 0 } });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV, fiche?: FicheImage): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules, ...(fiche ? { fiche } : {}) }), o);
    } else break;
  }
  return e;
}

describe("piste 2-3 : la voix (ancien état repris) ne cause pas « le bloc n'apparaît jamais »", () => {
  it("reprise depuis l'étape voix, état gardé en JSON : chaque mot du script est rattaché à son écran, mise en scène acceptée sur les 5 réseaux", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const o = outilsSimules(carte, m);
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(fini.etape).toBe("prete");
    // L'état de prod : voix et pistes gardées, refus posé sur l'étape voix (« Refaire cette partie »).
    const garde = JSON.parse(JSON.stringify({ ...fini, etape: "refusee", refus: { etape: "voix", code: "IV_VOIX", message: "Voix refusée le 15/10.", reessayable: false } })) as EtatFabricationIV;
    delete garde.scenes;
    delete garde.rendus;
    delete garde.controles;
    delete garde.livraison;
    const lus = m.lus.length;
    const repris = await avancerJusquAArretIV(reprendreIV(garde), o, { pasMax: 4 });
    expect(m.lus).toHaveLength(lus);
    expect(repris.refus).toBeUndefined();
    expect(repris.scenes?.length).toBe(fini.scenes?.length);
    const d = diagnostiquerMiseEnSceneIV(garde);
    expect(d.cause).toBe("aucune");
    expect(d.versions.map((v) => v.reseaux.join(","))).toEqual(fini.pistes!.map((p) => p.reseaux.join(",")));
    for (const v of d.versions) {
      expect(v.calage.partCalee).toBe(1);
      expect(v.ecransDesordre).toEqual([]);
      for (const x of v.ecrans) expect(x.cales, `${v.version} ${x.id}`).toBe(x.mots);
    }
  });

  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : voix étirée, décalée, 8 % de mots non reconnus — jamais « le bloc n'apparaît jamais » (Q12 ne lit aucune heure)`, () => {
      const e = entreeDe(nom);
      const abime = (f: (m: MotHorodate, k: number) => MotHorodate) => ({ ...e.voix, mots: e.voix.mots.map(f) });
      for (const voix of [
        abime((m) => ({ ...m, debutSec: m.debutSec * 1.3, finSec: m.finSec * 1.3 })),
        abime((m) => ({ ...m, debutSec: m.debutSec + 0.7, finSec: m.finSec + 0.7 })),
        abime((m, k) => (k % 12 === 5 ? { ...m, mot: "xyz" } : m)),
      ]) {
        const r = mettreEnSceneIV({ ...e, voix: { ...voix, finVoixSec: voix.mots.at(-1)!.finSec, dureeSec: voix.mots.at(-1)!.finSec + 0.5 } });
        expect(r.phrases.join("\n")).not.toMatch(/n'apparaît jamais/);
      }
    });
  }
});

describe("piste 3 bis : un écran « micro-objet » sur une carte sans bénéfice (la cause reproduite)", () => {
  it("carte C, écran e08 en « micro-objet » : mise en scène acceptée, n03 et n04 posés, « 4 secondes » montré sur son mot", () => {
    const r = mettreEnSceneIV(entreeDe("C", ficheMicroObjetC()));
    expect(r.phrases).toEqual([]);
    const refs = new Set(r.ligne.evenements.filter((x) => x.ref).map((x) => x.ref));
    for (const id of ["n03", "n04"]) expect(refs).toContain(id);
  });

  it("diagnostic de la version : voix réelle et voix simulée d'accord, chaque bloc cité est posé", () => {
    const d = diagnostiquerVersionIV({ version: "fin-tiktok", reseaux: ["youtube-shorts"], courte: false, entree: entreeDe("C", ficheMicroObjetC()) });
    expect(d.cause).toBe("aucune");
    expect(d.ecrans.find((x) => x.id === "e08")).toMatchObject({ scene: "micro-objet", jamaisDessines: [], beneficeSansBenefice: true });
  });

  it("bout en bout : script validé par Will avec l'écran « micro-objet » → vidéo prête sur les 5 réseaux (aucun refus IV_MISE_EN_SCENE)", async () => {
    const carte = carteFixe("C");
    const e = await jusquAuBout(recitReference(etatInitialIV(demandeEssai(carte))), outilsSimules(carte, monde()), ficheMicroObjetC());
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(entreesMiseEnSceneIV(e)).toHaveLength(e.pistes!.length + (e.courtes ?? []).filter((c) => c.resultat).length);
  });

  it("les 6 fixtures A-F restent acceptées (aucun écran de bénéfice sans bénéfice n'y change)", () => {
    for (const nom of Object.keys(IMAGES) as Image[]) for (const r of ["youtube-shorts", "linkedin"]) expect(mettreEnSceneIV(entreeDe(nom, undefined, r)).phrases, `${nom} ${r}`).toEqual([]);
  });
});
