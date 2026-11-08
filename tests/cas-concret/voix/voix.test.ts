/**
 * M4 (cas concret, plan § 4-f) : voix du format, avec des doubles seulement (aucun appel réel). Contrôle d'une prise
 * (mots, traîne, son), enchaînement des prises (corps puis une par fin), reformulation du corps, reprise après panne,
 * plan d'assemblage et heures des mots après tempo, empreinte d'une prise.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { FaitCas } from "@/formats/cas-concret/cas";
import {
  arretPhraseFigee,
  avancerVoixCasConcret,
  COUPE_APRES_DERNIER_MOT_MS,
  controlerPrise,
  empreintePriseVoix,
  etatInitialVoixCasConcret,
  LECTURES_CORPS_MAX,
  motsApresAssemblage,
  pausesAMesurer,
  planAssemblage,
  rapportVoix,
  REGLES_BLANCS_CAS_CONCRET,
  rouvrirApresArret,
  type EtatVoixCasConcret,
  type OutilsAvancerVoix,
} from "@/moteurs/montage-cas-concret/voix";

/** Mots horodatés d'un texte : 300 ms par mot, `ecarts[i]` ms (défaut 100) après le mot i. */
function motsDuTexte(texte: string, ecarts: Record<number, number> = {}): MotHorodate[] {
  const res: MotHorodate[] = [];
  let t = 0.05;
  texte
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m))
    .forEach((mot, i) => {
      res.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
      t += 0.3 + (ecarts[i] ?? 100) / 1000;
    });
  return res;
}

describe("M4 · contrôle d'une prise", () => {
  const texte = "On recrute nos collaborateurs en quinze minutes. Oui, quinze minutes.";

  it("écart de 400 ms gardé, 500 ms rejeté « traîne » (hors ponctuation)", () => {
    expect(controlerPrise({ texte, mots: motsDuTexte(texte, { 2: 400 }) })).toEqual({ ok: true });
    const r = controlerPrise({ texte, mots: motsDuTexte(texte, { 2: 500 }) });
    expect(r).toMatchObject({ rejet: "traine", phrase: "On recrute nos collaborateurs en quinze minutes." });
    // Après une ponctuation, un long blanc est permis.
    expect(controlerPrise({ texte, mots: motsDuTexte(texte, { 6: 900 }) })).toEqual({ ok: true });
  });

  it("long blanc MESURÉ silencieux gardé (la recette le resserre, comme la voix de la v4) ; mesuré bruyant : « son »", () => {
    // Essai réel du 14/10 : HeyGen laisse 500 ms après « recrute » ; la v4 avait le même genre de blanc, resserré à 0,10 s.
    const mots = motsDuTexte(texte, { 1: 500 });
    expect(pausesAMesurer(mots, texte)).toHaveLength(1);
    expect(controlerPrise({ texte, mots })).toMatchObject({ rejet: "traine" });
    expect(controlerPrise({ texte, mots, niveauxPauses: [-50] })).toEqual({ ok: true });
    expect(controlerPrise({ texte, mots, niveauxPauses: [-30] })).toMatchObject({ rejet: "son", phrase: "On recrute nos collaborateurs en quinze minutes." });
  });

  it("un mot en trop est rejeté « mots », la phrase est nommée", () => {
    const mots = motsDuTexte("On recrute nos collaborateurs en quinze minutes. Oui, oui, quinze minutes.");
    const r = controlerPrise({ texte, mots });
    expect(r).toMatchObject({ rejet: "mots", phrase: "Oui, quinze minutes." });
  });

  it("casse, accents et ponctuation ne comptent pas", () => {
    const mots = motsDuTexte("on RECRUTE nos collaborateurs en quinze minutes oui quinze minutes");
    expect(controlerPrise({ texte, mots })).toEqual({ ok: true });
  });

  it("blanc mesuré à −17 dB entre deux mots = hésitation (« euh », entendue par Will le 14/10) : refusé « son »", () => {
    const mots = motsDuTexte(texte, { 1: 420 });
    const r = controlerPrise({ texte, mots, niveauxPauses: [-17] });
    expect(r).toMatchObject({ rejet: "son", phrase: "On recrute nos collaborateurs en quinze minutes." });
    if (!("ok" in r)) expect(r.detail).toMatch(/hésitation/);
  });


  it("blanc sans ponctuation de plus de 300 ms à −30 dB rejeté « son » ; à −45 dB gardé", () => {
    const mots = motsDuTexte(texte, { 3: 350 });
    const pauses = pausesAMesurer(mots, texte);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]).toMatchObject({ deSec: mots[3].finSec, aSec: mots[4].debutSec });
    expect(controlerPrise({ texte, mots, niveauxPauses: [-30] })).toMatchObject({ rejet: "son", phrase: "On recrute nos collaborateurs en quinze minutes." });
    expect(controlerPrise({ texte, mots, niveauxPauses: [-45] })).toEqual({ ok: true });
  });

  it("un sigle à points ne coupe pas la phrase ni ne permet un long blanc ; « : » isolé ponctue", () => {
    const t = "Écrivez I.A. en commentaire. Tout est conforme au R.G.P.D. : cent pour cent.";
    expect(controlerPrise({ texte: t, mots: motsDuTexte(t, { 1: 700 }) })).toMatchObject({ rejet: "traine", phrase: "Écrivez I.A. en commentaire." });
    expect(controlerPrise({ texte: t, mots: motsDuTexte(t, { 8: 700 }) })).toEqual({ ok: true });
  });

  it("le texte de la vidéo de référence, lu sans défaut, passe", () => {
    const t = readFileSync(join(__dirname, "../temoin/reference/texte.txt"), "utf8");
    expect(controlerPrise({ texte: t, mots: motsDuTexte(t) })).toEqual({ ok: true });
  });

  it("règles de blancs du format", () => {
    expect(REGLES_BLANCS_CAS_CONCRET).toEqual({ seuilMs: 220, cibleMs: [120, 120], fonduMs: [10, 20], respirationMs: [150, 250], teteMaxMs: 100 });
  });
});

