/**
 * GARDE-FOUS BUDGET · re-relecture A09 (PR #254), dettes de « Reprendre (≈ X €) ». Faux `fetch`, aucune clé réelle, 0 €.
 *  1. L'écran montre la SOMME de toutes les écritures du sujet que le serveur fera confirmer (pas seulement la première),
 *     au centime d'euro près du montant exigé : l'accord donné au prix affiché suffit.
 *  2. Le devis d'une reprise compte la MÊME limite validée que la réserve du tour (corps supplémentaire au « tu »).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Parcours de bout en bout (lancement, boucle, reprise) : plus long que les 5 s par défaut sur un poste chargé.
vi.setConfig({ testTimeout: 30_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const mat = await import("@/services/matieres");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { proposerTypeMatiere } = await import("@/domaine/derivations-generateur");

const MDP = "essai-garde-fous-reprise-sujet";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 100_000);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

const generation = async (id: string) => (await depots().generations.obtenir(id))!;

describe("Re-relecture A09 · l'écran montre la somme que le serveur fait confirmer", () => {
  it("deux écritures du sujet au plafond : prix affiché = somme des deux ; l'accord à ce prix relance les deux", async () => {
    for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
    for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
    await ecrireParametre("fournisseur.script", "claude");
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...SUJETS_BANC[0].reseaux], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
    if (!r.ok) throw new Error("lancement");
    // Grande chaîne, plafond par défaut : refusée avant le 1er appel.
    await bg.tourBoucleGeneration();
    const g = await generation(r.generationId);
    expect(g.statut).toBe("plafond-atteint");
    // Une seconde écriture du même sujet, au plafond elle aussi (copie : mêmes réglages, son propre plafond).
    const seconde = { ...g, id: "gen-seconde", portee: "format-supplementaire" as const, plafondUsd: 100, creeLe: new Date(Date.parse(g.creeLe) + 1000).toISOString() };
    await depots().generations.enregistrer(seconde);
    await ecrireParametre(`generateur.chaine-options.${seconde.id}`, await (await import("@/services/_commun")).lireParametre(`generateur.chaine-options.${g.id}`, null));
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 100);
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: true });
    const premiere = (await bg.etatEcriture(r.scriptMaitreId))!.reprise!.prixUsd;
    // Les deux écritures ont le même devis (mêmes réglages, rien dépensé) : la somme vaut le double d'une.
    const seule = await (async () => {
      await depots().generations.modifier(seconde.id, { statut: "terminee" });
      const x = (await bg.etatEcriture(r.scriptMaitreId))!.reprise!.prixUsd;
      await depots().generations.modifier(seconde.id, { statut: "plafond-atteint" });
      return x;
    })();
    expect(premiere).toBeCloseTo(2 * seule, 6);
    // Le serveur fait confirmer exactement ce que l'écran affiche (centimes d'euro).
    const centimes = e!.reprise!.possible ? e!.reprise!.centimesEur : 0;
    expect(centimes).toBeGreaterThan(0);
    await expect(bg.reprendreEcriture(r.scriptMaitreId, centimes - 1)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: centimes });
    expect(await bg.reprendreEcriture(r.scriptMaitreId, centimes)).toBe(2);
  });
});

const VRAC = "Dans une PME, une personne passe 35 heures par semaine à exporter, copier, coller et vérifier des données dans des dizaines de tableurs.\nUne seule erreur de formule dans un tableur, et tous les chiffres qui en dépendent sont faux.\nExcel, ça paraît gratuit.\nUn tableur ne vérifie rien tout seul, donc chaque copier-coller est une occasion d'erreur que personne ne voit.\nEst-ce qu'on peut se passer de nos Excel sans tout casser ?";
const COMPLEMENTS = ["Un client nous a dit : on perd deux jours par mois à recopier les mêmes chiffres.", "J'ai vu une équipe passer de 10 heures à 2 heures de saisie par semaine.", "Le pourquoi : personne ne vérifie les copies, donc les erreurs restent.", "La conséquence : des décisions prises sur des chiffres faux.", "Je pense qu'un tableur sans contrôle coûte plus cher qu'un outil."];
const IDEE = "Une personne qui passe ses semaines à recopier des données dans des tableurs, et ce que ça coûte vraiment";
// Une limite longue : au « tu », sa forme change, et le pire cas du corps « + Tu » en dépend.
const LIMITE = "Sauf si vos tableaux changent de forme chaque mois, si vous avez des fichiers que vous recevez de vos clients et que vous devez reprendre à la main : là, gardez votre tableur et vérifiez-le vous-même, ligne par ligne, avant de l'envoyer.";

describe("Re-relecture A09 · le devis compte la même limite que la réserve", () => {
  it("corps supplémentaire « + Tu » au plafond : prix de « Reprendre » = pire cas réservé au tour suivant", async () => {
    const { migrerDonnees } = await import("@/services/migrations");
    await migrerDonnees(depots());
    const morceaux = await mat.proposerDecoupe(VRAC);
    await mat.enregistrerEnVrac(VRAC, morceaux.map((m) => ({ texte: m.texte, type: m.type })));
    const { ajouterPreuve } = await import("@/services/preuves");
    await ajouterPreuve({ enonce: "La saisie de cette équipe est passée de 6 heures à 1 heure par semaine." });
    let r = await bg.lancerGeneration({ idee: IDEE, reseaux: ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"], formatId: "avocat", mode: "avatar" } as never);
    const id = r.scriptMaitreId;
    for (const c of COMPLEMENTS) {
      if (r.ok) break;
      r = (await bg.completerSujet(id, { matiere: { type: proposerTypeMatiere(c), texte: c, source: { origine: "dictee", date: new Date().toISOString() }, motsCles: [] } })) as typeof r;
    }
    expect(r.ok).toBe(true);
    await bg.tourBoucleGeneration();
    await bg.validerException(id, { texte: LIMITE });
    const s = await bg.ajouterDeclinaison(id, { adresse: "tu" });
    if (!s.ok) throw new Error("déclinaison");
    // Le corps « + Tu » devient une écriture payante, au plafond : Claude branché, fetch interdit.
    await ecrireParametre("fournisseur.script", "claude");
    await depots().generations.modifier(s.generationId, { essai: false, statut: "plafond-atteint", plafondUsd: 100 });
    const devis = (await bg.devisRepriseDuSujet(id)).prixUsd;
    expect(devis).toBeGreaterThan(0);
    // Le tour suivant réserve son pire cas (puis l'appel échoue : réseau interdit). Le devis devait le compter tel quel.
    await depots().generations.modifier(s.generationId, { statut: "en-cours" });
    await bg.tourBoucleGeneration().catch(() => undefined);
    const reserve = (await gc.lireReserveChaine(s.generationId))!;
    expect(reserve).toBeTruthy();
    expect(devis).toBeCloseTo(reserve.pireCasUsd, 6);
  }, 60_000);
});
