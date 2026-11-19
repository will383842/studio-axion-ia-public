/**
 * AUTO-REP-01 · preuve par le code : aucune réponse automatique (publique ni privée) ne part JAMAIS sur LinkedIn ni sur TikTok,
 * même avec tous les réglages allumés, et elle reste possible sur Facebook et Instagram.
 *
 * Faux port seulement (tests/zernio/aides), base en mémoire, données fictives : aucun appel réel, aucun envoi.
 * Lecture seule de src/ : on exerce le vrai parcours (`traiterConversations`) et la matrice des capacités.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPACITES, RESEAUX, construireGrapheReseau, type Reseau } from "@/services/mots-capacites";
import { deposerCommentaire, evenement } from "./zernio/aides/conversation";
import { banc, C, Com, COMPTE, depots, envoisSortants, nettoyer, passer, preparer, T0 } from "./zernio/filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");
const { PARAM_INSTAGRAM_PUBLIC, PARAM_INSTAGRAM_SUIVRE } = await import("@/services/parcours-instagram");

/** Tous les noms sous lesquels un évènement pourrait annoncer ces réseaux (réseau du fournisseur, matrice, variantes de casse). */
const INTERDITS = ["linkedin", "linkedin_page", "linkedin_profil", "tiktok", "LinkedIn", "TikTok", " tiktok "] as const;
const AUTORISES = ["facebook", "instagram"] as const;

/** TOUS les réglages allumés : interrupteur général (déjà dans ENV), mots multiples, Instagram public, Instagram « suivre », mot actif, textes validés. */
async function toutAllumer(multi: boolean): Promise<void> {
  await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, multi);
  await Com.ecrireParametre(PARAM_INSTAGRAM_PUBLIC, true);
  await Com.ecrireParametre(PARAM_INSTAGRAM_SUIVRE, true);
}

beforeEach(preparer);
afterEach(nettoyer);

describe("AUTO-REP-01 · la matrice des capacités", () => {
  it("LinkedIn (page, profil) et TikTok : jamais « auto », jamais automatisables", () => {
    for (const r of ["linkedin_page", "linkedin_profil", "tiktok"] as const) {
      expect(CAPACITES[r].reponsePublique).not.toBe("auto");
      expect(CAPACITES[r].messagePrive).not.toBe("auto");
      expect(CAPACITES[r].automatisable).toBe(false);
    }
  });
  it("tout réseau dont le nom évoque LinkedIn ou TikTok est refusé en construction de workflow (couvre un réseau ajouté plus tard)", () => {
    const sensibles = RESEAUX.filter((r) => /linkedin|tiktok/.test(r));
    expect(sensibles.length).toBeGreaterThanOrEqual(3);
    for (const r of sensibles) {
      const g = construireGrapheReseau({ reponsePublique: "Merci.", messagePrive: "Voici." } as never, r as Reseau);
      expect(g.ok).toBe(false);
    }
  });
  it("témoin : Facebook et Instagram restent automatiques", () => {
    for (const r of AUTORISES) {
      expect(CAPACITES[r].reponsePublique).toBe("auto");
      expect(CAPACITES[r].automatisable).toBe(true);
    }
  });
});

describe.each([
  ["mode simple", false],
  ["mode « plusieurs mots » allumé", true],
])("AUTO-REP-01 · le vrai parcours, tous réglages allumés, faux client (%s)", (_nom, multi) => {
  beforeEach(() => toutAllumer(multi));

  it.each(INTERDITS)("commentaire reçu sur « %s » : AUCUN envoi (ni réponse publique, ni message privé, ni message), même sur un compte autorisé", async (reseau) => {
    const id = await deposerCommentaire(depots, { reseau });
    await passer(T0, { comptesPermis: [COMPTE] });
    expect(banc.port.pub).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(envoisSortants()).toBe(0);
    // Le site peut être LU (catalogue des cibles, GET) ; il ne reçoit jamais d'écriture (adresse, parcours) pour ces réseaux.
    expect(banc.site.vus.filter((r) => r.methode !== "GET")).toHaveLength(0);
    // Rien non plus après de nouveaux passages (reprise, rejeu) : la garde tient dans la durée.
    await passer(T0 + 120_000, { comptesPermis: [COMPTE] });
    await passer(T0 + 3_600_000, { comptesPermis: [COMPTE] });
    expect(envoisSortants()).toBe(0);
    // L'évènement n'est jamais « traité » en envoi : il est écarté ou reporté, jamais clos par un envoi.
    const ev = await evenement(depots, id);
    expect(["public_seul", "m1_envoye", "envoye"]).not.toContain(ev.charge.etat);
  });

  it("même un commentaire sur LinkedIn/TikTok dont l'auteur a déjà une conversation ouverte ne reçoit rien", async () => {
    // Un parcours Facebook existe pour cet auteur ; un commentaire LinkedIn du même auteur ne doit rien déclencher.
    const auteur = "auteur-fictif-croise";
    await deposerCommentaire(depots, { reseau: "facebook", idAuteur: auteur });
    await passer(T0);
    const apresFacebook = envoisSortants();
    expect(apresFacebook).toBeGreaterThan(0); // témoin : Facebook a bien répondu
    for (const reseau of ["linkedin", "tiktok"]) await deposerCommentaire(depots, { reseau, idAuteur: auteur });
    await passer(T0 + 60_000);
    expect(envoisSortants()).toBe(apresFacebook); // rien de plus
  });

  it.each(AUTORISES)("témoin « %s » : la réponse publique automatique part bien (le test ne passe pas parce que tout est coupé)", async (reseau) => {
    // « Instagram : suivre le compte » exige une formulation validée en plus : éteint ici pour que le témoin prouve le chemin de base.
    await Com.ecrireParametre(PARAM_INSTAGRAM_SUIVRE, false);
    await deposerCommentaire(depots, { reseau });
    await passer(T0);
    expect(banc.port.pub.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AUTO-REP-01 · de bout en bout par le crochet Zernio (faux client)", () => {
  it("un commentaire annoncé par LinkedIn ou TikTok ne produit aucun envoi, tout allumé", async () => {
    await toutAllumer(true);
    const { crochetCommentaire } = await import("./zernio/filet-guide/_amorce");
    for (const reseau of ["linkedin", "tiktok"] as const) {
      await crochetCommentaire("GUIDE", { reseau: reseau as never, idAuteur: `auteur-fictif-${reseau}` });
    }
    await passer(T0);
    await passer(T0 + 120_000);
    expect(envoisSortants()).toBe(0);
  });
  it("témoin : le même chemin sur Facebook répond bien", async () => {
    await toutAllumer(true);
    const { crochetCommentaire } = await import("./zernio/filet-guide/_amorce");
    const r = await crochetCommentaire("GUIDE", { reseau: "facebook", idAuteur: "auteur-fictif-fb" });
    expect(r.deposes.length).toBeGreaterThanOrEqual(1);
    await passer(T0);
    expect(banc.port.pub.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AUTO-REP-01 · le code de garde vise le bon motif", () => {
  it("sur LinkedIn l'évènement est reporté avec le code « garde_reseau » (et non par hasard par une autre garde)", async () => {
    await toutAllumer(false);
    const id = await deposerCommentaire(depots, { reseau: "linkedin" });
    await passer(T0);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("garde_reseau");
  });
});

// Garde de lecture : le test doit rester branché sur le vrai parcours.
describe("AUTO-REP-01 · branchement", () => {
  it("le parcours exporte bien traiterConversations", () => {
    expect(typeof C.traiterConversations).toBe("function");
  });
});
