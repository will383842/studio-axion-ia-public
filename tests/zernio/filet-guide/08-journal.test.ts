/**
 * FILET GUIDE · 9 — le journal ne contient ni texte de message ni adresse (ni identifiant brut, ni clé, ni empreinte).
 * Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { cleConversation, deposerCommentaire, deposerMessage, SECRET_EMPREINTE, TITRE } from "../aides/conversation";
import { ADRESSE, AUTEUR, banc, C, Com, depots, ENV, graineConv, lireTexteDe, MS, nettoyer, Opp, passer, preparer, T0, toutLeStockage, Z } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

const journal = async (): Promise<string> => JSON.stringify(await depots().evenements.lister(() => true));
const MESSAGE_PERSONNE = `Bonjour, voici mon adresse ${ADRESSE} merci beaucoup`;

async function verifier(): Promise<void> {
  const j = await journal();
  expect(j.startsWith("[{")).toBe(true); // au moins un événement : la vérification a un sens (la longueur exacte varie selon le cas)
  expect(j).not.toContain(ADRESSE);
  expect(j).not.toContain("exemple.test");
  expect(j).not.toContain("@");
  expect(j).not.toContain(MESSAGE_PERSONNE);
  expect(j).not.toContain("merci beaucoup");
  for (const t of [rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }), rendreTexteMp("mp-recu-v2", { titre: TITRE }), rendreTexteMp("mp-m2-v1", {}), rendreTexteMp("mp-pub-igfb-v1", {}), TEXTES_MP["mp-m1-v2"].texte]) expect(j).not.toContain(t as string);
  expect(j).not.toContain("Message automatique envoyé par Axion IA");
  expect(j).not.toContain(AUTEUR);
  expect(j).not.toContain(cleConversation(AUTEUR));
  expect(j).not.toContain(SECRET_EMPREINTE);
  expect(j).not.toMatch(/[0-9a-f]{64}/);
}

describe("9 · le journal ne contient ni texte de message ni adresse", () => {
  it("parcours complet réussi (commentaire, M1, adresse, site, accusé)", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    lireTexteDe(MESSAGE_PERSONNE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(1);
    await verifier();
  });
  it("adresse invalide (M2) et panne du site", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    lireTexteDe("je ne donne rien merci beaucoup");
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    banc.site.reponses = () => ({ statut: 503 });
    lireTexteDe(MESSAGE_PERSONNE);
    await deposerMessage(depots, {});
    await passer(T0 + 2000);
    await verifier();
  });
  it("« stop » en commentaire et en message privé, refus définitif du site", async () => {
    banc.site.reponses = () => ({ statut: 422, corps: {} }); // posée AVANT le passage : la réponse 422 est bien celle que le site donnerait
    await deposerCommentaire(depots, { reseau: "facebook", motSeul: "STOP", idAuteur: "auteur-fictif-402" });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("attente_email") });
    lireTexteDe("stop");
    await deposerMessage(depots, {});
    await passer();
    await verifier();
  });
  it("gardes bloquantes (alertes) : Tout arrêter, disjoncteur, compte hors liste", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false);
    await passer();
    await Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, true);
    await Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } });
    await passer(T0 + 2 * 3600_000);
    await passer(T0 + 4 * 3600_000, { comptesPermis: ["autre-compte-fictif"] });
    expect(await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).not.toHaveLength(0);
    await verifier();
  });
  it("plantage pendant M1 (alerte m1_a_verifier) et plafond atteint", async () => {
    banc.port.reponses.prive = () => {
      throw new Error("plantage simulé");
    };
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    await Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, { "compte-fictif-100": { heure: Math.floor((T0 + 3600_000) / 3600_000) * 3600_000, envois: 30 } });
    await deposerCommentaire(depots, { reseau: "facebook", idAuteur: "auteur-fictif-403" });
    await passer(T0 + 3600_000);
    await verifier();
  });
  it("le stockage complet (tous dépôts) ne contient pas non plus l'adresse après un parcours réussi", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    lireTexteDe(MESSAGE_PERSONNE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    const tout = await toutLeStockage();
    expect(tout).not.toContain(ADRESSE);
    expect(tout).not.toContain("merci beaucoup");
    expect(ENV.PARCOURS_CONVERSATION_ENABLED).toBe("1");
    expect(Opp.PARAM_OPPOSITIONS_MOTS).toBeTruthy();
  });
});
