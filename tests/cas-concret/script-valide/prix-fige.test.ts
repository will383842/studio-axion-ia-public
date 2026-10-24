/**
 * PRIX EXACT d'un script validé du studio (dont celui de « Mon script ») : figé dans la vidéo au lancement
 * (`entrees.casConcret.scriptFige`), il est compté tel quel par l'estimation, le lancement et le moteur : aucune ligne
 * « Écriture », la voix sur SON texte, le plafond de voix calculé sur lui. La fabrication le rejoue, jamais une écriture non
 * réservée. Une ancienne commande (sans `scriptFige`) garde le prix d'avant. Doubles seulement, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { apercuDesEcrans, CODE_PRIX_CHANGE, PHRASE_CAS_CHANGE_DEPUIS_LANCEMENT, PHRASE_SCRIPT_CHANGE_DEPUIS_PRIX, scriptDeFiche, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { empreinte as empreinteRelecture } from "@/domaine/relecture-script";
import { lignesDesEcrans } from "@/moteurs/montage-cas-concret/relecture";
import { LECTURES_CORPS_MAX } from "@/moteurs/montage-cas-concret/voix";
import { bornesDesFins, controlerTexteFourni, texteFourniDesEcrans } from "@/moteurs/montage-cas-concret/script-fourni";
import type { MoteurVideo } from "@/moteurs/types";
import { banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 24, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;
const FIXE = { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" } as const;
const CAS = trouverCas("rappels-rendez-vous")!;
const b0 = bornesDesFins(CAS);
const gabarit = ficheParGabarit(CAS, FIXE, dureesDesFins([b0.courte, b0.longue]));
const TEXTE = texteFourniDesEcrans(gabarit.ecrans, CAS);

/** Un script de Will conforme, construit par le module pur (les écrans validés). */
function scriptDe(texte: string, plus: Partial<ScriptValide> = {}): ScriptValide {
  const r = controlerTexteFourni(texte, CAS);
  if (!r.ok) throw new Error(r.refus.map((x) => x.message).join(" | "));
  return { ...scriptDeFiche({ casId: CAS.id, ecrans: r.ecrans as never }, { versionCas: CAS.version, valideLe: "2026-10-24", source: "Script fourni par Will (test).", fourni: true, texteFourni: texte }), numero: 1, ...plus };
}
const court = scriptDe(TEXTE);
/** Plus long que le gabarit : chaque étape et chaque détail gagne quelques mots (toujours dans les règles). */
const TEXTE_LONG = TEXTE.split("\n")
  .map((l) => (/^\[(étape \d|détail)\]/.test(l) ? l.replace(/\.$/, "") + " dès que vous le décidez." : l))
  .join("\n");
const long = scriptDe(TEXTE_LONG);
/** Plus court : les détails disparaissent des phrases (quatre mots). */
const TEXTE_COURT = TEXTE.split("\n")
  .map((l) => (/^\[détail\]/.test(l) ? "[détail] Rien d'autre à faire ici." : l))
  .join("\n");
const tresCourt = scriptDe(TEXTE_COURT);

type Lignes = { lignes: { etape: string; quantite: number; total: { centimes: number } }[]; total: { centimes: number } };
const ligne = (e: Lignes, etape: string) => e.lignes.find((l) => l.etape === etape);
const cmd = (b: ReturnType<typeof banc>, plus: Record<string, unknown> = {}): CommandeFabrication => {
  const c = b.commande();
  return { ...c, entrees: { ...(c.entrees as object), casConcret: { ...(c.entrees as { casConcret: object }).casConcret, ...plus } } } as CommandeFabrication;
};
const banque = () => banc({ casId: CAS.id, avecMot: false, scriptValide: async () => null });
/** L'empreinte du texte relu, comme l'écran la calcule (même calcul que les services). */
const empreinteDe = (s: ScriptValide) => empreinteRelecture(lignesDesEcrans(apercuDesEcrans(s.ecrans)));
const TOUTES = Array.from({ length: 80 }, (_, i) => i + 1);
async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, t: Travail) {
  for (let n = 0; n < 300 && t.statut !== "termine" && t.statut !== "echec"; n++) t = (await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000)).travail;
  return t;
}

