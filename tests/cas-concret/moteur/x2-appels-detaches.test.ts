/**
 * X2 · les appels d'écriture ne sont jamais attendus dans un passage de la boucle de fond, ni payés deux fois. Un double
 * d'appel met 200 s simulées : chaque passage rend la main vite, un seul appel est payé, la vidéo va jusqu'au bout ;
 * redémarrage au milieu (mémoire perdue, journal et réponses gardés) : pas de second appel ; 6 minutes sans réponse :
 * échec en clair, puis un seul nouvel appel au « Réessayer » (ou la réponse arrivée entre-temps, reprise sans repayer).
 * Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { DELAI_REPONSE_APPEL_MS } from "@/moteurs/montage-cas-concret/appels";
import type { ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { ResultatFabrication } from "@/moteurs/types";
import { doubles, type OptionsDoubles } from "../fabriquer/doubles";
import { commandeCasConcret, versOutils } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
/** Un passage de la boucle de fond toutes les 5 s. */
const PAS_MS = 5_000;
const DUREE_APPEL_MS = 200_000;
const ctx = { travailId: "t-x2", versionId: "ver-x2", titre: "Essai", maintenant: T0 };

interface Lancement {
  cle: string;
  depuis: number;
  appel: () => Promise<ReponseAppelEcriture>;
  /** L'appel ne répond jamais (studio redémarré pendant l'appel). */
  perdu?: boolean;
  fait?: boolean;
}

/**
 * Banc : la chaîne des doubles, des appels qui répondent `dureeMs` après leur lancement, des réponses gardées dans un
 * stockage qui survit au redémarrage. `redemarrer` : un moteur neuf (rien en mémoire), mêmes réponses gardées.
 */
function bancLent(opt: OptionsDoubles & { dureeMs?: number } = {}) {
  const d = doubles(opt);
  const reponses = new Map<string, ReponseAppelEcriture>();
  const lancements: Lancement[] = [];
  let maintenant = T0;
  const dureeMs = opt.dureeMs ?? DUREE_APPEL_MS;
  const creer = () => {
    const base = versOutils(d);
    return creerMoteurMontageCasConcret({
      outils: async () => ({
        ...base,
        ecriture: {
          ...base.ecriture,
          detache: {
            lancer: (cle, appel) => void lancements.push({ cle, depuis: maintenant, appel }),
            lire: async (cle) => reponses.get(cle) ?? null,
          },
        },
      }),
    });
  };
  /** Les appels dont la réponse est arrivée à l'heure `t` écrivent leur résultat. */
  async function ecouler(t: number) {
    maintenant = t;
    for (const l of lancements) {
      if (l.fait || l.perdu || t - l.depuis < dureeMs) continue;
      l.fait = true;
      reponses.set(l.cle, await l.appel());
    }
  }
  return { d, reponses, lancements, creer, ecouler, commande: (extra: Partial<CommandeFabrication> = {}) => commandeCasConcret(d, opt.reseaux, extra) };
}

type Banc = ReturnType<typeof bancLent>;

