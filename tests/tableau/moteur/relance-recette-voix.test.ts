/**
 * GV2-06 : « Relancer » après un traitement du son qui a raté 4 fois. Avant : le moteur relisait la demande ratée
 * (gardée 24 h par `studio-rendu`) et relevait la même erreur. Maintenant : une demande NEUVE (`-r<n>`) est soumise, la
 * voix se termine, et la lecture payante n'est jamais refaite. Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { EtatRendu, ServiceRendu } from "../../../src/fournisseurs/types";
import type { MoteurVideo } from "../../../src/moteurs/types";
import { ficheDemonstration } from "../regles/exemples";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 10, 13, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail, debut = T0) {
  let t = depart;
  for (let n = 0; n < 300; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, debut + n * 1000);
    t = r.travail;
    if (t.statut === "termine" || t.statut === "echec") return t;
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** Le rendu du banc, mais le traitement du son échoue (réessayable) pour les demandes dont l'identifiant est dans `ratees`. */
function ratantLeSon(b: ReturnType<typeof banc>, ratees: (id: string) => boolean) {
  const vrai = b.d.outils.voix.rendu();
  const soumisSon: string[] = [];
  const service: ServiceRendu = {
    soumettre: async (d) => {
      if (d.operation === "nettoyage-audio") soumisSon.push(d.idRendu);
      return vrai.soumettre(d);
    },
    etat: async (id): Promise<EtatRendu> => (ratees(id) ? { statut: "echec", erreur: { code: "inconnu", reessayable: true, message: "Le traitement du son a échoué." } } : vrai.etat(id)),
  };
  b.d.outils.voix.rendu = () => service;
  return soumisSon;
}

describe("« Relancer » le traitement du son (GV2-06)", () => {
  it("après 4 échecs du son : une demande NEUVE (-r1) part, la voix se termine, aucune lecture payante de plus", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    const soumisSon = ratantLeSon(b, (id) => !/-r\d+$/.test(id));

    const enEchec = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-son")));
    expect(enEchec.statut).toBe("echec");
    expect(enEchec.etapes.find((e) => e.statut === "echec")?.cle).toBe("voix");
    expect(enEchec.erreur?.reessayable).toBe(true);
    expect(soumisSon.map((id) => id.replace(/^.*-recette/, "-recette"))).toEqual(["-recette", "-recette-e1", "-recette-e2", "-recette-e3"]);
    expect(b.d.lectures()).toBe(1);

    const repris = await b.moteur.reessayer(enEchec, T0 + 60_000);
    const fin = await jusquAuBout(b.moteur, c, repris, T0 + 120_000);
    expect(fin.statut).toBe("termine");
    expect(soumisSon).toHaveLength(5);
    expect(soumisSon[4]).toMatch(/-recette-r1$/);
    expect(soumisSon.slice(0, 4).some((id) => /-r\d+$/.test(id))).toBe(false);
    // Zéro lecture payante de plus : la voix lue au premier passage est celle gardée.
    expect(b.d.lectures()).toBe(1);
  });

  it("les lignes de coût (lignesPayeesDe) sont les mêmes avant et après « Relancer », et la même que sans panne", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    ratantLeSon(b, (id) => !/-r\d+$/.test(id));

    const enEchec = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-cout")));
    expect(enEchec.statut).toBe("echec");
    const avant = b.moteur.lignesPayees?.(enEchec, c);
    const repris = await b.moteur.reessayer(enEchec, T0 + 60_000);
    // « Relancer » lui-même ne change rien au relevé de ce qui est payé.
    expect(b.moteur.lignesPayees?.(repris, c)).toEqual(avant);
    expect(JSON.stringify(b.moteur.lignesPayees?.(repris, c))).toBe(JSON.stringify(avant));

    // Une fois la voix finie : la même ligne « Voix » qu'une fabrication sans aucune panne (même montant, même quantité).
    const fin = await jusquAuBout(b.moteur, c, repris, T0 + 120_000);
    const propre = banc(ficheDemonstration);
    const cp = propre.commande(ficheDemonstration);
    const finPropre = await jusquAuBout(propre.moteur, cp, await propre.moteur.lancer(cp, ctx("t-cout-propre")));
    expect(finPropre.statut).toBe("termine");
    const apres = b.moteur.lignesPayees?.(fin, c);
    expect(apres?.map((l) => l.etape)).toEqual(["Voix"]);
    expect(apres).toEqual(propre.moteur.lignesPayees?.(finPropre, cp));
  });
});