describe("le prix d'un script figé", () => {
  it("le texte tiré du gabarit est conforme (les trois scripts de l'essai le sont)", () => {
    for (const s of [court, long, tresCourt]) expect(s.ecrans.length).toBeGreaterThanOrEqual(12);
    expect(long.ecrans.map((e) => e.texteDit).join(" ").length).toBeGreaterThan(court.ecrans.map((e) => e.texteDit).join(" ").length);
    expect(tresCourt.ecrans.map((e) => e.texteDit).join(" ").length).toBeLessThan(court.ecrans.map((e) => e.texteDit).join(" ").length);
  });

  it("une ancienne commande (sans scriptFige) garde exactement le prix d'avant : l'écriture et la voix sur le gabarit", async () => {
    const b = banque();
    const c = cmd(b);
    const e = (await b.moteur.estimer(c)) as unknown as Lignes;
    expect(ligne(e, "Écriture")).toBeTruthy();
    const avant = estimerDepuisCas(CAS, [...RESEAUX], false, { voix: { fournisseur: "heygen" } });
    expect(e.total.centimes).toBe(avant.total.centimes);
    expect(ligne(e, "Voix")!.quantite).toBe(ligne(avant as unknown as Lignes, "Voix")!.quantite);
  });

  it("figé : aucune ligne « Écriture », la voix sur SON texte ; le moteur et l'estimation d'un cas donnent le même prix au centime", async () => {
    const b = banque();
    for (const s of [court, long, tresCourt]) {
      const e = (await b.moteur.estimer(cmd(b, { scriptFige: s }))) as unknown as Lignes;
      expect(ligne(e, "Écriture")).toBeUndefined();
      const direct = estimerDepuisCas(CAS, [...RESEAUX], false, { voix: { fournisseur: "heygen" }, script: s }) as unknown as Lignes;
      expect(e.total.centimes).toBe(direct.total.centimes);
      expect(e.lignes.map((l) => [l.etape, l.quantite, l.total.centimes])).toEqual(direct.lignes.map((l) => [l.etape, l.quantite, l.total.centimes]));
    }
  });

  it("un script plus long coûte plus (voix), un script plus court coûte moins : la voix suit le texte, au caractère près", async () => {
    const b = banque();
    const prix = async (s?: ScriptValide) => ((await b.moteur.estimer(cmd(b, s ? { scriptFige: s } : {}))) as unknown as Lignes);
    const sans = await prix();
    const [pc, pl, pt] = [await prix(court), await prix(long), await prix(tresCourt)];
    // Sans écriture : moins cher que l'ancien prix (≈ 0,5 € d'écriture en moins).
    expect(pc.total.centimes).toBeLessThan(sans.total.centimes);
    expect(ligne(pl, "Voix")!.quantite).toBeGreaterThan(ligne(pc, "Voix")!.quantite);
    expect(ligne(pt, "Voix")!.quantite).toBeLessThan(ligne(pc, "Voix")!.quantite);
    expect(pl.total.centimes).toBeGreaterThanOrEqual(pc.total.centimes);
    expect(pt.total.centimes).toBeLessThanOrEqual(pc.total.centimes);
    // Le nombre de caractères de la ligne « Voix » : le corps (lectures du corps au pire) + les fins ; il croît exactement du texte ajouté.
    const delta = long.ecrans.map((e) => e.texteDit.trim()).join(" ").length - court.ecrans.map((e) => e.texteDit.trim()).join(" ").length;
    expect(ligne(pl, "Voix")!.quantite - ligne(pc, "Voix")!.quantite).toBeGreaterThan(0);
    expect((ligne(pl, "Voix")!.quantite - ligne(pc, "Voix")!.quantite) % delta).toBe(0);
  });

  it("« Nouveau script » : le script figé n'est PAS compté (l'écriture l'est)", async () => {
    const b = banque();
    const e = (await b.moteur.estimer(cmd(b, { scriptFige: court, nouveauScript: 1 }))) as unknown as Lignes;
    expect(ligne(e, "Écriture")).toBeTruthy();
  });

  it("un script figé qui ne convient plus au cas (autre version) n'est pas compté non plus : prix d'avant", async () => {
    const b = banque();
    const perime = { ...court, versionCas: CAS.version + 1 };
    const e = (await b.moteur.estimer(cmd(b, { scriptFige: perime }))) as unknown as Lignes;
    expect(ligne(e, "Écriture")).toBeTruthy();
  });
});

