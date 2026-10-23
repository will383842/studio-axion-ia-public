/**
 * Portage phase 2 · P8 : les relevés sont derrière `casConcret.releves` (éteint par défaut) : aucune lecture du site, aucun
 * bloc. Par publication seulement (vidéo × réseau), jamais par personne. Lecteur double : aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const suivi = await import("@/services/cas-concret-suivi");
const { BlocReleves } = await import("@/components/formats/cas-concret/releves/BlocReleves");

const MDP = "cas-concret-releves-reglage";
const VIDEO = "v-03";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await depots().videos.modifier(VIDEO, { formatId: "cas-concret", entrees: { casConcret: { reseaux: ["instagram"], essai: false } } });
});

describe("P8 · réglage `casConcret.releves` éteint (défaut)", () => {
  it("aucune lecture du site : le service refuse avant d'appeler le lecteur", async () => {
    const lire = vi.fn(async () => []);
    await expect(suivi.suiviDesVideos({ videoId: VIDEO, visites: { mode: "reel", lire } })).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    expect(lire).not.toHaveBeenCalled();
  });

  it("le bloc de la fiche ne rend rien", async () => {
    expect(await BlocReleves({ videoId: VIDEO })).toBeNull();
  });
});

describe("P8 · allumé (dans le double seulement)", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.releves", true);
  });

  it("le lecteur double est lu, lecture seule ; le bloc se rend", async () => {
    const lire = vi.fn(async () => [{ campagne: "0042-CC-IG", source: "instagram", visites: 5, rendezVous: 0 }]);
    const v = (await depots().videos.obtenir(VIDEO))!;
    const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
    await depots().versions.modifier(ver.id, { numero: 42 });
    const s = await suivi.suiviDesVideos({ videoId: VIDEO, visites: { mode: "reel", lire } });
    expect(lire).toHaveBeenCalledTimes(1);
    expect(s.lignes[0]).toMatchObject({ reseau: "instagram", codeSuivi: "0042-CC-IG", visites: 5, mesure: true });
    expect(await BlocReleves({ videoId: VIDEO })).not.toBeNull();
  });

  it("les sources lisent le réglage, n'écrivent rien et ne font aucun fetch", () => {
    const src = readFileSync(join(process.cwd(), "src/services/cas-concret-suivi.ts"), "utf8");
    expect(src).toContain("REGLAGES_CAS_CONCRET.releves");
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/\.(enregistrer|modifier|supprimer)\(/);
  });
});
