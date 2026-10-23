/**
 * VÉRIF V5 (serveur) — reprise après le redémarrage de `studio-aligneur` PENDANT chaque étape de la chaîne face caméra.
 *
 * Le VRAI client HTTP (`creerFacecamHttp`) parle à un faux conteneur (fetch) : file en mémoire, travaux terminés au
 * deuxième suivi. Deux sortes de redémarrage :
 *  - « redémarrage » : le conteneur ne répond plus pendant quelques tours (chargement des modèles ≈ 1 min ; la boucle
 *    du studio passe toutes les 5 s), puis revient AVEC ses travaux (dossier de travaux gardé) ;
 *  - « recréation » : il revient SANS ses travaux (ancienne image, dossier perdu) → 404 « inconnu ».
 * Attendu : la vidéo sort complète (aucun saut), chaque travail n'est calculé qu'UNE fois par vie du conteneur (aucune
 * double dépense de calcul), et un redémarrage ne consomme jamais un des 2 essais d'un travail.
 *
 * ROUGE sur master 85655d2 : la réponse « ne répond pas » était comptée comme un échec réessayable, puis la nouvelle
 * soumission (refusée elle aussi) consommait le 2e essai → « Le son n'a pas abouti » au bout de 3 tours (≈ 15 s).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamHttp, creerFacecamSimule } from "@/fournisseurs/facecam";
import type { DemandeFacecam, RouteFacecam } from "@/fournisseurs/facecam/client";
import { avancerChaine, etatChaineInitial, type EtatChaine } from "@/moteurs/montage-facecam/chaine";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux.";

function commande(ratios: string[] = ["9:16"]): CommandeFabrication {
  return {
    videoId: "v-v5",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios,
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-v5/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

/** Faux conteneur studio-aligneur derrière le vrai client HTTP. */
function fauxAligneur() {
  let travaux = new Map<string, { demande: DemandeFacecam; suivis: number }>();
  const calculs: string[] = [];
  const etat = { injoignable: false };
  const simule = creerFacecamSimule();
  const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
  const fetchFaux = (async (url: string | URL, init?: RequestInit) => {
    if (etat.injoignable) throw new TypeError("fetch failed (ECONNREFUSED)");
    const chemin = new URL(String(url)).pathname.split("/").filter(Boolean);
    const route = chemin[0] as RouteFacecam;
    if (init?.method === "POST") {
      const demande = JSON.parse(String(init.body)) as DemandeFacecam;
      const cle = `${route}:${demande.idTravail}`;
      const nouveau = !travaux.has(cle);
      if (nouveau) {
        travaux.set(cle, { demande, suivis: 0 });
        calculs.push(cle);
        await simule.soumettre(route, demande);
      }
      return reponse(202, { idTravail: demande.idTravail, nouveau });
    }
    const cle = `${route}:${decodeURIComponent(chemin[1])}`;
    const t = travaux.get(cle);
    if (!t) return reponse(404, { statut: "inconnu" });
    t.suivis += 1;
    if (t.suivis < 2) return reponse(200, { statut: "en_cours", progression: 50 });
    return reponse(200, await simule.suivre(route, t.demande.idTravail));
  }) as typeof fetch;
  return {
    facecam: creerFacecamHttp("http://studio-aligneur:4200", { fetch: fetchFaux, cle: "essai" }),
    calculs,
    etat,
    /** Recréation du conteneur : les travaux en cours sont perdus. */
    perdreTravaux: () => {
      travaux = new Map();
    },
    enCours: () => [...travaux.entries()].filter(([, t]) => t.suivis < 2).map(([c]) => c),
  };
}

const ETAPES: RouteFacecam[] = ["transcrire", "visages", "son", "image"];

/** Fait tourner la chaîne ; quand un travail de `route` est en cours, le conteneur « redémarre » (tours sans réponse). */
async function avecRedemarrage(route: RouteFacecam, sorte: "redemarrage" | "recreation", toursMuets = 12, o: { ratios?: string[]; viser?: (cle: string) => boolean } = {}) {
  const viser = o.viser ?? ((c: string) => c.startsWith(`${route}:`));
  const a = fauxAligneur();
  let etat: EtatChaine = etatChaineInitial();
  let fait = false;
  let perdus: string[] = [];
  let muets = 0;
  let maintenant = 1_000_000;
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) {
    maintenant += 5_000;
    if (!fait && a.enCours().some(viser)) {
      a.etat.injoignable = true;
      if (sorte === "recreation") {
        perdus = a.enCours();
        a.perdreTravaux();
      }
      fait = true;
    }
    if (a.etat.injoignable && ++muets > toursMuets) a.etat.injoignable = false;
    etat = await avancerChaine(etat, commande(o.ratios), { travailId: "t-v5", versionId: "ver-v5" }, { facecam: a.facecam, maintenant: () => maintenant });
  }
  return { etat, a, fait, perdus };
}

