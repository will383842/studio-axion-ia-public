/** SUI-C : le tableau de suivi chiffré est branché dans /mots (session d'abord, panne sans casser l'écran). Valeurs fictives. */
import { readFileSync } from "node:fs";
import { redirect } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

let session = false;
const exigerSession = vi.fn(async () => {
  if (!session) throw new Error("NON_CONNECTE");
  return {};
});
const fen = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const tableau = {
  genereLe: "2026-01-01T00:00:00Z",
  siteDisponible: true,
  lignes: [
    {
      mot: "GUIDE",
      commentaires: fen(1, 5, 9),
      reponsesPubliques: fen(1, 4, 8),
      premiersMessages: fen(2, 6, 10),
      renvois: fen(0, 1, 2),
      formulaires: fen(3, 3, 3),
      envoisEmail: fen(0, 0, 0),
      clics: fen(0, 0, 0),
      instagram: { reponsesOk: fen(0, 0, 0), dejaSuivi: fen(0, 0, 0), gagnees: fen(4, 5, 6), sansSuivre: fen(0, 0, 0), inconnu: fen(0, 0, 0) },
      auMoinsGagnees: 4,
      parPublication: [],
      formulations: [],
    },
  ],
};
const lireTableauSuivi = vi.fn(async (): Promise<unknown> => tableau);
const lireVueMots = vi.fn(async () => ({ interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 1000 }, lignes: [], oppositions: 0 }));

vi.mock("@/services/auth", () => ({ exigerSession: () => exigerSession() }));
vi.mock("@/services/suivi-mots", () => ({ lireTableauSuivi: () => lireTableauSuivi() }));
vi.mock("@/services/mots-service", async (orig) => ({ ...(await orig<typeof import("@/services/mots-service")>()), lireVueMots: () => lireVueMots() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ refresh: vi.fn() }) }));
// next/dynamic : le chargement à la demande est simulé de façon synchrone (le module est déjà résolu avant les rendus).
vi.mock("next/dynamic", () => ({
  default: (charger: () => Promise<unknown>) => {
    let C: ((p: unknown) => unknown) | null = null;
    void charger().then((m) => { C = (typeof m === "function" ? m : ((m as Record<string, unknown>).default ?? Object.values(m as object)[0])) as (p: unknown) => unknown; });
    return (p: unknown) => (C ? C(p) : null);
  },
}));

const { default: PageMots } = await import("@/app/(studio)/mots/page");
const { EcranMots } = await import("@/components/mots/EcranMots");
const { monter } = await import("../aides/crochets-factices");
await import("@/components/mots/TableauSuiviMots");
await new Promise((r) => setTimeout(r, 50));

type Props = { vue: unknown; suivi?: unknown; suiviIndisponible?: boolean };
const SERVICES = {} as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- props de test, le composant les type.
const Ecran = EcranMots as any;

beforeEach(() => {
  vi.clearAllMocks();
  session = false;
  lireTableauSuivi.mockImplementation(async () => tableau);
});

describe("SUI-C : branchement du suivi dans /mots", () => {
  it("sans session : aucune lecture du suivi", async () => {
    await expect(PageMots()).rejects.toThrow("NON_CONNECTE");
    expect(lireTableauSuivi).not.toHaveBeenCalled();
  });

  it("avec session : l'écran reçoit les chiffres", async () => {
    session = true;
    const el = (await PageMots()) as { props: Props };
    expect(lireTableauSuivi).toHaveBeenCalledTimes(1);
    expect(el.props.suivi).toEqual(tableau);
    expect(el.props.suiviIndisponible).toBe(false);
  });

  it("panne de lecture : l'écran des mots reste servi, sans chiffres", async () => {
    session = true;
    lireTableauSuivi.mockRejectedValueOnce(new Error("panne"));
    const el = (await PageMots()) as { props: Props };
    expect(el.props.vue).toBeDefined();
    expect(el.props.suivi).toBeNull();
    expect(el.props.suiviIndisponible).toBe(true);
  });

  it("l'écran affiche le tableau, ou « chiffres indisponibles pour l'instant » sans casser les mots", async () => {
    session = true;
    const vue = ((await PageMots()) as { props: Props }).props.vue as never;
    const avec = renderToStaticMarkup(monter(Ecran, { vue, services: SERVICES, suivi: tableau, suiviIndisponible: false }).rendre());
    expect(avec).toContain("Suivi chiffré par mot");
    expect(avec).toContain('data-ecran="mots"');
    expect(avec).not.toContain("€");
    const sans = renderToStaticMarkup(monter(Ecran, { vue, services: SERVICES, suivi: null, suiviIndisponible: true }).rendre());
    expect(sans).toContain("hiffres indisponibles pour l");
    expect(sans).toContain('data-ecran="mots"');
    expect(sans).not.toContain("Suivi chiffré par mot");
  });

  it("R2 : une redirection levée pendant la lecture du suivi n'est pas avalée", async () => {
    session = true;
    lireTableauSuivi.mockImplementationOnce(async () => redirect("/connexion"));
    await expect(PageMots()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  it("R3 : le tableau est chargé à la demande (aucun import statique), message de panne conservé", () => {
    const src = readFileSync(new URL("../../src/components/mots/EcranMots.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/^import[^\n]*TableauSuiviMots[^\n]*from/m);
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/TableauSuiviMots["']\)/);
    expect(src).toContain("hiffres indisponibles pour l");
  });
});
