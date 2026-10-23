/**
 * SÉRIE « CHIFFRES » (audit de bout en bout, non bloquant 4.11) — les fichiers produits par une fabrication sont
 * enregistrés avec leur VRAIE taille (celle mesurée sur le fichier exporté, `Sortie.taille`), jamais 1 Mo inventé.
 * Taille inconnue : 0 (inconnue), pas un chiffre fictif. Dépôts en mémoire, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { ResultatFabrication } from "@/moteurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const { moteurDeCommande } = await import("@/moteurs");

const MDP = "chiffres-taille";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
});

describe("4.11 · taille réelle des fichiers produits", () => {
  it("la vidéo exportée garde sa taille mesurée ; vignette et piste sans taille connue : 0, jamais 1 Mo", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const t = (await depots().travaux.obtenir(travailId))!;
    const version = (await depots().versions.obtenir(t.versionId!))!;
    const resultat: ResultatFabrication = {
      sorties: [
        { ratio: "9:16", fichierCle: "studio/dev/videos/v-03/sortie-9x16.mp4", vignetteCle: "studio/dev/videos/v-03/vignette-9x16.jpg", resolution: "1080x1920", dureeSec: 30, taille: 52_000_000, rapportQualite: { note: 90, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: -14 } },
      ],
      noteQualite: { globale: 90, alertes: [] },
      lignesReelles: [],
      projetMontage: {},
      pistes: [{ type: "audio-maitre", fournisseur: "heygen", fichierCle: "studio/dev/videos/v-03/audio-maitre.mp3" }] as ResultatFabrication["pistes"],
    };
    const lu = { travail: t, commande: version.commande, moteur: moteurDeCommande(version.commande) };
    const termine = { ...t, statut: "termine" as const, progression: 100, modifieLe: new Date(Date.now() + 1).toISOString() };
    await travaux.ecrireAvancement(lu, { travail: termine, resultat });

    const sortie = (await depots().sorties.lister((s) => s.versionId === t.versionId))[0];
    expect(sortie.taille).toBe(52_000_000);
    const video = (await depots().fichiers.obtenir(sortie.fichierId))!;
    expect(video.taille).toBe(52_000_000);
    const vignette = (await depots().fichiers.obtenir(sortie.vignetteFichierId!))!;
    expect(vignette.taille).toBe(0);
    const piste = (await depots().pistes.lister((p) => p.versionId === t.versionId && p.type === "audio-maitre"))[0];
    expect((await depots().fichiers.obtenir(piste.fichierId!))!.taille).toBe(0);
  });
});
