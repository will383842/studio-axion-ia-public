/**
 * T3a · cibles d'essai sur Instagram : validationPourEnvoi (parcours-dossier) et préparation des textes.
 * Faux site, dépôts en mémoire, aucun réseau, identifiants factices. Un VRAI mot autre que GUIDE reste « instagram_pas_encore ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_SITE_FICTIF, siteCiblesFactice } from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const V = await import("@/services/mots-validation-par-mot");
const D = await import("@/services/parcours-dossier");
const commun = await import("@/services/_commun");

const T0 = Date.UTC(2026, 10, 14, 10, 0, 0);
const IG = "compte-ig-essai";
const IG2 = "compte-ig-autre";
const FB = "compte-fb-essai-x";
const base = { ...ENV_SITE_FICTIF, PARCOURS_CONVERSATION_TITRE_GUIDE: "Titre serveur fictif" } as Record<string, string>;
const ENV = { ...base, PARCOURS_ESSAI_COMPTES: `${IG},${FB}`, PARCOURS_ESSAI_AUTEURS: "auteur-fictif-400" };
const MOT = "ESSAICONV";
const CODE = "gde-essai05";
const TITRE = "Guide d'essai fictif";
let site: ReturnType<typeof siteCiblesFactice>;
let n = 0;
const ms = () => T0 + ++n * 1_200_000;
const valider = async (env: Record<string, string>) => {
  const a = (await V.apercuTextesMot({ mot: MOT, env, maintenantMs: ms() })).find((x) => x.reseau === "instagram")!;
  return V.validerTextesMot({ mot: MOT, reseau: "instagram", empreinteVue: a.ok ? a.empreinte : "x", confirmeParOperateur: true, env, maintenantMs: ms() });
};
const envoi = (env: Record<string, string>, compte?: string, auteurOk?: boolean) =>
  D.validationPourEnvoi(MOT, "instagram", CODE, TITRE, env, ms(), compte, auteurOk);

beforeEach(async () => {
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  n = 0;
  site = siteCiblesFactice();
  site.cibles.push({ code: CODE, type: "guide", titre: TITRE, actif: true, test: true });
  site.liaisons.length = 0;
  site.liaisons.push({ mot: "essaiconv", reseau: "tous", codeCible: CODE, actif: true });
  pm.injecterTransportSite(site.transport);
  await commun.ecrireParametre("zernio.comptes", {
    lusLe: "2026-11-14T10:00:00.000Z",
    comptes: [
      { id: IG, reseau: "instagram", nom: "Compte Instagram fictif" },
      { id: IG2, reseau: "instagram", nom: "Autre compte Instagram fictif" },
      { id: FB, reseau: "facebook", nom: "Compte Facebook fictif" },
    ],
  });
});
afterEach(() => pm.injecterTransportSite(null));

describe("T3a · préparation (validation des textes) Instagram", () => {
  it("cible d'essai + compte d'essai listé : validation possible", async () => {
    expect((await valider(ENV)).raison).toBe("valide");
  });
  it("aucune liste d'essai : cible_test comme avant", async () => {
    expect((await valider(base)).raison).toBe("cible_test");
  });
});

describe("T3a · validationPourEnvoi Instagram", () => {
  it("cible d'essai, compte et auteur listés : peut partir (null)", async () => {
    expect((await valider(ENV)).raison).toBe("valide");
    expect(await envoi(ENV, IG, true)).toBeNull();
  });
  it("cible d'essai avec un AUTRE compte Instagram non listé : refus", async () => {
    expect((await valider(ENV)).raison).toBe("valide");
    expect(await envoi(ENV, IG2, true)).toBe("instagram_pas_encore");
  });
  it("auteurEssaiOk absent ou faux : refus", async () => {
    expect((await valider(ENV)).raison).toBe("valide");
    expect(await envoi(ENV, IG, undefined)).toBe("instagram_pas_encore");
    expect(await envoi(ENV, IG, false)).toBe("instagram_pas_encore");
  });
  it("compte absent : refus", async () => {
    expect((await valider(ENV)).raison).toBe("valide");
    expect(await envoi(ENV, undefined, true)).toBe("instagram_pas_encore");
  });
  it("VRAIE cible (non test), listes pleines, auteur listé : instagram_pas_encore", async () => {
    site.cibles.find((c) => c.code === CODE)!.test = false;
    expect((await valider(ENV)).raison).toBe("valide");
    expect(await envoi(ENV, IG, true)).toBe("instagram_pas_encore");
  });
  it("cible d'essai sans validation de textes : validation_absente ; réseau inconnu ou autre : instagram_pas_encore", async () => {
    expect(await envoi(ENV, IG, true)).toBe("validation_absente");
    expect(await D.validationPourEnvoi(MOT, "linkedin", CODE, TITRE, ENV, ms(), IG, true)).toBe("instagram_pas_encore");
    expect(await D.validationPourEnvoi(MOT, null, CODE, TITRE, ENV, ms(), IG, true)).toBe("instagram_pas_encore");
  });
  it("GUIDE sur Instagram : inchangé (guide-ia part, le reste refusé)", async () => {
    expect(await D.validationPourEnvoi("GUIDE", "instagram", "guide-ia", "T", ENV)).toBeNull();
    expect(await D.validationPourEnvoi("GUIDE", "instagram", "autre", "T", ENV)).toBe("validation_absente");
  });
});
