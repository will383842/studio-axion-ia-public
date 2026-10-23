/**
 * VÉRIF V2 (10/10) — chaîne face caméra de bout en bout : défauts trouvés en faisant tourner la vraie chaîne contre le
 * vrai `studio-aligneur` (FFmpeg réel) sur une prise synthétique « iPhone » (portrait, HLG, rotation, 29,97 i/s).
 * Ici, le double de simulation reproduit chaque cas sans réseau. Rapport : docs/verification/V2-CHAINE-FACECAM.md.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import type { FournisseurFacecam } from "@/fournisseurs/facecam/client";
import { avancerChaine, dimensionsSource, etatChaineInitial, type EtatChaine } from "@/moteurs/montage-facecam/chaine";

const TEXTE = "Vous perdez des heures chaque semaine. Ce n'est pas un problème de travail, c'est une fuite. Réservez votre appel diagnostic gratuit.";

function commande(): CommandeFabrication {
  return {
    videoId: "v-v2",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 30,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-v2/iphone.mov", mime: "video/quicktime", dureeSec: 30, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

/** Double du studio-aligneur pour une prise PORTRAIT d'iPhone (1080 × 1920 après rotation) dont le visage n'est pas suivi. */
function aligneurPortraitSansVisage(): FournisseurFacecam & { soumises: ReturnType<typeof creerFacecamSimule>["soumises"] } {
  const base = creerFacecamSimule({ routesEnPanne: ["visages"] });
  return {
    ...base,
    async suivre(route, id) {
      const r = await base.suivre(route, id);
      return route === "transcrire" && r.statut === "termine" ? { ...r, resultat: { ...r.resultat, largeurSource: 1080, hauteurSource: 1920 } } : r;
    },
  } as typeof base;
}

async function jusquAuBout(facecam: FournisseurFacecam): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 30 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-v2", versionId: "ver-1" }, { facecam });
  return etat;
}

describe("Vérif V2 — chaîne face caméra", () => {
  it("visage non suivi sur une prise portrait : les cadres restent DANS la prise (avant : cadre 1216 × 2160 pour une source supposée 3840 × 2160, FFmpeg n'écrivait rien)", async () => {
    const facecam = aligneurPortraitSansVisage();
    const etat = await jusquAuBout(facecam);
    expect(etat.fini).toBe(true);
    expect(etat.sauts.map((s) => s.brique)).toContain("Le cadrage du visage");
    expect(dimensionsSource(etat)).toEqual({ largeur: 1080, hauteur: 1920 });
    const cadrage = facecam.soumises.find((s) => s.route === "image" && s.demande.parametres?.etape === "cadrage");
    const plans = (cadrage?.demande.parametres?.plans ?? []) as { cadre: { x: number; y: number; largeur: number; hauteur: number } }[];
    expect(plans.length).toBeGreaterThan(0);
    for (const { cadre } of plans) {
      expect(cadre.x).toBeGreaterThanOrEqual(0);
      expect(cadre.y).toBeGreaterThanOrEqual(0);
      expect(cadre.x + cadre.largeur).toBeLessThanOrEqual(1080);
      expect(cadre.y + cadre.hauteur).toBeLessThanOrEqual(1920);
    }
    // Bande de la passe image : dans la prise aussi.
    const passe = facecam.soumises.find((s) => s.route === "image" && s.demande.parametres?.etape === "passe");
    const bande = passe?.demande.parametres?.bande as { x: number; largeur: number };
    expect(bande.x + bande.largeur).toBeLessThanOrEqual(1080);
  });

  it("dimensions de la prise : `/visages` d'abord, puis `/transcrire`, sinon la source 4K paysage d'origine", () => {
    const termine = (resultat: Record<string, unknown>) => ({ id: "x", statut: "termine" as const, essais: 0, resultat });
    expect(dimensionsSource({ travaux: {} })).toEqual({ largeur: 3840, hauteur: 2160 });
    expect(dimensionsSource({ travaux: { transcrire: termine({ largeurSource: 2160, hauteurSource: 3840 }) } })).toEqual({ largeur: 2160, hauteur: 3840 });
    expect(dimensionsSource({ travaux: { transcrire: termine({ largeurSource: 2160, hauteurSource: 3840 }), visages: termine({ largeurSource: 1080, hauteurSource: 1920 }) } })).toEqual({ largeur: 1080, hauteur: 1920 });
  });
});

