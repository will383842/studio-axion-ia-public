/**
 * Un cas ajouté à la main est FIGÉ dans les entrées de la vidéo (`entrees.casConcret.casFige`) : le moteur, pur et synchrone,
 * relit CE cas, jamais l'origine ni la base. Un cas figé invalide, ou d'un autre identifiant, est « absent ». Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { casDesEntrees, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { preparerCasAjoute } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { bornesDesFins, controlerTexteFourni, texteFourniDesEcrans } from "@/moteurs/montage-cas-concret/script-fourni";
import { scriptDeFiche } from "@/moteurs/montage-cas-concret/script-valide";
import { banc } from "../moteur/doubles";
import { FORMULAIRE_MINIMAL } from "./formulaires";

const ID = "ajout-essai-ab12";
const r = preparerCasAjoute(FORMULAIRE_MINIMAL, { id: ID, autres: CATALOGUE });
if (!r.ok) throw new Error(r.raisons.join("|"));
const CAS = r.cas;
const T0 = Date.UTC(2026, 9, 24, 9, 0, 0);

describe("casFige · lecture par le moteur", () => {
  it("lireEntreesCasConcret garde casFige en porte A, pas en porte B", () => {
    const a = lireEntreesCasConcret({ casConcret: { casId: ID, porte: "A", casFige: CAS, reseaux: ["facebook"] } } as never);
    expect(a.casFige).toEqual(CAS);
    const b = lireEntreesCasConcret({ casConcret: { casId: ID, porte: "porte-b", casFige: CAS, reseaux: ["facebook"] } } as never);
    expect(b.casFige).toBeUndefined();
    expect(lireEntreesCasConcret({ casConcret: { casId: ID, casFige: [1, 2], reseaux: [] } } as never).casFige).toBeUndefined();
  });

  it("casDesEntrees rend le cas figé (et il n'est pas au catalogue)", () => {
    expect(trouverCas(ID)).toBeUndefined();
    expect(casDesEntrees({ porte: "porte-a", casId: ID, casFige: CAS })).toEqual(CAS);
  });

  it("identifiant différent de casId : le cas n'existe plus (jamais l'origine en douce)", () => {
    const autre = CATALOGUE[0];
    expect(casDesEntrees({ porte: "porte-a", casId: autre.id, casFige: CAS })).toBeUndefined();
  });

  it("cas figé invalide : le cas n'existe plus", () => {
    expect(casDesEntrees({ porte: "porte-a", casId: ID, casFige: { ...CAS, posture: "chez-nous" } })).toBeUndefined();
    expect(casDesEntrees({ porte: "porte-a", casId: ID, casFige: { id: ID } })).toBeUndefined();
  });

  it("sans casFige : le catalogue, comme avant ; porte B inchangée", () => {
    const c = CATALOGUE[0];
    expect(casDesEntrees({ porte: "porte-a", casId: c.id })).toEqual(c);
    expect(casDesEntrees({ porte: "porte-a", casId: ID })).toBeUndefined();
    expect(casDesEntrees({ porte: "porte-b", casId: ID, cas: CAS })).toEqual(CAS);
  });
});

describe("casFige · fabrication de bout en bout (doubles)", () => {
  const b0 = bornesDesFins(CAS);
  const texte = texteFourniDesEcrans(ficheParGabarit(CAS, { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins([b0.courte])).ecrans, CAS);
  const ctrl = controlerTexteFourni(texte, CAS);
  const script = ctrl.ok ? { ...scriptDeFiche({ casId: ID, ecrans: ctrl.ecrans as never }, { versionCas: CAS.version, valideLe: "2026-10-24", source: "essai" }), numero: 1 } : null;

  const commande = (b: ReturnType<typeof banc>, plus: Record<string, unknown> = {}): CommandeFabrication => {
    const c = b.commande();
    const e = (c.entrees as { casConcret: Record<string, unknown> }).casConcret;
    return { ...c, entrees: { casConcret: { ...e, casId: ID, empreinteCas: empreinteCas(CAS), casFige: CAS, ...plus } } } as CommandeFabrication;
  };
  async function jusquAuBout(b: ReturnType<typeof banc>, c: CommandeFabrication, id: string): Promise<Travail> {
    let t: Travail = await b.moteur.lancer(c, { travailId: id, versionId: `ver-${id}`, titre: "Essai", maintenant: T0 } as never);
    for (let n = 0; n < 300 && t.statut !== "termine" && t.statut !== "echec"; n++) t = (await b.moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, c, T0 + n * 1000)).travail;
    return t;
  }

  it("le script de ce cas est contrôlé et rejoué : la vidéo va au bout, sans appel d'écriture", async () => {
    expect(ctrl.ok).toBe(true);
    const b = banc({ cas: CAS, avecMot: false, scriptValide: async () => script });
    const c = commande(b);
    expect(b.moteur.refusAuLancement?.(c)).toBeNull();
    const t = await jusquAuBout(b, c, "t-fige");
    expect(t.erreur?.messagePourWill ?? t.statut).toBe("termine");
    expect(b.d.appelsEcriture()).toBe(0);
  }, 60_000);

  it("refusAuLancement : sans casFige un cas ajouté n'existe pas ; avec un autre empreinteCas, « Ce cas a changé »", () => {
    const b = banc({ cas: CAS, avecMot: false, scriptValide: async () => script });
    const sans = commande(b);
    const e = (sans.entrees as { casConcret: Record<string, unknown> }).casConcret;
    delete e.casFige;
    expect(b.moteur.refusAuLancement?.(sans)?.message).toBe("Ce cas n'existe plus.");
    expect(b.moteur.refusAuLancement?.(commande(b, { empreinteCas: "autre" }))?.message).toBe("Ce cas a changé : relisez-le avant de fabriquer.");
  });

  it("l'estimation d'un cas figé est calculée sur CE cas (même prix qu'un cas du catalogue de même forme, aucune lecture de la base)", async () => {
    const b = banc({ cas: CAS, avecMot: false, scriptValide: async () => null });
    const e = await b.moteur.estimer(commande(b));
    expect(e.total.centimes).toBeGreaterThan(0);
  });
});