/** Fait passer la boucle (un passage toutes les 5 s) jusqu'à `condition` ; mesure la durée réelle de chaque passage. */
async function passer(b: Banc, moteur: ReturnType<Banc["creer"]>, commande: CommandeFabrication, depart: Travail, debut: number, condition: (t: Travail, maintenant: number) => boolean = (t) => t.statut === "termine" || t.statut === "echec") {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  const durees: number[] = [];
  const etats: Travail[] = [];
  for (let n = 0; n < 1000; n++) {
    const maintenant = debut + n * PAS_MS;
    await b.ecouler(maintenant);
    const t0 = performance.now();
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, maintenant);
    durees.push(performance.now() - t0);
    t = r.travail;
    etats.push(t);
    resultat = r.resultat ?? resultat;
    if (condition(t, maintenant)) return { travail: t, resultat, durees, etats, maintenant };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

const ecriture = (t: Travail) => t.etapes.find((e) => e.cle === "ecriture")!;
const lancesEcriture = (b: Banc) => b.lancements.filter((l) => l.cle.startsWith("ccecr-")).length;

describe("X2 · écriture détachée", () => {
  it("un appel de 200 s : aucun passage ne dépasse 2 s, un seul appel payé, la vidéo va jusqu'au bout", async () => {
    const b = bancLent();
    const moteur = b.creer();
    const c = b.commande();
    const fin = await passer(b, moteur, c, await moteur.lancer(c, ctx), T0);
    expect(fin.travail.statut).toBe("termine");
    expect(Math.max(...fin.durees)).toBeLessThan(2000);
    expect(lancesEcriture(b)).toBe(1);
    expect(b.d.appelsEcriture()).toBe(1);
    // Il a bien fallu attendre la réponse : plusieurs passages pendant l'appel.
    expect(fin.etats.filter((t) => ecriture(t).statut === "en_cours").length).toBeGreaterThanOrEqual(DUREE_APPEL_MS / PAS_MS - 1);
  });

  it("pendant l'attente, le suivi dit « L'écriture, en cours » (jamais en panne ni en échec)", async () => {
    const b = bancLent();
    const moteur = b.creer();
    const c = b.commande();
    const r = await passer(b, moteur, c, await moteur.lancer(c, ctx), T0, (_t, m) => m >= T0 + 100_000);
    expect(r.travail.statut).toBe("en_cours");
    expect(r.travail.erreur).toBeUndefined();
    expect(ecriture(r.travail)).toMatchObject({ nom: "L'écriture", statut: "en_cours" });
    expect(r.travail.reprise).toBeUndefined();
    // Le journal garde l'appel en cours, avec son identifiant et l'heure.
    const journal = (r.travail.parametres as { casConcret: { journal: { appels: Record<string, { tentative: number; le: number }> } } }).casConcret.journal;
    expect(Object.values(journal.appels)).toEqual([expect.objectContaining({ tentative: 1, le: T0 })]);
  });

  it("la relance et la reformulation d'une phrase sont détachées de même : chacune payée une fois", async () => {
    let premiere = true;
    const b = bancLent({
      lecturesFautives: [1],
      retoucherFiche: (f) => {
        if (!premiere) return f;
        premiere = false;
        // X9 : un champ figé est désormais posé par le studio ; un écran sans texte dit reste refusé (relance).
        const [premier, ...reste] = f.ecrans as Record<string, unknown>[];
        return { ...f, ecrans: [{ ...premier, texteDit: undefined }, ...reste] };
      },
    });
    const moteur = b.creer();
    const c = b.commande();
    const fin = await passer(b, moteur, c, await moteur.lancer(c, ctx), T0);
    expect(fin.travail.statut).toBe("termine");
    expect(Math.max(...fin.durees)).toBeLessThan(2000);
    expect(lancesEcriture(b)).toBe(2);
    expect(b.d.appelsEcriture()).toBe(2);
    expect(b.lancements.filter((l) => l.cle.startsWith("ccref-"))).toHaveLength(1);
    expect(b.d.roles.filter((r) => r === "reformulation-cas-concret")).toHaveLength(1);
  });
});

describe("X2 · jamais payé deux fois", () => {
  it("redémarrage au milieu (mémoire perdue, journal gardé) : pas de second appel, la réponse est reprise", async () => {
    const b = bancLent();
    const c = b.commande();
    const avant = b.creer();
    const milieu = await passer(b, avant, c, await avant.lancer(c, ctx), T0, (_t, m) => m >= T0 + 100_000);
    expect(lancesEcriture(b)).toBe(1);
    // Redémarrage : un moteur neuf, le travail tel qu'en base.
    const apres = b.creer();
    const fin = await passer(b, apres, c, milieu.travail, milieu.maintenant + PAS_MS);
    expect(fin.travail.statut).toBe("termine");
    expect(lancesEcriture(b)).toBe(1);
    expect(b.d.appelsEcriture()).toBe(1);
  });

  it("6 minutes sans réponse : échec en clair, puis un seul nouvel appel au « Réessayer »", async () => {
    const b = bancLent();
    const moteur = b.creer();
    const c = b.commande();
    const depart = await moteur.lancer(c, ctx);
    // Le studio a redémarré pendant l'appel : sa réponse n'arrivera jamais.
    const enEchec = await passer(b, moteur, c, depart, T0, (t) => {
      for (const l of b.lancements) l.perdu = true;
      return t.statut === "echec";
    });
    expect(enEchec.maintenant - T0).toBeGreaterThanOrEqual(DELAI_REPONSE_APPEL_MS);
    expect(enEchec.maintenant - T0).toBeLessThan(DELAI_REPONSE_APPEL_MS + 2 * PAS_MS);
    expect(lancesEcriture(b)).toBe(1);
    expect(ecriture(enEchec.travail).statut).toBe("echec");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    expect(enEchec.travail.erreur?.messagePourWill).toContain("L'étape « L'écriture » n'a pas abouti : la réponse n'est pas arrivée.");

    const repris = await moteur.reessayer(enEchec.travail, enEchec.maintenant);
    const fin = await passer(b, moteur, c, repris, enEchec.maintenant + PAS_MS);
    expect(fin.travail.statut).toBe("termine");
    expect(lancesEcriture(b)).toBe(2);
    expect(b.d.appelsEcriture()).toBe(1);
  });

  it("la réponse de l'ancien appel arrive après l'échec : « Réessayer » la reprend sans repayer", async () => {
    const b = bancLent({ dureeMs: DELAI_REPONSE_APPEL_MS + 60_000 });
    const moteur = b.creer();
    const c = b.commande();
    const enEchec = await passer(b, moteur, c, await moteur.lancer(c, ctx), T0);
    expect(enEchec.travail.statut).toBe("echec");
    // Will revient plus tard : la réponse est arrivée entre-temps.
    const plusTard = enEchec.maintenant + 120_000;
    await b.ecouler(plusTard);
    expect(b.reponses.size).toBe(1);
    const fin = await passer(b, moteur, c, await moteur.reessayer(enEchec.travail, plusTard), plusTard);
    expect(fin.travail.statut).toBe("termine");
    expect(lancesEcriture(b)).toBe(1);
    expect(b.d.appelsEcriture()).toBe(1);
  });
});