/* ------------------------------------------------------------------ */
/* Reprise après un redémarrage de conteneur                           */
/* ------------------------------------------------------------------ */

import { creerFacecamHttp } from "@/fournisseurs/facecam/client";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ServiceRendu } from "@/fournisseurs/types";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { DependancesChaine } from "@/moteurs/montage-facecam/chaine";

/**
 * Le VRAI client HTTP du studio-aligneur (`creerFacecamHttp`) devant un serveur simulé que l'on peut « éteindre » :
 * pendant la panne, toute requête échoue comme un conteneur qui redémarre (connexion refusée). Les travaux, eux,
 * survivent sur disque (comme `TravauxFacecam`) : ils sont toujours là au retour.
 */
function aligneurQuiRedemarre() {
  const sim = creerFacecamSimule();
  const etat = { eteint: false, requetesPendantPanne: 0 };
  const fetchSimule = (async (adresse: string, init?: RequestInit) => {
    if (etat.eteint) {
      etat.requetesPendantPanne++;
      throw new TypeError("fetch failed");
    }
    const [, route, id] = new URL(adresse).pathname.split("/");
    if (init?.method === "POST") {
      await sim.soumettre(route as "son", JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ idTravail: "x", nouveau: true }), { status: 202 });
    }
    const r = await sim.suivre(route as "son", decodeURIComponent(id));
    if (r.statut === "echec" && r.erreur.code === "fichier-inaccessible") return new Response(JSON.stringify({ statut: "inconnu" }), { status: 404 });
    return new Response(JSON.stringify(r), { status: 200 });
  }) as typeof fetch;
  return { facecam: creerFacecamHttp("http://aligneur.essai", { fetch: fetchSimule }), etat, soumises: sim.soumises };
}

