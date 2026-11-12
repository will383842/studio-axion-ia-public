/**
 * Z3b · une personne qui a reçu le lien de la page (son adresse est peut-être chez le site, pas au Studio) écrit « stop » :
 * le « stop » est gardé dans une file dédiée (`parcours.oppositions.page`), la cloche prévient, rien n'est perdu.
 * Partie 2 (côté Studio seulement) : transmission par référence de conversation, derrière OPPOSITIONS_PAR_REF_ENABLED (éteint par défaut).
 * Données 100 % fictives ; port et site FAUX. Aucun identifiant brut, adresse ni jeton dans la file, les journaux ni les alertes.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { voiesOpposition } from "@/domaine/guide-reseau/machine-conversation";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-lien-page-guide-0123456789-abcdef";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const ENV_REF = { ...ENV_LIEN, OPPOSITIONS_PAR_REF_ENABLED: "1" };
const A = "auteur-fictif-400";
const CHEMIN_PAGE = "/api/interne/oppositions-page-guide";

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
let statutPage = 200;
let vusPage: RequeteSignee[] = [];
type Env = Record<string, string | undefined>;
const passer = (env: Env = ENV_LIEN, ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const transmettre = (env: Env = ENV_LIEN, ms = T0 + 1000) => OT.transmettreOppositions({ port: port.port, env, maintenantMs: ms });
const lireParam = (nom: string) => Com.lireParametre<Record<string, any>>(nom, {});
const pagePrm = () => lireParam(OT.PARAM_OPPOSITIONS_PAGE);
const fichePrm = () => lireParam(OT.PARAM_OPPOSITIONS_FILE);
const etatDe = async () => (await lireParam(C.PARAM_CONVERSATIONS))[cleConversation(A)];
const alertesPage = async () => (await depots().notifications.lister((n: any) => /avaient reçu le lien de la page/.test(n.message))) as any[];
const ecrire = async (texte: string, id: string, ms = T0 + 500) => {
  port.reponses.texte = () => texte;
  await deposerMessage(depots, { idMessage: id });
  await passer(ENV_LIEN, ms);
};
/** M1 v3 envoyé (la personne a reçu le lien) : l'état porte `refLienConv`. */
async function personneAvecLien(): Promise<void> {
  await deposerCommentaire(depots, {});
  await passer(ENV_LIEN, T0);
  expect((await etatDe()).refLienConv).toMatch(/^c1_/);
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  statutPage = 200;
  vusPage = [];
  pm.injecterTransportSite(async (r) => {
    if (r.chemin === CHEMIN_PAGE) {
      vusPage.push(r);
      if (statutPage === 0) throw new Error("injoignable");
      return { statut: statutPage, corps: {} };
    }
    return site.transport(r);
  });
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await validerFormulationsAuParcours(["mp-m1-v4-1"]);
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("voiesOpposition (pur)", () => {
  it("adresse = occurredAt texte ; page = refLienConv non vide", () => {
    expect(voiesOpposition({ occurredAt: null })).toEqual({ adresse: false, page: false });
    expect(voiesOpposition({ occurredAt: "2026-01-01T00:00:00.000Z", refLienConv: "c1_x" })).toEqual({ adresse: true, page: true });
    expect(voiesOpposition({ occurredAt: null, refLienConv: "" })).toEqual({ adresse: false, page: false });
    expect(voiesOpposition({ occurredAt: null, refLienConv: null })).toEqual({ adresse: false, page: false });
  });
});

describe("partie 1 : « stop » gardé dans la file de la page", () => {
  it("1 · « stop » en message privé : état oppose, 1 entrée attente_route, rien dans la file adresse, 0 site, 0 message, 1 alerte cloche sans push", async () => {
    await personneAvecLien();
    await ecrire("STOP", "msg-s1");
    await transmettre();
    expect((await etatDe()).etat).toBe("oppose");
    const page = Object.values(await pagePrm());
    expect(page).toHaveLength(1);
    expect(page[0]).toMatchObject({ etat: "attente_route", essais: 0 });
    expect(Object.keys(await fichePrm())).toHaveLength(0);
    expect(site.vus).toHaveLength(0);
    expect(vusPage).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
    const al = await alertesPage();
    expect(al).toHaveLength(1);
    expect(al[0].envoi).toBeUndefined();
    expect(al[0].message).toMatch(/\(1 en attente\)/);
  });
  it("2 · « STOP » en commentaire (même personne) : même résultat, une seule entrée", async () => {
    await personneAvecLien();
    await deposerCommentaire(depots, { motSeul: "STOP", idCommentaire: "com-stop" });
    await passer(ENV_LIEN, T0 + 500);
    await transmettre();
    expect(Object.values(await pagePrm())).toHaveLength(1);
    expect(Object.keys(await fichePrm())).toHaveLength(0);
    expect(await alertesPage()).toHaveLength(1);
  });
  it("3 · deux « stop » et un « Arrête » : toujours 1 entrée ; au plus 1 alerte par heure", async () => {
    await personneAvecLien();
    await ecrire("STOP", "msg-s3a", T0 + 500);
    await ecrire("stop", "msg-s3b", T0 + 600);
    await ecrire("Arrête", "msg-s3c", T0 + 700);
    await transmettre(ENV_LIEN, T0 + 1000);
    await transmettre(ENV_LIEN, T0 + 30 * 60_000);
    expect(Object.values(await pagePrm())).toHaveLength(1);
    expect(await alertesPage()).toHaveLength(1);
  });
  it("4 · rattrapage : conversation mise à oppose à la main (avec refLienConv, sans entrée) : l'entrée est créée à T0 + 11 min", async () => {
    await personneAvecLien();
    const cle = cleConversation(A);
    const toutes = await lireParam(C.PARAM_CONVERSATIONS);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...toutes, [cle]: { ...toutes[cle], etat: "oppose" } });
    expect(Object.keys(await pagePrm())).toHaveLength(0);
    await OT.rattraperOppositions({ env: ENV_LIEN, maintenantMs: T0 + 11 * 60_000 });
    expect(Object.keys(await pagePrm())).toEqual([cle]);
    await OT.rattraperOppositions({ env: ENV_LIEN, maintenantMs: T0 + 30 * 60_000 }); // idempotent
    expect(Object.keys(await pagePrm())).toHaveLength(1);
  });
  it("5 · les deux voies : adresse déjà transmise ET lien reçu : 1 entrée dans CHAQUE file", async () => {
    await personneAvecLien();
    const cle = cleConversation(A);
    const toutes = await lireParam(C.PARAM_CONVERSATIONS);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...toutes, [cle]: { ...toutes[cle], occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adresse-fictif" } });
    await ecrire("STOP", "msg-s5");
    expect(Object.keys(await fichePrm())).toEqual([cle]);
    expect(Object.keys(await pagePrm())).toEqual([cle]);
    expect((await fichePrm())[cle]).toMatchObject({ etat: "a_transmettre" });
  });
  it("6 · sans refLienConv (M1 v2) et sans adresse : aucune entrée nulle part (non-régression)", async () => {
    await deposerCommentaire(depots, {});
    await passer(ENV, T0); // interrupteur du lien éteint : M1 v2
    expect((await etatDe()).refLienConv).toBeUndefined();
    port.reponses.texte = () => "STOP";
    await deposerMessage(depots, { idMessage: "msg-s6" });
    await passer(ENV, T0 + 500);
    await transmettre(ENV);
    expect((await etatDe()).etat).toBe("oppose");
    expect(Object.keys(await pagePrm())).toHaveLength(0);
    expect(Object.keys(await fichePrm())).toHaveLength(0);
    expect(await alertesPage()).toHaveLength(0);
  });
  it("7 · aucune donnée en clair dans la file de la page, les journaux ni les alertes", async () => {
    await personneAvecLien();
    await ecrire("STOP", "msg-s7");
    await transmettre();
    const p = JSON.stringify(await pagePrm());
    for (const interdit of [A, "conv-fictive-700", ADRESSE_FICTIVE, "@", SECRET_LIEN]) expect(p).not.toContain(interdit);
    const clef = Object.values(await pagePrm())[0] as any;
    expect(Object.keys(clef).sort()).toEqual(["cleIdempotence", "creeLe", "dernierCode", "essais", "etat", "prochainEssaiLe", "refLienConv", "reseau"]);
    const tout = JSON.stringify([await depots().evenements.lister(() => true), await depots().notifications.lister(() => true)]);
    for (const interdit of [A, "conv-fictive-700", ADRESSE_FICTIVE, clef.refLienConv, clef.cleIdempotence, SECRET_LIEN]) expect(tout).not.toContain(interdit);
  });
  it("8 · registre illisible au moment du « stop » : événement reporté, rien perdu, l'entrée apparaît au passage suivant", async () => {
    await personneAvecLien();
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, [{ id: "p1.deadbeef." + "0".repeat(64), le: "x", transmise: false }]);
    port.reponses.texte = () => "STOP";
    const id = await deposerMessage(depots, { idMessage: "msg-s8" });
    await passer(ENV_LIEN, T0 + 500);
    const ev = (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === id))[0];
    expect(ev).toMatchObject({ traite: false, charge: { dernierCode: "registre_illisible" } });
    expect(Object.keys(await pagePrm())).toHaveLength(0);
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, []);
    await passer(ENV_LIEN, T0 + 500 + 61_000);
    expect(Object.keys(await pagePrm())).toHaveLength(1);
  });
  it("9 · interrupteur du parcours éteint APRÈS le « stop » : l'entrée reste ; l'alerte continue", async () => {
    await personneAvecLien();
    await ecrire("STOP", "msg-s9");
    const eteint = { ...ENV_LIEN, PARCOURS_CONVERSATION_ENABLED: undefined };
    await transmettre(eteint, T0 + 2000);
    expect(Object.values(await pagePrm())).toHaveLength(1);
    expect(await alertesPage()).toHaveLength(1);
    await transmettre(eteint, T0 + 2 * H); // l'heure suivante : nouvelle alerte, toujours gardée
    expect(Object.values(await pagePrm())[0]).toMatchObject({ etat: "attente_route" });
    expect(await alertesPage()).toHaveLength(2);
  });
});

