/**
 * G6 · « Fabriquer les N » de bout en bout, en SIMULATION (aucun appel HeyGen, fal.ai ni Claude ; voix, visage et rendu
 * simulés) : la mère est la version la plus longue (9:16 + options), les autres versions partent seules quand elle est
 * prête, en `variante-reseau`, avec seulement leur début et leur fin à payer ; commande : texte assemblé, texte dit et
 * liste vide, réseaux cochés et union de leurs zones, encadré ; contrôles relancés sur le temps réel ; débit relevé ;
 * raccord visible → fabrication complète à confirmer ; « 2e ouverture Reels » ; double toucher sans double vidéo.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { zonesProtegeesUnion } = await import("@/briques/declinaison");

import type { ProjetMontageAvocat } from "@/moteurs/montage-avocat";

const MDP = "essai-g6-service";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  // Le moteur avocat réel du studio (voix, visage, rendu SIMULÉS) : c'est lui qui sait reprendre le corps d'une mère.
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

const BRIEF = { idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const };

/** Un sujet écrit en simulation, ses 5 versions validées. */
async function sujetValide() {
  const r = await bg.lancerGeneration(BRIEF);
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

async function tourner(jusqua: () => Promise<boolean>, tours = 120) {
  for (let i = 0; i < tours; i++) {
    if (await jusqua()) return;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

describe("G6 · « Fabriquer les N »", () => {
  it("plan : la mère est la plus longue ; chaque autre version coûte au plus 1 € (début et fin seulement)", async () => {
    const id = await sujetValide();
    const plan = (await fr.planFabricationSujet(id))!;
    expect(plan.versions).toHaveLength(5);
    const max = Math.max(...plan.versions.map((v) => v.dureeSec));
    expect(plan.mere.dureeSec).toBe(max);
    for (const v of plan.versions.filter((x) => x.role === "variante")) {
      expect(v.cout.centimes).toBeGreaterThan(0);
      expect(v.cout.centimes).toBeLessThanOrEqual(100);
    }
    expect(plan.total.centimes).toBeLessThan(plan.sansDeclinaison.centimes);
    expect((await fr.planFabricationSujet(id, { ratiosOption: ["4:5"] }))!.ratiosOption).toEqual(["4:5"]);
  });

  it("de bout en bout : mère puis 4 versions sur la mère, commandes conformes, contrôles réels, débit relevé", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await sujetValide();
    // Double toucher : deux envois IDENTIQUES (mêmes formats) ; l'ordre d'arrivée sous le verrou ne doit rien changer.
    const [a, b] = await Promise.all([fr.fabriquerLesN(id, { operationId: "op-n", lancer: false, ratiosOption: ["4:5"] }), fr.fabriquerLesN(id, { operationId: "op-n", lancer: false, ratiosOption: ["4:5"] })]);
    expect(a.mereVideoId).toBe(b.mereVideoId);
    expect(a.videoIds).toHaveLength(5);
    const r = await fr.fabriquerLesN(id, { operationId: "op-n", lancer: true });
    expect(r.travailId).toBeTruthy();
    const mere = (await depots().videos.obtenir(r.mereVideoId))!;
    expect(mere.ratios).toEqual(["9:16", "4:5"]);
    expect(fr.declinaisonDe(mere)?.role).toBe("mere");
    // Les autres attendent la mère, sans travail lancé.
    for (const vid of r.videoIds.slice(1)) {
      const v = (await depots().videos.obtenir(vid))!;
      expect(v).toMatchObject({ statut: "brouillon", typeDerive: "variante-reseau", sourceVideoId: r.mereVideoId });
      expect(fr.declinaisonDe(v)?.attendMere).toBe(true);
    }
    await tourner(async () => (await depots().videos.obtenir(r.mereVideoId))?.statut === "prete");
    await tourner(async () => (await Promise.all(r.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete"));

    const versionMere = (await depots().versions.obtenir((await depots().videos.obtenir(r.mereVideoId))!.versionChoisieId!))!;
    const cm = versionMere.commande;
    expect(cm.prononciations).toEqual([]);
    expect(cm.texteDitParSegment?.length).toBe(cm.script.blocs.flatMap((x) => x.segments.filter((s) => s.texte.trim())).length);
    expect(cm.reseaux?.sort()).toEqual([...RESEAUX_DECLINAISON].sort());
    expect(cm.zonesProtegees).toEqual(zonesProtegeesUnion([...RESEAUX_DECLINAISON]));
    expect(cm.encadreTexte).toBeTruthy();
    expect(cm.partiesDeclinaison?.ouverture.length).toBeGreaterThan(0);
    expect(cm.variante).toBeUndefined();

    let coutVersions = 0;
    for (const vid of r.videoIds.slice(1)) {
      const video = (await depots().videos.obtenir(vid))!;
      const version = (await depots().versions.obtenir(video.versionChoisieId!))!;
      const c = version.commande;
      expect(c.variante?.mere?.videoId).toBe(r.mereVideoId);
      expect(c.variante?.typeDerive).toBe("variante-reseau");
      expect(c.variante?.segmentsRefaits?.length).toBeGreaterThan(0);
      expect(c.variante!.tranches.finRemplaceSec).toBeGreaterThan(c.variante!.tranches.debutRemplaceSec);
      // Le texte assemblé de la version : son ouverture et sa fin, le corps commun.
      const v = (await depots().variantes.obtenir(video.varianteId!))!;
      expect(c.script.texteComplet).toContain(v.ouverture[0].segments[0].texte);
      const projet = version.projetMontage as unknown as ProjetMontageAvocat;
      expect(projet.assemblage?.morceaux.some((x) => x.entree === "mere")).toBe(true);
      expect(projet.assemblage?.morceaux[0].entree).toBe("partiel");
      coutVersions += video.coutReel?.centimes ?? 0;
      // Contrôles relancés sur l'horodatage réel, durée réelle.
      expect(v.controlesReels?.videoId).toBe(vid);
      expect(v.dureeReelleSec).toBeGreaterThan(5);
    }
    expect(coutVersions).toBeLessThanOrEqual(4 * 100);
    // Débit réel relevé sur la mère (recalage B.4.2) ; la valeur ne change qu'à partir de 5 relevés.
    const debit = await lireParametre<{ releves: number[]; valeur: number | null }>("debit.avocat.avatar", { releves: [], valeur: null });
    expect(debit.releves).toHaveLength(1);
    expect(debit.valeur).toBeNull();
    expect(await fr.debitRecale("avocat")).toBeNull();
    const etats = await fr.etatFabricationSujet(id);
    expect(etats).toHaveLength(5);
    expect(etats.every((e) => !e.attendMere && e.statut === "prete")).toBe(true);
  });

  it("raccord visible (aucune coupe de la mère) : la version est fabriquée en entier, coût affiché, sur confirmation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await sujetValide();
    const r = await fr.fabriquerLesN(id, { operationId: "op-raccord", lancer: true });
    // La mère finit ; on retire ses coupes AVANT que les versions ne partent (son projet n'a plus qu'un plan).
    await tourner(async () => (await depots().videos.obtenir(r.mereVideoId))?.statut === "prete");
    // Les versions sont parties dans la suite du même tour : on rejoue la décision pour une copie d'une version, sur une
    // mère dont on a retiré les coupes (son projet n'a plus qu'un plan).
    const versionMere = (await depots().versions.obtenir((await depots().videos.obtenir(r.mereVideoId))!.versionChoisieId!))!;
    const projet = versionMere.projetMontage as unknown as ProjetMontageAvocat;
    const d0 = projet.plansProduits!;
    await depots().versions.modifier(versionMere.id, { projetMontage: { ...projet, plansProduits: [{ ...d0[0], finSec: d0.at(-1)!.finSec }] } as unknown as Record<string, unknown> });
    const autre = r.videoIds.find((v) => v !== r.mereVideoId)!;
    const video = (await depots().videos.obtenir(autre))!;
    const brouillon = { ...video, statut: "brouillon" as const, versionChoisieId: undefined, entrees: { ...video.entrees, declinaison: { ...fr.declinaisonDe(video)!, attendMere: true } } };
    await depots().videos.enregistrer({ ...brouillon, id: "video-test-raccord" });
    await depots().videos.modifier(autre, { entrees: { ...video.entrees, declinaison: { ...fr.declinaisonDe(video)!, attendMere: false } } });
    await fr.apresFabricationGenerateur(r.mereVideoId);
    const x = (await depots().videos.obtenir("video-test-raccord"))!;
    expect(fr.declinaisonDe(x)).toMatchObject({ role: "complete", attendConfirmation: true, attendMere: false });
    expect(x.statut).toBe("brouillon");
    expect(x.sourceVideoId).toBeUndefined();
    const v = (await depots().variantes.obtenir(x.varianteId!))!;
    expect(v.corpsDistinct?.raison).toMatch(/aucune coupe/);
    const etat = (await fr.etatFabricationSujet(id)).find((e) => e.videoId === x.id)!;
    expect(etat.attendConfirmation).toBe(true);
    expect(etat.coutComplet!.centimes).toBeGreaterThan(100);
    const t = await fr.confirmerFabricationComplete(x.id);
    expect(t.travailId).toBeTruthy();
  });

  it("moteur du format sans reprise du corps (simulation par défaut) : chaque version est fabriquée en entier, coût affiché", async () => {
    await ecrireParametre("moteur.avocat", null);
    const id = await sujetValide();
    const plan = (await fr.planFabricationSujet(id))!;
    expect(plan.surMere).toBe(false);
    const r = await fr.fabriquerLesN(id, { operationId: "op-sim", lancer: true });
    for (const vid of r.videoIds.slice(1)) {
      const v = (await depots().videos.obtenir(vid))!;
      expect(fr.declinaisonDe(v)?.role).toBe("complete");
      expect(v.sourceVideoId).toBeUndefined();
      expect(v.statut).not.toBe("brouillon");
    }
  });

  it("« 2e ouverture Reels » : même version, autre accroche finaliste, `variante-accroche`, fichier -A2, corps et fin repris", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await sujetValide();
    const r = await fr.fabriquerLesN(id, { operationId: "op-a2", lancer: true });
    await tourner(async () => (await Promise.all(r.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete"));
    const ig = (await depots().variantes.lister((v) => v.scriptMaitreId === id && v.reseau === "instagram"))[0];
    const m = (await depots().scriptsMaitres.obtenir(id))!;
    if (!(m.accrochesFinalistes ?? []).some((a) => a.id !== ig.accrocheId)) {
      await depots().scriptsMaitres.modifier(id, { accrochesFinalistes: [...(m.accrochesFinalistes ?? []), { id: "acc-2", famille: "question", objectif: "commentaire", dit: "Combien d'heures vos relances vous prennent-elles ?", ecrit: "", vu: "", preuveIds: [], noteCode: 80, dureeDiteSec: 2.5 } as never] });
    }
    const [a, b] = await Promise.all([fr.fabriquerSecondeOuverture(ig.id, { operationId: "op-2o", lancer: false }), fr.fabriquerSecondeOuverture(ig.id, { operationId: "op-2o", lancer: false })]);
    expect(a.videoId).toBe(b.videoId);
    const video = (await depots().videos.obtenir(a.videoId))!;
    expect(video).toMatchObject({ typeDerive: "variante-accroche", sourceVideoId: ig.videoId, varianteId: ig.id, reseau: "instagram" });
    expect(video.titre).toContain("-A2");
    // La version garde sa vidéo (une version, au plus une vidéo).
    expect((await depots().variantes.obtenir(ig.id))?.videoId).toBe(ig.videoId);
    const t = await fr.fabriquerSecondeOuverture(ig.id, { operationId: "op-2o", lancer: true });
    expect(t.travailId).toBeTruthy();
    await tourner(async () => (await depots().videos.obtenir(a.videoId))?.statut === "prete");
    const version = (await depots().versions.obtenir((await depots().videos.obtenir(a.videoId))!.versionChoisieId!))!;
    expect(version.commande.variante?.typeDerive).toBe("variante-accroche");
    expect(version.commande.variante?.segmentsRefaits?.every((s) => s.endsWith("-a2"))).toBe(true);
    const projet = version.projetMontage as unknown as ProjetMontageAvocat;
    expect(projet.assemblage?.morceaux.map((x) => x.entree)).toEqual(["partiel", "mere"]);
  });
});
