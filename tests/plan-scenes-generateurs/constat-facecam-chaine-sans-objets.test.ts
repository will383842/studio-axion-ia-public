/**
 * C9-37t — filet : la chaîne Face caméra pose le même plan de scènes et aucune entrée objet-* sans permission.
 * Chaîne simulée, rendu simulé, faux LLM : aucun appel réseau. Écrit avant le branchement de C9-37.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { profilNeutre } from "@/briques/bibliotheque-video/profils/neutre";
import type { ProfilVideo } from "@/briques/bibliotheque-video/types";
import { ID } from "@/briques/bibliotheque-video/noms";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { fnv1a64 } from "@/briques/plan-scenes/empreinte";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

/** GV2-43 : le plan du stock ne pose une scène que sur un fait du script ; ce texte en porte deux (« 5 heures », « 30 % »). */
const TEXTE_AVEC_FAITS = `${TEXTE} En moyenne, une PME gagne 5 heures par semaine. Et elle réduit ses relances de 30 %.`;

function commande(entrees: Record<string, unknown> = {}, texte = TEXTE): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: texte },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees,
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

/** Outils de studio-rendu simulés : horloge qui avance de 6 s à chaque lecture d'état (un rendu long dure 10 s). */
function outilsRendu(service?: ServiceRendu): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const rendu = service ?? simule;
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c = commande()): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}


const llmKpi = () => {
  const requetes: RequeteClaude[] = [];
  const plan = { version: "plan-scenes-1", scenes: [{ id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" } }] };
  return { requetes, appeler: async (r: RequeteClaude): Promise<ReponseClaude> => (requetes.push(r), { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude) };
};
const composition = (o: { soumises: DemandeRendu[] }) => o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!.parametres as unknown as ParametresDemandeComposition & { image: { planScenes?: unknown } };


/** Entrée bibliothèque figée « tout prévu » (aucune capacité objet permise). */
const entreeBibliotheque = () => ({ bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: profilNeutre("facecam"), recents: [], graine: "G", figeeLe: "2026-11-16" } });
const clesObjet = (o: { soumises: DemandeRendu[] }) =>
  o.soumises.flatMap((d) => Object.keys(((d.parametres as { entrees?: Record<string, unknown> }).entrees) ?? {})).filter((k) => k.startsWith("objet-"));
const constat = (outils: { soumises: DemandeRendu[] }, etat: EtatChaine) => ({ entree: etat.planScenes?.entree, plan: composition(outils).image.planScenes });
const empreinteSysteme = (r: RequeteClaude) => fnv1a64(r.systeme.map((b) => b.texte).join("\n"));

describe("Facecam sans objets permis : plan de scènes figé (C9-37t)", () => {
  it("allumé, stock seul : plan figé, aucune clé objet-*", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({}) }, commande({}, TEXTE_AVEC_FAITS));
    expect(etat.fini).toBe(true);
    expect(constat(outils, etat)).toMatchSnapshot();
    expect(clesObjet(outils)).toEqual([]);
  });

  it("avec l'entrée bibliothèque « tout prévu » : même plan, toujours aucune clé objet-*", async () => {
    const a = outilsRendu();
    const sans = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: a, planScenes: async () => ({}) }, commande({}, TEXTE_AVEC_FAITS));
    const b = outilsRendu();
    const avec = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: b, planScenes: async () => ({}) }, commande(entreeBibliotheque(), TEXTE_AVEC_FAITS));
    expect(avec.fini).toBe(true);
    expect(constat(b, avec)).toEqual(constat(a, sans));
    expect(constat(b, avec).plan).toBeDefined();
    expect(clesObjet(b)).toEqual([]);
  });

  it("le plan posé ne contient aucune scène de la famille objet", async () => {
    const outils = outilsRendu();
    await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({}) }, commande(entreeBibliotheque(), TEXTE_AVEC_FAITS));
    const plan = composition(outils).image.planScenes as { scenes: { piece: string }[]; format: unknown; facecam: boolean };
    expect(plan.facecam).toBe(true);
    expect(plan.format).toEqual({ largeur: 1080, hauteur: 1920, fps: 25 });
    expect(plan.scenes.some((s) => s.piece.startsWith("objet"))).toBe(false);
  });

  it("faux LLM : un seul appel, plan figé, même empreinte du texte système avec et sans entrée bibliothèque", async () => {
    const l1 = llmKpi();
    const a = outilsRendu();
    const e1 = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: a, planScenes: async () => ({ appeler: l1.appeler }) }, commande({}, TEXTE_AVEC_FAITS));
    const l2 = llmKpi();
    const b = outilsRendu();
    const e2 = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: b, planScenes: async () => ({ appeler: l2.appeler }) }, commande(entreeBibliotheque(), TEXTE_AVEC_FAITS));
    expect(l1.requetes).toHaveLength(1);
    expect(l2.requetes).toHaveLength(1);
    expect(empreinteSysteme(l2.requetes[0]!)).toBe(empreinteSysteme(l1.requetes[0]!));
    expect(constat(b, e2)).toEqual(constat(a, e1));
    expect(constat(a, e1)).toMatchSnapshot();
    expect(clesObjet(a)).toEqual([]);
    expect(clesObjet(b)).toEqual([]);
  });

  it("éteint (sans deps.planScenes) : aucun plan, aucune clé objet-*", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils }, commande(entreeBibliotheque(), TEXTE_AVEC_FAITS));
    expect(etat.fini).toBe(true);
    expect(etat.planScenes).toBeUndefined();
    expect(composition(outils).image.planScenes).toBeUndefined();
    expect(clesObjet(outils)).toEqual([]);
  });

  it("objets permis (C9-37-b branché) : la liste des pièces permises passe au plan ; la scène objet permise est gardée, la non permise est retirée", async () => {
    // Entrée simulée qui permet `objet.chiffre` (forme recopiée de tests/demo-facecam/objets-permis-demo.test.ts, pas importée).
    const permet = { bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: { ...profilNeutre("facecam"), capacites: { [ID.objetChiffre]: { permis: true } } as unknown as ProfilVideo["capacites"] }, recents: [], graine: "G", figeeLe: "2026-11-20" } };
    const llmObjets = () => {
      const requetes: RequeteClaude[] = [];
      const scene = (id: string, piece: string, parametres: unknown, premier: number, dernier: number, debutMs: number, finMs: number) => ({ id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position: "centre", piece, parametres });
      const plan = { version: "plan-scenes-1", scenes: [scene("a", "objet-gros-chiffre", { valeur: 5, unite: "heures" }, 0, 3, 0, 2000), scene("b", "objet-fleche-droite", {}, 5, 8, 2500, 4500)] };
      return { requetes, appeler: async (r: RequeteClaude): Promise<ReponseClaude> => (requetes.push(r), { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude) };
    };
    const pieces = (o: { soumises: DemandeRendu[] }) => ((composition(o).image.planScenes as { scenes: { piece: string }[] } | undefined)?.scenes ?? []).map((s) => s.piece);
    const l = llmObjets();
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({ appeler: l.appeler }) }, commande(permet, TEXTE_AVEC_FAITS));
    expect(etat.fini).toBe(true);
    expect(pieces(outils)).toContain("objet-gros-chiffre");
    expect(pieces(outils)).not.toContain("objet-fleche-droite");
    // La consigne du LLM liste la pièce permise et jamais la non permise.
    const systeme = l.requetes.map((r) => r.systeme.map((b) => b.texte).join("\n")).join("\n");
    expect(systeme).toContain("- objet-gros-chiffre (");
    expect(systeme).not.toContain("- objet-fleche-droite (");
  });
});
