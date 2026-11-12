/**
 * Messages écrits pendant la veille (un humain a la main) et liste Zernio incomplète. Données 100 % fictives ; port et site FAUX.
 *  - un « stop » en veille est TOUJOURS lu et enregistré ; rien n'est jamais envoyé en veille (ni M1, ni M2, ni accusé, ni appel au site) ;
 *  - liste incomplète : 6 essais espacés puis clôture « ignore » avec une alerte distincte, sauf pour les oppositions (réessai sans fin).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENTES_PANNE_LECTURE_MS } from "@/domaine/guide-reseau/machine-conversation";
import type { MessageLu } from "@/fournisseurs/zernio-inbox";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";
import { graineConv, lectureParMessage, siteDouble } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const A = "auteur-fictif-400";
const H = 3600_000;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async (id: string) => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(id)];
const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const alertes = async () => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).map((e: any) => String(e.message));
const rienPartiNiAppele = () => port.pub.length + port.prive.length + port.envoyes.length + site.vus.length;
const graine = (etat: string, extra: Record<string, unknown> = {}) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graineConv(etat, extra) });
const veille = (texte: string): MessageLu => ({ texte, postback: null, veille: true });

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("veille · un « stop » est lu, rien n'est jamais envoyé", () => {
  for (const etat of ["attente_email", "m2_envoye", "guide_demande", "termine"]) {
    it(`état ${etat} : « stop » en veille → opposition enregistrée, état oppose, aucun envoi`, async () => {
      await graine(etat);
      port.reponses.lecture = () => veille("stop");
      const id = await deposerMessage(depots, {});
      await passer();
      expect((await evenement(depots, id)).charge.etat).toBe("oppose");
      expect((await etatDe(A)).etat).toBe("oppose");
      expect(await lignes()).toHaveLength(2);
      expect(rienPartiNiAppele()).toBe(0);
    });
  }
  it("orphelin (aucun parcours connu) : « stop » en veille → opposition enregistrée", async () => {
    port.reponses.lecture = () => veille("stop");
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 5; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (ev.traite) break;
      t = Number(ev.charge.prochainEssaiLe ?? t + 60_000);
    }
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(2);
    expect(rienPartiNiAppele()).toBe(0);
  });
  it("adresse écrite en veille → aucun envoi, aucun appel au site, événement clos en silence", async () => {
    await graine("attente_email");
    port.reponses.lecture = () => veille(`mon adresse ${ADRESSE_FICTIVE}`);
    const id = await deposerMessage(depots, {});
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("silence");
    expect((await etatDe(A)).etat).toBe("attente_email");
    expect(rienPartiNiAppele()).toBe(0);
    expect(await lignes()).toHaveLength(0);
  });
  it("texte quelconque en veille (M2 normalement envoyé) → aucun M2", async () => {
    await graine("attente_email");
    port.reponses.lecture = () => veille("bonjour");
    const id = await deposerMessage(depots, {});
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("silence");
    expect(rienPartiNiAppele()).toBe(0);
  });
  it("message normal (hors veille) : inchangé — M2 envoyé, adresse transmise au site", async () => {
    await graine("attente_email");
    port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, {});
    await passer();
    expect(port.envoyes).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("m2_envoye");
    await graine("attente_email");
    port.reponses.texte = () => `adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, {});
    await passer(T0 + 60_000);
    expect(site.vus.length).toBeGreaterThan(0);
  });
});

describe("liste Zernio incomplète · 6 essais puis clôture, sauf pour les oppositions", () => {
  const incomplete = (): MessageLu => ({ texte: null, postback: null, panne: true, codePanne: "liste-incomplete" });
  it("6 essais espacés (délais de panne de lecture), puis « ignore » avec une alerte distincte", async () => {
    await graine("attente_email");
    port.reponses.lecture = incomplete;
    const id = await deposerMessage(depots, {});
    let t = T0;
    const delais: number[] = [];
    for (let i = 0; i < 6; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (i < 5) {
        expect(ev.traite).toBe(false);
        expect(ev.charge.dernierCode).toBe("lecture_panne");
        delais.push(ev.charge.prochainEssaiLe - t);
        t = ev.charge.prochainEssaiLe;
      }
    }
    expect(port.lire).toBe(6);
    expect(delais).toEqual([...ATTENTES_PANNE_LECTURE_MS]);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "ignore", dernierCode: "liste_incomplete" });
    const a = (await alertes()).join("\n");
    expect(a).toContain("liste Zernio trop longue ou incomplète");
    // le septième passage ne relit plus rien
    await passer(t + 24 * H);
    expect(port.lire).toBe(6);
    expect(rienPartiNiAppele()).toBe(0);
  });
  it("avant la clôture, l'alerte reste celle de la panne ordinaire (pas de confusion de texte)", async () => {
    await graine("attente_email");
    port.reponses.lecture = incomplete;
    await deposerMessage(depots, {});
    await passer();
    const a = (await alertes()).join("\n");
    expect(a).not.toContain("liste Zernio trop longue ou incomplète");
  });
  it("une panne ordinaire (réseau) n'est JAMAIS plafonnée", async () => {
    await graine("attente_email");
    port.reponses.lecture = () => ({ texte: null, postback: null, panne: true });
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 9; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      expect(ev.traite).toBe(false);
      t = ev.charge.prochainEssaiLe;
    }
  });
  it("orphelin dont la liste est incomplète : réessai sans fin (un « stop » n'est jamais perdu)", async () => {
    port.reponses.lecture = incomplete;
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 10; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      expect(ev.traite).toBe(false);
      t = Number(ev.charge.prochainEssaiLe ?? t + 60_000);
    }
  });
  it("transmission d'une opposition : liste incomplète réessayée sans fin, jamais abandonnée", async () => {
    const sd = siteDouble();
    pm.injecterTransportSite(sd.transport);
    await graine("guide_demande", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr", idMessageGuide: "msg-adr" });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    lectureParMessage(port, { "msg-adr": `adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP" });
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer();
    port.port.lireMessage = async () => incomplete();
    let t = T0 + 60_000;
    for (let i = 0; i < 12; i++) {
      await OT.transmettreOppositions({ port: port.port, env: ENV, maintenantMs: t });
      t += 24 * H;
    }
    const file = await Com.lireParametre<Record<string, any>>(OT.PARAM_OPPOSITIONS_FILE, {});
    expect(Object.values(file)[0]).toMatchObject({ etat: "a_transmettre", dernierCode: "lecture_panne" });
    expect(sd.opp()).toHaveLength(0);
  });
});
