/**
 * ESSAI RÉEL n° 1 (04/10/2026) : la 1re vraie vidéo est restée bloquée à 33 %. La composition 9:16 avait échoué 3 fois
 * (`fichier-inaccessible` : fichiers publics absents du stockage, réparé depuis). État sauvé : « soumise », essai 3.
 * studio-rendu garde cet échec en mémoire ; le studio le relisait à chaque reprise, dépassait ESSAIS et levait encore :
 * aucune nouvelle demande ne partait jamais. Attendu : une attente, puis une NOUVELLE demande (nouvel identifiant).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { ATTENTE_SERIE_COMPOSITION_MS, avancerCompositions, SERIES_COMPOSITION, type EtatMontage, type OutilsMontage } from "@/briques/composition/montage";

const MAINTENANT = "2026-10-04T17:45:00.000Z";

function commande(): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-reel1",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 9,
    ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s1", texte: "Trente-cinq heures par semaine sur Excel." }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [],
    profilRealisme: formatAvocat.profilRendu?.realisme,
    profilRendu: formatAvocat.profilRendu,
    recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: {
      "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 },
    },
  } as CommandeFabrication;
}

const PLANS: PlanProduit[] = [
  { ordre: 1, debutSec: 0, finSec: 4, texte: "texte", segmentId: "s1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts" },
  { ordre: 2, debutSec: 4, finSec: 9, texte: "texte", segmentId: "s1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.2, valeur: "poitrine" }, transition: "coupe", angle: "trois-quarts" },
];
const SEGMENTS: SegmentSousTitres[] = [{ id: "g1", debutSec: 0.1, finSec: 0.8, mots: [{ mot: "Trente", debutSec: 0.1, finSec: 0.8 }] }];
const BASE = { plans: PLANS, segments: SEGMENTS, dureeSec: 9, audioCle: "studio/prod/audio-maitre/v-reel1/voix.wav", pistesDouble: { "trois-quarts": "studio/prod/visage/heygen/rendu.webm" } };
const ECHEC: EtatRendu = { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Entrée inaccessible (404)." } };

/** studio-rendu en mémoire : tout identifiant soumis échoue sauf ceux de `reussis`. */
function renduQuiGarde(reussis: (id: string) => boolean = () => false) {
  const soumis: string[] = [];
  const lus: string[] = [];
  const service: ServiceRendu = {
    soumettre: async (d: DemandeRendu) => {
      soumis.push(d.idRendu);
      return { idRendu: d.idRendu };
    },
    etat: async (id: string) => {
      lus.push(id);
      return reussis(id) ? { statut: "en_cours", progression: 10 } : ECHEC;
    },
  };
  return { service, soumis, lus };
}

