/**
 * LOT D2 · la structure tirée est branchée dans la chaîne : tirage AVANT l'écriture (gardé au journal), partie variable de
 * l'écriture, fiche, script validé. Risque : argent (un appel d'écriture repayé si la partie variable change) et données
 * (journal, fiche, script validé). Tout reste identique pour la v4 ou sans structure.
 */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { fabriquerCasConcret, VERSION_FABRICATION_CAS_CONCRET, type JournalCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { idEcranAttendu, validerSchemaFiche, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import { blocStructure } from "@/moteurs/montage-cas-concret/patrons-ecriture";
import { ficheDuScriptValide, lireScriptValide, scriptDeFiche, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { ajouterAHistorique, entreeHistorique, STRUCTURES, tirer, type EntreeHistorique, type Structure } from "@/moteurs/montage-cas-concret/variete";
import { doubles, type Doubles } from "../fabriquer/doubles";
import { casCoaching } from "../x5/cas-coaching";

const CANAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const V4 = STRUCTURES[0];
const cas = trouverCas("recrutement-apporteurs")!;
const AUTRES = STRUCTURES.slice(1);

/** Une vidéo dont le premier tirage (historique vide) est la structure demandée (ou, avec `sauf`, n'est pas celle-là). */
function videoDe(structure: Structure, sauf = false): string {
  for (let i = 0; i < 2000; i++) {
    const id = `video-d2-${i}`;
    if ((tirer({ videoId: id, canaux: CANAUX, historique: [] }).structure === structure) !== sauf) return id;
  }
  throw new Error("aucune vidéo trouvée");
}

function variete(historique: EntreeHistorique[] = []): OutilsVariete & { lignes: EntreeHistorique[]; ajouts: number } {
  const o = {
    lignes: [...historique],
    ajouts: 0,
    lireHistorique: async () => o.lignes,
    ajouter: async (e: EntreeHistorique) => {
      o.ajouts++;
      o.lignes = ajouterAHistorique(o.lignes, e);
    },
  };
  return o;
}

/** Les parties variables reçues par chaque appel d'écriture. */
function espionner(d: Doubles): string[] {
  const vus: string[] = [];
  const vrai = d.options.outils.ecriture.appeler;
  d.options.outils.ecriture.appeler = async (role, entree) => {
    if (role.id === "ecriture-cas-concret") vus.push(entree.variable);
    return vrai(role, entree);
  };
  return vus;
}

const avecVideo = (videoId: string, opt: Parameters<typeof doubles>[0] = {}): Doubles => {
  const d = doubles(opt);
  d.options.videoId = videoId;
  return d;
};
const journalDe = (d: Doubles): JournalCasConcret => d.partage.journal.valeur!;

describe("LOT F · tirer avec des structures exclues", () => {
  it("sans l'option : le tirage de toujours (vide ou absente, identique)", () => {
    for (let i = 0; i < 40; i++) {
      const base = tirer({ videoId: `x-${i}`, canaux: CANAUX, historique: [] });
      expect(tirer({ videoId: `x-${i}`, canaux: CANAUX, historique: [], structuresExclues: [] })).toEqual(base);
    }
  });

  it("une structure non v4 exclue et une v4 récente dans l'historique : jamais la structure exclue, jamais une 2e v4 sur 4 (toutes les règles tenues)", () => {
    for (let i = 0; i < 60; i++) {
      const recente = tirer({ videoId: `r-${i}`, canaux: CANAUX, historique: [], structureImposee: V4 });
      const historique = [entreeHistorique(`r-${i}`, CANAUX, recente, "2026-10-18T10:00:00.000Z")];
      const t = tirer({ videoId: `x-${i}`, canaux: CANAUX, historique, structuresExclues: ["une-journee"] });
      expect(t.structure).not.toBe("une-journee");
      expect(t.structure).not.toBe(V4);
    }
  });

  it("v4 exclue : jamais la v4, même au repli", () => {
    for (let i = 0; i < 40; i++) {
      expect(tirer({ videoId: `e-${i}`, canaux: CANAUX, historique: [], structuresExclues: [V4] }).structure).not.toBe(V4);
      expect(tirer({ videoId: `e-${i}`, canaux: CANAUX, historique: [], structuresExclues: [V4], essaisParNiveau: 1 }).structure).not.toBe(V4);
    }
  });
});

describe("D2 · tirer avec une structure imposée", () => {
  it("seule la structure change : le reste du tirage (hasard) est celui de toujours ; la règle v4 1 sur 4 ne la juge pas", () => {
    for (let i = 0; i < 40; i++) {
      const base = tirer({ videoId: `v-${i}`, canaux: CANAUX, historique: [] });
      for (const s of STRUCTURES) {
        const imposee = tirer({ videoId: `v-${i}`, canaux: CANAUX, historique: [], structureImposee: s });
        expect(imposee.structure).toBe(s);
        expect({ ...imposee, structure: 0, relache: 0 }).toEqual({ ...base, structure: 0, relache: 0 });
        expect(tirer({ videoId: `v-${i}`, canaux: CANAUX, historique: [], structureImposee: s })).toEqual(imposee);
      }
    }
  });

  it("v4 imposée alors que la fenêtre en compte déjà une : accordée (jamais refusée, jamais relâchée pour elle)", () => {
    const histo: EntreeHistorique[] = [];
    for (let i = 0; i < 6; i++) histo.push(entreeHistorique(`h-${i}`, CANAUX, tirer({ videoId: `h-${i}`, canaux: CANAUX, historique: histo, structureImposee: V4 }), "2026-10-18T10:00:00.000Z"));
    for (const h of histo) expect(h.tirage.structure).toBe(V4);
  });
});

describe("D2 · fiche et script validé", () => {
  it("la fiche accepte une structure connue, refuse une inconnue ; sans structure elle est lue comme avant", () => {
    const f = JSON.parse(JSON.stringify(ficheParGabarit(cas, { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" })));
    const sans = validerSchemaFiche(f);
    expect(sans.ok && "structure" in sans.fiche).toBe(false);
    const avec = validerSchemaFiche({ ...f, structure: "une-journee" });
    expect(avec.ok && avec.fiche.structure).toBe("une-journee");
    expect(validerSchemaFiche({ ...f, structure: "inconnue" }).ok).toBe(false);
  });

  it("(e) aller-retour fiche → script → lecture → fiche : la structure suit ; la v4 n'en porte jamais", () => {
    const fixe = { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" } as const;
    const base = ficheParGabarit(cas, fixe);
    const meta = { versionCas: cas.version, valideLe: "2026-10-18", source: "essai" };
    for (const s of AUTRES) {
      const script = scriptDeFiche({ ...base, structure: s }, meta);
      expect(script.structure).toBe(s);
      const relu = lireScriptValide(JSON.parse(JSON.stringify(script)))!;
      expect(relu.structure).toBe(s);
      expect(ficheDuScriptValide(relu, fixe, cas).structure).toBe(s);
    }
    for (const fiche of [base, { ...base, structure: V4 }]) {
      const script = scriptDeFiche(fiche, meta);
      expect("structure" in script).toBe(false);
      expect("structure" in lireScriptValide(JSON.parse(JSON.stringify(script)))!).toBe(false);
      expect("structure" in ficheDuScriptValide(script, fixe, cas)).toBe(false);
    }
    // Une structure illisible ou « v4 » dans un script gardé est ignorée (= v4).
    for (const mauvaise of ["inconnue", V4, 3, null]) {
      const brut = { ...scriptDeFiche(base, meta), structure: mauvaise };
      expect("structure" in lireScriptValide(JSON.parse(JSON.stringify(brut)))!).toBe(false);
    }
  });
});

describe("D2 · la chaîne", () => {
  it("(a) la structure reçue par l'écriture = celle du journal = celle de la mise de la fiche ; tirée AVANT l'écriture", async () => {
    for (const s of AUTRES) {
      const d = avecVideo(videoDe(s));
      d.options.outils.variete = variete();
      const vus = espionner(d);
      const cr = await fabriquerCasConcret(d.options);
      expect(vus).toHaveLength(1);
      expect(vus[0]).toContain(`<structure_de_la_video>\n${blocStructure(s, cas.offre)}\n</structure_de_la_video>`);
      expect(journalDe(d).tirage?.tirage.structure).toBe(s);
      expect(cr.fiche.mise!.tirage.structure).toBe(s);
      expect(journalDe(d).tirage?.notee).toBe(true);
    }
  });

  it("v4 tirée : la partie variable est celle d'aujourd'hui (aucune balise), rien n'est repayé", async () => {
    const id = videoDe(V4);
    const d = avecVideo(id);
    d.options.outils.variete = variete();
    const vus = espionner(d);
    await fabriquerCasConcret(d.options);
    const t = avecVideo(id);
    const vusTemoin = espionner(t);
    await fabriquerCasConcret(t.options);
    expect(vus).toEqual(vusTemoin);
    expect(vus[0]).not.toContain("<structure_de_la_video>");
    expect(journalDe(d).tirage?.tirage.structure).toBe(V4);
  });

  it("(b) écriture déjà commencée (appels au journal) sans tirage : v4 imposée, partie variable identique à aujourd'hui", async () => {
    const id = videoDe(V4, true);
    expect(tirer({ videoId: id, canaux: CANAUX, historique: [] }).structure).not.toBe(V4);
    const d = avecVideo(id);
    d.options.outils.variete = variete();
    d.partage.journal.valeur = { version: VERSION_FABRICATION_CAS_CONCRET, etapes: {}, appels: { [`ccecr-${id}-v1-1`]: { empreinte: "x", tentative: 1, le: 0, clos: true } } } as JournalCasConcret;
    const vus = espionner(d);
    await fabriquerCasConcret(d.options);
    const t = avecVideo(id);
    const vusTemoin = espionner(t);
    await fabriquerCasConcret(t.options);
    expect(vus).toEqual(vusTemoin);
    expect(vus[0]).not.toContain("<structure_de_la_video>");
    expect(journalDe(d).tirage?.tirage.structure).toBe(V4);
    // Le préfixe d'une AUTRE vidéo ne compte pas.
    const autre = avecVideo(id);
    autre.options.outils.variete = variete();
    autre.partage.journal.valeur = { version: VERSION_FABRICATION_CAS_CONCRET, etapes: {}, appels: { [`ccecr-${id}0-v1-1`]: { empreinte: "x", tentative: 1, le: 0, clos: true } } } as JournalCasConcret;
    await fabriquerCasConcret(autre.options);
    expect(journalDe(autre).tirage?.tirage.structure).toBe(tirer({ videoId: id, canaux: CANAUX, historique: [] }).structure);
  });

  it("(c) script validé : sa structure est imposée ; sans structure : la v4 ; aucun appel d'écriture", async () => {
    const id = videoDe(V4, true);
    const fixe = { videoId: id, versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" } as const;
    const meta = { versionCas: cas.version, valideLe: "2026-10-18", source: "essai" };
    const script = (structure?: Structure): ScriptValide => scriptDeFiche({ ...ficheParGabarit(cas, fixe), ...(structure ? { structure } : {}) }, meta);

    const avec = avecVideo(id);
    avec.options.outils.variete = variete();
    avec.options.scriptValide = script("une-journee");
    const cr = await fabriquerCasConcret(avec.options);
    expect(journalDe(avec).tirage?.tirage.structure).toBe("une-journee");
    expect(cr.fiche.mise!.tirage.structure).toBe("une-journee");
    expect(cr.fiche.structure).toBe("une-journee");
    expect(avec.appelsEcriture()).toBe(0);

    const sans = avecVideo(id);
    sans.options.outils.variete = variete();
    sans.options.scriptValide = script();
    const cr2 = await fabriquerCasConcret(sans.options);
    expect(journalDe(sans).tirage?.tirage.structure).toBe(V4);
    expect(cr2.fiche.structure).toBeUndefined();
    expect(sans.appelsEcriture()).toBe(0);
  });

  it("(d) reprise après un changement de l'historique : le tirage du journal n'est ni retiré, ni noté deux fois", async () => {
    const d = avecVideo(videoDe("une-journee"));
    const v = variete();
    d.options.outils.variete = v;
    const vus = espionner(d);
    const cr = await fabriquerCasConcret(d.options);
    const avant = structuredClone(journalDe(d).tirage);
    v.lignes = [...v.lignes, entreeHistorique("autre", CANAUX, tirer({ videoId: "autre", canaux: CANAUX, historique: [] }), "2026-10-18T10:00:00.000Z")];
    const ajoutsAvant = v.ajouts;
    const encore = await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage).toEqual(avant);
    expect(encore.fiche.mise!.tirage.structure).toBe(cr.fiche.mise!.tirage.structure);
    expect(v.ajouts).toBe(ajoutsAvant);
    expect(vus).toHaveLength(1);
  });

  it("une ligne d'historique est notée avant l'écriture ; la mise la complète sans la doubler (une seule ligne)", async () => {
    const d = avecVideo(videoDe("probleme-solution"));
    const v = variete();
    d.options.outils.variete = v;
    await fabriquerCasConcret(d.options);
    expect(v.ajouts).toBe(2);
    expect(v.lignes).toHaveLength(1);
    expect(typeof v.lignes[0]!.tirage.misesEnPage).toBe("string");
  });

  it("`ajouter` échoue une fois au tirage : la reprise n'écrase pas la ligne complète (misesEnPage) écrite par la mise", async () => {
    const d = avecVideo(videoDe("probleme-solution"));
    const v = variete();
    let echecs = 1;
    const ajouterVrai = v.ajouter;
    v.ajouter = async (e) => {
      if (echecs-- > 0) throw new Error("base injoignable (double)");
      await ajouterVrai(e);
    };
    d.options.outils.variete = v;
    await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage?.notee).toBe(false);
    expect(journalDe(d).mise?.notee).toBe(true);
    expect(v.lignes).toHaveLength(1);
    expect(typeof v.lignes[0]!.tirage.misesEnPage).toBe("string");
    await fabriquerCasConcret(d.options);
    expect(v.lignes).toHaveLength(1);
    expect(typeof v.lignes[0]!.tirage.misesEnPage).toBe("string");
    expect(journalDe(d).tirage?.notee).toBe(true);
  });

  it("LOT F · structure écartée (« Nouveau script ») : le tirage n'en reprend pas la même ; sinon il est inchangé", async () => {
    for (const ecartee of STRUCTURES) {
      const id = videoDe(ecartee);
      const d = avecVideo(id);
      d.options.outils.variete = variete();
      d.options.structureEcartee = ecartee;
      await fabriquerCasConcret(d.options);
      expect(journalDe(d).tirage?.tirage.structure).not.toBe(ecartee);
    }
    // Une autre structure écartée : le tirage de toujours.
    const id = videoDe("une-journee");
    const d = avecVideo(id);
    d.options.outils.variete = variete();
    d.options.structureEcartee = V4;
    await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage?.tirage.structure).toBe("une-journee");
  });

  it("(a) coaching + « une-journee » : le journal dit v4 (le script est v4), aucune balise", async () => {
    const id = videoDe("une-journee");
    const d = avecVideo(id, { cas: casCoaching });
    d.options.outils.variete = variete();
    const vus: string[] = [];
    d.options.outils.ecriture.appeler = async (_role, entree) => {
      vus.push(entree.variable);
      return { ok: true, simule: false, texte: JSON.stringify(ficheParGabarit(casCoaching, { videoId: id, versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" })), stopReason: "end_turn" };
    };
    await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage?.tirage.structure).toBe(V4);
    expect(vus[0]).not.toContain("<structure_de_la_video>");
  });

  it("(b) script validé alors qu'un tirage existe déjà au journal : sa structure fait foi (étiquette)", async () => {
    const id = videoDe("une-journee");
    const d = avecVideo(id);
    d.options.outils.variete = variete();
    await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage?.tirage.structure).toBe("une-journee");
    const fixe = { videoId: id, versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" } as const;
    d.options.scriptValide = scriptDeFiche(ficheParGabarit(cas, fixe), { versionCas: cas.version, valideLe: "2026-10-18", source: "essai" });
    await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage?.tirage.structure).toBe(V4);
  });

  it("tirage hérité d'une version précédente : sa structure guide aussi l'écriture", async () => {
    const id = videoDe(V4);
    const herite = tirer({ videoId: "ailleurs", canaux: CANAUX, historique: [], structureImposee: "resultat-d-abord" });
    const d = avecVideo(id);
    d.options.outils.variete = { ...variete(), miseHeritee: async () => ({ version: "variete/1", tirage: herite, ecrans: {} }) };
    const vus = espionner(d);
    await fabriquerCasConcret(d.options);
    expect(vus[0]).toContain("<structure_de_la_video>");
    expect(journalDe(d).tirage?.tirage.structure).toBe("resultat-d-abord");
  });

  it("(f) sans outils de variété : aucun tirage au journal, aucune balise, aucune structure dans la fiche", async () => {
    const d = avecVideo(videoDe("une-journee"));
    const vus = espionner(d);
    const cr = await fabriquerCasConcret(d.options);
    expect(journalDe(d).tirage).toBeUndefined();
    expect(vus[0]).not.toContain("<structure_de_la_video>");
    expect(cr.fiche.structure).toBeUndefined();
    expect(cr.fiche.mise).toBeUndefined();
  });

  it("une fiche fournie (écriture sautée) : aucun tirage avant l'écriture", async () => {
    const d = avecVideo(videoDe("une-journee"));
    d.options.outils.variete = variete();
    // La fiche brute que l'écriture simulée rend (celle que le studio fournirait).
    let fiche: unknown;
    const vrai = d.options.outils.ecriture.appeler;
    d.options.outils.ecriture.appeler = async (role, entree) => {
      const r = await vrai(role, entree);
      if (role.id === "ecriture-cas-concret" && r.ok) fiche = JSON.parse(r.texte ?? "null");
      return r;
    };
    await fabriquerCasConcret(d.options);
    const f = avecVideo(d.options.videoId);
    f.options.outils.variete = variete();
    f.options.entrees = { ...f.options.entrees, ficheCle: "fiche.json" } as typeof f.options.entrees;
    f.options.lireFiche = async () => fiche;
    await fabriquerCasConcret(f.options);
    expect(journalDe(f).tirage).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Intégration : la chaîne rejouée avec des outils simulés, pour une structure non v4                  */
/* ------------------------------------------------------------------ */

/** La fiche que Claude rendrait pour « résultat d'abord » : sans écran chiffre, un court résultat juste après l'accroche. */
function ficheResultatDAbord(videoId: string): FicheEcrans {
  const f = ficheParGabarit(cas, { videoId, versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" });
  const fin = [...f.ecrans].reverse().find((e) => e.type === "resultat")!;
  const tete = { ...fin, texteDit: "Tout cela se fait maintenant tout seul." };
  const ecrans = f.ecrans.filter((e) => e.type !== "chiffre");
  return { ...f, ecrans: [ecrans[0]!, tete, ...ecrans.slice(1)].map((e, i) => ({ ...e, id: idEcranAttendu(i) })) as FicheEcrans["ecrans"] };
}

describe("D2 · intégration (outils simulés, structure « resultat-d-abord »)", () => {
  it("le script suit l'ordre ; l'écriture est appelée UNE fois ; une reprise (même journal, historique changé) ne repaie rien", async () => {
    const id = videoDe("resultat-d-abord");
    const d = avecVideo(id);
    const v = variete();
    d.options.outils.variete = v;
    const reponses: string[] = [];
    const vus: string[] = [];
    d.options.outils.ecriture.appeler = async (role, entree) => {
      if (role.id !== "ecriture-cas-concret") return { ok: true, simule: false, texte: JSON.stringify({ phrase: "Phrase reformulée." }), stopReason: "end_turn" };
      vus.push(entree.variable);
      const texte = JSON.stringify(ficheResultatDAbord(id));
      reponses.push(texte);
      return { ok: true, simule: false, texte, stopReason: "end_turn" };
    };

    const cr = await fabriquerCasConcret(d.options);
    expect(reponses).toHaveLength(1);
    expect(vus[0]).toContain("<structure_de_la_video>");
    expect(vus[0]).toContain("n'est PAS un écran « chiffre »");
    expect(vus[0]).toMatch(/resultat-tete · Le résultat, d'abord · 1 à 3 s/);
    // Le script suit la structure : l'ordre des écrans, aucun chiffre, la structure notée dans la fiche.
    const types = cr.fiche.ecrans.map((e) => e.type);
    expect(types[0]).toBe("accroche");
    expect(types[1]).toBe("resultat");
    expect(types).not.toContain("chiffre");
    expect(types.at(-1)).toBe("question");
    expect(types.lastIndexOf("resultat")).toBeGreaterThan(types.lastIndexOf("etape"));
    expect(cr.fiche.structure).toBe("resultat-d-abord");
    expect(cr.fiche.mise!.tirage.structure).toBe("resultat-d-abord");
    expect(journalDe(d).tirage?.tirage.structure).toBe("resultat-d-abord");

    // Reprise : même journal, l'historique a changé entre-temps.
    v.lignes = [...v.lignes, entreeHistorique("autre", CANAUX, tirer({ videoId: "autre", canaux: CANAUX, historique: [] }), "2026-10-18T10:00:00.000Z")];
    const encore = await fabriquerCasConcret(d.options);
    expect(reponses).toHaveLength(1);
    expect(encore.fiche).toEqual(cr.fiche);
    expect(journalDe(d).tirage?.tirage.structure).toBe("resultat-d-abord");

    // Journal perdu mais écriture déjà commencée sans tirage : on ne change pas de structure en cours de route.
    const j = journalDe(d);
    const sansTirage: JournalCasConcret = { version: j.version, etapes: {}, appels: { [`ccecr-${id}-v1-1`]: { empreinte: "x", tentative: 1, le: 0, clos: true } } };
    d.partage.journal.valeur = sansTirage;
    await fabriquerCasConcret(d.options);
    expect(vus).toHaveLength(2);
    expect(vus.at(-1)).not.toContain("<structure_de_la_video>");
    expect(journalDe(d).tirage?.tirage.structure).toBe("v4-avant-etapes-resultat");
  });

  it("deux barres sur le même fait (résultat court, puis résultat final) : aucune règle ne les refuse", async () => {
    const f = ficheResultatDAbord("video-cc");
    const barres = f.ecrans.filter((e) => e.type === "resultat").map((e) => (e as { avant: { faitId?: string }; maintenant: { faitId?: string } }).maintenant.faitId);
    expect(barres).toHaveLength(2);
    expect(barres[0]).toBe(barres[1]);
    const r = validerSchemaFiche(JSON.parse(JSON.stringify(f)));
    expect(r.ok).toBe(true);
  });
});
