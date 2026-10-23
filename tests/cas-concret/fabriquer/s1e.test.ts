/**
 * S1e (cas concret) : la chaîne ne tient jamais la main pendant un rendu. Une capture, un assemblage ou une mesure des
 * blancs pas finis (`RenduEnCours`) font rendre la main sans rien perdre ni rien repayer ; une entrée absente du
 * stockage arrête les finitions après une seule série, avec une phrase qui nomme l'étape. Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import type { DemandeRendu } from "@/fournisseurs/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { ErreurFabricationCasConcret, ENTREE_INTROUVABLE, fabriquerCasConcret, RenduEnCours } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "./doubles";

/** Fait échouer `n` fois chaque clé (tirée du premier argument) avec `RenduEnCours`, puis laisse passer. */
function enCoursPuis<A extends unknown[], R>(n: number, cleDe: (premier: NoInfer<A>[0]) => string, f: (...a: A) => Promise<R>, quoi: string) {
  const vus = new Map<string, number>();
  return async (...a: A): Promise<R> => {
    const k = cleDe(a[0]);
    const deja = vus.get(k) ?? 0;
    vus.set(k, deja + 1);
    if (deja < n) throw new RenduEnCours(quoi);
    return f(...a);
  };
}

/** Voix d'essai qui laisse un blanc silencieux de 0,35 s après le 3e mot de chaque lecture : la prise a un blanc à mesurer. */
function avecBlanc(d: ReturnType<typeof doubles>) {
  const v = d.options.outils.voix;
  const voix = v.voix();
  const lire = voix.lire.bind(voix);
  const avecBlancs = {
    ...voix,
    lire: async (x: Parameters<typeof lire>[0]) => {
      const r = await lire(x);
      const mots = r.mots.map((m, i) => (i > 2 ? { ...m, debutSec: m.debutSec + 0.35, finSec: m.finSec + 0.35 } : m));
      return { ...r, mots, dureeSec: r.dureeSec + 0.35 };
    },
  };
  v.voix = () => avecBlancs;
  // Un blanc silencieux : la prise est gardée.
  v.mesurerPauses = async (_cle, pauses) => pauses.map(() => -90);
  return d;
}

describe("S1e · rendu soumis puis relu", () => {
  it("captures en cours : la chaîne attend, puis garde les mesures rendues (jamais celles d'un simple fichier)", async () => {
    const d = doubles();
    const o = d.options.outils.captures;
    const capturer = o.capturer;
    // Le fichier est déposé dès le premier passage (le rendu travaille) ; les mesures n'arrivent qu'à la relecture.
    o.capturer = enCoursPuis(
      2,
      (x) => x.cle,
      async (x) => ({ ...(await capturer(x)), mesures: { largeur: 1080, hauteur: 4321 } }) as Awaited<ReturnType<typeof capturer>>,
      "La capture",
    );
    const avant = o.capturer;
    o.capturer = async (x) => {
      d.partage.fichiers.add(x.cle);
      return avant(x);
    };
    let attentes = 0;
    const cr = await fabriquerCasConcret({ ...d.options, attendre: async () => void attentes++ });
    expect(attentes).toBeGreaterThan(0);
    const sortie = d.partage.journal.valeur?.etapes.captures?.sortie as { captures: Record<string, { hauteur: number }> };
    const hauteurs = Object.values(sortie.captures).map((c) => c.hauteur);
    expect(hauteurs.length).toBeGreaterThan(0);
    expect(new Set(hauteurs)).toEqual(new Set([4321]));
    expect(cr.journalCaptures.join(" ")).not.toMatch(/repli/i);
  });

  it("assemblages et mesures des blancs en cours : la chaîne attend, aucune voix relue", async () => {
    const temoin = avecBlanc(doubles());
    const coutTemoin = (await fabriquerCasConcret(temoin.options)).coutVoixCentimes;

    const d = avecBlanc(doubles());
    const v = d.options.outils.voix;
    v.assembler = enCoursPuis(3, (x) => x.id, v.assembler, "L'assemblage");
    const mesures: string[] = [];
    const mesurer = v.mesurerPauses;
    type Pauses = Parameters<typeof mesurer>[1];
    v.mesurerPauses = enCoursPuis(2, (cle: string) => cle, async (cle: string, pauses: Pauses) => (mesures.push(cle), mesurer(cle, pauses)), "La mesure");
    let attentes = 0;
    const cr = await fabriquerCasConcret({ ...d.options, attendre: async () => void attentes++ });
    expect(attentes).toBeGreaterThanOrEqual(3);
    expect(mesures.length).toBeGreaterThan(0);
    expect(d.lus).toEqual(temoin.lus);
    expect(cr.coutVoixCentimes).toBe(coutTemoin);
    // Chaque fin a son son assemblé, demandé sous le même identifiant à chaque passage.
    expect(new Set(cr.fins.map((f) => f.voixCle))).toEqual(new Set(d.assemblages.map((a) => a.sortieCle)));
  });

  it("un passage interrompu pendant un assemblage reprend sans relire ni réassembler ce qui est fini", async () => {
    const d = doubles({ reseaux: ["facebook", "linkedin"] });
    const v = d.options.outils.voix;
    const assembler = v.assembler;
    // Le premier assemblage finit, le second reste en cours : on interrompt (attente = arrêt du passage).
    v.assembler = async (x) => {
      if (d.assemblages.length >= 1) throw new RenduEnCours("L'assemblage");
      return assembler(x);
    };
    const arret = new Error("passage rendu");
    await expect(
      fabriquerCasConcret({
        ...d.options,
        attendre: async () => {
          throw arret;
        },
      }),
    ).rejects.toThrow();
    const lusAvant = d.lus.length;
    expect(d.partage.journal.valeur?.assemblages?.faits && Object.keys(d.partage.journal.valeur.assemblages.faits)).toHaveLength(1);
    v.assembler = assembler;
    await fabriquerCasConcret(d.options);
    expect(d.lus.length).toBe(lusAvant);
    expect(new Set(d.assemblages.map((a) => a.id)).size).toBe(d.assemblages.length);
  });
});

