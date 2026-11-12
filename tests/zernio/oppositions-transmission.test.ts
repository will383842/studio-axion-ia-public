/** Lot 5d · transmission des « stop » au site (file, relecture chez Zernio en mémoire, réessais, alertes). Données 100 % fictives ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleIdempotenceOpaque, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, cleConversation, deposerMessage, fauxPort, silencerConsole } from "./aides/conversation";
import { SchemaOppositionReseau } from "./aides/contrat-site-guides-reseau";
import { CHEMIN_OPP, H, MIN, graineConv, lectureParMessage, siteDouble } from "./aides/oppositions";

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
const cles = () => {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés attendues");
  return k.courante;
};
const passer = (ms = T0, env: Record<string, string | undefined> = ENV) => OT.transmettreOppositions({ port: port.port, env, maintenantMs: ms });
const file = () => Com.lireParametre<Record<string, any>>(OT.PARAM_OPPOSITIONS_FILE, {});
const entree = async (id = A) => (await file())[cleConversation(id)];
const alertes = async () => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))) as any[];
const tousLesTextes = async (): Promise<string> =>
  JSON.stringify([await depots().parametres.lister(() => true), await depots().evenements.lister(() => true), await depots().notifications.lister(() => true), await depots().evenementsFournisseurs.lister(() => true)]);

/** Une personne ayant donné son adresse (message `msg-adr-<id>`), opposée au registre, avec son entrée en file. */
async function semerOpposee(id = A, extra: Record<string, unknown> = {}, o: { enFile?: boolean; adresse?: string | null } = {}): Promise<string> {
  const cle = cleConversation(id);
  const idMessage = `msg-adr-${id}`;
  const conv = graineConv("oppose", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: idMessage, ...extra });
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})), [cle]: conv });
  await deposerMessage(depots, { idMessage, idExpediteur: id });
  await OPP.enregistrerOpposition(id, "zernio-conversation", { env: ENV });
  if (o.enFile !== false) await OT.mettreEnFileOpposition(cle, conv as any, cles(), T0);
  return idMessage;
}
const lire = (table: Record<string, string>) => lectureParMessage(port, table);
const adresseDe = (id = A) => ({ [`msg-adr-${id}`]: `Voici mon adresse : ${ADRESSE_FICTIVE}, merci.` });

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = siteDouble();
  pm.injecterTransportSite(site.transport);
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("constantes partagées avec le parcours", () => {
  it("mêmes valeurs que parcours-conversation.ts (pas d'import entre les deux sens)", () => {
    expect(OT.PARAM_CONVERSATIONS).toBe(C.PARAM_CONVERSATIONS);
    expect(OT.VARIABLE_INTERRUPTEUR_CONVERSATION).toBe(C.VARIABLE_INTERRUPTEUR_CONVERSATION);
  });
});

describe("mettreEnFileOpposition", () => {
  it("une seule entrée par personne, clé d'idempotence calculée une fois puis stockée, aucune adresse", async () => {
    const idMessage = await semerOpposee();
    const cle = cleConversation(A);
    const e1 = await entree();
    expect(e1).toMatchObject({ cleIdempotence: cleIdempotenceOpaque(cles(), "opposition", cle), reseau: "instagram", etat: "a_transmettre", essais: 0, prochainEssaiLe: null, dernierCode: null });
    expect(typeof e1.creeLe).toBe("string");
    expect(typeof e1.depuis).toBe("string");
    // idempotente : un second appel (autre secret courant simulé : clé différente) ne remplace rien
    const conv = (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cle];
    await OT.mettreEnFileOpposition(cle, conv, { kid: "autre000", secret: Buffer.from("autre-secret-fictif-de-test-0123456789ab") });
    expect(Object.keys(await file())).toHaveLength(1);
    expect((await entree()).cleIdempotence).toBe(e1.cleIdempotence);
    expect(JSON.stringify(await file())).not.toMatch(/@|example\.test/);
    expect(idMessage).toBeTruthy();
  });
  it("personne dont l'adresse n'a jamais été transmise (occurredAt null) : rien en file", async () => {
    const cle = cleConversation(A);
    const conv = graineConv("oppose");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: conv });
    await OT.mettreEnFileOpposition(cle, conv as any, cles());
    expect(await file()).toEqual({});
    expect(await depots().parametres.obtenir(OT.PARAM_OPPOSITIONS_FILE)).toBeFalsy(); // aucune écriture
  });
});

