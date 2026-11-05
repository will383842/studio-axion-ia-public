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
  const port: PortInboxZernio = creerPortInboxZernio({ client: base.client, comptesPermis: COMPTES });
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

  it("429 persistant : reessayerApresSec rendu", async () => {
    const { port } = fabrique([
      { statut: 429, entetes: { "retry-after": "2" }, corps: {} },
      { statut: 429, entetes: { "retry-after": "11" }, corps: {} },
    ]);
    const r = await port.envoyerMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", texte: PRIVE, cle: "k" });
    expect(r).toMatchObject({ statut: "a_reessayer", reessayerApresSec: 11 });
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
  it("erreur de lecture : texte et postback nuls, jamais d'exception brute", async () => {
    const { port } = fabrique([{ statut: 404, corps: { error: ADRESSE } }]);
    expect(await port.lireMessage({ idCompte: "exemple-compte-1", idConversation: "exemple-conv-1", idMessage: "x" })).toEqual({ texte: null, postback: null });
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
