/**
 * T-EXT-45b · « Réessayer » reprend là où ça s'est arrêté et ne paie rien deux fois. Moteur réel, voix, Claude et rendu
 * SIMULÉS (doubles) : aucun appel réel, 0 €.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { ServiceRendu } from "@/fournisseurs/types";
import { creerMoteurTutorielOutil, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { EtatTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
type Moteur = ReturnType<typeof creerMoteurTutorielOutil>;

async function mener(moteur: Moteur, c: CommandeFabrication, travail: Travail, depart = 0, jusqua = 400) {
  let t = travail;
  for (let i = depart; i < depart + jusqua; i++) {
    t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}

const etatDe = (t: Travail) => t.parametres?.tutoriel as EtatTutoriel;
const compositions = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const lancer = (moteur: Moteur, c: CommandeFabrication) => moteur.lancer(c, { travailId: "t-to", versionId: "ver-1", titre: "Tuto", maintenant: T0 });

/** Compte les réservations de la voix (`avantLecture`) sans rien changer d'autre. */
function compterReservations(o: OutilsTutoriel): { n: number } {
  const compteur = { n: 0 };
  o.voix!.avantLecture = async () => {
    compteur.n++;
  };
  return compteur;
}

describe("tutoriel d'outil : reprise sans payer deux fois", () => {
  it("un rendu 4:5 tombé 3 fois : « Réessayer » redemande vraiment un rendu (identifiant jamais vu) et la vidéo se finit, voix lue 1 fois", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { renduEchecs: 3 })) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const tombe = await mener(moteur, c, await lancer(moteur, c));
    expect(tombe.statut).toBe("echec");
    expect(tombe.etapes.find((e) => e.cle === "montage")?.statut).toBe("echec");
    const avant = compositions(j).map((d) => d.idRendu);
    expect(avant).toHaveLength(3);

    const relance = await moteur.reessayer!(tombe, T0 + 500_000);
    expect(etatDe(relance).rendus[0]).toMatchObject({ serie: 1, essai: 0, aSoumettre: true });
    const fini = await mener(moteur, c, relance, 600);
    expect(fini.statut).toBe("termine");

    const tous = compositions(j).map((d) => d.idRendu);
    expect(tous).toHaveLength(4);
    expect(new Set(tous).size).toBe(4); // jamais un identifiant déjà vu par le service de rendu
    expect(tous[3]).toBe("t-to-4x5-r1-0");
    expect(avant).not.toContain(tous[3]);
    expect(j.voix).toHaveLength(1);
    expect(j.claude).toHaveLength(1);
  });

  it("le 9:16 tombe après un 4:5 fini : « Réessayer » ne redemande pas le 4:5", async () => {
    const j = journalVide();
    const o = outilsDoubles(j);
    const base: ServiceRendu = o.rendu.service();
    let echecs = 3;
    const service: ServiceRendu = {
      ...base,
      async etat(id) {
        const e = await base.etat(id);
        if (id.includes("-9x16-") && e.statut === "termine" && echecs > 0) {
          echecs--;
          return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "conteneur occupé" } as never };
        }
        return e;
      },
    };
    o.rendu.service = () => service;
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    const c = commandeTutoriel();
    const tombe = await mener(moteur, c, await lancer(moteur, c));
    expect(tombe.statut).toBe("echec");
    expect(tombe.etapes.find((e) => e.cle === "exports")?.statut).toBe("echec");
    const du45Avant = compositions(j).filter((d) => d.idRendu.includes("-4x5-")).length;
    expect(du45Avant).toBe(1);

    const relance = await moteur.reessayer!(tombe, T0 + 500_000);
    const [r45, r916] = ["4:5", "9:16"].map((r) => etatDe(relance).rendus.find((x) => x.ratio === r)!);
    expect(r45.sortie).toBeDefined();
    expect(r45.serie).toBeUndefined();
    expect(r45.aSoumettre).toBeUndefined();
    expect(r916).toMatchObject({ serie: 1, essai: 0, aSoumettre: true });
    const fini = await mener(moteur, c, relance, 600);
    expect(fini.statut).toBe("termine");
    expect(compositions(j).filter((d) => d.idRendu.includes("-4x5-"))).toHaveLength(1);
    expect(compositions(j).filter((d) => d.idRendu.includes("-9x16-r1-"))).toHaveLength(1);
    expect(j.voix).toHaveLength(1);
  });

  for (const etape of ["voix", "calage", "plan", "montage", "exports"] as const) {
    it(`échec simulé de « ${etape} » puis « Réessayer » : voix 1 fois, Claude 1 fois, réservation 1 fois, 1 rendu réussi par format`, async () => {
      const j = journalVide();
      const o = outilsDoubles(j);
      const reservations = compterReservations(o);
      const moteur = creerMoteurTutorielOutil({ outils: une(o) });
      const c = commandeTutoriel({ simulerEchecEtape: etape });
      const tombe = await mener(moteur, c, await lancer(moteur, c));
      expect(tombe.statut).toBe("echec");
      const relance = await moteur.reessayer!(tombe, T0 + 500_000);
      const fini = await mener(moteur, c, relance, 600);
      expect(fini.statut).toBe("termine");
      expect(j.voix).toHaveLength(1);
      expect(j.claude).toHaveLength(1);
      expect(reservations.n).toBe(1);
      const parFormat = (m: string) => compositions(j).filter((d) => d.idRendu.includes(`-${m}-`)).length;
      expect(parFormat("4x5")).toBe(1);
      expect(parFormat("9x16")).toBe(1);
      expect(etatDe(fini).appelsClaude).toMatchObject({ plan: 1 });
    });
  }

  it("la même demande de rendu n'est jamais soumise deux fois sous le même identifiant, même après plusieurs « Réessayer »", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { renduEchecs: 6 })) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    let t = await mener(moteur, c, await lancer(moteur, c));
    expect(t.statut).toBe("echec");
    t = await mener(moteur, c, await moteur.reessayer!(t, T0 + 500_000), 600);
    expect(t.statut).toBe("echec");
    t = await mener(moteur, c, await moteur.reessayer!(t, T0 + 900_000), 1200);
    expect(t.statut).toBe("termine");
    const ids = compositions(j).map((d) => d.idRendu);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("t-to-4x5-r2-0");
    expect(j.voix).toHaveLength(1);
  });

  it("le registre des appels payants garde le plan payé : une reprise du plan ne rappelle pas Claude", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel({ simulerEchecEtape: "montage" });
    const tombe = await mener(moteur, c, await lancer(moteur, c));
    const etat = etatDe(tombe);
    expect(Object.keys(etat.payes ?? {})).toHaveLength(1);
    expect(Object.values(etat.payes!)[0]?.etape).toBe("plan");
    // Le plan est effacé de l'état (reprise forcée) : le registre répond, Claude n'est pas rappelé.
    const sansPlan: Travail = { ...tombe, parametres: { ...tombe.parametres, tutoriel: { ...etat, plan: undefined } }, etapes: tombe.etapes.map((e) => (e.cle === "plan" || e.cle === "montage" || e.cle === "exports" ? { ...e, statut: "en_attente" as const } : e)), statut: "en_cours" };
    const fini = await mener(moteur, c, sansPlan, 600);
    expect(fini.statut).toBe("termine");
    expect(j.claude).toHaveLength(1);
    expect(etatDe(fini).appelsClaude?.plan).toBe(1);
  });

  it("sans appel Claude revenu (en panne), rien n'est inscrit au registre : un appel futur reste permis", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { claudeEnPanne: true })) });
    const c = commandeTutoriel();
    const t = await mener(moteur, c, await lancer(moteur, c));
    expect(t.statut).toBe("termine");
    expect(etatDe(t).payes).toBeUndefined();
  });
});