describe("Vérif V2 — un conteneur qui redémarre ne casse plus la vidéo", () => {
  it("studio-aligneur injoignable 4 tours pendant le son et la passe : aucun essai consommé, aucun travail refait, la vidéo sort complète", async () => {
    const a = aligneurQuiRedemarre();
    const deps: DependancesChaine = { facecam: a.facecam };
    let etat = etatChaineInitial();
    let tours = 0;
    for (let i = 0; i < 40 && !etat.fini && !etat.echec; i++) {
      // Panne juste après la soumission du son (le conteneur redémarre pendant 4 tours de boucle ≈ 20 s).
      a.etat.eteint = !!etat.travaux.son && tours < 4;
      if (a.etat.eteint) tours++;
      etat = await avancerChaine(etat, commande(), { travailId: "t-r", versionId: "ver-1" }, deps);
    }
    expect(a.etat.requetesPendantPanne).toBeGreaterThan(0);
    expect(etat.echec).toBeUndefined();
    expect(etat.fini).toBe(true);
    expect(etat.sauts).toEqual([]);
    // Le son et la passe image n'ont été soumis qu'une fois, sous leur premier identifiant (rien n'est recalculé).
    const ids = a.soumises.map((s) => s.demande.idTravail);
    expect(ids.filter((x) => x.includes("-son"))).toEqual(["t-r-son"]);
    expect(ids.filter((x) => x.includes("-passe"))).toEqual(["t-r-passe"]);
  });

  it("studio-aligneur éteint pour de bon : la chaîne finit par le dire (pas d'attente sans fin)", async () => {
    const a = aligneurQuiRedemarre();
    let etat = etatChaineInitial();
    // Intégration #15 + #23 + #24 : la règle retenue est celle de la vérif V5 (`reprise.ts`) — 30 min d'attente au plus
    // sans consommer d'essai, mesurées à l'horloge (un tour de boucle ≈ 5 s), puis l'échec ordinaire reprend la main.
    let t = 0;
    for (let i = 0; i < 3000 && !etat.fini && !etat.echec; i++) {
      a.etat.eteint = !!etat.travaux.son;
      t += 5_000;
      etat = await avancerChaine(etat, commande(), { travailId: "t-m", versionId: "ver-1" }, { facecam: a.facecam, maintenant: () => t });
    }
    // 30 min sans essai consommé, puis 30 min par essai (ESSAIS_MAX) : ≈ 1 h 30, jamais d'attente sans fin.
    expect(t).toBeGreaterThanOrEqual(30 * 60_000);
    expect(t).toBeLessThanOrEqual(2 * 60 * 60_000);
    expect(etat.echec?.brique).toBe("son");
    expect(etat.echec?.reessayable).toBe(true);
  });

  it("studio-rendu injoignable 2 tours pendant le rendu des cartes : l'habillage n'est pas abandonné (avant : vidéo livrée sans sous-titres ni cartes)", async () => {
    let t = 0;
    const simule = creerServiceRenduSimule(() => (t += 6_000));
    let pannes = 0;
    const service: ServiceRendu = {
      soumettre: (d) => simule.soumettre(d),
      etat: async (id) => {
        if (pannes > 0) {
          pannes--;
          throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });
        }
        return simule.etat(id);
      },
    };
    const habillage: OutilsMontage = {
      rendu: () => service,
      recette: RECETTE_COMPOSITION_FACECAM,
      signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
      cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
    };
    const facecam = creerFacecamSimule();
    let etat = etatChaineInitial();
    let panneFaite = false;
    for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) {
      if (!panneFaite && etat.habillage && !etat.habillage.sortie) {
        pannes = 2;
        panneFaite = true;
      }
      etat = await avancerChaine(etat, commande(), { travailId: "t-h", versionId: "ver-1" }, { facecam, habillage });
    }
    expect(panneFaite).toBe(true);
    expect(etat.fini).toBe(true);
    expect(etat.habillage?.abandonne).toBeFalsy();
    expect(etat.habillage?.sortie?.fichierCle).toBeTruthy();
    expect(etat.sauts.map((s) => s.brique)).not.toContain("Les sous-titres et cartes");
  });
});

/* ------------------------------------------------------------------ */
/* Reprise absorbée : les recalages suivent la vidéo après la chaîne   */
/* ------------------------------------------------------------------ */

import { readFileSync } from "node:fs";
import { livraisonChaine } from "@/moteurs/montage-facecam/chaine";
import { motsPourMonteur } from "@/moteurs/montage-facecam/monteur/temps";
import type { MotHorodate } from "@/domaine/types";

describe("Vérif V2 — reprise absorbée (IMG_7747) : le monteur voit les mêmes mots que la chaîne", () => {
  it("la transcription livrée à la vidéo est recalée : aucun mot de la prise gardée n'est vu « coupé » par le monteur (avant : 12 mots perdus)", async () => {
    const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
    const script = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync("tests/facecam-reprise-cartes.test.ts", "utf-8"))![1];
    const base = creerFacecamSimule();
    const facecam = {
      ...base,
      mode: "reel" as const,
      async suivre(route: "transcrire", id: string) {
        const r = await base.suivre(route, id);
        return route === "transcrire" && r.statut === "termine" ? { ...r, resultat: { transcriptionCle: "facecam/v/ver-1/transcription.json.gz", dureeSec: 130.732, mots: reel.mots } } : r;
      },
    } as unknown as FournisseurFacecam;
    const deposes = new Map<string, unknown>();
    const c = { ...commande(), script: { blocs: [], texteComplet: script } } as CommandeFabrication;
    let etat = etatChaineInitial();
    for (let i = 0; i < 4 && !etat.coupes; i++) etat = await avancerChaine(etat, c, { travailId: "t-a", versionId: "ver-1" }, { facecam, ecrireJsonGz: async (cle, d) => void deposes.set(cle, d), lireJsonGz: async (cle) => deposes.get(cle) ?? null });
    expect(etat.coupes?.recalages?.length).toBeGreaterThan(0);
    const livree = livraisonChaine(etat).facecam.transcriptionCle!;
    expect(livree).not.toBe("facecam/v/ver-1/transcription.json.gz");
    const mots = (deposes.get(livree) as { mots: MotHorodate[] }).mots;
    const vus = motsPourMonteur(mots, etat.coupes!.liste.map((x) => ({ debutSec: x.debutSec, finSec: x.finSec })));
    expect(vus.filter((m) => m.monteeSec !== null)).toHaveLength(312);
  });
});