describe("transmettreOppositions · nominal et rejeu", () => {
  it("relit le message, envoie le corps strict signé, marque transmise (file et registre), sans journaliser l'adresse", async () => {
    await semerOpposee();
    lire(adresseDe());
    const r = await passer();
    expect(r.transmises).toBe(1);
    expect(site.opp()).toHaveLength(1);
    expect(site.opp()[0]).toMatchObject({ methode: "POST", chemin: CHEMIN_OPP });
    const corps = JSON.parse(site.opp()[0].corps);
    expect(SchemaOppositionReseau.parse(corps)).toMatchObject({ email: ADRESSE_FICTIVE, motif: "stop", reseau: "instagram", schemaVersion: 1 });
    expect(Object.keys(corps).sort()).toEqual(["cleIdempotence", "email", "motif", "occurredAt", "reseau", "schemaVersion"]);
    expect(corps.cleIdempotence).toBe((await entree()).cleIdempotence);
    expect(site.invalides).toEqual([]);
    expect((await entree()).etat).toBe("transmise");
    const reg = await Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, []);
    expect(reg.every((l) => l.transmise === true)).toBe(true);
    expect(await tousLesTextes()).not.toContain(ADRESSE_FICTIVE);
    expect(await tousLesTextes()).not.toContain("example.test");
  });
  it("rejeu : un second passage ne renvoie rien", async () => {
    await semerOpposee();
    lire(adresseDe());
    await passer();
    await passer(T0 + 5 * MIN);
    await passer(T0 + 2 * H);
    expect(site.opp()).toHaveLength(1);
    expect(port.lire).toBe(1);
  });
  it("réessai après 500 : même clé d'idempotence, MÊMES octets de corps, attente d'une minute", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 500;
    await passer();
    expect(await entree()).toMatchObject({ etat: "a_transmettre", essais: 1, dernierCode: "500", prochainEssaiLe: T0 + MIN });
    await passer(T0 + 59_000);
    expect(site.opp()).toHaveLength(1);
    site.reponseOpp = () => 200;
    await passer(T0 + 61_000);
    expect(site.opp()).toHaveLength(2);
    expect(site.opp()[1].corps).toBe(site.opp()[0].corps);
    expect((await entree()).etat).toBe("transmise");
    expect(port.lire).toBe(2); // l'adresse est relue à chaque essai, jamais gardée
  });
  it("deux passages simultanés : un seul POST", async () => {
    await semerOpposee();
    lire(adresseDe());
    await Promise.all([passer(), passer()]);
    expect(site.opp()).toHaveLength(1);
  });
});

describe("transmettreOppositions · conversation d'avant le lot 4 (idMessageAdresse absent)", () => {
  it("repli sur idMessageGuide : l'adresse est relue et le « stop » est transmis", async () => {
    const idMessage = await semerOpposee(A, { idMessageAdresse: null, idMessageGuide: `msg-adr-${A}` });
    expect(idMessage).toBeTruthy();
    lire(adresseDe());
    const r = await passer();
    expect(r.transmises).toBe(1);
    expect(site.opp()).toHaveLength(1);
    expect((await entree()).etat).toBe("transmise");
  });
});

