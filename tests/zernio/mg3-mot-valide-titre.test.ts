/** Suite PR 445 : une formulation validée pour un autre titre de guide ne compte pas. Faux site, dépôts en mémoire, valeurs fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENV_SITE_FICTIF,
  siteCiblesFactice,
} from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const V = await import("@/services/mots-validation-par-mot");

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const env = {
  ...ENV_SITE_FICTIF,
  PARCOURS_CONVERSATION_TITRE_GUIDE: "Titre serveur fictif",
} as unknown as Record<string, string>;
let site: ReturnType<typeof siteCiblesFactice>;
let n = 0;
const maintenantMs = () => T0 + ++n * 20 * MIN;

beforeEach(() => {
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  n = 0;
  site = siteCiblesFactice();
  site.liaisons.length = 0;
  site.liaisons.push({
    mot: "chatgpt",
    reseau: "tous",
    codeCible: "gde-essai01",
    actif: true,
  });
  pm.injecterTransportSite(site.transport);
});

describe("motValidePour : titre de la cible", () => {
  it("validé avec le titre A, le titre du guide change sur le site : faux", async () => {
    const a = (
      await V.apercuTextesMot({ mot: "CHATGPT", env, maintenantMs: maintenantMs() })
    ).find((x) => x.reseau === "facebook")!;
    if (!a.ok) throw new Error("aperçu refusé");
    const titreA = a.cible.titre;
    expect(
      await V.validerTextesMot({
        mot: "CHATGPT",
        reseau: "facebook",
        empreinteVue: a.empreinte,
        confirmeParOperateur: true,
        env,
        maintenantMs: maintenantMs(),
      }),
    ).toEqual({ ok: true, raison: "valide" });
    const requete = (titre?: string) =>
      V.motValidePour({
        mot: "CHATGPT",
        reseau: "facebook",
        codeCible: "gde-essai01",
        titre: titre ?? titreA,
        env,
        maintenantMs: maintenantMs(),
      });
    expect(await requete()).toBe(true);
    site.cibles.find((c) => c.code === "gde-essai01")!.titre =
      "Autre titre fictif";
    expect(await requete()).toBe(false);
  });
});
