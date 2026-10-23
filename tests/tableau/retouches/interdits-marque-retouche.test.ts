/**
 * Les retouches de « Votre vidéo » lisent les interdits de la marque comme la création (une seule fonction,
 * `interditsDeLaMarque`) : un titre retouché à la main ne peut pas écrire un mot interdit. Mémoire seulement.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { regleControlesScript } from "../../../src/moteurs/montage-tableau/regles";
import { AUJOURDHUI_EXEMPLES, ficheDemonstration } from "../regles/exemples";
import { banc } from "../moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => ({ ...(await original<object>()), ecranTableauVisible: () => true }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ficheTableauDeLaVideo } = await import("@/services/tableau-vue");
const { contexteRegles } = await import("@/services/tableau-creation");

const MDP = "tableau-interdits-retouche";
const VIDEO = "v-03";
const T0 = "2026-10-01T10:00:00.000Z";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await depots().contexteAxion.enregistrer({
    id: "contexte-axion-v1",
    version: 1,
    positionIds: [],
    piliers: [],
    interdits: [{ id: "i1", texte: "Jamais « formation certifiée ».", regex: "formation certifi", origine: "test" }],
    jargonAutorise: [],
    jargonInterdit: ["synergie"],
    promessesInterdites: ["garanti"],
    carnetVoix: [],
    termesVagues: [],
    rolesDestinataires: [],
    creeLe: T0,
    modifieLe: T0,
  } as never);
  const b = banc(ficheDemonstration);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { commande: { ...b.commande(ficheDemonstration), videoId: VIDEO }, estDemo: false, projetMontage: { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche: ficheDemonstration, retouchee: true } } });
});

describe("le contexte des retouches porte les interdits de la marque", () => {
  it("interdits de Will et mots interdits : les mêmes qu'à la création", async () => {
    const vue = await ficheTableauDeLaVideo(VIDEO, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const creation = await contexteRegles(AUJOURDHUI_EXEMPLES);
    expect(vue?.contexte.motsInterdits).toEqual(["synergie", "garanti"]);
    expect(vue?.contexte.interdits).toHaveLength(1);
    expect(vue?.contexte.motsInterdits).toEqual(creation.motsInterdits);
    expect(vue?.contexte.interdits).toEqual(creation.interdits);
  });

  it("un titre retouché à la main avec un mot interdit est refusé par la règle 13", async () => {
    const vue = (await ficheTableauDeLaVideo(VIDEO, { aujourdhui: AUJOURDHUI_EXEMPLES }))!;
    const fiche = structuredClone(ficheDemonstration);
    const ligne = fiche.scenes.flatMap((s) => s.elements).find((e) => e.type === "ligne") as { texte: string };
    ligne.texte = "Une synergie garantie";
    const detail = regleControlesScript(fiche, { ...vue.contexte, texteScript: "" }).map((m) => m.detail).join(" | ");
    expect(detail).toContain("mot interdit « synergie »");
  });
});
