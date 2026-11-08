/** Les alertes du parcours de conversation n'envoient JAMAIS de notification push au téléphone (cloche seulement). Données fictives, faux transports. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPTE, ENV, T0, TITRE, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const N = await import("@/services/notifications");

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  pm.injecterTransportSite(fauxSite().transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("alerte du parcours : cloche seulement", () => {
  it("canal « téléphone » + appareil abonné : l'alerte (plafond atteint) ne déclenche aucun push", async () => {
    await Com.ecrireParametre("notifications", { videoPrete: true, echec: true, budget: true, canal: "telephone" });
    await Com.ecrireParametre("push.abonnements", [{ endpoint: "https://exemple.invalid/appareil-fictif", keys: { p256dh: "p", auth: "a" } }]);
    await Com.ecrireParametre("parcours.conversations.compteurs", { [COMPTE]: { heure: Math.floor(T0 / 3600_000) * 3600_000, envois: 30 } });
    await deposerCommentaire(depots, {});
    const port = fauxPort();
    await C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
    const cloche = await depots().notifications.lister((n: any) => n.titre === "Parcours des messages privés");
    expect(cloche.length).toBe(1); // la cloche a l'alerte
    const envoyerPush = vi.fn(async () => ({ envoyes: 1, expires: [] as string[] }));
    await N.diffuserNotifications({ push: { publique: "p", privee: "q", sujet: "mailto:x@example.com" }, email: null, envoyerPush, maintenant: () => T0 });
    expect(envoyerPush).not.toHaveBeenCalled();
  });
});
