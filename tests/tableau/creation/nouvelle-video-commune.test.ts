/**
 * « Nouvelle vidéo » commune : la carte du tableau animé (actif) mène à `/tableau/nouvelle`, jamais à l'assistant de
 * face caméra ; face caméra et l'avocat gardent leur parcours.
 */
import { hash } from "@node-rs/argon2";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { default: PageNouvelle } = await import("@/app/(studio)/nouvelle/page");
const { default: PageAssistant } = await import("@/app/(studio)/nouvelle/[format]/page");

const MDP = "tableau-nouvelle-commune";

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

const vers = async (formatId: string, sp: { brouillon?: string } = {}) => {
  try {
    await PageAssistant({ params: Promise.resolve({ format: formatId }), searchParams: Promise.resolve(sp) });
  } catch (e) {
    return String((e as { message?: string; vers?: string }).vers ?? (e as Error).message);
  }
  return null;
};

describe("Nouvelle vidéo commune et tableau animé", () => {
  it("la grille propose le tableau animé, mais le lien de sa carte passe par la redirection du tableau", async () => {
    const html = renderToStaticMarkup(await PageNouvelle());
    expect(html).toContain("Tableau animé");
    expect(html).toContain('href="/nouvelle/facecam"');
  });

  it("/nouvelle/tableau-anime renvoie vers /tableau/nouvelle (brouillon conservé)", async () => {
    expect(await vers("tableau-anime")).toContain("/tableau/nouvelle");
    expect(await vers("tableau-anime", { brouillon: "v1" })).toContain("/tableau/nouvelle?brouillon=v1");
  });

  it("face caméra ne part jamais vers le tableau", async () => {
    expect((await vers("facecam")) ?? "").not.toContain("/tableau/nouvelle");
  });
});
