/**
 * AUTO-REP-01 · preuve par le code : aucune réponse automatique (publique ni privée) ne part JAMAIS sur LinkedIn ni sur TikTok,
 * même avec tous les réglages allumés, et elle reste possible sur Facebook et Instagram.
 *
 * Faux port seulement (tests/zernio/aides), base en mémoire, données fictives : aucun appel réel, aucun envoi.
 * Lecture seule de src/ : on exerce le vrai parcours (`traiterConversations`) et la matrice des capacités.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { textesDepuisSaisie, validerTextes } from "@/services/mots-textes";
import { construireGrapheMot, RESEAUX_AUTOMATIQUES } from "@/services/mots-graphe";
import { CAPACITES, RESEAUX, construireGrapheReseau, grapheConformeAuReseau } from "@/services/mots-capacites";
import { deposerCommentaire, evenement } from "./zernio/aides/conversation";
import { banc, C, Com, COMPTE, depots, envoisSortants, nettoyer, passer, preparer, T0 } from "./zernio/filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");
const { PARAM_INSTAGRAM_PUBLIC, PARAM_INSTAGRAM_SUIVRE } = await import("@/services/parcours-instagram");

/** Tous les noms sous lesquels un évènement pourrait annoncer ces réseaux (réseau du fournisseur, matrice, variantes de casse). */
const INTERDITS = ["linkedin", "linkedin_page", "linkedin_profil", "tiktok", "LinkedIn", "TikTok", " tiktok "] as const;
const AUTORISES = ["facebook", "instagram"] as const;
/** Textes complets et validés par le vrai validateur (sinon le refus pourrait venir des textes et non du réseau). Fictifs. */
const TEXTES = validerTextes(textesDepuisSaisie({ mot: "GUIDE", reponsePublique: "Bonjour ! le guide est sur la page indiquée.", messagePrive: "Bonjour ! Quelle adresse pour le guide ?", relance: null, fin: "Bonjour ! Merci, c'est noté." }));

