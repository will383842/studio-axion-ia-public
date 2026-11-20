/**
 * BR-DESSIN-FACECAM-a : le filtre C5-5.07 (pièces du plan de scènes qui recouvrent les sous-titres ou une carte) est
 * branché dans la chaîne face caméra, derrière `planScenes.facecamDessin` (ÉTEINT). Chemin réel : `avancerChaine`
 * (chaîne simulée, rendu simulé, faux LLM, aucun appel réseau) puis les suppléments posés dans la composition.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let reglages: Record<string, unknown> = {};
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  lireParametre: async (cle: string, defaut: unknown) => (cle in reglages ? reglages[cle] : defaut),
}));
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { profilNeutre } from "@/briques/bibliotheque-video/profils/neutre";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { ReponseClaude } from "@/fournisseurs/claude/client";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { servicesFacecam } from "@/moteurs/montage-facecam/dependances";
import "@/services/facecam-branchements";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge. En moyenne, une PME gagne 5 heures par semaine. Et elle réduit ses relances de 30 %.";

function commande(entrees: Record<string, unknown> = {}): CommandeFabrication {
  return {
    videoId: "v-dessin", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE }, distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-dessin/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null }, entrees, reglages: {}, plans: [], prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), simule.soumettre(d)), etat: (id) => simule.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c: CommandeFabrication): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const scene = (id: string, premier: number, dernier: number, debutMs: number, finMs: number, position: string) => ({ id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position, piece: "carte-kpi", parametres: { valeur: "42", etiquette: id } });
/**
 * « haut » : hors visage et hors bande des sous-titres ; « bas » : sur la bande des sous-titres ; la 3e pièce tombe
 * pendant l'écran partagé que la chaîne pose seule (mots 40 à 46, vers 16 à 19 s).
 */
const PLAN = { version: "plan-scenes-1", scenes: [scene("haut-libre", 0, 3, 500, 2500, "haut"), scene("sur-soustitres", 4, 8, 3000, 5500, "bas"), scene("pendant-carte", 40, 46, 16000, 19000, "haut")] };
const llm = () => ({ appeler: async (): Promise<ReponseClaude> => ({ texte: JSON.stringify(PLAN), stopReason: "end_turn" }) as ReponseClaude });
// BR-DESSIN-FACECAM-b-v20a (20/11) : attentes DÉPLACÉES, jamais retirées : quand le dessin est permis, le plan filtré est lu sur `texte.planScenes` (calque texte), sinon sur `image.planScenes` comme avant.
const composition = (o: { soumises: DemandeRendu[] }) => o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!.parametres as unknown as ParametresDemandeComposition & { image: { planScenes?: { scenes: { id: string }[] } }; texte: { planScenes?: { scenes: { id: string }[] } } };
const ids = (o: { soumises: DemandeRendu[] }) => (composition(o).texte.planScenes ?? composition(o).image.planScenes)?.scenes.map((s) => s.id);

/** Entrée bibliothèque figée dont le profil PERMET `plan-scenes.facecam` (le profil neutre ne le permet pas). */
const entreePermise = () => {
  const profil = profilNeutre("facecam");
  return { bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: { ...profil, capacites: { ...profil.capacites, "plan-scenes.facecam": { ...profil.capacites["plan-scenes.facecam"], permis: true } } }, recents: [], graine: "G", figeeLe: "2026-11-18" } };
};
const entreeFermee = () => ({ bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: profilNeutre("facecam"), recents: [], graine: "G", figeeLe: "2026-11-18" } });

async function fabriquer(option: { dessin?: true } | undefined, entrees: Record<string, unknown> = {}) {
  const o = outilsRendu();
  const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: o, planScenes: async () => ({ appeler: llm().appeler, ...option }) }, commande(entrees));
  expect(etat.fini).toBe(true);
  return { o, etat };
}

