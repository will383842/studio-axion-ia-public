/**
 * PHRASE-1 : une vidéo partie d'une phrase, proposition n° 1 REFUSÉE à la lecture : le maquettiste est rappelé UNE fois, avec les
 * remarques, dans les PROPOSITIONS_PIECE_MAX appels déjà comptés par le plafond. Aucun appel réel : 0 €.
 */
import { describe, expect, it } from "vitest";
import type { DefinitionRole } from "@/generateur/roles/types";
import { roleMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { appliquerSortie, prochainPas, ROLES_TUTORIEL, type EntreesEquipe, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { PROPOSITIONS_PIECE_MAX } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PHRASE_STOCKS, SORTIE_REELLE_SERVEUR } from "./sortie-reelle-phrase1";

const ouvert: EntreesEquipe = { dossier: null, phraseOuverte: true };
const depart = (): EtatEquipe => ({ demande: { phrase: PHRASE_STOCKS }, payes: {} });
const simuler = (entree: Parameters<DefinitionRole["simuler"]>[0]) => (roleMaquettiste as unknown as DefinitionRole).simuler(entree);

type Pas = ReturnType<typeof prochainPas>;
const payant = (p: Pas) => {
  if (!("faire" in p) || !p.payant) throw new Error(`un appel payant était attendu : ${JSON.stringify(p).slice(0, 200)}`);
  return p;
};

/** Le chef classe par règles (0 appel), puis le maquettiste est le pas payant n° 1. */
function premierAppel(): { e: EtatEquipe; p: ReturnType<typeof payant> } {
  const chef = prochainPas(depart(), ouvert);
  if (!("faire" in chef) || chef.payant) throw new Error("les règles du chef étaient attendues");
  return { e: chef.etat, p: payant(prochainPas(chef.etat, ouvert)) };
}

describe("PHRASE-1 · reprise du maquettiste (proposition n° 1 refusée à la lecture)", () => {
  it("a) la sortie réelle du serveur est refusée ; le 2e appel reçoit les remarques ; une sortie correcte donne la pièce « à construire » (proposition 1)", async () => {
    const { e, p } = premierAppel();
    expect(p.faire).toBe("maquettiste");
    expect(p.entree.variable).not.toContain("<remarques_precedentes>");

    const refus = await appliquerSortie(e, "maquettiste", SORTIE_REELLE_SERVEUR, ouvert);
    expect(refus.ok).toBe(false);
    if (refus.ok) return;
    expect(refus.bloquee).toBe(false); // PHRASE-1 : une reprise est encore permise
    expect(refus.etat.appels?.maquettiste).toBe(1);
    expect(refus.etat.remarques?.maquettiste?.length).toBeGreaterThan(0);
    expect(refus.etat.remarques!.maquettiste!.length).toBeLessThanOrEqual(6);
    expect(refus.etat.pieceCreee).toBeUndefined();

    const reprise = payant(prochainPas(refus.etat, ouvert));
    expect(reprise.faire).toBe("maquettiste");
    expect(reprise.entree.variable).toContain("<remarques_precedentes>");
    expect(reprise.entree.variable).toContain("champ inconnu « titre »");
    expect(reprise.entree.variable).toContain("identifiant attendu");
    expect(reprise.entree.variable).toContain("<proposition>1</proposition>"); // la reprise reste la proposition 1
    expect(reprise.empreinteEntree).not.toBe(p.empreinteEntree); // autre entrée : payée comme un nouvel appel, jamais confondue avec le 1er

    const ok = await appliquerSortie(refus.etat, "maquettiste", simuler(reprise.entree), ouvert);
    if (!ok.ok) throw new Error(`sortie correcte refusée : ${JSON.stringify(ok.etat.remarques)}`);
    expect(ok.etat.appels?.maquettiste).toBe(2);
    expect(ok.etat.appels?.maquettiste).toBeLessThanOrEqual(PROPOSITIONS_PIECE_MAX);
    expect(ok.etat.remarques?.maquettiste).toBeUndefined();
    expect(ok.etat.pieceCreee).toMatchObject({ genre: "maquette", proposition: 1, statut: "a-construire" });
    expect(prochainPas(ok.etat, ouvert)).toMatchObject({ pause: { code: "TO_PIECE_A_CONSTRUIRE" } });
  });

  it("b) deux refus : TO_EQUIPE_BLOQUEE, jamais un 3e appel (même en rejouant le pas)", async () => {
    const { e } = premierAppel();
    const un = await appliquerSortie(e, "maquettiste", SORTIE_REELLE_SERVEUR, ouvert);
    expect(un.ok).toBe(false);
    if (un.ok) return;
    payant(prochainPas(un.etat, ouvert));
    const deux = await appliquerSortie(un.etat, "maquettiste", SORTIE_REELLE_SERVEUR, ouvert);
    expect(deux.ok).toBe(false);
    if (deux.ok) return;
    expect(deux.bloquee).toBe(true);
    expect(deux.etat.appels?.maquettiste).toBe(2);
    for (let i = 0; i < 3; i++) {
      const p = prochainPas(deux.etat, ouvert);
      expect("faire" in p).toBe(false);
      expect(p).toMatchObject({ pause: { code: "TO_EQUIPE_BLOQUEE" } });
    }
  });

  it("une réponse illisible (ni objet, ni manque) compte comme un refus : même règle, 2 appels au plus", async () => {
    const { e } = premierAppel();
    let etat = e;
    let appels = 0;
    for (let i = 0; i < 6; i++) {
      const p = prochainPas(etat, ouvert);
      if (!("faire" in p)) break;
      appels++;
      const a = await appliquerSortie(etat, "maquettiste", { illisible: true }, ouvert);
      etat = a.etat;
    }
    expect(appels).toBe(PROPOSITIONS_PIECE_MAX);
    expect(prochainPas(etat, ouvert)).toMatchObject({ pause: { code: "TO_EQUIPE_BLOQUEE" } });
  });

  it("la reprise n'ajoute rien au plafond : essaisMax du maquettiste reste 1 (il entre dans le calcul d'un dossier)", () => {
    expect(ROLES_TUTORIEL.find((r) => r.id === "maquettiste")).toEqual({ id: "maquettiste", essaisMax: 1, payant: "si-manque" });
  });

  it("proposition n° 2 inchangée : une pièce n° 1 acceptée au 1er appel garde son 2e appel pour « En proposer une autre »", async () => {
    const { e, p } = premierAppel();
    const ok = await appliquerSortie(e, "maquettiste", simuler(p.entree), ouvert);
    if (!ok.ok) throw new Error("sortie correcte refusée");
    expect(ok.etat.repriseMaquettiste).toBeUndefined();
    const n2: EtatEquipe = { ...ok.etat, pieceCreee: { ...ok.etat.pieceCreee!, proposition: 2, statut: "a-construire" } };
    const p2 = payant(prochainPas(n2, ouvert));
    expect(p2.entree.variable).toContain("<proposition>2</proposition>");
  });

  it("refus de la proposition n° 2 : bloquée tout de suite (2 appels faits), jamais de reprise de la reprise", async () => {
    const { e, p } = premierAppel();
    const ok = await appliquerSortie(e, "maquettiste", simuler(p.entree), ouvert);
    if (!ok.ok) throw new Error("sortie correcte refusée");
    const n2: EtatEquipe = { ...ok.etat, pieceCreee: { ...ok.etat.pieceCreee!, proposition: 2, statut: "a-construire" } };
    const a = await appliquerSortie(n2, "maquettiste", SORTIE_REELLE_SERVEUR, ouvert);
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.bloquee).toBe(true);
    expect(prochainPas(a.etat, ouvert)).toMatchObject({ pause: { code: "TO_EQUIPE_BLOQUEE" } });
  });

  it("cohérence avec « En proposer une autre » : après une reprise réussie (2 appels), une pièce n° 2 « à construire » n'est JAMAIS une pause éternelle avec l'ancien contenu", async () => {
    const { e } = premierAppel();
    const refus = await appliquerSortie(e, "maquettiste", SORTIE_REELLE_SERVEUR, ouvert);
    if (refus.ok) throw new Error("refus attendu");
    const reprise = payant(prochainPas(refus.etat, ouvert));
    const ok = await appliquerSortie(refus.etat, "maquettiste", simuler(reprise.entree), ouvert);
    if (!ok.ok) throw new Error("sortie correcte refusée");
    expect(ok.etat.repriseMaquettiste).toBe(true);
    // État qu'aurait laissé « En proposer une autre » (le service le refuse désormais, mais l'orchestre ne doit pas dépendre de lui).
    const n2: EtatEquipe = { ...ok.etat, pieceCreee: { ...ok.etat.pieceCreee!, proposition: 2, statut: "a-construire" } };
    const p = prochainPas(n2, ouvert);
    expect("faire" in p).toBe(false);
    expect(p).toMatchObject({ pause: { code: "TO_PIECE_A_REVOIR" } });
    expect((p as { pause: { message: string } }).pause.message).toMatch(/plus d'autre proposition/);
    expect((p as { pause: { message: string } }).pause.message).not.toMatch(/€|\$|euros?/);
  });

  it("flux (« tri d'e-mails ») : un refus ne se rejoue pas tout seul (comme avant)", async () => {
    const chef = prochainPas({ demande: { phrase: "je veux un tri d'e-mails" }, payes: {} }, ouvert);
    if (!("faire" in chef) || chef.payant) throw new Error("règles attendues");
    const a = await appliquerSortie(chef.etat, "maquettiste", { manque: "flux-automatisation", contenu: {} }, ouvert);
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.bloquee).toBe(true);
    expect(prochainPas(a.etat, ouvert)).toMatchObject({ pause: { code: "TO_EQUIPE_BLOQUEE" } });
  });
});
