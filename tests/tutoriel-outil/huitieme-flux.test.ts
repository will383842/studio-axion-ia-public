/**
 * T-EXT-28 · 8e cas, partie « flux » (cas 3 : automatisation SANS tableau de bord), depuis la phrase de
 * `huitieme/flux/description.txt`. Tout en mémoire, tout double, 0 €.
 *
 *  - Entrée par phrase FERMÉE (état par défaut) : le chef de projet classe en cas 3, puis la chaîne s'arrête avec un refus
 *    clair, sans échec ni dépense. C'est ce que le test vérifie (jamais de `it.skip`).
 *  - Entrée par phrase OUVERTE (option passée explicitement par le test, jamais écrite à la place de Williams) : le
 *    maquettiste rend un `flux-automatisation.v1` sur les vues du bureau exemple (T-EXT-49), lu par le gabarit G-Flux (T-EXT-50).
 *
 * Si un maillon casse, le test reste ROUGE avec un message « maillon : … » ; aucune correction de production ici.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classerParRegles, etablirCahier } from "../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { GABARITS } from "../../src/moteurs/montage-tutoriel-outil/equipe/gabarits";
import { completerManque } from "../../src/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { contientMontant, donneesEcransDepuisFlux, lireFluxAutomatisation, scenarioDepuisFlux, trameGFlux, VERSION_FLUX } from "../../src/moteurs/montage-tutoriel-outil/gabarit-flux";
import { lireScenarioMaquette } from "../../src/moteurs/montage-tutoriel-outil/scenario-maquette";
import { planSchemaFlux } from "../../src/moteurs/montage-tutoriel-outil/schema-flux";

const PHRASE = readFileSync(join(__dirname, "huitieme", "flux", "description.txt"), "utf8").trim();
const NOMS_PACKS = ["Stocks", "Tâches", "Taches", "Connaissances", "Knowledge", "Clients", "Facturation", "Rendez-vous"];

function maillon(nom: string, raison: string): never {
  throw new Error(`8e tableau (flux) : maillon : ${nom} — ${raison}`);
}

/** Ce que dit la voix (doublon de lecture : les mots sont ceux de `surMot`). */
const VOIX =
  "Chaque jour, vous perdez du temps à trier les demandes de devis. Une demande arrive par e-mail. L'automatisation lit le message puis étiquette la demande. Un brouillon de réponse est préparé. Vous relisez et vous décidez. Vous êtes prévenu dans la messagerie. Votre entreprise répond plus vite, plus sereinement.";

/**
 * en attendant T-EXT-25b : ce que le maquettiste rendra pour le manque « flux-automatisation » (sur les vues du bureau
 * exemple de T-EXT-49). Tant que 25b n'est pas sur master, ce flux écrit à la main tient sa place ; dès que 25b rend une
 * proposition, c'est elle qui est lue (voir `fluxDuMaquettiste`).
 */
