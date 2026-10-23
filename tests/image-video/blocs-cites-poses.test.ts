/**
 * 17/10 · Prod (après #320) : la mise en scène reste refusée sur les 5 réseaux, voix 100 % calée, cause = la fiche.
 *  (1) Q12 « le bloc X n'apparaît jamais » : un écran « alerte » cite [action, alerte, liens] et ne posait que `refs[0]`
 *      (l'action en amont) : l'alerte elle-même (« Alerte Telegram ») n'était jamais posée.
 *  (2) Q14 « 3,0 s sans rien de nouveau » : l'écran « email » juste avant cite [nœud, lien] et pose un seul objet sur ~4 s.
 * Garde-fou général : tout nœud cité par un écran est posé par lui ou par un autre, quelle que soit la scène.
 */
import { describe, expect, it, vi } from "vitest";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { avancerJusquAArretIV, BRUITAGES_V4_IV, etatInitialIV, validerCarteIV, validerScriptIV, attendWillIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { scenesPermises } from "@/moteurs/montage-image-video/recettes";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";

vi.setConfig({ testTimeout: 240_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Image = keyof typeof IMAGES;

function entreeDe(nom: Image, fiche: FicheImage = FICHES_SIMULEES[IMAGES[nom]], reseau = "youtube-shorts"): EntreeMiseEnSceneIV {
  const carte = carteFixe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau as never))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV };
}

/** Carte C (chatbot) : e12 « email » cite [n07, l07] (seul objet sur son écran), e13 « alerte » cite [n08 action, n09 alerte, l08, l09]. */
function ficheChatbot(): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  par("e11").scene = "toile";
  par("e11").refs = [];
  Object.assign(par("e12"), { scene: "email", refs: ["n07", "l07"] });
  Object.assign(par("e13"), { scene: "alerte", refs: ["n08", "n09", "l08", "l09"] });
  // Un mot ne peut animer qu'un bloc que l'écran cite.
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

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
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((x) => [x.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules, ...(fiche ? { fiche } : {}) }), o);
    } else break;
  }
  return e;
}

describe("alerte : la carte d'alerte est le nœud qui EST l'alerte, les autres nœuds cités sont posés aussi", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : acceptée, n08 et n09 posés, l'alerte dessinée est « Alerte Telegram »`, () => {
      const r = mettreEnSceneIV(entreeDe("C", ficheChatbot(), reseau));
      expect(r.phrases).toEqual([]);
      const refs = new Set(r.ligne.evenements.filter((x) => x.ref).map((x) => x.ref));
      for (const id of ["n07", "n08", "n09"]) expect(refs).toContain(id);
      const alerte = r.ligne.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments : [])).find((m) => m.sorte === "alerte");
      expect(alerte).toMatchObject({ source: "Telegram" });
    });
  }

  it("bout en bout : script validé avec ces écrans → vidéo prête sur les 5 réseaux", async () => {
    const carte = carteFixe("C");
    const e = await jusquAuBout(recitReference(etatInitialIV(demandeEssai(carte))), outilsSimules(carte, monde()), ficheChatbot());
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
  });
});

describe("rythme : un écran « email » ou « alerte » n'a jamais 2,4 s sans rien de nouveau", () => {
  it("aucun refus de rythme (Q14) sur la fiche du chatbot, 5 réseaux", () => {
    for (const reseau of RESEAUX_IV) expect(mettreEnSceneIV(entreeDe("C", ficheChatbot(), reseau)).phrases.filter((p) => /Rythme|rien de nouveau/.test(p)), reseau).toEqual([]);
  });
});

describe("garde-fou : tout nœud cité par un écran est posé (par lui ou par un autre), pour toute scène", () => {
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : chaque scène forcée sur chaque écran citant des nœuds ne laisse aucun bloc jamais posé (Q12)`, () => {
      const base = FICHES_SIMULEES[IMAGES[nom]];
      const carte = carteFixe(nom);
      const permises = [...scenesPermises(carte.types)].filter((s) => s !== "ensemble");
      const ids = new Set(carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => n.id));
      const echecs: string[] = [];
      for (const ecran of base.ecrans.filter((e) => e.refs.some((r) => ids.has(r)))) {
        for (const scene of permises) {
          const fiche = structuredClone(base);
          fiche.ecrans.find((e) => e.id === ecran.id)!.scene = scene as Scene;
          const r = mettreEnSceneIV(entreeDe(nom, fiche));
          const poses = new Set(r.ligne.evenements.filter((x) => x.ref).map((x) => x.ref));
          const cites = new Set(fiche.ecrans.flatMap((e) => e.refs).filter((x) => ids.has(x)));
          const manquants = [...cites].filter((id) => !poses.has(id));
          if (manquants.length) echecs.push(`${ecran.id}→${scene}: ${manquants.join(",")}`);
        }
      }
      expect(echecs).toEqual([]);
    });
  }
});