describe("Vérif V2 — contrôle de synchro calibré sur la prise d'origine", () => {
  it("le cadrage reçoit la piste du visage ET la prise d'origine (référence du contrôle son-image)", async () => {
    const facecam = creerFacecamSimule();
    let etat = etatChaineInitial();
    for (let i = 0; i < 30 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-s", versionId: "ver-1" }, { facecam });
    const cadrage = facecam.soumises.find((s) => s.route === "image" && s.demande.parametres?.etape === "cadrage")!;
    const prise = facecam.soumises.find((s) => s.route === "transcrire")!.demande.source;
    expect(cadrage.demande.parametres?.piste).toBeTruthy();
    expect(cadrage.demande.parametres?.prise).toBe(prise);
  });
});

/* ------------------------------------------------------------------ */
/* Priorité : le 9:16 (la vidéo attendue) avant les formats            */
/* ------------------------------------------------------------------ */

import type { DemandeRendu } from "@/fournisseurs/types";
import type { CarteMonteur } from "@/moteurs/montage-facecam/raccords";

describe("Vérif V2 — les cartes du 9:16 partent avant celles des formats secondaires", () => {
  it("file longue de studio-rendu (un rendu à la fois) : aucune carte 4:5 ou 1:1 devant une carte du 9:16 (avant : les 18 cartes des formats passaient d'abord)", async () => {
    let t = 0;
    const simule = creerServiceRenduSimule(() => (t += 6_000));
    const soumises: DemandeRendu[] = [];
    const habillage: OutilsMontage = {
      rendu: () => ({ soumettre: async (d) => (soumises.push(d), simule.soumettre(d)), etat: (id) => simule.etat(id) }),
      recette: RECETTE_COMPOSITION_FACECAM,
      signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
      cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
    };
    const cartes: CarteMonteur[] = [
      { id: "pas-1", debutSec: 1, finSec: 5, disposition: "moitie-haute", modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], description: "Les trois raisons" },
      { id: "pas-2", debutSec: 6, finSec: 9, disposition: "moitie-haute", modele: "chiffre", textes: ["30 %", "de temps gagné"], description: "un chiffre" },
    ] as CarteMonteur[];
    const facecam = creerFacecamSimule();
    const c = { ...commande(), ratios: ["9:16", "4:5", "1:1"] } as CommandeFabrication;
    let etat = etatChaineInitial();
    for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-p", versionId: "ver-1" }, { facecam, habillage, monteur: async () => ({ cartes }) });
    expect(etat.fini).toBe(true);
    const cles = soumises.filter((x) => !(x.parametres as { mode?: string }).mode).map((x) => x.sortie.cle);
    const formats = cles.map((k, i) => (/-(4x5|1x1)/.test(k) ? i : -1)).filter((i) => i >= 0);
    const principales = cles.map((k, i) => (/-(4x5|1x1|16x9)/.test(k) ? -1 : i)).filter((i) => i >= 0);
    expect(principales.length).toBeGreaterThan(0);
    expect(formats.length).toBeGreaterThan(0);
    expect(Math.max(...principales)).toBeLessThan(Math.min(...formats));
  });
});