describe("partie 2 (côté Studio) : OPPOSITIONS_PAR_REF_ENABLED, éteint par défaut", () => {
  async function stopApresLien(): Promise<void> {
    await personneAvecLien();
    await ecrire("STOP", "msg-p2");
  }
  it("éteint (absent, 0) : aucun appel au site pour la file de la page, les entrées restent attente_route", async () => {
    await stopApresLien();
    await transmettre(ENV_LIEN, T0 + 1000);
    await transmettre({ ...ENV_LIEN, OPPOSITIONS_PAR_REF_ENABLED: "0" }, T0 + 2000);
    expect(vusPage).toHaveLength(0);
    expect(Object.values(await pagePrm())[0]).toMatchObject({ etat: "attente_route", essais: 0 });
  });
  it("allumé : une requête signée, octets figés (sans adresse), 200 → transmise ; plus aucun appel ensuite", async () => {
    await stopApresLien();
    const ref = (await etatDe()).refLienConv as string;
    const entree = Object.values(await pagePrm())[0] as any;
    await transmettre(ENV_REF, T0 + 1000);
    expect(vusPage).toHaveLength(1);
    const r = vusPage[0];
    expect(r.methode).toBe("POST");
    expect(r.corps).toBe(JSON.stringify({ schemaVersion: 1, cleIdempotence: entree.cleIdempotence, conv: ref, reseau: "instagram", occurredAt: entree.creeLe }));
    expect(r.corps).not.toMatch(/email|@/);
    const h = r.entetes;
    expect(signatureValide(ENV.SITE_GUIDES_RESEAU_SECRET, { methode: r.methode, chemin: r.chemin, corps: r.corps, horodatage: h["x-axion-horodatage"], nonce: h["x-axion-nonce"], signature: h["x-axion-signature"] })).toBe(true);
    expect(Object.values(await pagePrm())[0]).toMatchObject({ etat: "transmise", dernierCode: "200" });
    await transmettre(ENV_REF, T0 + 3 * H);
    expect(vusPage).toHaveLength(1);
  });
  it("allumé alors que le parcours est éteint : la transmission part quand même", async () => {
    await stopApresLien();
    await transmettre({ ...ENV_REF, PARCOURS_CONVERSATION_ENABLED: undefined }, T0 + 1000);
    expect(vusPage).toHaveLength(1);
  });
  it("409 (même clé) → transmise ; 422 → refusee + alerte sans identifiant ; 503/401/429/0 → réessai sans fin, entrée gardée", async () => {
    await stopApresLien();
    statutPage = 409;
    await transmettre(ENV_REF, T0 + 1000);
    expect(Object.values(await pagePrm())[0]).toMatchObject({ etat: "transmise", dernierCode: "409" });

    for (const [code, attendu] of [[422, "refusee"], [503, "a_transmettre"], [401, "a_transmettre"], [429, "a_transmettre"], [0, "a_transmettre"]] as const) {
      reinitialiserDepots();
      OT.reinitialiserOppositionsTransmission();
      C.reinitialiserParcoursConversation();
      await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
      await validerGuideAuParcours();
      await validerFormulationsAuParcours(["mp-m1-v4-1"]);
      await stopApresLien();
      statutPage = code;
      await transmettre(ENV_REF, T0 + 1000);
      const e = Object.values(await pagePrm())[0] as any;
      expect(e.etat).toBe(attendu);
      if (code === 422) {
        expect((await depots().notifications.lister((n: any) => /refusé une opposition/.test(n.message))).length).toBe(1);
      } else {
        expect(e.essais).toBe(1);
        expect(e.prochainEssaiLe).toBeGreaterThan(T0 + 1000);
        const avant = vusPage.length;
        await transmettre(ENV_REF, T0 + 1000 + 30_000); // pas encore dû
        expect(vusPage).toHaveLength(avant);
        statutPage = 200;
        await transmettre(ENV_REF, T0 + 7 * H);
        expect(Object.values(await pagePrm())[0]).toMatchObject({ etat: "transmise" });
        statutPage = code;
      }
    }
  });
  it("jamais de suppression : les entrées transmises, refusées ou en attente restent dans la file", async () => {
    await stopApresLien();
    await transmettre(ENV_REF, T0 + 1000);
    expect(Object.keys(await pagePrm())).toHaveLength(1);
  });
  it("une file « page » illisible (entrée null) ne bloque jamais le passage : la voie par adresse est quand même traitée, avec ou sans l'interrupteur", async () => {
    await Com.ecrireParametre(OT.PARAM_OPPOSITIONS_PAGE, { entree_illisible: null });
    for (const env of [ENV_LIEN, ENV_REF]) await expect(transmettre(env, T0 + 1000)).resolves.toBeDefined();
    expect(vusPage).toHaveLength(0);
  });
});
describe("8 · message « Bonjour » sans adresse après le message avec lien", () => {
  it("PARCOURS_LIEN_GUIDE allumé, M1 v3 envoyé, puis « Bonjour » : 0 envoi réseau, événement clos en silence, m2Envoye faux", async () => {
    await personneAvecLien();
    const avant = port.envoyes.length;
    port.reponses.texte = () => "Bonjour";
    const id = await deposerMessage(depots, { idMessage: "msg-bonjour-8" });
    await passer(ENV_LIEN, T0 + 500);
    expect(port.envoyes).toHaveLength(avant);
    const ev = (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === id))[0];
    expect(ev.traite).toBe(true);
    expect(ev.charge.etat).toBe("silence");
    expect((await etatDe()).m2Envoye).toBeFalsy();
  });
});
