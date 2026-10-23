/**
 * DÉLAI DE GARDE (incident du 12/10) : lecture gardée d'un rendu (`fournisseurs/rendu/garde.ts`), branchée sur le
 * tableau animé (scènes, composition) et délai de garde global du travail. Doubles seulement, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../../src/fournisseurs/types";
import { lireRenduGarde, delaiSansNouvelleMs, SANS_NOUVELLE_MIN_DEFAUT } from "../../src/fournisseurs/rendu/garde";
import { suivreRendu } from "../../src/fournisseurs/rendu/client";
import { avancerCartesMotion, etatInitialCartesMotion } from "../../src/briques/motion/rendu-cartes";
import type { CarteFormat } from "../../src/briques/motion/pourFormat";
import { CODE_SANS_NOUVELLE, DELAI_GARDE_TRAVAIL_MS, PHRASE_SCENE_RATEE } from "../../src/moteurs/montage-tableau";
import { bancDeuxVerticaux, ctx, estComplet, estScene, horloge, tourner } from "./banc";

const MIN = 60_000;
const demande = (id: string): DemandeRendu => ({ idRendu: id, operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: "https://r2/d", cle: `k/${id}` }, parametres: {} });
function serveur(etats: Record<string, EtatRendu>): ServiceRendu & { soumis: string[] } {
  const soumis: string[] = [];
  return {
    soumis,
    async soumettre(d) {
      soumis.push(d.idRendu);
      return { idRendu: d.idRendu };
    },
    async etat(id) {
      return etats[id] ?? { statut: "inconnu" };
    },
  };
}

describe("lecture gardée d'un rendu", () => {
  it("défaut prudent (15 min), réglable par l'environnement", () => {
    expect(SANS_NOUVELLE_MIN_DEFAUT).toBe(15);
    expect(delaiSansNouvelleMs({})).toBe(15 * MIN);
    expect(delaiSansNouvelleMs({ STUDIO_RENDU_SANS_NOUVELLE_MIN: "25" })).toBe(25 * MIN);
    expect(delaiSansNouvelleMs({ STUDIO_RENDU_SANS_NOUVELLE_MIN: "0" })).toBe(15 * MIN);
  });

  it("état figé : en cours sans progrès depuis N min → échec réessayable « Rendu sans nouvelle depuis N min »", async () => {
    let t = 0;
    const s = serveur({ a: { statut: "en_cours", progression: 40 } });
    const garde = { delaiMs: 15 * MIN, maintenant: () => t };
    const l1 = await lireRenduGarde(s, demande("a"), undefined, garde);
    expect(l1.etat.statut).toBe("en_cours");
    t = 14 * MIN;
    const l2 = await lireRenduGarde(s, demande("a"), l1.veille, garde);
    expect(l2.etat.statut).toBe("en_cours");
    expect(l2.veille).toEqual(l1.veille);
    t = 15 * MIN;
    const l3 = await lireRenduGarde(s, demande("a"), l2.veille, garde);
    expect(l3).toMatchObject({ sansNouvelle: true, etat: { statut: "echec", erreur: { reessayable: true, message: "Rendu sans nouvelle depuis 15 min." } } });
    expect(s.soumis).toEqual([]);
  });

  it("ajout pur : un rendu qui avance n'est jamais arrêté ; la file d'attente n'est pas surveillée", async () => {
    let t = 0;
    const etats: Record<string, EtatRendu> = { a: { statut: "en_file", rang: 1 } };
    const s = serveur(etats);
    const garde = { delaiMs: 15 * MIN, maintenant: () => t };
    let veille = (await lireRenduGarde(s, demande("a"), undefined, garde)).veille;
    t = 60 * MIN;
    const enFile = await lireRenduGarde(s, demande("a"), veille, garde);
    expect(enFile.etat).toEqual({ statut: "en_file", rang: 1 });
    veille = enFile.veille;
    for (let p = 0; p <= 90; p += 10) {
      etats.a = { statut: "en_cours", progression: p };
      t += 14 * MIN;
      const l = await lireRenduGarde(s, demande("a"), veille, garde);
      expect(l.etat.statut).toBe("en_cours");
      veille = l.veille;
    }
    etats.a = { statut: "termine", sortieCle: "k/a" };
    t += 60 * MIN;
    expect((await lireRenduGarde(s, demande("a"), veille, garde)).etat.statut).toBe("termine");
  });

  it("identifiant inconnu (serveur redémarré) → échec réessayable, rien n'est soumis ; sans garde, l'ancienne reprise reste", async () => {
    const s = serveur({});
    const l = await lireRenduGarde(s, demande("a"), { signature: "en_cours:30", depuis: 0 }, { delaiMs: 15 * MIN, maintenant: () => 4 * MIN });
    expect(l).toMatchObject({ sansNouvelle: true, etat: { statut: "echec", erreur: { reessayable: true, message: "Rendu sans nouvelle depuis 4 min : le serveur de rendu ne le connaît plus." } } });
    expect(s.soumis).toEqual([]);
    // `suivreRendu` (autres formats) : inchangé, même demande, même identifiant.
    expect(await suivreRendu(s, demande("a"))).toMatchObject({ statut: "en_file", resoumis: true });
    expect(s.soumis).toEqual(["a"]);
  });

  it("cartes : un rendu inconnu repart UNE fois sous un autre identifiant (-e1) ; sans garde, comportement d'avant", async () => {
    const carte = { id: "s1", ratio: "9:16", debutSec: 0, finSec: 5, modele: "TableauScene", parametres: { composition: "TableauScene", proprietes: {} } } as unknown as CarteFormat;
    const s = serveur({});
    const outils = { rendu: () => s, depot: async (cle: string) => `https://r2/depot/${cle}` };
    let e = etatInitialCartesMotion([carte], () => "studio/dev/cartes/v/s1.mp4");
    e = await avancerCartesMotion(e, { ...outils, garde: { delaiMs: 15 * MIN, maintenant: () => 0 } });
    e = await avancerCartesMotion(e, { ...outils, garde: { delaiMs: 15 * MIN, maintenant: () => 0 } });
    expect(s.soumis).toEqual([s.soumis[0], `${s.soumis[0]}-e1`]);
    expect(e.cartes[0]).toMatchObject({ statut: "soumise", essais: 1 });
    const t = serveur({});
    let f = etatInitialCartesMotion([carte], () => "studio/dev/cartes/v/s1.mp4");
    f = await avancerCartesMotion(f, { rendu: () => t, depot: outils.depot });
    f = await avancerCartesMotion(f, { rendu: () => t, depot: outils.depot });
    expect(t.soumis).toEqual([t.soumis[0], t.soumis[0]]);
    expect(f.cartes[0]).toMatchObject({ statut: "soumise", essais: 0 });
  });
});

describe("tableau animé sous délai de garde", { timeout: 120_000 }, () => {
  const garde = () => ({ delaiMs: 15 * MIN, maintenant: () => horloge.t });
  const avecGarde = (o: { scenes: object; montage: object }) => ({ scenes: { ...o.scenes, garde: garde() }, montage: { ...o.montage, garde: garde() } }) as never;

  it("scène du second vertical figée « en cours » : nouvel essai après 15 min, puis échec avec la phrase simple", async () => {
    const b = bancDeuxVerticaux((d, compositions) => (estScene(d) && compositions >= 1 ? { statut: "en_cours", progression: 37 } : null), avecGarde);
    const { travail, tours } = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-fige")), 200, 5 * MIN);
    expect(travail.statut).toBe("echec");
    expect(travail.erreur).toMatchObject({ reessayable: true, messagePourWill: PHRASE_SCENE_RATEE });
    expect(travail.erreur?.detailTechnique).toMatch(/Rendu sans nouvelle depuis 15 min/);
    const [premiere, essai] = b.scenesSoumises().slice(-2);
    expect(essai).toBe(`${premiere}-e1`);
    // Deux fois 15 min (et les tours du premier vertical), jamais « en cours » sans fin.
    expect(tours * 5 * MIN).toBeLessThan(80 * MIN);
  });

  it("serveur de rendu redémarré (identifiant inconnu) : la scène repart sous un autre identifiant et la vidéo est finie", async () => {
    let oubli = true;
    const b = bancDeuxVerticaux((d, compositions) => {
      if (!(estScene(d) && compositions >= 1 && oubli)) return null;
      oubli = false;
      return { statut: "inconnu" };
    }, avecGarde);
    const { travail } = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-inconnu")), 100);
    expect(travail.statut).toBe("termine");
    const [premiere, essai] = b.scenesSoumises().slice(-2);
    expect(essai).toBe(`${premiere}-e1`);
  });

  it("composition figée : UNE nouvelle demande (autre identifiant), puis échec définitif ; relance sans repayer", async () => {
    const b = bancDeuxVerticaux((d, compositions) => (estComplet(d) && compositions >= 2 ? { statut: "en_cours", progression: 61 } : null), avecGarde);
    const { travail } = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-compo")), 200, 5 * MIN);
    expect(travail.statut).toBe("echec");
    expect(travail.etapes.find((e) => e.cle === "montage")?.statut).toBe("echec");
    const [premiere, essai] = b.compositionsSoumises().slice(-2);
    expect(essai).toBe(`${premiere}-e1`);
    const lectures = b.d.lectures();
    b.reparer();
    const fin = await tourner(b.moteur, b.commande, await b.moteur.reessayer!(travail, horloge.t), 60);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(lectures);
  });

  it("délai de garde global : une fabrication sans changement d'état pendant M min passe en échec ; défaut 45 min", async () => {
    expect(DELAI_GARDE_TRAVAIL_MS).toBe(45 * MIN);
    // Composition du second vertical en file pour toujours (non surveillée par le délai d'un rendu).
    const b = bancDeuxVerticaux((d, compositions) => (estComplet(d) && compositions >= 2 ? { statut: "en_file", rang: 1 } : null), () => ({ delaiGardeMs: 20 * MIN }));
    const { travail, tours } = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-global")), 200, 5 * MIN);
    expect(travail.statut).toBe("echec");
    expect(travail.erreur).toMatchObject({ code: CODE_SANS_NOUVELLE, reessayable: true, messagePourWill: "La fabrication n'a plus avancé depuis 20 min. Relancez : la voix déjà payée est gardée." });
    expect(tours).toBeLessThan(60);
    const lectures = b.d.lectures();
    b.reparer();
    const relance = await b.moteur.reessayer!(travail, horloge.t);
    expect((relance.parametres as { tableau: { garde?: unknown } }).tableau.garde).toBeUndefined();
    const fin = await tourner(b.moteur, b.commande, relance, 60);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(lectures);
  });
});