describe("V5 · reprise : studio-aligneur redémarre pendant chaque étape de la chaîne face caméra", () => {
  it("témoin : sans redémarrage, la chaîne va au bout avec le faux conteneur (chaque travail calculé une fois)", async () => {
    const a = fauxAligneur();
    let etat: EtatChaine = etatChaineInitial();
    for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-v5", versionId: "ver-v5" }, { facecam: a.facecam });
    expect(etat.echec).toBeUndefined();
    expect(etat.fini).toBe(true);
    expect(etat.sauts).toEqual([]);
    expect(new Set(a.calculs).size).toBe(a.calculs.length);
  });

  for (const route of ETAPES) {
    it(`ROUGE — redémarrage pendant « ${route} » (1 min sans réponse) : la vidéo sort, chaque travail calculé une seule fois, aucun essai consommé`, async () => {
      const { etat, a, fait } = await avecRedemarrage(route, "redemarrage");
      expect(fait).toBe(true);
      expect(etat.echec).toBeUndefined();
      expect(etat.fini).toBe(true);
      expect(etat.sauts).toEqual([]);
      // Aucune double dépense : chaque (route, identifiant) n'a été calculé qu'une fois, et un seul identifiant par brique.
      expect(new Set(a.calculs).size).toBe(a.calculs.length);
      for (const t of Object.values(etat.travaux)) expect(t?.essais).toBe(0);
    });

    it(`ROUGE — recréation pendant « ${route} » (travaux perdus, 404) : resoumis sous le MÊME identifiant, sans consommer d'essai`, async () => {
      const { etat, a, fait, perdus } = await avecRedemarrage(route, "recreation");
      expect(fait).toBe(true);
      expect(etat.echec).toBeUndefined();
      expect(etat.fini).toBe(true);
      expect(etat.sauts).toEqual([]);
      // Seuls les travaux perdus (en cours à la recréation) sont recalculés, une fois, sous le même identifiant.
      const refaits = a.calculs.filter((c, i) => a.calculs.indexOf(c) !== i);
      expect(perdus.some((c) => c.startsWith(`${route}:`))).toBe(true);
      expect(refaits.sort()).toEqual([...perdus].sort());
      for (const t of Object.values(etat.travaux)) expect(t?.essais).toBe(0);
    });
  }

  for (const sorte of ["redemarrage", "recreation"] as const) {
    it(`ROUGE — ${sorte} pendant la passe « formats » (cadrage 16:9) : les deux formats sortent, aucun essai consommé`, async () => {
      const { etat, a, fait } = await avecRedemarrage("image", sorte, 12, { ratios: ["9:16", "16:9"], viser: (c) => c.startsWith("image:") && c.includes("cadrage-") });
      expect(fait).toBe(true);
      expect(etat.echec).toBeUndefined();
      expect(etat.fini).toBe(true);
      expect(etat.sauts).toEqual([]);
      expect(etat.declinaisons?.cadrages["16:9"]?.statut).toBe("termine");
      expect(etat.declinaisons?.cadrages["16:9"]?.essais).toBe(0);
      if (sorte === "redemarrage") expect(new Set(a.calculs).size).toBe(a.calculs.length);
    });
  }

  it("un conteneur qui ne revient pas : l'échec arrive quand même (30 min sans réponse), jamais une attente sans fin", async () => {
    const { etat } = await avecRedemarrage("son", "redemarrage", 10_000);
    // 80 tours × 5 s ≈ 6,6 min : on attend encore (ni échec ni fin)…
    expect(etat.echec).toBeUndefined();
    expect(etat.fini).toBeFalsy();
    // … puis, au-delà de 30 min sans réponse, l'échec ordinaire (réessayable) reprend la main.
    const a = fauxAligneur();
    let e: EtatChaine = etatChaineInitial();
    let t = 0;
    for (let i = 0; i < 40 && !e.echec && !e.fini; i++) {
      t += 5_000;
      if (a.enCours().some((c) => c.startsWith("son:"))) a.etat.injoignable = true;
      if (a.etat.injoignable) t += 4 * 60_000;
      e = await avancerChaine(e, commande(), { travailId: "t-v5b", versionId: "ver-v5b" }, { facecam: a.facecam, maintenant: () => t });
    }
    expect(e.echec?.brique).toBe("son");
    expect(e.echec?.reessayable).toBe(true);
  });
});