describe("S1e · entrée absente : une série, puis l'arrêt", () => {
  it("la composition échoue en une série avec une phrase qui nomme l'étape ; une relance repart d'une demande neuve", async () => {
    const d = doubles({ reseaux: ["linkedin"] });
    d.options.outils.montage.seriesFichierInaccessible = 1;
    const rendu = d.options.outils.montage.rendu();
    const soumettre = rendu.soumettre.bind(rendu);
    const complets: DemandeRendu[] = [];
    rendu.soumettre = async (x) => {
      const r = await soumettre(x);
      if (x.operation === "composition" && (x.parametres as { mode?: string }).mode === "complet") {
        complets.push(x);
        d.partage.etats!.set(x.idRendu, { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Entrée inaccessible (404)" } });
      }
      return r;
    };
    const err = await fabriquerCasConcret(d.options).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
    expect((err as ErreurFabricationCasConcret).etape).toBe("montage");
    expect((err as Error).message).toContain("Les finitions");
    expect((err as ErreurFabricationCasConcret).raisons).toEqual([ENTREE_INTROUVABLE]);
    expect((err as Error).message).not.toMatch(/404|https?:/);
    // Une demande, puis trois essais : une seule série, sans attente de dix minutes.
    expect(complets).toHaveLength(4);
    expect(Object.keys(d.partage.journal.valeur?.montage ?? {})).toEqual([]);
  });

  it("au moteur : l'étape « Les finitions » échoue avec la phrase ; « Réessayer » recompose d'une demande neuve", async () => {
    const d = doubles({ reseaux: ["linkedin"] });
    const rendu = d.options.outils.montage.rendu();
    const soumettre = rendu.soumettre.bind(rendu);
    let absente = true;
    const complets: string[] = [];
    rendu.soumettre = async (x) => {
      const r = await soumettre(x);
      if (x.operation === "composition" && (x.parametres as { mode?: string }).mode === "complet") {
        complets.push(x.idRendu);
        if (absente) d.partage.etats!.set(x.idRendu, { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Entrée inaccessible (404)" } });
      }
      return r;
    };
    const { journal: _j, contexte, ...reste } = d.options.outils;
    void _j;
    const { reseaux: _r, ...ctx } = contexte;
    void _r;
    const outils = { ...reste, montage: { ...reste.montage, seriesFichierInaccessible: 1 }, env: "dev", numeroVersion: async () => 42, contexte: ctx, cas: d.options.cas };
    const moteur = creerMoteurMontageCasConcret({ outils: async () => outils });
    const c = { videoId: "video-cc", distribution: [{ voixId: "v" }], prononciations: [], entrees: { casConcret: d.options.entrees } } as unknown as CommandeFabrication;
    const avancer = async (t: Travail) => {
      for (let i = 0; i < 400 && t.statut !== "termine" && t.statut !== "echec"; i++) t = (await moteur.avancer(t, c)).travail;
      return t;
    };
    const echec = await avancer(await moteur.lancer(c, { travailId: "tr", versionId: "v1", titre: "Essai" } as never));
    expect(echec.statut).toBe("echec");
    expect(echec.etapes.find((e) => e.statut === "echec")?.cle).toBe("montage");
    expect(echec.erreur?.messagePourWill).toBe(`L'étape « Les finitions » n'a pas abouti. ${ENTREE_INTROUVABLE} Vous pouvez réessayer cette étape seule.`);
    expect(complets).toHaveLength(4);
    // Le fichier est revenu : la relance repart d'une demande neuve (pas de la série épuisée).
    absente = false;
    const fin = await avancer(await moteur.reessayer(echec));
    expect(fin.erreur?.messagePourWill).toBeUndefined();
    expect(fin.statut).toBe("termine");
    expect(complets).toHaveLength(5);
  });
});