describe("Face caméra · dessin du plan de scènes branché (BR-DESSIN-FACECAM-a)", () => {
  it("(a) éteint : le plan est posé tel quel (même objet), les 3 pièces restent, aucune retrait noté", async () => {
    const { o, etat } = await fabriquer(undefined);
    expect(etat.habillage!.base.supplements?.planScenes).toBe(etat.planScenes!.plan);
    expect(ids(o)).toEqual(["haut-libre", "sur-soustitres", "pendant-carte"]);
    expect(etat.habillage!.base.supplements?.ecransPartages?.length).toBe(1);
    expect(etat.planScenesRetirees).toBeUndefined();
  });

  it("(a) bis : l'option sans `dessin` (réglage éteint) et avec entrée permise ne filtre rien non plus", async () => {
    const { o, etat } = await fabriquer(undefined, entreePermise());
    expect(ids(o)).toEqual(["haut-libre", "sur-soustitres", "pendant-carte"]);
    expect(etat.planScenesRetirees).toBeUndefined();
  });

  it("(b) allumé : la pièce sur les sous-titres et celle pendant la carte sont retirées, l'autre gardée, retraits notés", async () => {
    const { o, etat } = await fabriquer({ dessin: true });
    expect(ids(o)).toEqual(["haut-libre"]);
    expect(composition(o).image.planScenes).toBeUndefined();
    expect(etat.planScenesRetirees).toEqual([{ id: "sur-soustitres", raison: "sous-titres" }, { id: "pendant-carte", raison: "carte" }]);
  });

  it("(b) bis : allumé avec une entrée bibliothèque qui permet `plan-scenes.facecam` : même filtre", async () => {
    const { o } = await fabriquer({ dessin: true }, entreePermise());
    expect(ids(o)).toEqual(["haut-libre"]);
  });

  it("(c) allumé mais entrée bibliothèque qui ne permet PAS `plan-scenes.facecam` : porte fermée, rien n'est filtré", async () => {
    const { o, etat } = await fabriquer({ dessin: true }, entreeFermee());
    expect(etat.habillage!.base.supplements?.planScenes).toBe(etat.planScenes!.plan);
    expect(ids(o)).toEqual(["haut-libre", "sur-soustitres", "pendant-carte"]);
    expect(etat.planScenesRetirees).toBeUndefined();
  });

  describe("le vrai raccord de service lit le réglage `planScenes.facecamDessin`", () => {
    beforeEach(() => {
      reglages = {};
    });

    it("ALLUMÉ par défaut (20/11) : réglage absent ou valeur autre que `false` exact → `dessin: true`", async () => {
      expect(await servicesFacecam().planScenes!()).toEqual({ dessin: true });
      for (const v of ["true", 1, "oui", null]) {
        reglages = { "planScenes.facecamDessin": v };
        expect(await servicesFacecam().planScenes!()).toEqual({ dessin: true });
      }
    });

    it("éteint explicitement (`false` exact) : l'option rendue est l'objet vide d'avant, rendu identique", async () => {
      reglages = { "planScenes.facecamDessin": false };
      expect(await servicesFacecam().planScenes!()).toEqual({});
    });

    it("par défaut (réglage absent) la chaîne réelle ne laisse aucune pièce sur les sous-titres ni sur une carte", async () => {
      reglages = {};
      const option = await servicesFacecam().planScenes!();
      const { o, etat } = await fabriquer({ ...option });
      expect(ids(o)).toEqual(["haut-libre"]);
      expect(etat.planScenesRetirees).toEqual([{ id: "sur-soustitres", raison: "sous-titres" }, { id: "pendant-carte", raison: "carte" }]);
    });

    it("`true` exact : l'option porte `dessin: true`, et la chaîne réelle retire les pièces gênantes", async () => {
      reglages = { "planScenes.facecamDessin": true };
      const option = await servicesFacecam().planScenes!();
      expect(option).toEqual({ dessin: true });
      const { o, etat } = await fabriquer({ ...option, dessin: true });
      expect(ids(o)).toEqual(["haut-libre"]);
      expect(etat.planScenesRetirees?.length).toBe(2);
    });

    it("plan de scènes coupé (`planScenes.facecam` = false) : aucune option, même si le dessin est allumé", async () => {
      reglages = { "planScenes.facecam": false, "planScenes.facecamDessin": true };
      expect(await servicesFacecam().planScenes!()).toBeUndefined();
    });
  });
});