/* ------------------------------------------------------------------ */
/* Doubles de la voix maître                                             */
/* ------------------------------------------------------------------ */

interface Journal {
  appels: string[];
  lus: string[];
  /** `nouvelleLecture` de chaque lecture (cache du fournisseur ignoré). */
  nouvelles?: boolean[];
}

interface OptionsDoubles {
  /** Mots rendus pour un texte lu (n° de lecture à partir de 1). */
  motsPour?: (texte: string, n: number) => MotHorodate[];
  /** Pannes du rendu (une erreur levée par appel) avant de répondre. */
  pannesRendu?: number;
  niveaux?: number;
  reformuler?: OutilsAvancerVoix["reformuler"];
}

function doubles(j: Journal, opt: OptionsDoubles = {}): OutilsAvancerVoix {
  let pannes = opt.pannesRendu ?? 0;
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string; idExterne: string; nouvelleLecture?: boolean }) {
      j.lus.push(d.texte);
      (j.nouvelles ??= []).push(!!d.nouvelleLecture);
      j.appels.push(`voix.lire`);
      const mots = opt.motsPour ? opt.motsPour(d.texte, j.lus.length) : motsDuTexte(d.texte);
      return { fichierCle: `studio/test/brut-${j.lus.length}.mp3`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, cout: { centimes: 10, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    async urlLecture(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlLectureDuree(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlDepotDuree(cle: string) {
      return `https://depot.test/${cle}`;
    },
  } as unknown as StockageFichiers;
  const aligneur = { mode: "simulation" } as unknown as FournisseurAlignement;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      if (pannes > 0) {
        pannes--;
        throw new Error("panne passagère du rendu");
      }
      j.appels.push(`rendu.soumettre:${d.idRendu}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 5 } : {} };
    },
  };
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => aligneur,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/test/voix/${nom}`,
    idVoix: "voix-avocat",
    reglages: { vitesse: 1.1, stabilite: 45, emotion: 30 },
    fournisseurVoix: "voix-double",
    caler: () => false,
    regles: REGLES_BLANCS_CAS_CONCRET,
    assembler: async () => {
      throw new Error("non utilisé");
    },
    mesurerPauses: async (cle, pauses) => {
      j.appels.push(`mesure:${cle}:${pauses.length}`);
      return pauses.map(() => opt.niveaux ?? -50);
    },
    reformuler:
      opt.reformuler ??
      (async (phrase) => {
        j.appels.push(`reformuler:${phrase}`);
        return { ok: true, phrase: phrase.replace("vraiment ", "") };
      }),
    faits: [] as FaitCas[],
    avantLecture: (l) => {
      j.appels.push(`avantLecture:${l.prise}:${l.caracteres}`);
    },
  };
}

const CORPS = "On recrute en quinze minutes. Et vraiment tout part tout seul.";
const FINS = [
  { id: "fin-fb", texte: "Écrivez I.A. en commentaire. Je vous envoie la structure complète." },
  { id: "fin-tt", texte: "Faites votre diagnostic gratuit en quelques minutes. Le lien est dans mon profil." },
];

/** Fait tourner la voix jusqu'au bout (états sérialisés, comme dans le journal). */
async function jusquAuBout(o: OutilsAvancerVoix, depart: EtatVoixCasConcret, tours = 80): Promise<EtatVoixCasConcret> {
  let etat = depart;
  for (let i = 0; i < tours && !etat.issue; i++) etat = JSON.parse(JSON.stringify(await avancerVoixCasConcret(etat, o))) as EtatVoixCasConcret;
  return etat;
}

describe("M4 · enchaînement des prises", () => {
  it("le corps puis une prise par fin ; chaque prise payée est gardée", async () => {
    const j: Journal = { appels: [], lus: [] };
    const fin = await jusquAuBout(doubles(j), etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toEqual([CORPS, FINS[0].texte, FINS[1].texte]);
    expect(fin.payees.map((p) => p.prise)).toEqual(["corps", "fin-fb", "fin-tt"]);
    expect(fin.payees.every((p) => p.coutCentimes === 10)).toBe(true);
    expect(fin.corps.prise?.etat.phase).toBe("faite");
    expect(fin.fins.map((f) => f.prise?.etat.phase)).toEqual(["faite", "faite"]);
    // Le budget est vérifié avant CHAQUE lecture.
    expect(j.appels.filter((a) => a.startsWith("avantLecture"))).toEqual([`avantLecture:corps:${CORPS.length}`, `avantLecture:fin-fb:${FINS[0].texte.length}`, `avantLecture:fin-tt:${FINS[1].texte.length}`]);
    expect(rapportVoix(fin)).toMatchObject({ lecturesCorps: 1, reformulations: [], finsGardeesMalgreRejet: [], coutCentimes: 30 });
  });

  it("une panne après la lecture du corps ne relance pas la lecture (compteur = 1)", async () => {
    const j: Journal = { appels: [], lus: [] };
    let etat = etatInitialVoixCasConcret({ corps: CORPS, fins: [] });
    // Tour 1 : la lecture, payée, est rendue tout de suite (et gardée par l'appelant).
    etat = JSON.parse(JSON.stringify(await avancerVoixCasConcret(etat, doubles(j, { pannesRendu: 1 }))));
    expect(etat.payees).toHaveLength(1);
    // Tour 2 : le rendu tombe en panne ; l'état gardé est celui du tour 1.
    await expect(avancerVoixCasConcret(etat, doubles(j, { pannesRendu: 1 }))).rejects.toThrow(/panne/);
    // Reprise avec des doubles neufs (serveur redémarré).
    const fin = await jusquAuBout(doubles(j), etat);
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toHaveLength(1);
  });

  it("corps rejeté : reformulation de la phrase, puis relecture du corps entier", async () => {
    const j: Journal = { appels: [], lus: [] };
    // Première lecture : un mot de trop dans la deuxième phrase.
    const motsPour = (t: string, n: number) => (n === 1 ? motsDuTexte(t.replace("tout part", "tout tout part")) : motsDuTexte(t));
    const fin = await jusquAuBout(doubles(j, { motsPour }), etatInitialVoixCasConcret({ corps: CORPS, fins: [FINS[0]] }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.appels).toContain("reformuler:Et vraiment tout part tout seul.");
    expect(j.lus).toEqual([CORPS, "On recrute en quinze minutes. Et tout part tout seul.", FINS[0].texte]);
    expect(fin.corps.texte).toBe("On recrute en quinze minutes. Et tout part tout seul.");
    expect(fin.payees.map((p) => [p.prise, p.lecture])).toEqual([
      ["corps", 1],
      ["corps", 2],
      ["fin-fb", 1],
    ]);
    expect(rapportVoix(fin)).toMatchObject({ lecturesCorps: 2, reformulations: [{ avant: "Et vraiment tout part tout seul.", apres: "Et tout part tout seul.", rejet: "mots" }] });
  });

  it(`${LECTURES_CORPS_MAX} lectures qui hésitent → le MÊME texte relu en lecture neuve, puis la dernière lecture est GARDÉE et la phrase signalée`, async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t, { 3: 600 });
    const reformuler: OutilsAvancerVoix["reformuler"] = async (phrase) => {
      j.appels.push("reformuler");
      return { ok: true, phrase };
    };
    const fin = await jusquAuBout(doubles(j, { motsPour, niveaux: -30, reformuler }), etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(j.lus.slice(0, 3)).toEqual([CORPS, CORPS, CORPS]);
    // Une hésitation vient de la lecture, pas du texte : aucune reformulation.
    expect(j.appels.filter((a) => a === "reformuler")).toHaveLength(0);
    expect(j.nouvelles!.slice(0, 3)).toEqual([false, true, true]);
    // 08/11/2026 : plus d'arrêt ; la voix se termine, la phrase est dans le rapport (« à vérifier »).
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(rapportVoix(fin).corpsGardeMalgreRejet).toMatchObject({ rejet: "son", phrase: "On recrute en quinze minutes." });
    // Les fins sont lues ensuite, rien n'est perdu.
    expect(fin.fins.every((f) => f.prise)).toBe(true);
  });

  it("17/10 · script validé (texte figé) qui hésite (« euh ») : relu tel quel, puis la lecture est gardée et la phrase signalée (jamais réécrite)", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t, { 3: 600 });
    const reformuler: OutilsAvancerVoix["reformuler"] = async (phrase) => {
      j.appels.push("reformuler");
      return { ok: true, phrase };
    };
    const fin = await jusquAuBout({ ...doubles(j, { motsPour, niveaux: -30, reformuler }), texteFige: true }, etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(j.lus.slice(0, 3)).toEqual([CORPS, CORPS, CORPS]);
    expect(j.appels.filter((a) => a === "reformuler")).toHaveLength(0);
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(fin.corps.prise?.controle).toMatchObject({ rejet: "son" });
    expect(rapportVoix(fin).corpsGardeMalgreRejet).toMatchObject({ rejet: "son", phrase: "On recrute en quinze minutes." });
    expect(rapportVoix(fin).corpsGardeMalgreRejet!.detail).toContain("-30 dB");
  });

  it("18/10 · un blanc long (« traine ») n'est pas une hésitation : « marque un long blanc après », avec la mesure en ms", () => {
    const c = { rejet: "traine" as const, phrase: "On recrute en quinze minutes.", detail: "blanc de 520 ms après « recrute »" };
    const r = arretPhraseFigee(c, true)!;
    expect(r.message).toMatch(/^La voix marque un long blanc après « recrute » \(520 ms\)\. Reformulez la phrase dans « Relire le script »/);
    expect(r.message).toMatch(/mot exact de la promesse/);
    expect(r.message).toMatch(/R03/);
    expect(r.message).not.toContain("hésite");
    expect(r.conseil).toBeTruthy();
    // Un sigle coupé en deux : le blanc est DANS le mot.
    const sigle = arretPhraseFigee({ rejet: "traine", phrase: "Puis l'I.A. écrit.", detail: "blanc d'environ 700 ms à l'intérieur de « l'I.A. » (sigle coupé en deux)" }, true)!;
    expect(sigle.message).toMatch(/^La voix marque un long blanc dans « l'I\.A\. » \(700 ms\)\./);
    // Pas figé : pas de conseil.
    expect(arretPhraseFigee(c, false)).toBeUndefined();
  });

  it("17/10 · un script NON figé hésite aussi : lecture gardée, phrase signalée", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t, { 3: 600 });
    const reformuler: OutilsAvancerVoix["reformuler"] = async (phrase) => ({ ok: true, phrase });
    const fin = await jusquAuBout(doubles(j, { motsPour, niveaux: -30, reformuler }), etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(rapportVoix(fin).corpsGardeMalgreRejet?.phrase).toBe("On recrute en quinze minutes.");
  });

  it("`reformuler` qui rend ok: false (mot mal dit) → la lecture est gardée, la phrase signalée (08/11/2026, pas d'arrêt)", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t.replace("tout part", "tout tout part"));
    const reformuler: OutilsAvancerVoix["reformuler"] = async () => ({ ok: false, raison: "Le service d'écriture est injoignable." });
    const fin = await jusquAuBout(doubles(j, { motsPour, reformuler }), etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(j.lus[0]).toBe(CORPS);
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(rapportVoix(fin).corpsGardeMalgreRejet).toMatchObject({ rejet: "mots", phrase: "Et vraiment tout part tout seul." });
  });


  it("blanc trop bruyant mesuré dans le son brut : rejet « son »", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t, { 2: 350 });
    const reformuler: OutilsAvancerVoix["reformuler"] = async () => ({ ok: false, raison: "Arrêt du test." });
    const fin = await jusquAuBout(doubles(j, { motsPour, niveaux: -30, reformuler }), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(j.appels).toContain("mesure:studio/test/brut-1.mp3:1");
    expect(fin.corps.prise?.controle).toMatchObject({ rejet: "son" });
  });

  it("fin qui hésite : relue UNE fois en lecture neuve, puis gardée ; le rapport le dit", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => (t === FINS[0].texte ? motsDuTexte(t, { 2: 700 }) : motsDuTexte(t));
    const fin = await jusquAuBout(doubles(j, { motsPour, niveaux: -30 }), etatInitialVoixCasConcret({ corps: CORPS, fins: FINS }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus.filter((t) => t === FINS[0].texte)).toHaveLength(2);
    expect(fin.payees.filter((p) => p.prise === "fin-fb").map((p) => p.lecture)).toEqual([1, 2]);
    expect(rapportVoix(fin).finsGardeesMalgreRejet).toEqual([expect.objectContaining({ id: "fin-fb", rejet: "son", phrase: "Écrivez I.A. en commentaire." })]);
  });

  it("fin qui hésite puis relue propre : gardée sans alerte", async () => {
    const j: Journal = { appels: [], lus: [] };
    let n = 0;
    const motsPour = (t: string) => (t === FINS[0].texte && ++n === 1 ? motsDuTexte(t, { 2: 700 }) : motsDuTexte(t));
    const fin = await jusquAuBout(doubles(j, { motsPour, niveaux: -30 }), etatInitialVoixCasConcret({ corps: CORPS, fins: [FINS[0]] }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(rapportVoix(fin).finsGardeesMalgreRejet).toEqual([]);
  });


  it("long blanc silencieux dans le corps : gardé sans reformulation ni relecture (essai réel du 14/10)", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string) => motsDuTexte(t, { 1: 500 });
    const fin = await jusquAuBout(doubles(j, { motsPour }), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toEqual([CORPS]);
    expect(j.appels.some((a) => a.startsWith("reformuler"))).toBe(false);
  });

  it("script validé (texte figé) : jamais reformulé, même pour un mot mal dit ; relu tel quel, en lecture neuve", async () => {
    const j: Journal = { appels: [], lus: [] };
    const motsPour = (t: string, n: number) => (n === 1 ? motsDuTexte(t.replace("tout part", "tout tout part")) : motsDuTexte(t));
    const fin = await jusquAuBout({ ...doubles(j, { motsPour }), texteFige: true }, etatInitialVoixCasConcret({ corps: CORPS, fins: [FINS[0]] }));
    expect(j.appels.some((a) => a.startsWith("reformuler"))).toBe(false);
    expect(j.lus).toEqual([CORPS, CORPS, FINS[0].texte]);
    expect(j.nouvelles).toEqual([false, true, false]);
    expect(fin.corps.texte).toBe(CORPS);
    expect(fin.issue).toEqual({ statut: "faite" });
  });

});

describe("« Réessayer » après un arrêt de la voix (essai réel du 14/10)", () => {
  it("le contrôle de la prise gardée est refait avec les règles du moment, SANS nouvelle lecture, puis la voix se termine", async () => {
    const j: Journal = { appels: [], lus: [] };
    // Arrêt gardé : trois lectures refusées (texte figé).
    const motsPour = (t: string) => motsDuTexte(t.replace("tout part", "tout tout part"));
    const termine = await jusquAuBout({ ...doubles(j, { motsPour }), texteFige: true }, etatInitialVoixCasConcret({ corps: CORPS, fins: [FINS[0]] }));
    // Un état ARRÊTÉ d'avant le 08/11/2026 (stocké au journal) doit encore se rouvrir : on le reconstitue.
    const { retenu: _r, ...corpsSansRetenu } = termine.corps;
    void _r;
    const arrete: EtatVoixCasConcret = { ...termine, fins: [{ id: FINS[0].id, texte: FINS[0].texte }], payees: termine.payees.slice(0, 3), corps: corpsSansRetenu, issue: { statut: "arret", message: "ancien arrêt", phrase: "Et vraiment tout part tout seul." } };
    expect(arrete.issue?.statut).toBe("arret");
    j.lus.splice(3);
    expect(j.lus).toEqual([CORPS, CORPS, CORPS]);
    // La règle a changé (ici : la prise gardée est jugée bonne) ; la reprise ne relit PAS la voix.
    const prise = arrete.corps.prise!;
    const rouvert = rouvrirApresArret({ ...arrete, corps: { ...arrete.corps, prise: { ...prise, ...(prise.brut ? { brut: { ...prise.brut, mots: motsDuTexte(CORPS) } } : {}) } } });
    expect(rouvert.issue).toBeUndefined();
    expect(rouvert.corps.prise?.controle).toBeUndefined();
    const fin = await jusquAuBout({ ...doubles(j), texteFige: true }, rouvert);
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toEqual([CORPS, CORPS, CORPS, FINS[0].texte]);
  });


  it("un état non arrêté, ou déjà retenu, est rendu tel quel", () => {
    const e = etatInitialVoixCasConcret({ corps: CORPS, fins: [] });
    expect(rouvrirApresArret(e)).toBe(e);
  });
});

describe("M4 · assemblage", () => {
  const corps = { fichierCle: "corps.wav", dureeSec: 4, mots: [
    { mot: "Bonjour", debutSec: 0.05, finSec: 0.5 },
    { mot: "Will.", debutSec: 0.62, finSec: 1.08 },
  ] };
  const fin = { fichierCle: "fin.wav", dureeSec: 2.4, mots: [
    { mot: "Le", debutSec: 0.05, finSec: 0.2 },
    { mot: "lien.", debutSec: 0.32, finSec: 0.81 },
  ] };

  it(`corps coupé ${COUPE_APRES_DERNIER_MOT_MS} ms après son dernier mot, puis la fin entière`, () => {
    expect(planAssemblage(corps, fin, 1.08)).toEqual({
      morceaux: [
        { entree: "corps.wav", deSec: 0, aSec: 1.38 },
        { entree: "fin.wav", deSec: 0, aSec: 2.4 },
      ],
      tempo: 1.08,
    });
    // Corps trop court pour la marge : coupé à sa fin.
    expect(planAssemblage({ ...corps, dureeSec: 1.2 }, fin, 1).morceaux[0].aSec).toBe(1.2);
  });

  it("heures après tempo 1,08 : décalées, puis divisées par 1,08", () => {
    const mots = motsApresAssemblage(corps, fin, 1.08);
    expect(mots.map((m) => m.mot)).toEqual(["Bonjour", "Will.", "Le", "lien."]);
    expect(mots[1].debutSec).toBeCloseTo(0.62 / 1.08, 3);
    expect(mots[2].debutSec).toBeCloseTo((1.38 + 0.05) / 1.08, 3);
    expect(mots[3].finSec).toBeCloseTo((1.38 + 0.81) / 1.08, 3);
    expect(motsApresAssemblage(corps, fin, 1)[3].finSec).toBeCloseTo(2.19, 6);
  });
});

describe("M4 · empreinte d'une prise", () => {
  const base = { texte: CORPS, fournisseurVoix: "voix-double", idVoix: "voix-avocat", reglages: { vitesse: 1.1, stabilite: 45, emotion: 30 }, regles: REGLES_BLANCS_CAS_CONCRET };
  it("même texte, même voix, mêmes réglages → même empreinte ; tout changement en donne une autre", () => {
    expect(empreintePriseVoix(base)).toBe(empreintePriseVoix({ ...base, reglages: { emotion: 30, stabilite: 45, vitesse: 1.1 } }));
    expect(empreintePriseVoix({ ...base, texte: CORPS.replace("quinze", "seize") })).not.toBe(empreintePriseVoix(base));
    expect(empreintePriseVoix({ ...base, idVoix: "autre" })).not.toBe(empreintePriseVoix(base));
    expect(empreintePriseVoix({ ...base, reglages: { ...base.reglages, vitesse: 1 } })).not.toBe(empreintePriseVoix(base));
  });
});