describe("la fabrication d'un script figé", () => {
  it("rejoue le script figé SANS aucun appel d'écriture, avec la voix plafonnée sur son texte (un script plus long que le gabarit n'est pas arrêté)", async () => {
    const b = banque();
    const c = cmd(b, { scriptFige: long });
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-long")));
    expect(t.statut).toBe("termine");
    expect(b.d.appelsEcriture()).toBe(0);
    const lus = b.d.lus.join(" ");
    expect(lus).toContain("dès que vous le décidez");
    // Le plafond de voix est la ligne « Voix » du prix annoncé : les lectures payées y tiennent.
    const voix = ligne((await b.moteur.estimer(c)) as unknown as Lignes, "Voix")!;
    expect(b.d.lus.reduce((n, x) => n + x.length, 0)).toBeLessThanOrEqual(voix.quantite);
  });

  it("un script figé périmé : arrêt à l'étape « fiche », phrase dédiée non réessayable, AUCUN appel d'écriture, AUCUNE voix, même si un script courant existe", async () => {
    const b = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => court });
    const perime = { ...long, versionCas: CAS.version + 1 };
    const c = cmd(b, { scriptFige: perime });
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-perime")));
    expect(t.statut).toBe("echec");
    expect(t.etapes.find((e) => e.statut === "echec")?.cle).toBe("fiche");
    expect(t.erreur?.code).toBe(CODE_PRIX_CHANGE);
    expect(t.erreur?.reessayable).toBe(false);
    expect(t.erreur?.messagePourWill).toBe(PHRASE_CAS_CHANGE_DEPUIS_LANCEMENT);
    expect(b.d.appelsEcriture()).toBe(0);
    expect(b.d.lus).toEqual([]);
  });

  it("un script figé qui n'est plus celui relu au lancement (repère différent) : arrêt avant toute voix ; avec son repère il passe", async () => {
    const b = banque();
    const c = cmd(b, { scriptFige: long, scriptRelu: empreinteDe(court) });
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-autre-relu")));
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe(CODE_PRIX_CHANGE);
    expect(t.erreur?.messagePourWill).toBe(PHRASE_SCRIPT_CHANGE_DEPUIS_PRIX);
    expect(b.d.lus).toEqual([]);
    expect(b.d.appelsEcriture()).toBe(0);
    const b2 = banque();
    const c2 = cmd(b2, { scriptFige: long, scriptRelu: empreinteDe(long) });
    expect((await jusquAuBout(b2.moteur, c2, await b2.moteur.lancer(c2, ctx("t-bon-relu")))).statut).toBe("termine");
  });

  it("c'est le script FIGÉ qui est joué, même si un autre script (plus long) est validé après le lancement", async () => {
    const b = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => long });
    const c = cmd(b, { scriptFige: court });
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-fige-joue")));
    expect(t.statut).toBe("termine");
    expect(b.d.lus.join(" ")).not.toContain("dès que vous le décidez");
    expect(b.d.appelsEcriture()).toBe(0);
  });

  it("SANS script figé (lancée sans script validé), un script LONG collé ensuite n'est pas joué : arrêt à « fiche », 0 voix payée", async () => {
    const b = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => long });
    const c = cmd(b);
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-colle-long")));
    expect(t.statut).toBe("echec");
    expect(t.etapes.find((e) => e.statut === "echec")?.cle).toBe("fiche");
    expect(t.erreur?.code).toBe(CODE_PRIX_CHANGE);
    expect(t.erreur?.reessayable).toBe(false);
    expect(t.erreur?.messagePourWill).toBe(PHRASE_SCRIPT_CHANGE_DEPUIS_PRIX);
    expect(b.d.lus).toEqual([]);
  });

  it("SANS script figé : le script relu au lancement (même repère) ou un script qui ne dépasse pas le corps du prix est joué", async () => {
    const releve = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => long });
    const c1 = cmd(releve, { scriptRelu: empreinteDe(long) });
    expect((await jusquAuBout(releve.moteur, c1, await releve.moteur.lancer(c1, ctx("t-relu")))).statut).toBe("termine");
    const moins = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => tresCourt });
    const c2 = cmd(moins);
    expect((await jusquAuBout(moins.moteur, c2, await moins.moteur.lancer(c2, ctx("t-moins")))).statut).toBe("termine");
  });

  it("sans script figé (ancienne commande) et sans script validé : l'écriture a lieu comme avant", async () => {
    const b = banque();
    const c = cmd(b);
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-avant")));
    expect(b.d.appelsEcriture()).toBeGreaterThan(0);
    expect(["termine", "echec"]).toContain(t.statut);
  });
});

