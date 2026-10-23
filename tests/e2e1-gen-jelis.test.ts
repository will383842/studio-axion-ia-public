/**
 * Vérification E2E n° 1 du générateur, problème n° 1 (BLOQUANT) : « + Je lis » / « + Tu » sur un sujet écrit, dont
 * la limite proposée par la machine a été validée (« C'est juste »), ne produisait rien : le fond repris de la 1re
 * écriture portait encore la limite « proposée », le plan du nouveau corps était refusé (C30 bis) et le sujet passait
 * en silence à « à compléter ». Parcours de l'écran, Claude simulé, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const mat = await import("@/services/matieres");
const { proposerTypeMatiere } = await import("@/domaine/derivations-generateur");

const MDP = "essai-e2e1-jelis";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  const { migrerDonnees } = await import("@/services/migrations");
  await migrerDonnees(depots());
});
afterEach(() => bg.arreterBoucleGeneration());

const VRAC = "Dans une PME, une personne passe 35 heures par semaine à exporter, copier, coller et vérifier des données dans des dizaines de tableurs.\nUne seule erreur de formule dans un tableur, et tous les chiffres qui en dépendent sont faux.\nExcel, ça paraît gratuit.\nUn tableur ne vérifie rien tout seul, donc chaque copier-coller est une occasion d'erreur que personne ne voit.\nEst-ce qu'on peut se passer de nos Excel sans tout casser ?";
const COMPLEMENTS = ["Un client nous a dit : on perd deux jours par mois à recopier les mêmes chiffres.", "J'ai vu une équipe passer de 10 heures à 2 heures de saisie par semaine.", "Le pourquoi : personne ne vérifie les copies, donc les erreurs restent.", "La conséquence : des décisions prises sur des chiffres faux.", "Je pense qu'un tableur sans contrôle coûte plus cher qu'un outil."];
const IDEE = "Une personne qui passe ses semaines à recopier des données dans des tableurs, et ce que ça coûte vraiment";

async function sujetEcritEtValide(): Promise<string> {
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
  const m0 = await depots().scriptsMaitres.obtenir(id);
  expect(m0?.numero).toBeDefined();
  // Le cas du rapport : une limite PROPOSÉE par la machine, validée d'un toucher.
  expect(m0?.exception?.source).toBe("proposition-machine");
  await bg.validerException(id, "c-est-juste");
  const v0 = await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe);
  expect(await bg.validerVariantes(v0.map((v) => v.id))).toBeGreaterThan(0);
  return id;
}

describe("E2E-1 n° 1 · « + Je lis » / « + Tu » après la validation de la limite", () => {
  it("« Je lis » : une ligne « -L » apparaît, téléprompteur rempli avec la limite validée, le sujet ne passe pas « à compléter »", async () => {
    const id = await sujetEcritEtValide();
    const avant = await depots().variantes.lister((v) => v.scriptMaitreId === id);
    const r2 = await bg.ajouterDeclinaison(id, { mode: "teleprompteur" });
    expect(r2.ok).toBe(true);
    await bg.tourBoucleGeneration();
    const m = await depots().scriptsMaitres.obtenir(id);
    expect(m?.manque, JSON.stringify(m?.manque)).toBeUndefined();
    expect(m?.etat).not.toBe("a-completer");
    const apres = await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe);
    expect(apres.length).toBeGreaterThan(avant.length);
    const jeLis = apres.filter((v) => /-L(-T)?$/.test(v.code));
    expect(jeLis.length).toBeGreaterThan(0);
    expect(jeLis.every((v) => !!v.prompteur)).toBe(true);
    expect(jeLis.some((v) => v.prompteur!.replace(/\s+/g, " ").includes(m!.exception!.texte!.replace(/\s+/g, " ").slice(0, 25)))).toBe(true);
    // La limite reste validée : l'ajout ne la repasse pas « proposée ».
    expect(m?.exception?.valideeParWill).toBe(true);
  });

  it("« Tu » : une ligne au tutoiement apparaît, sans arrêt silencieux", async () => {
    const id = await sujetEcritEtValide();
    const avant = await depots().variantes.lister((v) => v.scriptMaitreId === id);
    const r2 = await bg.ajouterDeclinaison(id, { adresse: "tu" });
    expect(r2.ok).toBe(true);
    await bg.tourBoucleGeneration();
    const m = await depots().scriptsMaitres.obtenir(id);
    expect(m?.manque, JSON.stringify(m?.manque)).toBeUndefined();
    expect(m?.etat).not.toBe("a-completer");
    const apres = await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe);
    expect(apres.length).toBeGreaterThan(avant.length);
  });
});
