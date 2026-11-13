/**
 * APPELS SANS FIN (GV2-02) : ffmpeg figé, dépôt ou lecture du stockage de la face caméra qui ne répondent jamais.
 * Chaque appel a un délai ; au dépassement : erreur claire (outil, dépôt) ou `null` (lecture). Aucun réseau réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set() {}, delete() {} }), headers: async () => new Headers() }));

const fournisseurSimule = vi.fn();
vi.mock("@/services/_commun", async (importer) => ({ ...(await importer<object>()), fournisseur: (...a: unknown[]) => fournisseurSimule(...a) }));

const { outilsPreparationServeur } = await import("@/moteurs/montage-facecam-animee/images/production");
const { deposerJsonGz, lireJsonGz } = await import("@/services/monteur-facecam");

/** `executer` n'accepte que ffmpeg/ffprobe en type : on lui passe node (essai seulement). */
const NODE = process.execPath as "ffmpeg";

describe("executer (ffmpeg/ffprobe de la face caméra animée)", () => {
  it("un programme qui ne finit pas est tué au délai et la promesse rejette avec un message clair", async () => {
    const outils = outilsPreparationServeur({ deposer: async () => "", delaiCommandeMs: 300 });
    await expect(outils.executer(NODE, ["-e", "setInterval(()=>{},1e3)"])).rejects.toThrow("L'outil vidéo ne répond plus.");
  }, 20_000);

  it("un programme qui finit rend sa sortie ; un échec normal garde son message d'échec", async () => {
    const outils = outilsPreparationServeur({ deposer: async () => "", delaiCommandeMs: 20_000 });
    expect((await outils.executer(NODE, ["-e", "process.stdout.write('ok')"])).toString()).toBe("ok");
    await expect(outils.executer(NODE, ["-e", "process.exit(3)"])).rejects.toThrow(/a échoué \(3\)/);
  }, 30_000);
});

let couper = () => {};
let delaisDemandes: number[] = [];

describe("stockage de la face caméra", () => {
  beforeEach(() => {
    fournisseurSimule.mockResolvedValue({ urlDepotDuree: async () => "https://stockage.exemple/depot", urlLectureDuree: async () => "https://stockage.exemple/lecture" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fournisseurSimule.mockReset();
  });

  /** `fetch` qui ne répond jamais, sauf si on l'abandonne par son `signal`. */
  function fetchPendu() {
    // AbortSignal.timeout n'obéit pas à l'horloge simulée : on le remplace par un signal qu'on coupe à la main.
    const delais: number[] = [];
    const controle = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => (delais.push(ms), controle.signal));
    couper = () => controle.abort(new DOMException("délai", "TimeoutError"));
    delaisDemandes = delais;
    const f = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_ok, ko) => init?.signal?.addEventListener("abort", () => ko(init.signal!.reason))));
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("le dépôt passe un signal à fetch et rejette en clair quand la connexion est pendue", async () => {
    const f = fetchPendu();
    const p = deposerJsonGz("cle", { a: 1 });
    const verdict = expect(p).rejects.toMatchObject({ message: expect.stringContaining("Le stockage ne répond pas") });
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    couper();
    await verdict;
    expect(delaisDemandes).toEqual([2 * 60_000]);
    expect((f.mock.calls[0]![1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("la lecture passe un signal à fetch et rend null quand la connexion est pendue", async () => {
    const f = fetchPendu();
    const p = lireJsonGz("autre-cle");
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    couper();
    expect(await p).toBeNull();
    expect(delaisDemandes).toEqual([2 * 60_000]);
    expect((f.mock.calls[0]![1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });
});
