/**
 * FILET GUIDE · 1 et 2 — déclenchement du parcours par le mot GUIDE, et guide / titre envoyés.
 * Tests de caractérisation : ils figent le comportement actuel (verts sur master tel quel). Données fictives, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { comptesParcours, titreGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { AUTEUR, banc, C, COMPTE, crochetCommentaire, depots, envoisSortants, ENV, nettoyer, passer, preparer, toutesLesConversations, TITRE } from "./_amorce";
import { deposerCommentaire } from "../aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

describe("1 · le mot GUIDE déclenche le parcours sur un compte Facebook autorisé", () => {
  it.each(["guide", "Guide", "GUIDE", "  GUIDE  ", " guide "])("commentaire « %s » (casse et espaces indifférents) : réponse publique + M1, état attente_email", async (texte) => {
    const r = await crochetCommentaire(texte, { reseau: "facebook" });
    expect(r.statut).toBe(200);
    expect(r.deposes).toHaveLength(1);
    expect(r.deposes[0]).toMatchObject({ reseau: "facebook", motSeul: "GUIDE", proprio: false });
    await passer();
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    const etats = Object.values(await toutesLesConversations());
    expect(etats).toHaveLength(1);
    expect(etats[0]).toMatchObject({ etat: "attente_email", reseau: "facebook", idCompte: COMPTE });
  });

  it.each(["\tGuide\t", "GUIDE\n", "\nguide"])("COMPORTEMENT SURPRENANT FIGÉ : %j (tabulation ou retour à la ligne autour du mot) n'est PAS reconnu — rien n'est déposé", async (texte) => {
    const r = await crochetCommentaire(texte, { reseau: "facebook" });
    expect(r.statut).toBe(200);
    expect(r.deposes).toHaveLength(0);
  });

  it("le même mot sur un compte Instagram déclenche aussi (réseaux pris en charge : instagram et facebook)", async () => {
    await crochetCommentaire("GUIDE", { reseau: "instagram" });
    await passer();
    expect(banc.port.prive).toHaveLength(1);
  });

  it.each(["guides", "le guide", "GUIDE svp", "BONJOUR", "123456789", "super vidéo, merci beaucoup", "guide@exemple.test"])("« %s » n'est pas le mot seul : rien n'est déposé, rien n'est envoyé", async (texte) => {
    const r = await crochetCommentaire(texte, { reseau: "facebook" });
    expect(r.statut).toBe(200);
    expect(r.deposes).toHaveLength(0);
    await passer();
    expect(envoisSortants()).toBe(0);
  });

  it("côté service : un autre mot que GUIDE, un commentaire sans mot et une réponse (estReponse) sont écartés sans effet", async () => {
    const a = await deposerCommentaire(depots, { reseau: "facebook", motSeul: "BONJOUR" });
    const b = await deposerCommentaire(depots, { reseau: "facebook", motSeul: null });
    const c = await deposerCommentaire(depots, { reseau: "facebook", estReponse: true });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(await toutesLesConversations()).toEqual({});
    for (const id of [a, b, c]) {
      const ev = (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === id))[0];
      expect(ev.traite).toBe(true);
      expect(ev.charge.etat).toBe("ecarte");
    }
  });

  it("côté service : la casse et les espaces autour de motSeul sont tolérés (« guide » / « Guide » / « GUIDE » avec espaces)", async () => {
    for (const [i, mot] of ["guide", "Guide", "  GUIDE  "].entries()) await deposerCommentaire(depots, { reseau: "facebook", motSeul: mot, idAuteur: `auteur-fictif-casse-${i}` });
    await passer();
    expect(banc.port.prive).toHaveLength(3);
  });

  it("un mot d'opposition en commentaire ne démarre jamais le parcours : rien n'est envoyé (voir fichier 03)", async () => {
    for (const mot of ["STOP", "arrêt", "Arrêtez !"]) {
      const r = await crochetCommentaire(mot, { reseau: "facebook", idAuteur: `auteur-fictif-opp-${mot.length}` });
      expect(r.deposes).toHaveLength(1);
    }
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(Object.values(await toutesLesConversations()).every((e: any) => e.etat === "oppose")).toBe(true);
  });

  it("la liste des comptes autorisés se lit dans PARCOURS_CONVERSATION_COMPTES (virgules, espaces ignorés, vides ignorés)", () => {
    expect(comptesParcours({ PARCOURS_CONVERSATION_COMPTES: " fictif-a , fictif-b ,, " })).toEqual(["fictif-a", "fictif-b"]);
    expect(comptesParcours({})).toEqual([]);
  });
});

describe("2 · le guide envoyé est « guide-ia », avec le titre de PARCOURS_CONVERSATION_TITRE_GUIDE", () => {
  it("le titre se lit dans PARCOURS_CONVERSATION_TITRE_GUIDE (espaces rognés, absent = vide)", () => {
    expect(titreGuideParcours({ PARCOURS_CONVERSATION_TITRE_GUIDE: "  Guide d'exemple  " })).toBe("Guide d'exemple");
    expect(titreGuideParcours({})).toBe("");
  });
  it("l'état de la conversation porte guide « guide-ia » et la version de texte mp-m1-v2", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    const e: any = Object.values(await toutesLesConversations())[0];
    expect(e.guide).toBe("guide-ia");
    expect(e.versionTexteM1).toBe("mp-m1-v2");
  });
  it("M1 contient le mot GUIDE et le titre fourni ; la réponse publique ne contient aucun titre", async () => {
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer();
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
    expect(banc.port.prive[0].texte).toContain(TITRE);
    expect(banc.port.pub[0].texte).toBe(rendreTexteMp("mp-pub-igfb-v1", {}));
    expect(banc.port.pub[0].texte).not.toContain(TITRE);
  });
  it("un autre titre (PARCOURS_CONVERSATION_TITRE_GUIDE) est inséré tel quel, mais sans validation de ce titre rien ne part", async () => {
    const AUTRE = "Autre titre fictif";
    await crochetCommentaire("GUIDE", { reseau: "facebook" });
    await passer(undefined, { titreGuide: AUTRE }); // validation faite pour TITRE seulement → garde « validation_perimee »
    expect(envoisSortants()).toBe(0);
  });
  it("le modèle M1 n'a pas de titre sans titreGuide : le texte à trous ne part pas (rendu null)", () => {
    expect(TEXTES_MP["mp-m1-v2"].texte).toContain("[TITRE DU GUIDE]");
    expect(rendreTexteMp("mp-m1-v2", { mot: "GUIDE" })).toBeNull();
  });
  it("à la fin du parcours, l'accusé mp-recu-v2 contient le titre (voir fichier 07)", () => {
    expect(rendreTexteMp("mp-recu-v2", { titre: TITRE })).toContain(TITRE);
  });
  it("(contrôle de l'environnement de test) ENV allume bien le parcours", () => {
    expect(C.parcoursConversationActif(ENV)).toBe(true);
    expect(AUTEUR).toBe("auteur-fictif-400");
  });
});
