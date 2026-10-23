/**
 * G6b · « Monter ma prise » (« je lis ») de bout en bout, en SIMULATION : la prise filmée et rangée par la séance de
 * tournage (G4c) devient la source de la vidéo — `rush`, un seul angle, alignement forcé, sous-titres du texte validé,
 * 0 € ; avec des prises découpées (1 corps filmé une fois + le début et la fin du réseau), la commande les assemble.
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
const tournage = await import("@/services/tournage");
const fr = await import("@/services/fabrication-reseaux");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");

import type { ProjetMontageAvocat } from "@/moteurs/montage-avocat";

const MDP = "essai-g6b-service";

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
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

/** Versions « je lis » d'un sujet, validées (écriture simulée, 0 €). */
async function versionsJeLis() {
  const s = SUJETS_BANC[0];
  const r = await bg.lancerGeneration({ idee: s.idee, reseaux: ["tiktok", "instagram"], formatId: "avocat", pilier: s.pilier.id, mode: "teleprompteur" });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception && !m.exception.valideeParWill) await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const ids = (await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id);
  await bg.validerVariantes(ids);
  return (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId)).sort((a, b) => a.code.localeCompare(b.code));
}

let n = 0;
async function fichierPrise(dureeSec: number): Promise<string> {
  const id = `f-prise-${++n}`;
  const t = new Date().toISOString();
  await depots().fichiers.enregistrer({ id, cleStockage: `studio/dev/rushs/${id}.mp4`, nom: `${id}.mp4`, mime: "video/mp4", taille: 2_000_000, dureeSec, origine: "envoi", statut: "pret", creeLe: t, modifieLe: t } as never);
  return id;
}

async function tourner(jusqua: () => Promise<boolean>) {
  for (let i = 0; i < 120; i++) {
    if (await jusqua()) return;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

describe("G6b · « Monter ma prise »", () => {
  it("une prise de toute la version : rush, un angle, texte dit, rien à payer ; vidéo prête, sous-titrée depuis le texte validé", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const [v] = await versionsJeLis();
    const seance = await tournage.creerSeance([v.id]);
    await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId: await fichierPrise(24), dureeSec: 24 });
    const avec = (await depots().variantes.obtenir(v.id))!;
    const c = await fabrication.construireCommande(avec.videoId!);
    expect(c.distribution[0]).toMatchObject({ source: "rush", modeAngles: "un-angle" });
    expect(c.prises).toHaveLength(1);
    expect(c.prises![0]).toMatchObject({ partie: "version", dureeSec: 24 });
    expect(c.prises![0].segmentIds.length).toBe(c.script.blocs.flatMap((b) => b.segments.filter((s) => s.texte.trim())).length);
    expect(c.prononciations).toEqual([]);
    expect(c.texteDitParSegment?.length).toBe(c.prises![0].segmentIds.length);
    const e = await fabrication.apercuFabrication(avec.videoId!);
    expect(e.estimation.lignes.map((l) => l.etape)).not.toContain("Voix");
    expect(e.etapes.map((x) => x.cle)).not.toContain("visage");

    const r = await fr.monterJeLis(v.id, { confirme: true });
    await tourner(async () => (await depots().videos.obtenir(r.videoId))?.statut === "prete");
    const video = (await depots().videos.obtenir(r.videoId))!;
    const version = (await depots().versions.obtenir(video.versionChoisieId!))!;
    const projet = version.projetMontage as unknown as ProjetMontageAvocat;
    expect(projet.assemblage?.source).toBe("prises");
    expect(projet.assemblage?.morceaux).toHaveLength(1);
    const st = (await depots().sousTitres.lister((s) => s.versionId === version.id)).sort((a, b) => b.version - a.version)[0];
    expect(st.segments.length).toBeGreaterThan(0);
    // Rien de payé pour la voix ni pour le double.
    const depenses = await depots().depenses.lister((x) => x.videoId === r.videoId);
    expect(depenses.flatMap((x) => x.lignes).filter((l) => l.etape === "Voix" || l.etape.startsWith("Double"))).toEqual([]);
  });

  it("prises découpées : le corps filmé une fois (rangé sous une autre version) + le début et la fin du réseau", async () => {
    const [tt, ig] = await versionsJeLis();
    const seance = await tournage.creerSeance([tt.id, ig.id]);
    await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: ig.id, fichierId: await fichierPrise(18), dureeSec: 18, partie: "corps" });
    await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: tt.id, fichierId: await fichierPrise(4), dureeSec: 4, partie: "debut" });
    await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: tt.id, fichierId: await fichierPrise(3), dureeSec: 3, partie: "fin" });
    const c = await fabrication.construireCommande((await depots().variantes.obtenir(tt.id))!.videoId!);
    // Les versions « je lis » d'un sujet partagent leur corps (un seul texte du milieu).
    expect(tt.scriptId).toBe(ig.scriptId);
    expect(c.prises?.map((p) => p.partie)).toEqual(["debut", "corps", "fin"]);
    expect(c.prises![0].segmentIds).toEqual(c.partiesDeclinaison!.ouverture);
    expect(c.prises![2].segmentIds).toEqual(c.partiesDeclinaison!.fin);
    expect(c.prises![1].dureeSec).toBe(18);
  });

  it("refus : version sans prise", async () => {
    const [v] = await versionsJeLis();
    await expect(fr.monterJeLis(v.id, { confirme: true })).rejects.toMatchObject({ code: "SANS_PRISE" });
  });
});
