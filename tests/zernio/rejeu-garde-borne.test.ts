/**
 * Rejeu borné sous garde durable : un commentaire bloqué par une garde depuis plus de 24 h (sans conversation en cours sur ce commentaire) se périme
 * au lieu d'être reporté à vie ; le journal ne répète pas une ligne tant que la cause du report ne change pas. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleConversation, deposerCommentaire, evenement } from "./aides/conversation";
import { AUTEUR, banc, C, Com, depots, envoisSortants, graineConv, MS, nettoyer, passer, preparer, registre, T0 } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const MM = await import("@/services/parcours-mots-multiples");

const H = 3600_000;
beforeEach(preparer);
afterEach(nettoyer);

const lignesReport = async (): Promise<number> => (await depots().evenements.lister((e: { message: string }) => /a_reessayer/.test(e.message))).length;
const toutesLesConv = () => Com.lireParametre<Record<string, unknown>>(C.PARAM_CONVERSATIONS, {});

describe.each([["mot unique", false], ["plusieurs mots", true]])("rejeu borné · %s", (_nom, multi) => {
  beforeEach(async () => {
    if (multi) await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  });
  // Garde durable. Mode plusieurs mots : un mot en pause y est écarté AVANT la garde (jamais reporté) ; c'est donc le disjoncteur ouvert qui bloque.
  const bloquer = (): Promise<void> => (multi ? Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }) : registre("pause"));
  const debloquer = async (): Promise<void> => {
    await Com.ecrireParametre(MS.PARAM_GARDES_MOTS, {});
    await registre("actif");
  };
  const CODE = multi ? "garde_disjoncteur_ferme" : "garde_mot_inactif";

  it("1 · commentaire GUIDE reçu il y a 25 h, registre en pause : périmé et clos", async () => {
    await bloquer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "perime", dernierCode: "perime" });
    expect(envoisSortants()).toBe(0);
    expect(await toutesLesConv()).toEqual({});
  });

  it("2 · une fois périmé, registre actif et validation présente : aucun appel au port", async () => {
    await bloquer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H });
    await passer(T0);
    expect(await lignesReport()).toBe(0); // clos : aucun report, donc aucune ligne a_reessayer
    await debloquer();
    await passer(T0 + 61_000);
    expect(banc.port.pub).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).charge.etat).toBe("perime");
    expect(await lignesReport()).toBe(0);
  });

  it("5 · conversation sur le même commentaire mais ni nouveau ni pub_ok, âge > 24 h : périmé", async () => {
    await bloquer();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("attente_email", { idCommentaire: "com-meme" }) });
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H, idCommentaire: "com-meme" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "perime", dernierCode: "perime" });
  });

  it("4 · non-régression : conversation pub_ok sur le même commentaire, âge > 24 h, garde bloquante : l'événement reste a_reessayer", async () => {
    await bloquer();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("pub_ok", { idCommentaire: "com-meme" }) });
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H, idCommentaire: "com-meme" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: CODE });
  });
});

describe("rejeu borné · journal", () => {
  it("3 · deux passages bloqués par la même garde : une seule ligne a_reessayer", async () => {
    await registre("pause");
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    await passer(T0);
    await passer(T0 + 61_000);
    await passer(T0 + 122_000);
    const ev = await evenement(depots, id);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: "garde_mot_inactif" });
    expect(ev.charge.prochainEssaiLe).toBe(T0 + 122_000 + 60_000); // le report, lui, continue
    expect(await lignesReport()).toBe(1);
  });
});
