/** Lot 5d · réessai d'un « stop » dont la mise en file a échoué, et idempotence du registre. Données 100 % fictives ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerMessage, fauxPort, silencerConsole } from "./aides/conversation";
import { H, MIN, graineConv, lectureParMessage, siteDouble } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof siteDouble>;
const A = "auteur-fictif-400";
const eteint = { ...ENV, PARCOURS_CONVERSATION_ENABLED: undefined };
const passer = (ms = T0, env: Record<string, string | undefined> = ENV) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const transmettre = (ms: number, env: Record<string, string | undefined> = ENV) => OT.transmettreOppositions({ port: port.port, env, maintenantMs: ms });
const file = () => Com.lireParametre<Record<string, any>>(OT.PARAM_OPPOSITIONS_FILE, {});
const tousLesTextes = async (): Promise<string> => JSON.stringify([await depots().parametres.lister(() => true), await depots().evenements.lister(() => true)]);

/** Fait échouer l'écriture de la file tant que `actif.v` est vrai. */
function paneFile(actif: { v: boolean }): void {
  const orig = depots().parametres.enregistrer.bind(depots().parametres);
  vi.spyOn(depots().parametres, "enregistrer").mockImplementation(async (x: any) => {
    if (actif.v && x.id === OT.PARAM_OPPOSITIONS_FILE) throw new Error("panne d'écriture fictive");
    return orig(x);
  });
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = siteDouble();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("« stop » privé dont la mise en file échoue", () => {
  for (const [nom, env] of [["interrupteur allumé", ENV], ["interrupteur éteint pendant la transmission", eteint]] as const) {
    it(`réessai → entrée en file, un seul POST (${nom})`, async () => {
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graineConv("guide_demande", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr", idMessageGuide: "msg-adr" }) });
      await deposerMessage(depots, { idMessage: "msg-adr" });
      lectureParMessage(port, { "msg-adr": `adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP" });
      await deposerMessage(depots, { idMessage: "stop-1" });
      const panne = { v: true };
      paneFile(panne);
      await passer().catch(() => undefined);
      expect(await file()).toEqual({});
      panne.v = false;
      await passer(T0 + 2 * MIN).catch(() => undefined);
      await passer(T0 + 10 * MIN).catch(() => undefined);
      expect(Object.keys(await file())).toEqual([cleConversation(A)]);
      await transmettre(T0 + 11 * MIN, env);
      await transmettre(T0 + H, env);
      expect(site.opp()).toHaveLength(1);
      expect(JSON.parse(site.opp()[0].corps).email).toBe(ADRESSE_FICTIVE);
      expect(await tousLesTextes()).not.toContain(ADRESSE_FICTIVE);
    });
  }
});

describe("enregistrerOppositionPersonne · idempotence", () => {
  it("deux appels aux mêmes entrées : mêmes lignes du registre", async () => {
    const appel = () => OPP.enregistrerOppositionPersonne([A, "conv-fictive-700"], [cleConversation(A)], "zernio-conversation", { env: ENV });
    await appel();
    const apres1 = JSON.stringify(await Com.lireParametre(OPP.PARAM_OPPOSITIONS_MOTS, []));
    await appel();
    const apres2 = JSON.stringify(await Com.lireParametre(OPP.PARAM_OPPOSITIONS_MOTS, []));
    expect(apres2).toBe(apres1);
  });
});
