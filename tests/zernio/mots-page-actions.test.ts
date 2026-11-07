/** LOT 4c · page /mots et actions serveur : session exigée, Activer/Pause du mot GUIDE local via mots-gestes. Valeurs fictives, aucun réseau. */
import { beforeEach, describe, expect, it, vi } from "vitest";

let session = false;
const exigerSession = vi.fn(async () => {
  if (!session) throw new Error("NON_CONNECTE");
  return {};
});
const activerMotLocal = vi.fn(async (_d: unknown) => ({ issue: "execute", raison: "activation_locale" }));
const mettreEnPauseLocal = vi.fn(async (_d: unknown) => ({ issue: "execute", raison: "pause_locale" }));
const lireVueMots = vi.fn(async () => ({ interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 1000 }, lignes: [], oppositions: 0 }));
const reseau = vi.fn(async () => new Response("{}"));

vi.mock("@/services/auth", () => ({ exigerSession: () => exigerSession() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/mots-service", async (orig) => ({ ...(await orig<typeof import("@/services/mots-service")>()), activerMotLocal: (d: unknown) => activerMotLocal(d), mettreEnPauseLocal: (d: unknown) => mettreEnPauseLocal(d), lireVueMots: () => lireVueMots() }));

const actions = await import("@/app/(studio)/mots/actions");
const { default: PageMots } = await import("@/app/(studio)/mots/page");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  session = false;
});

describe("/mots : session exigée", () => {
  it("sans session : la page et chaque action refusent, rien n'est lu ni écrit", async () => {
    await expect(PageMots()).rejects.toThrow("NON_CONNECTE");
    await expect(actions.activerMotLocalAction("c1")).rejects.toThrow("NON_CONNECTE");
    await expect(actions.mettreEnPauseLocalAction("GUIDE", "c1")).rejects.toThrow("NON_CONNECTE");
    await expect(actions.mettreEnPauseAction("GUIDE", "c1")).rejects.toThrow("NON_CONNECTE");
    await expect(actions.reactiverAction("GUIDE", "c1")).rejects.toThrow("NON_CONNECTE");
    await expect(actions.refermerDisjoncteurAction()).rejects.toThrow("NON_CONNECTE");
    await expect(actions.reglerPlafondsAction({ heureCompte: 1 })).rejects.toThrow("NON_CONNECTE");
    expect(lireVueMots).not.toHaveBeenCalled();
    expect(activerMotLocal).not.toHaveBeenCalled();
    expect(mettreEnPauseLocal).not.toHaveBeenCalled();
  });

  it("avec session : la page affiche l'écran avec la vue", async () => {
    session = true;
    const el = (await PageMots()) as { props: { vue: unknown; branchement: unknown } };
    expect(lireVueMots).toHaveBeenCalledTimes(1);
    expect(el.props.vue).toBeDefined();
    expect("branchement" in el.props).toBe(true);
  });

  it("avec session : Activer appelle activerMotLocal (GUIDE, confirmé par l'opérateur)", async () => {
    session = true;
    const r = await actions.activerMotLocalAction("c1");
    expect(r.issue).toBe("execute");
    expect(activerMotLocal).toHaveBeenCalledWith(expect.objectContaining({ mot: "GUIDE", compte: "c1", confirmeParOperateur: true }));
  });

  it("avec session : Pause appelle mettreEnPauseLocal, sans aucun appel réseau", async () => {
    session = true;
    await actions.mettreEnPauseLocalAction("GUIDE", "c1");
    expect(mettreEnPauseLocal).toHaveBeenCalledWith(expect.objectContaining({ mot: "GUIDE", compte: "c1", confirmeParOperateur: true }));
    expect(reseau).not.toHaveBeenCalled();
  });
});