describe("le plafond de voix suit le vrai texte (lectures rejetées)", () => {
  const somme = (lus: string[]) => lus.reduce((n, x) => n + x.length, 0);
  const prixLecture = (n: number) => Math.ceil(n * 0.03 * 0.9 - 1e-9);

  it("script long figé, toutes les lectures rejetées : le corps est lu 3 fois, TOUT ce qui est lu tient dans la ligne « Voix » (caractères et centimes)", async () => {
    const b = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => null, lecturesFautives: TOUTES });
    const c = cmd(b, { scriptFige: long });
    const voix = ligne((await b.moteur.estimer(c)) as unknown as Lignes, "Voix")!;
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-rejets")));
    expect(t.statut).toBe("echec");
    // La chaîne s'arrête d'elle-même après deux refus identiques (jamais plus que LECTURES_CORPS_MAX lectures).
    expect(b.d.lus.length).toBeGreaterThan(0);
    expect(b.d.lus.length).toBeLessThanOrEqual(LECTURES_CORPS_MAX);
    expect(somme(b.d.lus)).toBeLessThanOrEqual(voix.quantite);
    expect(b.d.lus.reduce((n, x) => n + prixLecture(x.length), 0)).toBeLessThanOrEqual(voix.total.centimes);
    expect(b.d.appelsEcriture()).toBe(0);
  });

  it("ressemblance (2 lectures par texte) : la ligne « Voix » double exactement, sur le script long comme sur le court", async () => {
    const b = banque();
    for (const s of [court, long]) {
      const base = cmd(b, { scriptFige: s });
      const un = ligne((await b.moteur.estimer(base)) as unknown as Lignes, "Voix")!;
      const c2 = { ...base, entrees: { ...(base.entrees as object), ressemblanceVoix: { actif: true, relancesMax: 1 } } } as CommandeFabrication;
      const deux = ligne((await b.moteur.estimer(c2)) as unknown as Lignes, "Voix")!;
      expect(deux.quantite).toBe(un.quantite * 2);
    }
  });

  it("prononciations : le prix compte le texte réellement lu (corps et fins), moteur et estimation d'un cas donnent le même prix, et les lectures tiennent dedans", async () => {
    const b = banque();
    const mot = court.ecrans.map((e) => e.texteDit).join(" ").split(/[^\p{L}]+/u).find((w) => w.length >= 6)!;
    const pr = [{ mot, prononciation: `${mot} ${mot} ${mot}` }];
    const sans = (await b.moteur.estimer(cmd(b, { scriptFige: court }))) as unknown as Lignes;
    const c = { ...cmd(b, { scriptFige: court }), prononciations: pr } as CommandeFabrication;
    const avec = (await b.moteur.estimer(c)) as unknown as Lignes;
    const direct = estimerDepuisCas(CAS, [...RESEAUX], false, { voix: { fournisseur: "heygen" }, script: court, prononciations: pr }) as unknown as Lignes;
    expect(ligne(avec, "Voix")!.quantite).toBeGreaterThan(ligne(sans, "Voix")!.quantite);
    expect(avec.total.centimes).toBe(direct.total.centimes);
    const r = banc({ casId: CAS.id, avecMot: false, scriptValide: async () => null, lecturesFautives: TOUTES });
    const cr = { ...cmd(r, { scriptFige: court }), prononciations: pr } as CommandeFabrication;
    const voix = ligne((await r.moteur.estimer(cr)) as unknown as Lignes, "Voix")!;
    await jusquAuBout(r.moteur, cr, await r.moteur.lancer(cr, ctx("t-pron")));
    expect(somme(r.d.lus)).toBeLessThanOrEqual(voix.quantite);
  });
});