/** TOUS les réglages allumés : interrupteur général (déjà dans ENV), « Tout arrêter » à sa valeur par défaut (envois autorisés), mots multiples, Instagram public, Instagram « suivre », mot actif, textes validés. */
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
  it("tout réseau dont le nom évoque LinkedIn ou TikTok est refusé « manuel_seulement » en construction de workflow, textes valides (couvre un réseau ajouté plus tard)", () => {
    const sensibles = RESEAUX.filter((r) => /linkedin|tiktok/.test(r));
    expect(sensibles.length).toBeGreaterThanOrEqual(3);
    for (const r of sensibles) {
      const g = construireGrapheReseau(TEXTES, r);
      expect(g.ok).toBe(false);
      if (!g.ok) expect(g.code).toBe("manuel_seulement");
      // Un workflow quelconque n'est jamais déclaré conforme pour ces réseaux.
      expect(grapheConformeAuReseau({ nom: "x", etapes: [{ id: "e1", type: "repondre_commentaire", texte: "Merci", suite: null }] } as never, r)).toBe(false);
    }
  });
  it("le workflow réellement posé chez Zernio (construireGrapheMot, utilisé par la pose des mots) ne se déclenche que sur Facebook et Instagram", () => {
    expect([...RESEAUX_AUTOMATIQUES].sort()).toEqual(["facebook", "instagram"]);
    const g = construireGrapheMot(TEXTES);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const decl = g.workflow.declencheur;
    expect(decl.type).toBe("commentaire_mot_seul");
    const reseaux = decl.type === "commentaire_mot_seul" ? [...decl.reseaux] : [];
    expect(reseaux.length).toBeGreaterThan(0);
    for (const r of reseaux) expect(["facebook", "instagram"]).toContain(r);
    expect(JSON.stringify(g.workflow)).not.toMatch(/linkedin|tiktok/i);
  });
  it("témoin : les mêmes textes valides donnent un workflow pour Facebook et Instagram (le refus ci-dessus vient bien de la règle réseau)", () => {
    for (const r of AUTORISES) {
      const g = construireGrapheReseau(TEXTES, r);
      expect(g.ok).toBe(true);
      if (g.ok) expect(grapheConformeAuReseau(g.workflow, r)).toBe(true);
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
    // Le blocage vient bien de la règle réseau, pas d'une autre garde qui masquerait son absence.
    expect((await evenement(depots, id)).charge.dernierCode).toBe("garde_reseau");
  });

  it("auteur déjà servi sur Facebook : ses commentaires LinkedIn/TikTok sont refusés par la garde réseau (code « garde_reseau ») et rien de plus ne part", async () => {
    // Un parcours Facebook existe pour cet auteur ; un commentaire LinkedIn du même auteur ne doit rien déclencher.
    const auteur = "auteur-fictif-croise";
    await deposerCommentaire(depots, { reseau: "facebook", idAuteur: auteur });
    await passer(T0);
    const apresFacebook = envoisSortants();
    expect(apresFacebook).toBeGreaterThan(0); // témoin : Facebook a bien répondu
    const ids: string[] = [];
    for (const reseau of ["linkedin", "tiktok"]) ids.push(await deposerCommentaire(depots, { reseau, idAuteur: auteur }));
    await passer(T0 + 60_000);
    expect(envoisSortants()).toBe(apresFacebook); // rien de plus
    for (const id of ids) expect((await evenement(depots, id)).charge.dernierCode).toBe("garde_reseau");
  });

  it.each(["youtube", "threads", ""])("réseau inconnu « %s » : fermé aussi (liste blanche), aucun envoi", async (reseau) => {
    const id = await deposerCommentaire(depots, { reseau });
    await passer(T0);
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("garde_reseau");
  });

  it.each(AUTORISES)("témoin « %s » (avec « suivre le compte » éteint, qui exige une formulation validée en plus) : la réponse publique automatique part bien", async (reseau) => {
    // « Instagram : suivre le compte » exige une formulation validée en plus : éteint ici pour que le témoin prouve le chemin de base.
    await Com.ecrireParametre(PARAM_INSTAGRAM_SUIVRE, false);
    await deposerCommentaire(depots, { reseau });
    await passer(T0);
    expect(banc.port.pub.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AUTO-REP-01 · défense d'entrée : le crochet Zernio", () => {
  // Cette barrière est EN PLUS de la garde du parcours (testée plus haut) ; elle ne la remplace pas.
  it("un commentaire annoncé par LinkedIn ou TikTok n'est même pas déposé, et rien ne part", async () => {
    await toutAllumer(true);
    const { crochetCommentaire } = await import("./zernio/filet-guide/_amorce");
    for (const reseau of ["linkedin", "tiktok"] as const) {
      const r = await crochetCommentaire("GUIDE", { reseau: reseau as never, idAuteur: `auteur-fictif-${reseau}` });
      expect(r.deposes).toHaveLength(0); // seule assertion discriminante de ce bloc : la barrière d'entrée refuse le dépôt
    }
    await passer(T0);
    expect(envoisSortants()).toBe(0); // conséquence directe (rien n'est déposé)
  });
  it("témoin : le même crochet dépose le commentaire Facebook, et la réponse part", async () => {
    await toutAllumer(true);
    const { crochetCommentaire } = await import("./zernio/filet-guide/_amorce");
    const r = await crochetCommentaire("GUIDE", { reseau: "facebook", idAuteur: "auteur-fictif-fb" });
    expect(r.deposes.length).toBeGreaterThanOrEqual(1);
    await passer(T0);
    expect(banc.port.pub.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AUTO-REP-01 · branchement", () => {
  it("le parcours exporte bien traiterConversations", () => {
    expect(typeof C.traiterConversations).toBe("function");
  });
});
