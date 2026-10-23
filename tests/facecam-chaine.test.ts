/**
 * PLAN FACECAM v4 — LOT B « Chaîne vidéo » (tests gardés : l'original n'est jamais modifié ; règle de panne : une brique
 * ratée n'empêche jamais la livraison). Chaîne complète avec le DOUBLE de simulation du studio-aligneur : aucun réseau.
 * Les coupes du cas F0 sont testées dans `src/briques/coupes/coupes.test.ts`.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import type { RouteFacecam } from "@/fournisseurs/facecam/client";
import { avancerChaine, bandeDesPlans, etatChaineInitial, livraisonChaine, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { creerMoteurMontageFacecam } from "@/moteurs/montage-facecam";
import { dependancesChaineParDefaut } from "@/moteurs/montage-facecam/dependances";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";
const PRISE = "studio/prod/rush/v-fc/prise-1.mov";

function commande(entrees: Record<string, unknown> = {}): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: PRISE, mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees,
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

async function jusquAuBout(deps: DependancesChaine, c = commande()): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 20 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

describe("chaîne vidéo face caméra (lot B)", () => {
  it("transcription → consignes et coupes → son → visages → réalisation → passe image → piste montée, dans cet ordre", async () => {
    const facecam = creerFacecamSimule();
    const etat = await jusquAuBout({ facecam });
    expect(etat.fini).toBe(true);
    expect(etat.sauts).toEqual([]);
    const ordre = facecam.soumises.map((s) => `${s.route}${s.demande.parametres?.etape ? `:${s.demande.parametres.etape}` : ""}`);
    expect(ordre).toEqual(["transcrire", "visages", "son", "image:passe", "image:cadrage"]);
    // Le son est monté sur les passages gardés par les coupes ; la passe image travaille sur la bande utile.
    const son = facecam.soumises.find((s) => s.route === "son")!.demande;
    expect(son.parametres?.gardes).toEqual(etat.coupes!.gardes);
    const passe = facecam.soumises.find((s) => s.demande.parametres?.etape === "passe")!.demande;
    expect(passe.parametres?.bande).toEqual(bandeDesPlans(etat.plans!, { largeur: 3840, hauteur: 2160 }));
    expect(etat.coupes!.mode).toBe("texte");
    expect(etat.plans!.length).toBeGreaterThan(0);
    const l = livraisonChaine(etat);
    expect(l.montageCle).toMatch(/^simulation\/facecam\/t-1-cadrage\//);
    expect(l.facecam.transcriptionCle).toBeTruthy();
    expect(l.facecam.pisteVisageCle).toBeTruthy();
  });

  it("l'original n'est jamais modifié : la prise n'est que LUE ; chaque résultat a sa propre clé sous la version (tests gardés n° 5)", async () => {
    const facecam = creerFacecamSimule();
    const lectures: string[] = [];
    const depots: string[] = [];
    const deps: DependancesChaine = {
      facecam: { ...facecam, mode: "reel", soumettre: facecam.soumettre, suivre: facecam.suivre },
      urlLecture: async (cle) => (lectures.push(cle), `https://r2.exemple/lire/${cle}`),
      urlDepot: async (cle) => (depots.push(cle), `https://r2.exemple/deposer/${cle}`),
      lireJsonGz: async () => null,
    };
    const etat = await jusquAuBout(deps);
    expect(etat.fini).toBe(true);
    expect(lectures).toContain(PRISE);
    expect(depots).not.toContain(PRISE);
    expect(depots.every((c) => c.startsWith("facecam/v-fc/ver-1/"))).toBe(true);
    for (const { demande } of facecam.soumises) {
      expect(Object.values(demande.depots ?? {}).some((u) => u.includes(PRISE))).toBe(false);
    }
  });

  it("règle de panne : visages et passe image en panne → la vidéo sort quand même (cadre centré, prise recadrée), « 1 élément non fait »", async () => {
    const facecam = creerFacecamSimule({ routesEnPanne: ["visages"] as RouteFacecam[] });
    // La passe image tombe en panne aussi : le double rend la route « image » en échec pour la passe seulement.
    const suivre = facecam.suivre;
    const deps: DependancesChaine = {
      facecam: {
        ...facecam,
        suivre: async (route, id) => (route === "image" && id.includes("-passe") ? { statut: "echec", erreur: { code: "inconnu", reessayable: false, message: "Panne simulée." } } : suivre(route, id)),
      } as typeof facecam,
    };
    const etat = await jusquAuBout(deps);
    expect(etat.fini).toBe(true);
    expect(etat.sauts.map((s) => s.brique).sort()).toEqual(["L'image", "Le cadrage du visage"]);
    const cadrage = facecam.soumises.find((s) => s.demande.parametres?.etape === "cadrage")!.demande;
    expect(cadrage.parametres?.preparer).toBe(true);
    expect(livraisonChaine(etat).alertes.some((a) => a.message.startsWith("1 élément non fait"))).toBe(true);
  });

  it("son en panne : échec réessayable (une vidéo sans son n'est pas livrable), le moteur repart sur « Réessayer »", async () => {
    const facecam = creerFacecamSimule({ routesEnPanne: ["son"] });
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam }) });
    const c = commande();
    expect(moteur.refusAuLancement?.(c)).toBeNull();
    let travail: Travail = await moteur.lancer(c, { travailId: "t-2", versionId: "ver-2", titre: "Essai" });
    for (let i = 0; i < 20 && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c, Date.now())).travail;
    expect(travail.statut).toBe("echec");
    expect(travail.etapes.find((e) => e.cle === "son")?.statut).toBe("echec");
    expect(travail.erreur?.reessayable).toBe(true);
    const repris = await moteur.reessayer(travail, Date.now());
    expect(repris.statut).toBe("en_cours");
    expect((repris.parametres?.chaine as EtatChaine).echec).toBeUndefined();
  });

  it("moteur : toutes les étapes faites, résultat 9:16 1080×1920, données du face caméra en clés R2, aucun prix", async () => {
    const facecam = creerFacecamSimule();
    const relues: string[] = [];
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam }), relire: async (cmd) => void relues.push(cmd.videoId) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "t-3", versionId: "ver-3", titre: "Essai" });
    let resultat;
    for (let i = 0; i < 20 && travail.statut !== "termine"; i++) ({ travail, resultat } = await moteur.avancer(travail, c, Date.now()));
    expect(travail.statut).toBe("termine");
    expect(travail.etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree")).toBe(true);
    expect(relues).toEqual(["v-fc"]);
    expect(resultat!.sorties[0]).toMatchObject({ ratio: "9:16", resolution: "1080x1920" });
    expect(resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    const projet = resultat!.projetMontage as { facecam: { coupes: { auto: unknown[] }; transcriptionCle?: string } };
    expect(projet.facecam.transcriptionCle).toMatch(/^simulation\/facecam\//);
    expect(JSON.stringify(projet).length).toBeLessThan(40_000);
  });

  it("calage : le texte VALIDÉ est calé sur le son monté par l'aligneur existant, puis déposé (sous-titres, agent)", async () => {
    const facecam = creerFacecamSimule();
    const demandes: { texte: string; reference?: { mot: string; debutSec: number; finSec: number }[] }[] = [];
    const deposes: Record<string, unknown> = {};
    const deps: DependancesChaine = {
      // « Réel » simulé : le double transcrit le texte qu'on lui glisse (la vraie route ne le reçoit jamais).
      facecam: { ...facecam, mode: "reel", soumettre: (route, d) => facecam.soumettre(route, route === "transcrire" ? { ...d, parametres: { ...d.parametres, texte: TEXTE } } : d) },
      urlLecture: async (cle) => `https://r2.exemple/lire/${cle}`,
      urlDepot: async (cle) => `https://r2.exemple/deposer/${cle}`,
      lireJsonGz: async () => null,
      alignement: {
        id: "studio-aligneur",
        type: "alignement",
        mode: "reel",
        async soumettre(d: { texte: string; reference?: { mot: string; debutSec: number; finSec: number }[] }) {
          demandes.push(d);
        },
        async suivre() {
          const ref = demandes[0].reference ?? [];
          return { statut: "termine", resultat: { mots: ref.map((m) => ({ ...m, debutSec: m.debutSec + 0.02, finSec: m.finSec + 0.02 })), motsNonAlignes: 0, modele: "essai", dureeCalculSec: 1 } };
        },
      } as unknown as DependancesChaine["alignement"],
      ecrireJsonGz: async (cle, donnees) => void (deposes[cle] = donnees),
    };
    const etat = await jusquAuBout(deps);
    expect(etat.fini).toBe(true);
    expect(demandes[0].texte).toBe(TEXTE);
    expect(etat.mots).toMatchObject({ statut: "fait", source: "aligneur", cle: "facecam/v-fc/ver-1/mots-montes.json.gz" });
    const mots = (deposes["facecam/v-fc/ver-1/mots-montes.json.gz"] as { mots: { mot: string }[] }).mots;
    expect(mots.map((m) => m.mot).join(" ")).toBe(TEXTE);
    expect(livraisonChaine(etat).motsMontesCle).toBe("facecam/v-fc/ver-1/mots-montes.json.gz");
  });

  it("sans chaîne demandée : squelette du lot A inchangé (lancement réel refusé) ; le réel n'est jamais pris par défaut", () => {
    const moteur = creerMoteurMontageFacecam();
    expect(moteur.refusAuLancement?.(commande())?.code).toBe("FACECAM_EN_CHANTIER");
    expect(dependancesChaineParDefaut(commande(), { STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" })).toBeNull();
    expect(dependancesChaineParDefaut(commande({ facecamAligneurReel: true }), {})).toBeNull();
    expect(dependancesChaineParDefaut(commande({ facecamAligneurReel: true }), { STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200" })?.facecam.mode).toBe("reel");
  });
});
