/**
 * Script perso, 5e tour : l'origine « will » rangée à la fabrication suit la vidéo jusqu'aux retouches de « Votre vidéo »
 * (même contexte de règles que la création : `texteDeWill`). Sans elle, les contrôles restent entiers. Mémoire seulement.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { lireEntreesTableau } from "../../../src/moteurs/montage-tableau";
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

const MDP = "tableau-origine-retouche";
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
});

async function preparer(origine?: unknown) {
  const b = banc(ficheDemonstration);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  const commande = { ...b.commande(ficheDemonstration), videoId: VIDEO };
  const entrees = { ...commande.entrees, tableau: { ...(commande.entrees as Record<string, object>).tableau, ...(origine !== undefined ? { origine } : {}) } };
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { commande: { ...commande, entrees }, estDemo: false, projetMontage: { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche: ficheDemonstration, retouchee: true } } });
}

describe("origine « will » dans les entrées de fabrication", () => {
  it("lue telle quelle quand c'est « will », ignorée sinon", () => {
    expect(lireEntreesTableau({ tableau: { origine: "will" } } as never).origine).toBe("will");
    for (const o of ["generateur", "autre", 3, null]) expect(lireEntreesTableau({ tableau: { origine: o } } as never).origine).toBeUndefined();
  });
});

describe("le contexte des retouches connaît l'origine", () => {
  const tutoie = () => {
    const fiche = structuredClone(ficheDemonstration);
    fiche.scenes[0].texteDit = `${fiche.scenes[0].texteDit} Tu verras, demain tu gagneras du temps.`;
    return fiche;
  };
  it("origine « will » : texteDeWill posé, un « tu » / « demain » dit n'est plus refusé", async () => {
    await preparer("will");
    const vue = (await ficheTableauDeLaVideo(VIDEO, { aujourdhui: AUJOURDHUI_EXEMPLES }))!;
    expect((vue.contexte as { texteDeWill?: boolean }).texteDeWill).toBe(true);
    const detail = regleControlesScript(tutoie(), { ...vue.contexte, texteScript: "" }).map((m) => m.detail).join(" | ");
    expect(detail).not.toMatch(/tutoi|demain/i);
  });
  it("origine absente : pas de texteDeWill, le même texte reste refusé", async () => {
    await preparer();
    const vue = (await ficheTableauDeLaVideo(VIDEO, { aujourdhui: AUJOURDHUI_EXEMPLES }))!;
    expect((vue.contexte as { texteDeWill?: boolean }).texteDeWill).toBeUndefined();
    const detail = regleControlesScript(tutoie(), { ...vue.contexte, texteScript: "" }).map((m) => m.detail).join(" | ");
    expect(detail).toMatch(/tutoi|demain/i);
  });
});
