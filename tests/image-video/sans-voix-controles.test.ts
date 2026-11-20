/**
 * IV-SV · Q19 sans voix : seule la partie « écoute » est sans objet ; le contrôle de scène (la fin laisse le temps de lire,
 * `controles-scene.ts`) reste. Cartes figées, voix simulée, aucun appel payant (aucune écoute en mode sans voix).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import type { VersionAControlerIV } from "@/moteurs/montage-image-video/controles";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { liensSuivisIV, planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { porteUniqueIV, type EntreePorteIV, type OutilsPorteIV } from "@/moteurs/montage-image-video/porte";
import { textesDePublicationIV } from "@/moteurs/montage-image-video/publication";

vi.setConfig({ testTimeout: 60_000 });

// Fin trop courte : la mise en scène réelle laisse toujours la queue voulue ; pour la forcer, le contrôle de la scène relit une
// ligne de temps raccourcie (la ligne rendue, elle, reste celle que donnent le script et la voix).
let queueForcee: number | undefined;
vi.mock("@/moteurs/montage-image-video/controles-scene", async (original) => {
  const m = await original<typeof import("@/moteurs/montage-image-video/controles-scene")>();
  return {
    ...m,
    controlerMiseEnSceneIV: (l: Parameters<typeof m.controlerMiseEnSceneIV>[0], ctx: Parameters<typeof m.controlerMiseEnSceneIV>[1]) =>
      m.controlerMiseEnSceneIV(queueForcee === undefined ? l : { ...l, dureeSec: l.finVoixSec + queueForcee }, ctx),
  };
});

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

function montage(): EntreePorteIV {
  const c: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/A.json"), "utf8"));
  const carte: CarteImage = { ...c, formulesAbsolues: c.formulesAbsolues.map((f) => ({ ...f, choixWill: f.choixWill ?? "garder" })), validation: { par: "will", le: "essai", empreinteCarte: c.image.empreinte } };
  const fiche = FICHES_SIMULEES["essai-a"];
  const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit });
  const versions: VersionAControlerIV[] = plan.fins.map((fin) => {
    const segment = fin.muet ? null : fin;
    const voix = pisteSimulee(fiche, segment, { departSec: 0.1 });
    const piste: PisteVoixSeuleIV = { version: fin.id, reseaux: [...fin.reseaux], courte: false, cle: `voix/${fin.id}.wav`, dureeSec: voix.dureeSec, empreinte: "silence", mots: voix.mots, motsCorps: voix.motsCorps, ...(segment ? { raccordSec: voix.mots[voix.motsCorps]?.debutSec } : {}), finVoixSec: voix.finVoixSec, coupesDeplacees: 0, tempo: 1.05 };
    const scene = { carte, fiche, voix, fin: segment, reseaux: fin.reseaux, bruitagesValides: VALIDES };
    const ligne = mettreEnSceneIV(scene).ligne;
    return { version: fin.id, reseaux: [...fin.reseaux], courte: false, fiche, fin: segment, piste, scene, ligne, mixage: { voix: { empreinte: piste.empreinte } }, fichier: { cle: `final/${fin.id}.mp4`, empreinte: `final-${fin.id}`, mesures: { lufs: -14, creteVraieDbtp: -1.5, noirMaxSec: 0, figeMaxSec: 0, largeur: 1080, hauteur: 1920, fps: 25 } } };
  });
  const liens = liensSuivisIV(RESEAUX_IV, 42);
  const publication = textesDePublicationIV({ accroche: fiche.accroches[0].texteDit, resultat: carte.phraseChoc, questionCommentaire: fiche.questionCommentaire.texteDit }, plan, liens);
  return { videoId: "v-sv", carte, fiche, reseaux: RESEAUX_IV, plan, voix: { issue: { statut: "faite" } }, versions, publication, liens, sansVoix: true } as EntreePorteIV;
}

// Aucun outil payant : s'il est appelé, le test échoue.
const interdit = async (): Promise<never> => {
  throw new Error("aucun appel attendu en mode sans voix");
};
const outilsMuets = { lireSon: interdit, budget: { reserver: interdit }, transcrire: interdit, extraireImages: async () => ({ images: [] }), lireImage: interdit, idAppel: (p: string) => `${p}-1`, appeler: interdit } as unknown as OutilsPorteIV;

describe("IV-SV · Q19 sans voix", () => {
  it("fin qui laisse le temps de lire : Q19 sans objet, aucun blocage", async () => {
    const v = await porteUniqueIV(montage(), outilsMuets);
    for (const x of v.versions) {
      const q19 = x.lignes.find((l) => l.code === "Q19")!;
      expect(q19.etat).not.toBe("echoue");
      expect(q19.phrase).toMatch(/sans voix/);
    }
  });

  it("fin trop courte (0,5 s au lieu de 1,5 s) : le contrôle de scène de Q19 reste, même sans voix", async () => {
    queueForcee = 0.5;
    const v = await porteUniqueIV(montage(), outilsMuets);
    for (const x of v.versions) {
      const q19 = x.lignes.find((l) => l.code === "Q19")!;
      expect(q19.etat, JSON.stringify(q19)).toBe("echoue");
      expect(q19.phrase).toMatch(/1,5 s/);
    }
    queueForcee = undefined;
  });
});
