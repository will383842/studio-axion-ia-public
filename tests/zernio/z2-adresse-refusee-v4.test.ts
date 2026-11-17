/**
 * C2 · formulations v4 du message « adresse refusée » (422). Données fictives ; port et site FAUX.
 * Les v3 restent actives : F1 seule validée = F1 exacte ; rien de validé = rien ne part + alerte ; v3 seule = inchangé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const V3 = "mp-adresse-refusee-v3-1";
const F1 = "mp-adresse-refusee-v4-1";
const F2 = "mp-adresse-refusee-v4-2";
const TEXTE_F1 = "Je n'ai pas pu enregistrer cette adresse e-mail : elle semble mal écrite ou n'est pas reconnue. Je ne peux donc pas y envoyer le guide.";
const A = "auteur-fictif-400";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, env: Record<string, string | undefined> = ENV) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, Record<string, unknown>>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const refuse = () => ({ statut: 422, corps: { erreur: "invalide" } });
const cloches = async () => (await depots().notifications.lister((n: { message: string }) => /n.est validée dans Mots/.test(n.message))).length;

async function ecrireAdresse(idMessage: string, ms = T0 + 1000): Promise<void> {
  port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
  await deposerMessage(depots, { idMessage });
  await passer(ms);
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await deposerCommentaire(depots, {});
  await passer();
  site.reponses = refuse;
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("C2 · formulations « adresse refusée » v4", () => {
  it("F1 et F2 sont au dictionnaire, actives, à la fin du groupe ; les v3 restent actives", () => {
    expect(TEXTES_MP[F1].texte).toBe(TEXTE_F1);
    expect(TEXTES_MP[F2].texte).toBe("Cette adresse e-mail n'a pas été acceptée, peut-être à cause d'une faute de frappe ou d'un format inconnu. Le guide ne peut donc pas partir vers cette adresse.");
    expect(GROUPES_MP["adresse-refusee"]).toEqual(["mp-adresse-refusee-v3-1", "mp-adresse-refusee-v3-2", "mp-adresse-refusee-v3-3", F1, F2]);
    for (const v of GROUPES_MP["adresse-refusee"]) expect((TEXTES_MP as Record<string, { statut?: string }>)[v].statut, v).toBe("actif");
  });

  it("F1 seule validée : le message envoyé est exactement F1, une seule fois", async () => {
    await validerFormulationsAuParcours([F1]);
    await ecrireAdresse("msg-f1");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(TEXTE_F1);
    expect(port.envoyes[0].texte).not.toContain(ADRESSE_FICTIVE);
    expect(await etatDe()).toMatchObject({ etat: "site_refuse", adresseRefuseeEnvoyee: true, formulations: { "adresse-refusee": F1 } });
  });

  it("aucune formulation validée : rien ne part, l'alerte prévue est émise", async () => {
    await Com.ecrireParametre("parcours.validation.formulations", null);
    await ecrireAdresse("msg-aucune");
    expect(port.envoyes).toHaveLength(0);
    expect(await cloches()).toBe(1);
    const etat = await etatDe();
    expect(etat).toMatchObject({ etat: "site_refuse", dernierCode: "422" });
    expect(etat.adresseRefuseeEnvoyee).not.toBe(true);
  });

  it("v3 validée seule : comportement inchangé (le message est la v3, jamais une v4)", async () => {
    await validerFormulationsAuParcours([V3]);
    await ecrireAdresse("msg-v3");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(TEXTES_MP[V3].texte);
    expect([TEXTE_F1, TEXTES_MP[F2].texte]).not.toContain(port.envoyes[0].texte);
    expect(await etatDe()).toMatchObject({ formulations: { "adresse-refusee": V3 } });
  });
});
