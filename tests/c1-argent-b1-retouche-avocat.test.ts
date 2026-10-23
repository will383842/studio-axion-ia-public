/**
 * CORRECTEUR 1 (argent) — B1 : la retouche d'une VRAIE vidéo montée par le moteur avocat n'existe pas encore (le moteur
 * la confiait au moteur d'essai, qui rend une vidéo de démonstration). Elle est refusée proprement, avant toute
 * réservation ; et si une ancienne retouche rend quand même une vidéo de démonstration, la version choisie est gardée.
 * Aucun appel réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { moteurDeCommande } = await import("@/moteurs");

const MDP = "c1-argent-b1";

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
});

/** v-03 devient une VRAIE vidéo (pas un exemple) dont la version choisie a été montée par le moteur avocat. */
async function vraieVideoAvocat(): Promise<{ versionId: string }> {
  const v = (await depots().videos.obtenir("v-03"))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(v.id, { estDemo: false });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, moteurId: "montage-avocat" }, estDemo: false });
  expect(moteurDeCommande({ ...ver.commande, moteurId: "montage-avocat" }).id).toBe("montage-avocat");
  return { versionId: ver.id };
}

describe("B1 · retouche d'une vraie vidéo avocat", () => {
  it("refusée proprement avant tout paiement : phrase simple, rien de réservé, aucune nouvelle version", async () => {
    const { versionId } = await vraieVideoAvocat();
    const plan = (await depots().plans.lister((p) => p.versionId === versionId))[0];
    const versionsAvant = await depots().versions.compter((x) => x.videoId === "v-03");
    const travauxAvant = await depots().travaux.compter((t) => t.cibleId === "v-03");
    const err = await fabrication.lancerRetouche("v-03", [plan.id], "plus net", { confirme: true }).catch((e) => e);
    expect(err).toMatchObject({ code: "RETOUCHE_INDISPONIBLE" });
    expect(String(err.message)).toMatch(/pas encore disponible/);
    expect(await depots().versions.compter((x) => x.videoId === "v-03")).toBe(versionsAvant);
    expect(await depots().travaux.compter((t) => t.cibleId === "v-03")).toBe(travauxAvant);
    expect(await depots().reservations.compter((r) => r.videoId === "v-03" && r.statut === "active")).toBe(0);
    expect((await depots().videos.obtenir("v-03"))!.versionChoisieId).toBe(versionId);
  });

  it("une retouche déjà partie qui rend une vidéo de démonstration ne remplace JAMAIS la version choisie", async () => {
    const { versionId } = await vraieVideoAvocat();
    const v = (await depots().videos.obtenir("v-03"))!;
    const ver = (await depots().versions.obtenir(versionId))!;
    const moteur = moteurDeCommande(ver.commande);
    // Ancienne retouche lancée avant la correction : travail de retouche en cours sur une nouvelle version.
    const nouvelle = "ver-retouche-b1";
    await depots().versions.enregistrer({ ...ver, id: nouvelle, numero: 99, parentVersionId: ver.id, statut: "en_fabrication", choisie: false, travailId: "trav-b1" });
    const plan = ver.commande.plans[0];
    const t = await moteur.retoucher({ commande: ver.commande, contexte: { travailId: "trav-b1", versionId: nouvelle, titre: "Retouche" }, planIds: [plan.id], consigne: "plus net" });
    await depots().travaux.enregistrer({ ...t, estDemo: false });
    await depots().retouches.enregistrer({ id: "ret-b1", videoId: v.id, versionId: ver.id, planIds: [plan.id], consigne: "plus net", statut: "en_cours", travailId: "trav-b1", creeLe: t.creeLe, modifieLe: t.creeLe });
    const notesAvant = new Set((await depots().notifications.lister()).map((n) => n.id));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < 100; i++) {
        const x = await depots().travaux.obtenir("trav-b1");
        if (x && x.statut !== "en_cours" && x.statut !== "en_file") break;
        vi.setSystemTime(Date.now() + 5_000);
        await boucle.tourDeBoucle();
      }
    } finally {
      vi.useRealTimers();
    }
    const apres = (await depots().videos.obtenir("v-03"))!;
    expect(apres.versionChoisieId).toBe(versionId);
    expect((await depots().versions.obtenir(versionId))!.choisie).toBe(true);
    expect((await depots().versions.obtenir(nouvelle))!.choisie).toBe(false);
    expect(apres.statut).toBe("prete");
    expect((await depots().retouches.obtenir("ret-b1"))!.statut).toBe("echec");
    // Aucune sortie de démonstration n'est rangée sur la vraie vidéo.
    expect(await depots().sorties.compter((s) => s.versionId === nouvelle)).toBe(0);
    // Rien n'annonce « Votre vidéo est prête » ; Will lit une phrase simple.
    const notes = await depots().notifications.lister((n) => n.lien === "/videos/v-03" && !notesAvant.has(n.id));
    expect(notes.some((n) => n.titre === "Votre vidéo est prête")).toBe(false);
    expect(notes.some((n) => /pas encore disponible/.test(`${n.titre} ${n.message ?? ""}`))).toBe(true);
    void travaux;
  });
});