function outils(service: ServiceRendu): OutilsMontage {
  return {
    rendu: () => service,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.example/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.example/depot/${d.cle}`])) }),
    cle: (_c, nom) => `studio/prod/videos/v-reel1/${nom}`,
    recette: RECETTE_COMPOSITION_AVOCAT,
  };
}

/** L'état exact trouvé sur studio.axion-ia.com le 04/10 (trav-258d35aca950). */
const ETAT_BLOQUE: EtatMontage = {
  "9:16": { phase: "soumise", essai: 3, progression: 0, alertes: [], demande: { idRendu: "trav-x-9x16-compo-e3", operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: "u", cle: "c" }, parametres: {} } as DemandeRendu },
};

describe("ESSAI RÉEL n° 1 : un montage aux essais épuisés repart après une attente", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(MAINTENANT) }));
  afterEach(() => vi.useRealTimers());

  it("l'état bloqué ne lève plus : il attend, sans nouvelle demande ni relecture pendant l'attente", async () => {
    const r = renduQuiGarde();
    const apres = await avancerCompositions(ETAT_BLOQUE, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
    const e = apres["9:16"] as { phase: string; relanceApres?: string; serie?: number };
    expect(e.phase).toBe("soumise");
    expect(e.serie).toBe(2);
    expect(Date.parse(e.relanceApres!)).toBe(Date.parse(MAINTENANT) + ATTENTE_SERIE_COMPOSITION_MS);
    expect(r.soumis).toEqual([]);
    // Pendant l'attente : rien n'est relu, rien n'est soumis.
    vi.advanceTimersByTime(ATTENTE_SERIE_COMPOSITION_MS - 1000);
    const encore = await avancerCompositions(apres, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
    expect(r.lus).toEqual(["trav-x-9x16-compo-e3"]);
    expect(r.soumis).toEqual([]);
    expect(encore["9:16"]).toEqual(apres["9:16"]);
  });

  it("à l'heure dite, une NOUVELLE demande part (nouvel identifiant), puis le montage avance", async () => {
    const r = renduQuiGarde((id) => id.endsWith("-e4"));
    let etat = await avancerCompositions(ETAT_BLOQUE, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
    vi.advanceTimersByTime(ATTENTE_SERIE_COMPOSITION_MS);
    etat = await avancerCompositions(etat, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
    expect(r.soumis).toEqual(["trav-x-9x16-compo-e4"]);
    const e = etat["9:16"] as { phase: string; essai?: number; relanceApres?: string; demande: DemandeRendu };
    expect(e.phase).toBe("soumise");
    expect(e.essai).toBe(4);
    expect(e.relanceApres).toBeUndefined();
    etat = await avancerCompositions(etat, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
    expect((etat["9:16"] as { progression: number }).progression).toBe(10);
  });

  it("une panne qui dure finit en échec définitif après les séries prévues (pas de boucle sans fin)", async () => {
    const r = renduQuiGarde();
    let etat: EtatMontage = ETAT_BLOQUE;
    let erreur: unknown;
    for (let tour = 0; tour < 200 && !erreur; tour++) {
      try {
        etat = await avancerCompositions(etat, commande(), ["9:16"], BASE, "complet", "trav-x", outils(r.service));
      } catch (e) {
        erreur = e;
      }
      vi.advanceTimersByTime(ATTENTE_SERIE_COMPOSITION_MS);
    }
    expect(erreur).toBeTruthy();
    // Définitif : non réessayable (sinon la reprise du travail relirait le même échec pendant 24 h, relecture 563f211).
    expect((erreur as { erreur?: { reessayable?: boolean } }).erreur?.reessayable ?? (erreur as { reessayable?: boolean }).reessayable).toBe(false);
    // 3 essais par nouvelle série, séries 2 à SERIES_COMPOSITION.
    expect(r.soumis.length).toBe(3 * (SERIES_COMPOSITION - 1));
    expect(new Set(r.soumis).size).toBe(r.soumis.length);
  });
});

describe("tableau animé (12/10) : `fichier-inaccessible` borné à une série quand le format le demande", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(MAINTENANT) }));
  afterEach(() => vi.useRealTimers());

  it("avec `seriesFichierInaccessible: 1` : série épuisée → arrêt définitif (non réessayable), sans nouvelle demande", async () => {
    const r = renduQuiGarde();
    const err = await avancerCompositions(ETAT_BLOQUE, commande(), ["9:16"], BASE, "complet", "trav-x", { ...outils(r.service), seriesFichierInaccessible: 1 }).catch((e: unknown) => e);
    expect(err).toMatchObject({ erreur: { code: "fichier-inaccessible", reessayable: false } });
    expect(r.soumis).toEqual([]);
  });

  it("avec `seriesFichierInaccessible: 1` mais un autre échec passager : la règle commune (nouvelle série) reste", async () => {
    const r = renduQuiGarde();
    const indisponible: ServiceRendu = { ...r.service, etat: async () => ({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Occupé." } }) };
    const apres = await avancerCompositions(ETAT_BLOQUE, commande(), ["9:16"], BASE, "complet", "trav-x", { ...outils(indisponible), seriesFichierInaccessible: 1 });
    expect((apres["9:16"] as { serie?: number }).serie).toBe(2);
  });
});
