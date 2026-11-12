/**
 * L1-06 (correction après relecture), repris par le CORRECTIF STK-01 — supprimer une vidéo : ses créneaux non publiés et non archivés restent
 * sans la vidéo (détachés), un créneau publié ou archivé garde son lien vidéo, le journal des décalages (ajout seul) n'est jamais effacé. Aucun appel réel, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const { viderObjetsSimules } = await import("@/fournisseurs/simulation/autres");

const MDP = "essai-creneaux-123";
const ID = "v-01";
const AUTRE = "v-03";
const creneau = (id: string, videoId: string, statut: CreneauEditorial["statut"]): CreneauEditorial => ({
  id, jourVise: "2026-11-25", heuresParReseau: {}, compteCible: "compte-fictif-1", videoId, statut, decalages: 0,
});

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  viderObjetsSimules();
  await auth.seConnecter(MDP, false);
});

describe("suppression d'une vidéo et créneaux éditoriaux", () => {
  it("détache les créneaux non publiés et non archivés de la vidéo, garde le publié et l'archivé avec leur lien, le voisin et le journal", async () => {
    const d = depots();
    for (const c of [creneau("c-propose", ID, "propose"), creneau("c-programme", ID, "programme"), creneau("c-publie", ID, "publie"), creneau("c-archive", ID, "archive"), creneau("c-voisin", AUTRE, "propose")]) await d.creneauxEditoriaux.enregistrer(c);
    await d.journalDecalages.enregistrer({ id: "dec-1", creneauId: "c-propose", ancienJour: "2026-11-25", nouveauJour: "2026-11-26", raison: "essai", creeLe: "2026-11-20T10:00:00.000Z" });
    await videos.supprimerVideoDefinitivement(ID);
    const tous = await d.creneauxEditoriaux.lister();
    expect(tous.map((c) => c.id).sort()).toEqual(["c-archive", "c-programme", "c-propose", "c-publie", "c-voisin"]);
    const lien = Object.fromEntries(tous.map((c) => [c.id, c.videoId ?? null]));
    expect(lien).toEqual({ "c-propose": null, "c-programme": null, "c-publie": ID, "c-archive": ID, "c-voisin": AUTRE });
    expect(await d.journalDecalages.obtenir("dec-1")).not.toBeNull();
  });
});