describe("transmettreOppositions · panne du site", () => {
  it("503 → 500 → 0 → 200 : délais 1, 5, 15 min, jamais d'abandon, une alerte au plus par heure", async () => {
    await semerOpposee();
    lire(adresseDe());
    let t = T0;
    const suite = [503, 500, 0, 200];
    let i = 0;
    site.reponseOpp = () => suite[i++];
    await passer(t);
    expect(await entree()).toMatchObject({ essais: 1, dernierCode: "503", prochainEssaiLe: t + 1 * MIN });
    t += 1 * MIN;
    await passer(t);
    expect(await entree()).toMatchObject({ essais: 2, dernierCode: "500", prochainEssaiLe: t + 5 * MIN });
    t += 5 * MIN;
    await passer(t);
    expect(await entree()).toMatchObject({ essais: 3, dernierCode: "0", prochainEssaiLe: t + 15 * MIN, etat: "a_transmettre" });
    t += 15 * MIN;
    await passer(t);
    expect((await entree()).etat).toBe("transmise");
    expect(site.opp()).toHaveLength(4);
    expect((await alertes()).length).toBeLessThanOrEqual(1);
  });
  it("palier 60 min puis 6 h SANS FIN : l'entrée n'est jamais abandonnée", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 502;
    let t = T0;
    const delais: number[] = [];
    for (let n = 0; n < 9; n++) {
      await passer(t);
      const e = await entree();
      expect(e.etat).toBe("a_transmettre");
      delais.push(e.prochainEssaiLe - t);
      t = e.prochainEssaiLe;
    }
    expect(delais).toEqual([1 * MIN, 5 * MIN, 15 * MIN, 60 * MIN, 6 * H, 6 * H, 6 * H, 6 * H, 6 * H]);
    expect(site.opp()).toHaveLength(9);
  });
  it("401 : alerte « secret du site », l'entrée reste à transmettre ; 429, 404, 409 : réessai", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 401;
    await passer(T0);
    expect(await entree()).toMatchObject({ etat: "a_transmettre", dernierCode: "401", essais: 1 });
    expect((await alertes()).some((a) => /secret du site/.test(a.message))).toBe(true);
    for (const [n, statut] of [429, 404, 409].entries()) {
      site.reponseOpp = () => statut;
      await passer((await entree()).prochainEssaiLe);
      expect(await entree()).toMatchObject({ etat: "a_transmettre", dernierCode: String(statut), essais: n + 2 });
    }
  });
  it("503 : alerte « OPPOSITIONS_RESEAU_ENABLED éteint côté site », une seule par heure puis une nouvelle ensuite", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 503;
    await passer(T0);
    await passer(T0 + 1 * MIN);
    await passer(T0 + 6 * MIN);
    const a = (await alertes()).filter((x) => /OPPOSITIONS_RESEAU_ENABLED/.test(x.message));
    expect(a).toHaveLength(1);
    expect(a[0].message).toMatch(/éteint côté site/);
    await passer(T0 + 6 * MIN + 61 * MIN + 1);
    expect((await alertes()).filter((x) => /OPPOSITIONS_RESEAU_ENABLED/.test(x.message))).toHaveLength(2);
  });
  it("422 : refusée + alerte, entrée GARDÉE, aucun nouvel essai", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 422;
    await passer(T0);
    expect(await entree()).toMatchObject({ etat: "refusee", dernierCode: "422" });
    expect((await alertes()).length).toBeGreaterThanOrEqual(1);
    await passer(T0 + 7 * H);
    expect(site.opp()).toHaveLength(1);
    expect(await entree()).toBeDefined();
  });
  it("site non relié (secret absent) : aucune lecture, l'entrée attend, alerte", async () => {
    await semerOpposee();
    lire(adresseDe());
    await passer(T0, { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined });
    expect(site.vus).toHaveLength(0);
    expect(port.lire).toBe(0);
    expect(await entree()).toMatchObject({ etat: "a_transmettre", dernierCode: "site_non_relie" });
  });
});

describe("transmettreOppositions · relecture chez Zernio", () => {
  it("panne de lecture (réponse en panne puis exception) : réessai à délai croissant, aucun POST, jamais d'abandon", async () => {
    await semerOpposee();
    let casse = true;
    lectureParMessage(port, { "msg-adr-auteur-fictif-400": { texte: null, postback: null, panne: true } });
    await passer(T0);
    expect(await entree()).toMatchObject({ etat: "a_transmettre", dernierCode: "lecture_panne", essais: 1 });
    const t1 = (await entree()).prochainEssaiLe;
    expect(t1).toBeGreaterThan(T0);
    lectureParMessage(port, adresseDe(), { exception: () => casse });
    await passer(t1);
    const e2 = await entree();
    expect(e2).toMatchObject({ etat: "a_transmettre", essais: 2 });
    expect(e2.prochainEssaiLe - t1).toBeGreaterThan(t1 - T0);
    expect(site.vus).toHaveLength(0);
    casse = false;
    await passer(e2.prochainEssaiLe);
    expect(site.opp()).toHaveLength(1);
    expect((await entree()).etat).toBe("transmise");
  });
  it("message introuvable 4 fois : adresse_illisible + alerte « à reporter à la main dans le CRM », aucun POST, entrée gardée", async () => {
    await semerOpposee();
    lire({});
    let t = T0;
    for (let n = 1; n <= 3; n++) {
      await passer(t);
      const e = await entree();
      expect(e).toMatchObject({ etat: "a_transmettre", dernierCode: "message_introuvable" });
      t = e.prochainEssaiLe;
    }
    expect((await alertes()).some((a) => /à la main dans le CRM/.test(a.message))).toBe(false);
    await passer(t);
    expect(await entree()).toMatchObject({ etat: "adresse_illisible" });
    expect((await alertes()).some((a) => /opposition à reporter à la main dans le CRM/.test(a.message))).toBe(true);
    expect(port.lire).toBe(4);
    expect(site.vus).toHaveLength(0);
    await passer(t + 24 * H);
    expect(port.lire).toBe(4);
  });
  it("message sans adresse (ou deux adresses) 4 fois : adresse_illisible", async () => {
    await semerOpposee();
    lire({ "msg-adr-auteur-fictif-400": "merci, à bientôt" });
    let t = T0;
    for (let n = 0; n < 4; n++) {
      await passer(t);
      t = (await entree()).prochainEssaiLe ?? t;
    }
    expect((await entree()).etat).toBe("adresse_illisible");
    expect(site.vus).toHaveLength(0);
  });
  it("événement du message d'adresse introuvable dans la base : même chemin (lectures vaines), puis adresse_illisible", async () => {
    await semerOpposee(A, { idMessageAdresse: "msg-inconnu" });
    lire(adresseDe());
    let t = T0;
    for (let n = 0; n < 4; n++) {
      await passer(t);
      t = (await entree()).prochainEssaiLe ?? t;
    }
    expect((await entree()).etat).toBe("adresse_illisible");
    expect(port.lire).toBe(0);
  });
});

