/** Lot 3a · fonctions pures : adresse e-mail, machine d'états, garde d'import (22). Données fictives. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraireAdresse } from "@/domaine/guide-reseau/adresse-email";
import { doitExpirer, transition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";

const base: Conversation = {
  etat: "nouveau", reseau: "instagram", idCompte: "c", idCommentaire: "com-1", idPostPlateforme: "p", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "a".repeat(64), creeLe: "2026-10-18T10:00:00.000Z", m1Le: null, occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [],
};
const NOW = Date.parse("2026-10-18T10:05:00.000Z");
const com = (o: Partial<Extract<Parameters<typeof transition>[1], { t: "commentaire" }>> = {}) => ({ t: "commentaire" as const, idCommentaire: "com-1", proprio: false, idAuteur: "a", idCompte: "c", motSeul: "GUIDE", estReponse: false, ageMs: 1000, maintenantMs: NOW, ...o });

describe("extraireAdresse", () => {
  it("une seule adresse distincte", () => {
    expect(extraireAdresse("voici : Lecteur.Fictif+x@Example.test merci")).toBe("Lecteur.Fictif+x@Example.test");
    expect(extraireAdresse("a@example.test et A@EXAMPLE.test")).toBe("a@example.test");
  });
  it("aucune, plusieurs, exemple du M2, trop longue : null", () => {
    expect(extraireAdresse("bonjour")).toBeNull();
    expect(extraireAdresse("a@example.test b@example.test")).toBeNull();
    expect(extraireAdresse("par exemple adresse@entreprise.fr")).toBeNull();
    expect(extraireAdresse("ADRESSE@Entreprise.FR")).toBeNull();
    expect(extraireAdresse("x".repeat(250) + "@example.test")).toBeNull();
    expect(extraireAdresse(null)).toBeNull();
  });
  it("l'exemple du M2 n'empêche pas une vraie adresse seule", () => {
    expect(extraireAdresse("adresse@entreprise.fr non, plutôt moi@example.test")).toBe("moi@example.test");
  });
});

describe("machine · commentaire", () => {
  it.each([
    [{ proprio: true }, "proprio"], [{ idAuteur: "c" }, "auteur_compte"], [{ idAuteur: null }, "auteur_compte"], [{ motSeul: null }, "mot"],
    [{ motSeul: "BONJOUR" }, "mot"], [{ estReponse: true }, "reponse"], [{ ageMs: 25 * 3600_000 }, "perime"],
  ] as const)("écarté %j", (o, raison) => {
    expect(transition(null, com(o as never))).toMatchObject({ action: "ecarter", raison });
  });
  it("opposition, nouveau parcours, un parcours par personne, exception m1_refuse > 24 h", () => {
    expect(transition(null, com({ motSeul: "STOP" })).action).toBe("opposer");
    expect(transition(null, com()).action).toBe("demarrer");
    expect(transition({ ...base, etat: "attente_email" }, com({ idCommentaire: "com-2" })).action).toBe("silence");
    expect(transition({ ...base, etat: "m1_refuse" }, com({ idCommentaire: "com-2" })).action).toBe("silence");
    expect(transition({ ...base, etat: "m1_refuse", creeLe: "2026-10-17T09:00:00.000Z" }, com({ idCommentaire: "com-2" })).action).toBe("demarrer");
    expect(transition({ ...base, etat: "pub_ok" }, com()).action).toBe("reprendre");
  });
});

describe("machine · résultats", () => {
  it("public : envoyé, réessai borné à 3, autres codes → on continue vers le privé", () => {
    expect(transition(base, { t: "public", res: { statut: "envoye" } })).toMatchObject({ action: "prive", patch: { etat: "pub_ok" } });
    expect(transition(base, { t: "public", res: { statut: "a_reessayer", code: "debit", reessayerApresSec: 5 } })).toMatchObject({ action: "reessayer", apresMs: 5000 });
    expect(transition({ ...base, essaisPub: 2 }, { t: "public", res: { statut: "a_reessayer", code: "debit" } }).action).toBe("prive");
    expect(transition(base, { t: "public", res: { statut: "a_verifier", code: "a-verifier" } })).toMatchObject({ action: "prive", patch: { dernierCode: "a-verifier" } });
  });
  it("M1 : envoyé / consommée / à vérifier / débit borné / refus", () => {
    const m1 = (res: never) => transition({ ...base, etat: "m1_en_vol" }, { t: "m1", res, maintenantMs: NOW });
    expect(m1({ statut: "envoye" } as never).patch).toMatchObject({ etat: "attente_email" });
    expect(m1({ statut: "definitif", code: "reponse-privee-consommee", consomme: true } as never).patch).toMatchObject({ etat: "m1_consommee" });
    expect(m1({ statut: "a_verifier", code: "reponse-privee-inconnue" } as never).patch).toMatchObject({ etat: "m1_a_verifier" });
    expect(m1({ statut: "a_reessayer", code: "debit" } as never)).toMatchObject({ action: "reessayer", patch: { etat: "pub_ok", essaisM1: 1 } });
    expect(transition({ ...base, essaisM1: 2 }, { t: "m1", res: { statut: "a_reessayer", code: "debit" }, maintenantMs: NOW }).patch).toMatchObject({ etat: "m1_refuse" });
    expect(transition({ ...base, creeLe: "2026-10-01T00:00:00.000Z" }, { t: "m1", res: { statut: "a_reessayer", code: "debit" }, maintenantMs: NOW }).patch).toMatchObject({ etat: "m1_refuse" });
    expect(m1({ statut: "refuse", code: "INBOX_REQUIRED" } as never)).toMatchObject({ blocage: true, patch: { etat: "m1_refuse" } });
    expect(m1({ statut: "refuse", code: "message_allowance_exceeded" } as never).blocage).toBe(true);
    expect(m1({ statut: "refuse", code: "acces" } as never).blocage).toBe(true);
    expect(m1({ statut: "refuse", code: "chemin-refuse" } as never).blocage).toBeFalsy();
  });
  it("expiration à 7 jours après M1, seulement attente_email", () => {
    const e = { ...base, etat: "attente_email" as const, m1Le: "2026-10-11T10:00:00.000Z" };
    expect(doitExpirer(e, Date.parse("2026-10-18T10:00:00.000Z"))).toBe(true);
    expect(doitExpirer(e, Date.parse("2026-10-18T09:59:59.000Z"))).toBe(false);
    expect(doitExpirer({ ...e, etat: "termine" }, NOW)).toBe(false);
  });
  it("orphelin : 2 réessais (30 s, 2 min) puis ignoré ; texte absent : 3 réessais (30 s, 2 min, 10 min)", () => {
    expect([0, 1].map((n) => transition(null, { t: "orphelin", essais: n }).apresMs)).toEqual([30_000, 120_000]);
    expect(transition(null, { t: "orphelin", essais: 2 }).action).toBe("orphelin_ignore");
    expect([0, 1, 2].map((n) => transition(base, { t: "texte_absent", essais: n }).apresMs)).toEqual([30_000, 120_000, 600_000]);
    expect(transition(base, { t: "texte_absent", essais: 3 }).action).toBe("texte_ignore");
  });
});

describe("22 · garde : la machine reste inerte en production", () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  it("ni boucle.ts ni instrumentation.ts n'importent parcours-conversation", () => {
    for (const f of ["src/services/boucle.ts", "src/instrumentation.ts"]) expect(src(f)).not.toMatch(/parcours-conversation/);
  });
  it("aucun autre fichier de src n'importe le service (hors tests)", async () => {
    const { execSync } = await import("node:child_process");
    const l = execSync("grep -rlE 'from .*parcours-conversation' src || true", { cwd: new URL("../../", import.meta.url), encoding: "utf8" }).split("\n").filter(Boolean);
    expect(l).toEqual([]);
  });
  it("les fonctions pures n'importent pas server-only", () => {
    for (const f of ["src/domaine/guide-reseau/machine-conversation.ts", "src/domaine/guide-reseau/adresse-email.ts"]) expect(src(f)).not.toMatch(/server-only/);
  });
});
