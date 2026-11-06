/**
 * Port inbox Zernio : implémentation réelle au-dessus du client, lecture des seuls messages ENTRANTS,
 * résultats typés (jamais l'erreur brute), non-branchement au démarrage. Données FICTIVES.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { creerPortInboxZernio, type PortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { creerFauxClientZernio } from "./aides/faux-zernio";

const ADRESSE = "lecteur-fictif@example.com";
const PRIVE = rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })!;
const PUBLIC = rendreTexteMp("mp-pub-igfb-v1", {})!;
const COMPTES = ["exemple-compte-1"];
const fabrique = (reponses: Parameters<typeof creerFauxClientZernio>[0], opts: Parameters<typeof creerFauxClientZernio>[1] = {}) => {
  const base = creerFauxClientZernio(reponses, opts);
  const port: PortInboxZernio = creerPortInboxZernio({ client: base.client, comptesPermis: COMPTES, titresGuidesPermis: ["Guide d'exemple"] });
  return { ...base, port };
};

describe("port inbox · écritures", () => {
  it("réponse privée : corps {accountId, message} sans Idempotency-Key", async () => {
    const { port, faux } = fabrique([{ statut: 200, corps: { messageId: "exemple-msg-1" } }]);
    const r = await port.repondreEnPrive({ idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: PRIVE });
    expect(r).toMatchObject({ statut: "envoye", idMessage: "exemple-msg-1" });
    expect(faux.appels[0].json).toEqual({ accountId: "exemple-compte-1", message: PRIVE });
    expect(faux.appels[0].entetes["Idempotency-Key"]).toBeUndefined();
  });

  it("réponse publique : corps {accountId, message, commentId} avec clé dédiée stable", async () => {
    const { port, faux } = fabrique([{ statut: 200, corps: {} }, { statut: 200, corps: {} }]);
    await port.repondreCommentaire({ idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: PUBLIC, cle: "cle-metier-1" });
    await port.repondreCommentaire({ idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: PUBLIC, cle: "cle-metier-1" });
    expect(faux.appels[0].json).toEqual({ accountId: "exemple-compte-1", message: PUBLIC, commentId: "exemple-com-1" });
    const k = faux.appels[0].entetes["Idempotency-Key"];
    expect(k).toMatch(/^inbox-[0-9a-f]{64}$/);
    expect(faux.appels[1].entetes["Idempotency-Key"]).toBe(k);
  });

  it("envoi de message : boutons postback transmis, clé dédiée", async () => {
    const { port, faux } = fabrique([{ statut: 200, corps: { messageId: "exemple-msg-2" } }]);
    const r = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: PRIVE, boutons: [{ titre: "Recevoir ici", payload: "recevoir_ici" }], cle: "cle-metier-2" });
    expect(r).toMatchObject({ statut: "envoye", idMessage: "exemple-msg-2" });
    expect(faux.appels[0].json).toEqual({ accountId: "exemple-compte-1", message: PRIVE, buttons: [{ type: "postback", title: "Recevoir ici", payload: "recevoir_ici" }] });
    expect(faux.appels[0].entetes["Idempotency-Key"]).toMatch(/^inbox-[0-9a-f]{64}$/);
  });

  it("texte libre ou compte hors liste : refus rendu, zéro appel réseau", async () => {
    const { port, faux } = fabrique([]);
    const a = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: `Écrivez à ${ADRESSE}`, cle: "k" });
    const b = await port.repondreEnPrive({ idCompte: "exemple-autre", idPost: "p", idCommentaire: "c", texte: PRIVE });
    expect(a).toMatchObject({ statut: "refuse", code: "chemin-refuse" });
    expect(b).toMatchObject({ statut: "refuse", code: "chemin-refuse" });
    expect(JSON.stringify([a, b])).not.toContain("example.com");
    expect(faux.appels).toHaveLength(0);
  });

  it("« Tout arrêter » : refus rendu sans appel réseau", async () => {
    const { port, faux } = fabrique([], { envoiAutorise: () => false });
    const r = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: PRIVE, cle: "k" });
    expect(r).toMatchObject({ statut: "refuse", code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });

  it("erreurs typées : INBOX_REQUIRED, quota, consommée (définitif), inconnue (à vérifier), 429", async () => {
    const { port, faux } = fabrique([
      { statut: 403, corps: { code: "INBOX_REQUIRED" } },
      { statut: 403, corps: { code: "message_allowance_exceeded" } },
      { statut: 400, corps: { details: { privateReplyConsumed: true } } },
      { statut: 502, corps: { details: { privateReplyOutcome: "unknown" } } },
    ]);
    const p = { idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: PRIVE };
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "refuse", code: "INBOX_REQUIRED" });
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "refuse", code: "message_allowance_exceeded" });
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "definitif", consomme: true });
    // Lecture exigée à ce stade ? non : seules les 5xx la posent ; la dernière réponse est l'inconnue.
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "a_verifier", issueInconnue: true });
    expect(faux.appels).toHaveLength(4);
    // Aucun nouvel essai automatique : un 5e appel est bloqué (lecture exigée), sans réseau.
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "refuse", code: "lecture-requise" });
    expect(faux.appels).toHaveLength(4);
  });

  it("429 sur une écriture : INCERTAIN (même état que à vérifier), Retry-After conservé, aucun rejeu", async () => {
    const { port, faux } = fabrique([{ statut: 429, entetes: { "retry-after": "11" }, corps: {} }]);
    const r = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: PRIVE, cle: "k" });
    expect(r).toMatchObject({ statut: "a_verifier", etat: "a_verifier", code: "limite-incertaine", reessayerApresSec: 11 });
    expect(faux.appels).toHaveLength(1);
  });

  it("l'état à vérifier est rendu dans le résultat (502 inconnue) et « consommée » est définitive", async () => {
    const { port } = fabrique([
      { statut: 400, corps: { privateReplyConsumed: true } },
      { statut: 502, corps: { privateReplyOutcome: "unknown" } },
    ]);
    const p = { idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: PRIVE };
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "definitif", etat: "consommee" });
    expect(await port.repondreEnPrive(p)).toMatchObject({ statut: "a_verifier", etat: "a_verifier", issueInconnue: true });
  });

  it("réponse privée avec boutons : code dédié, distinct de chemin-refuse, zéro appel", async () => {
    const { port, faux } = fabrique([]);
    const r = await port.repondreEnPrive({ idCompte: "exemple-compte-1", idPost: "p", idCommentaire: "c", texte: PRIVE, boutons: [{ titre: "Recevoir", payload: "recevoir_ici" }] });
    expect(r).toMatchObject({ statut: "refuse", code: "boutons-non-supportes" });
    expect(faux.appels).toHaveLength(0);
  });

  it("lien hors de nos domaines ou titre hors liste : refus typés, zéro appel, rien de recopié", async () => {
    const { port, faux } = fabrique([{ statut: 200, corps: { messageId: "exemple-msg-9" } }, { statut: 200, corps: {} }]);
    const base = { idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", cle: "k" };
    const lien = (u: string) => rendreTexteMp("mp-lien-v2", { titre: "Guide d'exemple", lien: u })!;
    // « http:// » n'entre même pas dans le modèle du dictionnaire : refusé aussi (chemin-refuse).
    expect(await port.envoyerMessage({ ...base, texte: lien("http://axion-ia.com/x") })).toMatchObject({ statut: "refuse" });
    for (const mauvais of ["https://evil.example/x", "https://axion-ia.com.evil.example/x", "https://axion-ia.com@evil.example/x", "https://xaxion-ia.com/x"]) {
      const r = await port.envoyerMessage({ ...base, texte: lien(mauvais) });
      expect(r).toMatchObject({ statut: "refuse", code: "lien-hors-domaine" });
      expect(JSON.stringify(r)).not.toContain("evil");
    }
    const titre = await port.envoyerMessage({ ...base, texte: rendreTexteMp("mp-lien-v2", { titre: "Guide inventé", lien: "https://axion-ia.com/fr/guide-ia" })! });
    expect(titre).toMatchObject({ statut: "refuse", code: "guide-inconnu" });
    expect(JSON.stringify(titre)).not.toContain("inventé");
    expect(faux.appels).toHaveLength(0);
    // Nos domaines et sous-domaines passent.
    expect(await port.envoyerMessage({ ...base, texte: lien("https://axion-ia.com/fr/guide-ia") })).toMatchObject({ statut: "envoye" });
    expect(await port.envoyerMessage({ ...base, cle: "k2", texte: lien("https://guides.axion-ia.com/fr/guide-ia") })).toMatchObject({ statut: "envoye" });
  });

  it("réponse publique : lien et titre contrôlés aussi ; sans liste de titres, tout titre est refusé", async () => {
    const { port, faux } = fabrique([]);
    const pub = rendreTexteMp("mp-pub-linkedin-v1", { titre: "Guide d'exemple", lien: "https://evil.example/x" });
    {
      const r = await port.repondreCommentaire({ idCompte: "exemple-compte-1", idPost: "p", idCommentaire: "c", texte: pub!, cle: "k" });
      expect(r).toMatchObject({ statut: "refuse", code: "lien-hors-domaine" });
    }
    const sans = creerPortInboxZernio({ client: fabrique([]).client, comptesPermis: COMPTES });
    expect(await sans.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "c", texte: PRIVE, cle: "k" })).toMatchObject({ statut: "refuse", code: "guide-inconnu" });
    expect(faux.appels).toHaveLength(0);
  });

  it("domainesPermis : une entrée sans point ou commençant par un point est refusée à la construction", () => {
    for (const mauvais of ["com", ".com", ".axion-ia.com", "  "]) {
      expect(() => creerPortInboxZernio({ client: fabrique([]).client, comptesPermis: COMPTES, domainesPermis: [mauvais] })).toThrow();
    }
    expect(() => creerPortInboxZernio({ client: fabrique([]).client, comptesPermis: COMPTES, domainesPermis: ["axion-ia.com"] })).not.toThrow();
  });

  it("le résultat ne contient jamais le corps ni l'adresse de la personne", async () => {
    const { port } = fabrique([{ statut: 403, corps: { code: "INBOX_REQUIRED", error: ADRESSE } }]);
    const r = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: PRIVE, cle: "k" });
    expect(JSON.stringify(r)).not.toContain("example.com");
  });
});

describe("port inbox · lireMessage", () => {
  const messages = [
    { id: "exemple-msg-sortant", direction: "outgoing", text: "Message automatique envoyé par Axion IA. Bonjour" },
    { id: "exemple-msg-echo", direction: "incoming", isEcho: true, text: "écho de notre message" },
    { id: "exemple-msg-entrant", direction: "incoming", text: `Mon adresse : ${ADRESSE}` },
    { id: "exemple-msg-clic", direction: "incoming", postback: { payload: "recevoir_ici" } },
    { id: "exemple-msg-inconnu", text: "sans direction" },
  ];
  const lire = async (idMessage: string) => {
    const { port, faux } = fabrique([{ statut: 200, corps: { messages } }]);
    const r = await port.lireMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", idMessage });
    return { r, faux };
  };

  it("rend le texte d'un message entrant, sans journaliser l'adresse", async () => {
    const { r, faux } = await lire("exemple-msg-entrant");
    expect(r).toEqual({ texte: `Mon adresse : ${ADRESSE}`, postback: null });
    expect(faux.appels[0].url).toContain("accountId=exemple-compte-1");
  });
  it("rend le postback d'un clic entrant", async () => {
    expect((await lire("exemple-msg-clic")).r).toEqual({ texte: null, postback: "recevoir_ici" });
  });
  it("ignore nos messages sortants, les échos et les messages sans direction connue", async () => {
    for (const id of ["exemple-msg-sortant", "exemple-msg-echo", "exemple-msg-inconnu", "exemple-absent"]) {
      expect((await lire(id)).r).toEqual({ texte: null, postback: null });
    }
  });
  it("erreur de lecture : texte et postback nuls, marquée « panne », jamais d'exception brute", async () => {
    const { port } = fabrique([{ statut: 404, corps: { error: ADRESSE } }]);
    expect(await port.lireMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", idMessage: "x" })).toEqual({ texte: null, postback: null, panne: true });
  });
});

describe("port inbox · non branché au démarrage", () => {
  const RACINE = resolve(__dirname, "../..");
  const SRC = resolve(RACINE, "src");
  const PORT = resolve(SRC, "fournisseurs/zernio-inbox.ts");
  const importsDe = (fichier: string): string[] => {
    const code = readFileSync(fichier, "utf8");
    const sortie: string[] = [];
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) sortie.push(m[1]);
    return sortie;
  };
  const resoudre = (depuis: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? resolve(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(depuis), spec) : null;
    if (!base) return null;
    for (const c of [`${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), base]) if (existsSync(c) && /\.tsx?$/.test(c)) return c;
    return null;
  };
  it("ni instrumentation.ts ni la boucle n'atteignent zernio-inbox (import direct ou transitif)", () => {
    const departs = [resolve(SRC, "instrumentation.ts"), resolve(SRC, "services/boucle.ts")];
    const vus = new Set<string>();
    const pile = [...departs];
    while (pile.length) {
      const f = pile.pop()!;
      if (vus.has(f)) continue;
      vus.add(f);
      for (const spec of importsDe(f)) {
        expect(spec, `${f} importe ${spec}`).not.toMatch(/zernio-inbox(\.ts)?$/);
        const r = resoudre(f, spec);
        expect(r, `${f} atteint le port inbox`).not.toBe(PORT);
        if (r) pile.push(r);
      }
    }
    expect(vus.size).toBeGreaterThan(2);
  });
});
