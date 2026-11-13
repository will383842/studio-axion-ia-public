/**
 * GV2-06 : une panne passagère du serveur de rendu fait ATTENDRE le tableau au lieu de le faire échouer ; au-delà de
 * 15 min sans progrès, l'échec d'avant (réessayable) ; un refus définitif échoue tout de suite ; un refus d'animation
 * dit la vérité (non réessayable, problème nommé). Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { ServiceRendu } from "../../../src/fournisseurs/types";
import { ErreurRendu } from "../../../src/fournisseurs/rendu/client";
import type { MoteurVideo } from "../../../src/moteurs/types";
import { ficheDemonstration } from "../regles/exemples";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 10, 13, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const MIN = 60_000;

/** Un tour par pas de `pasMs` ; s'arrête à « termine » ou « echec » (ou après `max` tours). */
async function jouer(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail, pasMs: number, max = 300) {
  let t = depart;
  const statuts: string[] = [];
  for (let n = 0; n < max; n++) {
    t = (await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * pasMs)).travail;
    statuts.push(t.statut);
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, statuts };
}

/** Le rendu du banc, mais `soumettre` du traitement du son lève une `ErreurRendu` tant que `panne()` le demande. */
function enPanne(b: ReturnType<typeof banc>, panne: () => ErreurRendu | null) {
  const vrai = b.d.outils.voix.rendu();
  const tentatives = { n: 0 };
  const service: ServiceRendu = {
    soumettre: async (d) => {
      if (d.operation === "nettoyage-audio") {
        tentatives.n++;
        const p = panne();
        if (p) throw p;
      }
      return vrai.soumettre(d);
    },
    etat: (id) => vrai.etat(id),
  };
  b.d.outils.voix.rendu = () => service;
  return tentatives;
}

const indisponible = () => new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });

describe("panne passagère du serveur de rendu (GV2-06)", () => {
  it("3 tours sans réponse, puis il répond : toujours « en cours », puis terminé, voix lue UNE fois", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    const t = await b.moteur.lancer(c, ctx("t-panne-3"));
    const tentatives = enPanne(b, () => (tentatives.n <= 3 ? indisponible() : null));
    const r = await jouer(b.moteur, c, t, 1000);
    expect(r.travail.statut).toBe("termine");
    expect(r.statuts).not.toContain("echec");
    expect(tentatives.n).toBeGreaterThanOrEqual(4);
    expect(b.d.lectures()).toBe(1);
  });

  it("pendant la panne, le travail reste « en cours » et le compte des pannes est tenu hors de l'avancement", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    enPanne(b, () => indisponible());
    const r = await jouer(b.moteur, c, await b.moteur.lancer(c, ctx("t-panne-compte")), 30_000, 12);
    expect(r.travail.statut).toBe("en_cours");
    const etat = (r.travail.parametres as { tableau: { pannes?: { nombre: number }; garde?: { empreinte: string } } }).tableau;
    expect(etat.pannes?.nombre).toBeGreaterThanOrEqual(3);
    expect(b.d.lectures()).toBe(1);
  });

  it("muet plus de 15 min : échec réessayable (la voix payée reste gardée)", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    enPanne(b, () => indisponible());
    const r = await jouer(b.moteur, c, await b.moteur.lancer(c, ctx("t-panne-15")), MIN, 40);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur?.reessayable).toBe(true);
    // 15 min de pannes : pas avant.
    expect(r.statuts.length).toBeGreaterThanOrEqual(15);
    expect(r.statuts.slice(0, 10)).not.toContain("echec");
    expect(b.d.lectures()).toBe(1);
  });

  it("refus définitif (reessayable: false) : échec immédiat", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    enPanne(b, () => new ErreurRendu({ code: "refuse", reessayable: false, message: "Le service de rendu a refusé la demande." }));
    const r = await jouer(b.moteur, c, await b.moteur.lancer(c, ctx("t-refus-def")), 1000);
    expect(r.travail.statut).toBe("echec");
    expect(r.statuts.length).toBeLessThanOrEqual(8);
  });
});

describe("refus d'animation (GV2-06)", () => {
  it("une page qui reste vide 0,5 s : TABLEAU_ANIMATION_REFUSEE, non réessayable, le problème est nommé", async () => {
    const b0 = banc(ficheDemonstration);
    const probleme = "Page 2 · la page 2 reste vide 0.50 s après l'effacement.";
    const b = banc(ficheDemonstration, { preparation: { ...b0.d.outils.preparation, controlerProprietes: () => [probleme] } });
    const c = b.commande(ficheDemonstration);
    const r = await jouer(b.moteur, c, await b.moteur.lancer(c, ctx("t-anim")), 1000);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur).toMatchObject({ code: "TABLEAU_ANIMATION_REFUSEE", reessayable: false });
    expect(r.travail.erreur?.messagePourWill).toContain("ne tient pas sur la voix");
    expect(r.travail.erreur?.messagePourWill).toContain("reste vide 0.50 s");
    expect(r.travail.erreur?.messagePourWill).not.toMatch(/réessayer/);
  });
});
