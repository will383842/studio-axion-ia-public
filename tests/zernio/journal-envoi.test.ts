/**
 * LOG-REFUS · journal des envois (une ligne JSON « studio_envoi » par événement, liste blanche stricte).
 * Zernio simulé, aucun réseau (fetch interdit), clés fictives.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer, CANAUX } from "../helpers/r1-buffer";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0002";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0003";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** Le faux Zernio est rendu par `fournisseurParId("publication", "zernio")` ; tout le reste est le vrai registre. */
const etat: { zernio: FournisseurPublication | null } = { zernio: null };
vi.mock("@/fournisseurs", async (original) => {
  const reel = await original<typeof import("@/fournisseurs")>();
  return { ...reel, fournisseurParId: ((type: string, id: string) => (type === "publication" && id === "zernio" && etat.zernio ? etat.zernio : (reel.fournisseurParId as (t: string, i: string) => unknown)(type, id))) as typeof reel.fournisseurParId };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { PARAM_CANAUX } = await import("@/services/buffer");
const { PARAM_ROUTAGE } = await import("@/services/routage-publication");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { journaliserEnvoi } = await import("@/services/journal-envoi");
const { ciblesZernioPour } = await import("@/services/zernio-cibles");
// Précondition L7-08 : l'envoi du calendrier a son propre réglage, fermé par défaut ; ce fichier teste l'envoi, il l'ouvre.
const { ecrireParametre: ecrireReglageCalendrier } = await import("@/services/_commun");
const { PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");


const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const canal = (id: string, nom: string, service = "facebook", organisationId = "zernio"): CanalPublication => ({ id, organisationId, nom, service, deconnecte: false });
const BUF_AXION = "buffer-fb-axion";
const CANAUX_BUFFER = [canal(BUF_AXION, "Axion-IA.com", "facebook", "org-buffer")];

let canauxZernio: CanalPublication[] = [];
function fauxZernio(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer() {
      return { idExterne: "exemple-post-1", via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return canauxZernio;
    },
  };
}

let lignes: string[] = [];
const PREFIXE = "studio_envoi ";
const evenements = () => lignes.filter((l) => l.startsWith(PREFIXE)).map((l) => JSON.parse(l.slice(PREFIXE.length)) as Record<string, unknown>);

beforeAll(async () => {
  await preparerMotDePasse("essai-log-refus");
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  lignes = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void lignes.push(a.map(String).join(" ")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireReglageCalendrier(PARAM_ENVOI_CALENDRIER, true);
  reinitialiserRequete();
  await auth.seConnecter("essai-log-refus", false);
  etat.zernio = fauxZernio();
  canauxZernio = [canal("zernio-fb-axion-111111", "Axion-IA.com"), canal("zernio-fb-williams-222222", "Williams Jullin")];
  await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: CANAUX_BUFFER });
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("LOG-REFUS · journal des envois", () => {
  it("(a) une ligne JSON, préfixe stable, champs exacts", () => {
    journaliserEnvoi({ action: "essai", outil: "zernio", reseau: "facebook", code: "PAS_PRETE", contenuId: "v-15", nbComptes: 2, brouillon: true });
    expect(lignes).toHaveLength(1);
    expect(lignes[0].startsWith(PREFIXE)).toBe(true);
    expect(lignes[0]).not.toContain("\n");
    const e = evenements()[0];
    expect(Object.keys(e)).toEqual(["ts", "action", "outil", "reseau", "code", "contenuId", "nbComptes", "brouillon"]);
    expect(new Date(e.ts as string).toISOString()).toBe(e.ts);
    expect(e).toMatchObject({ action: "essai", outil: "zernio", reseau: "facebook", code: "PAS_PRETE", contenuId: "v-15", nbComptes: 2, brouillon: true });
  });

  it("(b) texte, email, clé, pseudo, détail technique ne ressortent jamais", () => {
    const piege = { action: "essai", code: "OK", texte: "TEXTE-SECRET", legende: "LEGENDE-SECRETE", email: "a@b.fr", cle: "CLE-SECRETE", jeton: "JETON", pseudo: "PSEUDO-X", detailTechnique: "DETAIL-X", corps: "CORPS-X", canalId: "zernio-fb-axion-111111" };
    journaliserEnvoi(piege as never);
    const brut = lignes.join("\n");
    for (const interdit of ["TEXTE-SECRET", "LEGENDE-SECRETE", "a@b.fr", "CLE-SECRETE", "JETON", "PSEUDO-X", "DETAIL-X", "CORPS-X", "zernio-fb-axion-111111"]) expect(brut).not.toContain(interdit);
    expect(Object.keys(evenements()[0]).sort()).toEqual(["action", "code", "ts"]);
    // Un champ autorisé mais mal formé (phrase, e-mail dans le code) est ignoré aussi.
    lignes = [];
    journaliserEnvoi({ action: "essai", code: "a@b.fr contient du texte", contenuId: "Mon texte libre", reseau: "Facebook Axion IA" });
    expect(Object.keys(evenements()[0]).sort()).toEqual(["action", "ts"]);
  });

  it("(c) PAS_PRETE : vidéo inconnue, refus journalisé avec son code", async () => {
    const r = await envoyerParOutilAction("v-inexistant", "facebook", DEMAIN, { outil: "zernio" });
    expect(r.ok).toBe(false);
    expect(evenements()).toContainEqual(expect.objectContaining({ action: "envoyerParOutilAction", outil: "zernio", reseau: "facebook", code: "PAS_PRETE", contenuId: "v-inexistant" }));
  });

  it("(c) CIBLE_* : rien coché, homonymes, compte inconnu — journalisés avec leur code, sans nom de page", async () => {
    await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio" });
    canauxZernio = [canal("zernio-fb-axion-111111", "Axion-IA.com"), canal("zernio-fb-axion-333333", "Axion-IA.com")];
    await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [BUF_AXION] });
    await ciblesZernioPour(fauxZernio(), "facebook", ["zernio-inconnu"]);
    const codes = evenements().filter((e) => e.action === "ciblesZernioPour").map((e) => e.code);
    expect(codes).toEqual(["CIBLE_ABSENTE", "CIBLE_AMBIGUE", "CIBLE_INCONNUE"]);
    expect(evenements().filter((e) => e.action === "envoyerParOutilAction").map((e) => e.code)).toEqual(["CIBLE_ZERNIO", "CIBLE_ZERNIO"]);
    const brut = lignes.join("\n");
    for (const interdit of ["Axion-IA.com", "Williams", "111111", "333333", "Cochez", "aucune cible"]) expect(brut).not.toContain(interdit);
  });

  it("(c) envoi accepté : « OK », un compte, brouillon", async () => {
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [BUF_AXION] });
    expect(r.ok).toBe(true);
    const e = evenements();
    expect(e).toContainEqual(expect.objectContaining({ action: "ciblesZernioPour", code: "OK", nbComptes: 1 }));
    expect(e).toContainEqual(expect.objectContaining({ action: "envoyerReel", outil: "zernio", reseau: "facebook", code: "OK", nbComptes: 1, brouillon: true, contenuId: VIDEO }));
    expect(e).toContainEqual(expect.objectContaining({ action: "envoyerParOutilAction", code: "OK", nbComptes: 1 }));
    expect(lignes.join("\n")).not.toContain("zernio-fb-axion-111111");
  });
});