describe("transmettreOppositions · plafond et alerte d'attente", () => {
  it("au plus 10 entrées par passage", async () => {
    for (let n = 0; n < 12; n++) await semerOpposee(`personne-${n}`);
    lire(Object.assign({}, ...Array.from({ length: 12 }, (_, n) => adresseDe(`personne-${n}`))));
    await passer(T0);
    expect(site.opp()).toHaveLength(10);
    await passer(T0 + MIN);
    expect(site.opp()).toHaveLength(12);
  });
  it("une entrée qui attend depuis plus de 6 h déclenche une alerte (au plus une par heure)", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 500;
    await passer(T0);
    await passer(T0 + 5 * H);
    expect((await alertes()).filter((a) => /plus de 6 h/.test(a.message))).toHaveLength(0);
    await passer(T0 + 7 * H);
    await passer(T0 + 7 * H + 5 * MIN);
    expect((await alertes()).filter((a) => /plus de 6 h/.test(a.message))).toHaveLength(1);
  });
});

describe("interrupteur éteint", () => {
  const eteint = { ...ENV, PARCOURS_CONVERSATION_ENABLED: undefined };
  it("éteint ET file vide : aucun appel au port ni au site, aucune écriture", async () => {
    const avant = JSON.stringify(await depots().parametres.lister(() => true));
    const ecrire = vi.spyOn(depots().parametres, "enregistrer");
    const journal = vi.spyOn(depots().evenements, "enregistrer");
    const r = await passer(T0, eteint);
    expect(r.transmises).toBe(0);
    expect(port.total()).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect(ecrire).not.toHaveBeenCalled();
    expect(journal).not.toHaveBeenCalled();
    expect(JSON.stringify(await depots().parametres.lister(() => true))).toBe(avant);
  });
  it("éteint mais conversation à rattraper : la réconciliation n'ajoute rien (rien ne change)", async () => {
    await semerOpposee(A, {}, { enFile: false });
    await passer(T0, eteint);
    expect(await file()).toEqual({});
    expect(await OT.rattraperOppositions({ env: eteint, maintenantMs: T0 })).toBe(0);
    expect(await file()).toEqual({});
  });
  it("éteint mais « stop » déjà en file : il est quand même transmis (décision 2)", async () => {
    await semerOpposee();
    lire(adresseDe());
    await passer(T0, eteint);
    expect(site.opp()).toHaveLength(1);
    expect((await entree()).etat).toBe("transmise");
  });
});

describe("registre : empreintesOpposees et marquerTransmiseParEmpreinte", () => {
  it("empreintesOpposees reconnaît n'importe laquelle des formes, false sinon", async () => {
    await OPP.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    expect(await OPP.empreintesOpposees(["p1.00000000." + "1".repeat(64), cleConversation(A)], { env: ENV })).toBe(true);
    expect(await OPP.empreintesOpposees([cleConversation("autre-fictive")], { env: ENV })).toBe(false);
    expect(await OPP.empreintesOpposees([], { env: ENV })).toBe(false);
  });
  it("registre illisible (kid inconnu) ou secret absent : l'erreur est levée (échec fermé)", async () => {
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, [{ id: "p1.deadbeef." + "0".repeat(64), le: "x", transmise: false }]);
    await expect(OPP.empreintesOpposees([cleConversation(A)], { env: ENV })).rejects.toThrow();
    await expect(OPP.empreintesOpposees([cleConversation(A)], { env: { ...ENV, STUDIO_EMPREINTE_SECRET: undefined } })).rejects.toThrow();
  });
  it("marquerTransmiseParEmpreinte marque la ligne retrouvée par une forme (alias compris), sans toucher aux autres", async () => {
    await OPP.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    await OPP.enregistrerOpposition("autre-fictive", "zernio-conversation", { env: ENV });
    await OPP.marquerTransmiseParEmpreinte(cleConversation(A), { env });
    const reg = await Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, []);
    expect(reg.map((l) => l.transmise)).toEqual([true, false]);
  });
});
const env = ENV;

