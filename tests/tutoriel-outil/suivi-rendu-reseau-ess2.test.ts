/**
 * ESS-2 · une coupure réseau pendant le SUIVI d'un rendu déjà soumis = attente puis relecture, jamais un échec ni un second
 * rendu. Moteur réel, rendu simulé (doubles) : aucun réseau, aucune dépense, aucune attente réelle.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { ServiceRendu } from "@/fournisseurs/types";
import { creerMoteurTutorielOutil, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { ATTENTES_RESEAU_MAX, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 25, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
type Moteur = ReturnType<typeof creerMoteurTutorielOutil>;

async function mener(moteur: Moteur, c: CommandeFabrication, travail: Travail, jusqua = 400) {
  let t = travail;
  for (let i = 0; i < jusqua; i++) {
    t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}
const lancer = (moteur: Moteur, c: CommandeFabrication) => moteur.lancer(c, { travailId: "t-res", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
const etatDe = (t: Travail) => t.parametres?.tutoriel as EtatTutoriel;

/** La lecture d'état des COMPOSITIONS lève `erreur` pour les `n` premières lectures (`Infinity` : toujours) ; le reste est le double. */
function avecCoupures(o: OutilsTutoriel, n: number, erreur: () => Error, sur: (id: string) => boolean = (id) => id.includes("-4x5-")) {
  const base: ServiceRendu = o.rendu.service();
  const compte = { soumissions: 0, coupures: 0 };
  const service: ServiceRendu = {
    async soumettre(d) {
      compte.soumissions++;
      return base.soumettre(d);
    },
    async etat(id) {
      if (sur(id) && compte.coupures < n) {
        compte.coupures++;
        throw erreur();
      }
      return base.etat(id);
    },
  };
  o.rendu.service = () => service;
  return { o, compte };
}
const reseau = () => new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });

describe("ESS-2 · suivi d'un rendu soumis : coupure réseau", () => {
  it("la lecture lève une ErreurRendu réessayable une fois puis « termine » : pas d'échec, sortie rangée, UNE seule soumission de la composition", async () => {
    const j = journalVide();
    const { o, compte } = avecCoupures(outilsDoubles(j), 1, reseau);
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t = await mener(moteur, c, await lancer(moteur, c));
    expect(compte.coupures).toBe(1);
    expect(t.statut).toBe("termine");
    expect(etatDe(t).rendus[0]?.sortie).toBeDefined();
    expect(etatDe(t).rendus[0]?.attentesReseau).toBeUndefined();
    const compositions = j.rendus.filter((d) => d.operation === "composition");
    expect(compositions).toHaveLength(1);
    expect(new Set(j.rendus.map((d) => d.idRendu)).size).toBe(j.rendus.length);
  });

  it("une erreur NON réessayable au suivi reste un échec immédiat", async () => {
    const j = journalVide();
    const { o } = avecCoupures(outilsDoubles(j), Infinity, () => new ErreurRendu({ code: "refuse", reessayable: false, message: "refusé" }));
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t = await mener(moteur, c, await lancer(moteur, c));
    expect(t.statut).toBe("echec");
    expect(j.rendus.filter((d) => d.operation === "composition")).toHaveLength(1);
  });

  it("au-delà de la borne de pas consécutifs : échec réessayable, toujours une seule soumission, jamais un nouvel identifiant", async () => {
    const j = journalVide();
    const { o, compte } = avecCoupures(outilsDoubles(j), Infinity, reseau);
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t = await mener(moteur, c, await lancer(moteur, c), ATTENTES_RESEAU_MAX + 60);
    expect(t.statut).toBe("echec");
    expect(compte.coupures).toBe(ATTENTES_RESEAU_MAX + 1);
    expect(j.rendus.filter((d) => d.operation === "composition")).toHaveLength(1);
    expect(t.erreur?.reessayable).toBe(true);
  });

  it("après la borne, « Réessayer » relit d'abord l'ancienne demande : si le rendu est fini, aucun second rendu", async () => {
    const j = journalVide();
    const { o, compte } = avecCoupures(outilsDoubles(j), ATTENTES_RESEAU_MAX + 1, reseau);
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const tombe = await mener(moteur, c, await lancer(moteur, c), ATTENTES_RESEAU_MAX + 60);
    expect(tombe.statut).toBe("echec");
    const relance = await moteur.reessayer!(tombe, T0 + 900_000);
    const fini = await mener(moteur, c, relance);
    expect(compte.coupures).toBe(ATTENTES_RESEAU_MAX + 1);
    expect(fini.statut).toBe("termine");
    expect(j.rendus.filter((d) => d.operation === "composition")).toHaveLength(1);
  });

  it("une coupure pendant le suivi du mixage, de la mesure du son et de la vignette ne les fait pas échouer", async () => {
    const j = journalVide();
    const base = outilsDoubles(j);
    const { o, compte } = avecCoupures(base, 3, reseau, (id) => id.includes("-mixage-") || id.includes("-son-") || id.includes("-vignette-"));
    const vrai = o.rendu.service();
    const service: ServiceRendu = {
      soumettre: (d) => vrai.soumettre(d),
      async etat(id) {
        const e = await vrai.etat(id);
        return id.includes("-son-") && e.statut === "termine" ? { ...e, mesures: { lufs: -14.1, creteVraieDbtp: -2.3 } } : e;
      },
    };
    const outils: OutilsTutoriel = { ...o, rendu: { ...o.rendu, service: () => service }, finitions: { actif: true } };
    const moteur = creerMoteurTutorielOutil({ outils: une(outils) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t = await mener(moteur, c, await lancer(moteur, c));
    expect(compte.coupures).toBe(3);
    expect(t.statut).toBe("termine");
    const e = etatDe(t);
    expect(e.sonMixe?.echec).toBeUndefined();
    expect(e.sonMixe?.attentesReseau).toBeUndefined();
    expect(e.rendus[0]?.mesure?.resultat).toMatchObject({ lufs: -14.1 });
    expect(e.rendus[0]?.vignette?.resultat).toMatchObject({ cle: expect.stringMatching(/\.jpg$/) });
    expect(e.reserves.some((r) => r.includes("chaîne son"))).toBe(false);
    expect(new Set(j.rendus.map((d) => d.idRendu)).size).toBe(j.rendus.length);
  });
});