const FLUX_EN_ATTENDANT_25B = {
  version: VERSION_FLUX,
  avant: { vue: "boite", etat: "avant", surMot: "Chaque" },
  declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
  etapes: [
    { id: "lecture", vue: "boite", etat: "ouvert", acteur: "ia", libelleSchema: "Lecture du message", surMot: "lit" },
    { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement", surMot: "étiquette" },
    { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
    { id: "relecture", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Relecture", surMot: "relisez" },
    { id: "prevenu", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Notification", surMot: "prévenu" },
  ],
  moments: ["classement", "brouillon", "relecture"],
  resultat: { vue: "messagerie", etat: "tache-creee", surMot: "sereinement" },
  contenus: {
    boite: {
      messages: [{ id: "m1", de: "Cabinet Durand (exemple)", objet: "Demande de devis (exemple)", adresse: "contact@exemple.invalid", corps: "Bonjour, je souhaite un devis pour une cuisine. (exemple)", dossier: "d1" }],
      nouveau: "m1",
      dossiers: [{ id: "d1", nom: "Devis" }],
      brouillon: { texte: "Bonjour, merci de votre message. Nous vous répondons très vite. (exemple)" },
    },
    messagerie: {
      fil: [{ de: "Atelier (exemple)", texte: "Bonjour (exemple)" }],
      notification: { de: "Automatisation", texte: "Un brouillon est prêt (exemple)" },
      tache: { titre: "Relire le brouillon (exemple)", responsable: "Vous (exemple)" },
    },
  },
};

/** Le flux du maquettiste : la proposition de 25b si elle existe, sinon le flux écrit à la main (en attendant 25b). */
async function fluxDuMaquettiste(appels: { n: number }): Promise<{ flux: unknown; reel: boolean }> {
  const contexte = { metier: "atelier de menuiserie", carteZones: [], interdits: NOMS_PACKS };
  const r = (await completerManque({
    manque: "flux-automatisation",
    contexte,
    appeler: async () => {
      appels.n++;
      return { manque: "flux-automatisation", contenu: FLUX_EN_ATTENDANT_25B };
    },
  })) as { statut: string; flux?: unknown };
  return r.statut === "proposition" && r.flux !== undefined ? { flux: r.flux, reel: true } : { flux: FLUX_EN_ATTENDANT_25B, reel: false };
}

describe("8e cas : automatisation sans tableau de bord, depuis une phrase", () => {
  it("le chef de projet classe la phrase en cas 3 (entrée C, gabarit G-Flux)", () => {
    const decision = classerParRegles({ phrase: PHRASE });
    if (decision.cas !== 3) maillon("chef de projet", `cas ${decision.cas} au lieu de 3 (${decision.raisons.join(" ; ")})`);
    expect(decision.entree).toBe("C");
    expect(decision.gabarits).toEqual(["G-Flux"]);
  });

  it("entrée par phrase fermée : refus clair « pas encore ouverte », ni échec ni dépense", () => {
    const decision = classerParRegles({ phrase: PHRASE });
    const r = etablirCahier({ phrase: PHRASE }, decision);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.attente.code).toBe("TO_CAS_V2");
    expect(r.attente.message).toMatch(/phrase seule/);
    expect(r.attente.message).toMatch(/arrive dans une version suivante/);
    expect(r.attente.message).toMatch(/rien n'a échoué/);
    // option différente de `true` exact : toujours fermée.
    expect(etablirCahier({ phrase: PHRASE }, decision, { phraseOuverte: false }).ok).toBe(false);
    expect(etablirCahier({ phrase: PHRASE }, decision, { phraseOuverte: "oui" as never }).ok).toBe(false);
  });

  it("entrée par phrase ouverte : cahier du cas 3, maquettiste → flux → gabarit G-Flux, à 0 €", async () => {
    const decision = classerParRegles({ phrase: PHRASE });
    const cahierLu = etablirCahier({ phrase: PHRASE }, decision, { phraseOuverte: true });
    if (!cahierLu.ok) maillon("chef de projet", cahierLu.attente.message);
    const cahier = cahierLu.cahier;
    expect(cahier.cas).toBe(3);
    expect(cahier.gabarits).toEqual(["G-Flux"]);
    expect(cahier.manques).toEqual(["flux-automatisation"]);
    expect(cahier.roles.slice(0, 2)).toEqual(["maquettiste", "ecrans-neutres"]);
    // la phrase reste une donnée : elle n'entre dans aucun texte du cahier.
    expect(JSON.stringify(cahier)).not.toContain(PHRASE);

    // maquettiste (partie 25b) : un `flux-automatisation.v1`
    const appels = { n: 0 };
    const { flux: brut } = await fluxDuMaquettiste(appels);
    const lu = lireFluxAutomatisation(brut);
    if (!lu.ok) maillon("maquettiste (flux)", lu.erreurs.join(" | "));
    const flux = lu.flux;
    // sur les vues du bureau exemple : boîte de réception et messagerie, rien d'autre
    expect([...new Set([flux.avant.vue, flux.declencheur.vue, flux.resultat.vue, ...flux.etapes.map((e) => e.vue)])].sort()).toEqual(["boite", "messagerie"]);
    expect(flux.etapes.some((e) => e.acteur === "humain")).toBe(true);
    expect(flux.moments.length).toBeLessThanOrEqual(3);

    // gabarit G-Flux : scénario, données d'écrans, trame, schéma animé
    if (GABARITS["G-Flux"] === undefined) maillon("gabarit G-Flux", "absent du registre des gabarits");
    const scenario = lireScenarioMaquette(scenarioDepuisFlux(flux));
    if (!scenario.ok) maillon("gabarit G-Flux (scénario)", scenario.erreurs.join(" | "));
    expect(scenario.scenario.etapes.length).toBe(flux.etapes.length + 3);
    const donnees = donneesEcransDepuisFlux(flux);
    expect(donnees.startsWith("window.DONNEES_ECRANS = ")).toBe(true);
    const trame = trameGFlux(48_000);
    if (!trame.ok) maillon("gabarit G-Flux (trame)", trame.erreurs.join(" | "));
    expect(trame.remarques).toEqual([]);
    // la voix passe en revue les étapes pendant la fenêtre du schéma : un mot clé toutes les 1,1 s (double de la voix).
    const mots = flux.etapes.map((e, i) => ({ texte: e.surMot, debutMs: trame.trame.debuts.schema + 400 + i * 1100 }));
    const plan = planSchemaFlux(flux, mots, trame.trame.debuts.schema, trame.trame.debuts.schema + trame.trame.schemaMs, { largeur: 1080, hauteur: 1350 });
    expect(plan.alertes, `alertes du schéma : ${plan.alertes.join(" | ")}`).toEqual([]);
    expect(plan.blocs.length).toBe(flux.etapes.length);

    // aucun montant d'argent, aucun nom de pack, 0 € (le seul « appel » est le double du maquettiste)
    expect(contientMontant(JSON.stringify({ flux, VOIX }))).toBe(false);
    for (const nom of NOMS_PACKS) expect(JSON.stringify({ flux, scenario, donnees }), `nom de pack « ${nom} »`).not.toContain(nom);
    expect(appels.n).toBeLessThanOrEqual(1);
  });
});