describe("réconciliation", () => {
  it("ajoute les conversations opposées (état ou registre) dont l'adresse a été transmise ; ignore les autres", async () => {
    await semerOpposee("p-etat", {}, { enFile: false });
    // opposée seulement au registre (état « termine ») avec un alias
    const cleReg = cleConversation("p-registre");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})), [cleReg]: graineConv("termine", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "m", alias: [cleConversation("alias-reg")] }) });
    await OPP.enregistrerOpposition("alias-reg", "zernio-conversation", { env: ENV });
    // jamais d'adresse transmise : rien
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})), [cleConversation("p-sans-adresse")]: graineConv("oppose") });
    // pas opposée
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})), [cleConversation("p-libre")]: graineConv("termine", { occurredAt: new Date(T0 - H).toISOString() }) });
    const n = await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 });
    expect(n).toBe(2);
    expect(Object.keys(await file()).sort()).toEqual([cleConversation("p-etat"), cleReg].sort());
    // idempotente, et limitée à une fois toutes les 10 minutes
    expect(await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 11 * MIN })).toBe(0);
    await semerOpposee("p-tard", {}, { enFile: false });
    expect(await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 12 * MIN })).toBe(0);
    expect(await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 22 * MIN })).toBe(1);
  });
  it("registre illisible : l'erreur est levée, rien n'est ajouté", async () => {
    await semerOpposee("p-etat", {}, { enFile: false });
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, [{ id: "p1.deadbeef." + "0".repeat(64), le: "x", transmise: false }]);
    await expect(OT.rattraperOppositions({ env: ENV, maintenantMs: T0 })).rejects.toThrow();
    expect(await file()).toEqual({});
  });
  it("transmettreOppositions rattrape puis transmet dans le même passage", async () => {
    await semerOpposee(A, {}, { enFile: false });
    lire(adresseDe());
    await passer(T0);
    expect(site.opp()).toHaveLength(1);
  });
});

describe("aucune fuite d'adresse", () => {
  it("ni journal, ni notifications, ni paramètres, ni charges, ni console, quels que soient les échecs", async () => {
    await semerOpposee();
    lire(adresseDe());
    let t = T0;
    for (const statut of [401, 503, 500, 0, 422]) {
      site.reponseOpp = () => statut;
      await passer(t);
      t = ((await entree()).prochainEssaiLe ?? t) + 1;
    }
    // panne de lecture et lecture introuvable
    await semerOpposee("personne-2");
    lectureParMessage(port, {}, {});
    for (let n = 0; n < 5; n++) await passer(T0 + (n + 1) * 7 * H);
    const texte = await tousLesTextes();
    expect(texte).not.toMatch(/example\.test|@/);
    const sorties = (["log", "error", "warn", "info"] as const).flatMap((m) => (console[m] as any).mock.calls);
    expect(JSON.stringify(sorties)).not.toMatch(/example\.test|@/);
    expect(JSON.stringify(site.opp().map((r) => r.corps)).includes("example.test")).toBe(true); // seul le corps du POST (en mémoire) la porte
    expect(texte).not.toContain(site.opp()[0].corps);
    expect(texte).not.toContain(ENV.SITE_GUIDES_RESEAU_SECRET);
  });
  it("le journal ne contient que des codes : aucune clé d'idempotence, aucune empreinte", async () => {
    await semerOpposee();
    lire(adresseDe());
    site.reponseOpp = () => 500;
    await passer(T0);
    const e = await entree();
    const journal = JSON.stringify(await depots().evenements.lister(() => true)) + JSON.stringify(await depots().notifications.lister(() => true));
    expect(journal).not.toContain(e.cleIdempotence);
    expect(journal).not.toContain(cleConversation(A));
    expect(MS.CHEMIN_OPPOSITIONS_SITE).toBe(CHEMIN_OPP);
  });
});
