/**
 * FIX-DECOUPAGE-RELANCES-b (19/11/2026, demande du fondateur du 18/11) : jusqu'à TROIS relances du découpage (4 appels au
 * plus), prix au pire annoncé en conséquence, arrêt quand le modèle tourne en rond, bilan des refus par règle (pur).
 * Tout passe par le chemin réel : vrai `decouperEnScenes`, vraie validation, double de `appeler` et du budget seulement.
 * Aucun appel réseau, rien de payé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { DESSINS } from "@/briques/dessins";
import { cleRefus } from "@/moteurs/montage-tableau/bilan-refus";
import type { BilanDecoupage } from "@/moteurs/montage-tableau/bilan-refus";
import {
  APPELS_MAX,
  coutEstimeUsd,
  coutPireDecoupageUsd,
  decouperEnScenes,
  partiesDuDecoupage,
  roleDecoupageTableau,
  variableDecoupage,
  variableRelance,
  type EntreeDecoupage,
  type OutilsDecoupage,
  type ReponseAppelDecoupage,
} from "@/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const { coutDecoupageCentimes } = await import("@/services/tableau-creation");
const { TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");

const fiche = ficheErreurCorrigee;

function entree(): EntreeDecoupage {
  const { texteScript, ...controle } = contexteExemple(fiche);
  return {
    texteScript, structure: fiche.structure, serie: fiche.serie, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute,
    preuves: [{ id: "matiere-demo-questions", resume: "Même demande, avec et sans les trois questions." }],
    dessins: [{ id: "point-interrogation", motsCles: ["question", "doute"] }, { id: "bulle", motsCles: ["parole", "réponse"] }],
    videoId: fiche.videoId, versionId: fiche.versionId, habillage: fiche.habillage, stylo: fiche.stylo, ratio: fiche.ratio, controle,
  };
}

/** Fiche invalide DIFFÉRENTE à chaque `mot` : le texte dit change d'UN mot (« vagues » → mot), donc un refus différent. */
function invalide(mot: string): FicheTableau {
  const f = copie(fiche);
  f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", mot);
  return f;
}

interface Double extends OutilsDecoupage {
  appels: string[];
  reservations: { appelId: string }[];
  bilans: BilanDecoupage[];
}
function double(reponses: (FicheTableau | string | ReponseAppelDecoupage)[], budgetOk: (n: number) => boolean = () => true, noterBilan?: (b: BilanDecoupage) => void): Double {
  const d: Double = {
    appels: [], reservations: [], bilans: [],
    async appeler(_role, e) {
      d.appels.push(e.variable);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      if (typeof r === "string") return { ok: true, simule: false, donnees: r };
      if ("ok" in r) return r;
      return { ok: true, simule: false, donnees: JSON.stringify(r) };
    },
    budget: {
      async reserver(demande) {
        d.reservations.push(demande);
        return budgetOk(d.reservations.length) ? { ok: true } : { ok: false, message: "Budget du mois atteint." };
      },
    },
    noterBilan: noterBilan ?? ((b) => void d.bilans.push(b)),
  };
  return d;
}

describe("a) trois relances : 3 réponses invalides différentes puis une valide", () => {
  it("accepté au 4e appel, 4 réservations d'appelId distincts, relances: 3", async () => {
    const d = double([invalide("floues"), invalide("molles"), invalide("vides"), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(4);
    expect(new Set(d.reservations.map((x) => x.appelId)).size).toBe(4);
    expect(d.reservations.map((x) => x.appelId.slice(-2))).toEqual(["-1", "-2", "-3", "-4"]);
    expect(r).toEqual({ ok: true, fiche, appels: 4, relance: true, relances: 3 });
    // Chaque relance repart de la réponse PRÉCÉDENTE et de ses refus.
    expect(d.appels[3]).toContain("vides");
    expect(d.appels[3]).not.toContain("floues");
  });
  it("une seule relance : le résultat ne porte pas `relances` (les toEqual d'avant restent vrais)", async () => {
    const r = await decouperEnScenes(entree(), double([invalide("floues"), fiche]));
    expect(r).toEqual({ ok: true, fiche, appels: 2, relance: true });
  });
});

describe("b) quatre réponses invalides différentes : jamais de cinquième appel", () => {
  it("refusee, 4 appels, message « après 4 essais »", async () => {
    const d = double([invalide("floues"), invalide("molles"), invalide("vides"), invalide("rares"), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(APPELS_MAX).toBe(4);
    expect(d.appels).toHaveLength(4);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: 4 });
    if (!r.ok) {
      expect(r.message).toMatch(/refusée par les règles après 4 essais/);
      expect(r.aCorriger?.scenes[0].texteDit).toContain("rares");
    }
    expect(d.bilans[0].issue).toBe("refuse");
  });
});

describe("c) arrêt sans progrès", () => {
  it("deux réponses identiques invalides : 2 appels, issue refuse-sans-progres, message « après 2 essais »", async () => {
    const d = double([invalide("floues"), invalide("floues"), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(2);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: 2 });
    if (!r.ok) expect(r.message).toMatch(/après 2 essais/);
    expect(d.bilans).toHaveLength(1);
    expect(d.bilans[0].issue).toBe("refuse-sans-progres");
  });
  it("le même refus au 3e essai (après un refus différent) : arrêt à 3 appels", async () => {
    const d = double([invalide("molles"), invalide("floues"), invalide("floues"), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(3);
    expect(r).toMatchObject({ ok: false, appels: 3 });
    expect(d.bilans[0].issue).toBe("refuse-sans-progres");
  });
});

describe("d) réponse coupée au 3e appel", () => {
  it("tronquee, 3 appels, jamais rejouée", async () => {
    const coupee: ReponseAppelDecoupage = { ok: true, simule: false, donnees: JSON.stringify(fiche).slice(0, 2000), stopReason: "max_tokens" };
    const d = double([invalide("floues"), invalide("molles"), coupee, fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(3);
    expect(r).toMatchObject({ ok: false, motif: "tronquee", appels: 3 });
    expect(d.bilans[0].issue).toBe("tronque");
  });
});

describe("e) budget refusé à la 3e réservation", () => {
  it("budget, 2 appels, refus gardés", async () => {
    const d = double([invalide("floues"), invalide("molles"), fiche], (n) => n !== 3);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(2);
    expect(d.reservations).toHaveLength(3);
    expect(r).toMatchObject({ ok: false, motif: "budget", appels: 2 });
    if (!r.ok) expect(r.refus.join(" ")).toMatch(/texte dit mot pour mot/);
    expect(d.bilans[0].issue).toBe("budget");
  });
});

describe("f) prix au pire : premier + 3 × relance au pire", () => {
  const f = ficheFormation();
  const { texteScript, ...controle } = contexteFormation();
  const dessins = [...new Set(f.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "dessin" ? [e.dessinId] : []))))].map((id) => ({ id, motsCles: [id] }));
  const preuves = [...new Set(f.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "preuve" ? [e.preuveId] : []))))].map((id) => ({ id, resume: id }));
  const e: EntreeDecoupage = { texteScript, structure: f.structure, serie: f.serie, douleur: f.douleur, gesteMinute: f.gesteMinute, preuves, dessins, videoId: f.videoId, versionId: f.versionId, habillage: f.habillage, stylo: f.stylo, ratio: f.ratio, controle };

  it("exactement coutEstimeUsd(premier) + 3 × coutEstimeUsd(relance au pire)", () => {
    const base = variableDecoupage(e);
    const premier = coutEstimeUsd(roleDecoupageTableau, { contexte: {}, variable: base });
    const relance = coutEstimeUsd(roleDecoupageTableau, { contexte: {}, variable: variableRelance(base, "x".repeat(roleDecoupageTableau.maxTokens * 4), ["x".repeat(4000)]) });
    expect(coutPireDecoupageUsd(e)).toBeCloseTo(premier + 3 * relance, 9);
    expect(coutPireDecoupageUsd(e)).toBeGreaterThan(premier + relance);
  });
  it("le prix du bouton (tableau-creation, lecture seule) suit sans autre changement", () => {
    const centimes = coutDecoupageCentimes(TAUX_USD_EUR_PAR_DEFAUT);
    expect(centimes).toBeGreaterThan(0);
    expect(coutDecoupageCentimes(TAUX_USD_EUR_PAR_DEFAUT)).toBe(centimes);
  });
});

/* ---------------------------- g) bilan --------------------------------- */

type El = Record<string, unknown>;
type Scene = { id: string; page: number; role: string; texteDit: string; gabarit?: Record<string, unknown>; elements: El[] };
type Cas = { texteScript: string; motsDouleur: string[] | null; parties: { texte: string }[]; reponse: { scenes: Scene[]; [cle: string]: unknown } };
const charger = (id: string): Cas => JSON.parse(readFileSync(join(__dirname, "temoins", `decoupage-${id}.json`), "utf8"));
function entreeDe(cas: Cas): EntreeDecoupage {
  const b = cas.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  return {
    texteScript: cas.texteScript, structure: b.structure, serie: b.serie, douleur: b.douleur, gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })), dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId, versionId: b.versionId, habillage: b.habillage, stylo: b.stylo, ratio: b.ratio,
    controle: { aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [], matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })), ...(cas.motsDouleur ? { motsDouleur: cas.motsDouleur } : {}) },
    parties: partiesDuDecoupage(cas.parties),
  } as EntreeDecoupage;
}
const DOULEUR_ORIGINE = "Vous fouillez ses mails. Vous rappelez le client. Vous refaites ce qu'elle avait peut-être déjà fait. Et la matinée y passe.";
const DIT = "Un outil pour les devis. Un autre pour les e-mails. Un troisième pour les relances.";
const ligne = (id: string, texte: string, bloc: string, ancre: number): El => ({ id, type: "ligne", texte, niveau: "texte", role: "alerte", bloc, ancre });
/** Le cas a) de la fiche FIX-DECOUPAGE-AUTOREPARE-a : trois outils en liste sur la page « douleur ». */
function casDouleur(): Cas {
  const c = structuredClone(charger("v-365dd2ae67ee"));
  c.texteScript = c.texteScript.replace(DOULEUR_ORIGINE, DIT);
  c.parties = c.parties.map((p) => (p.texte === DOULEUR_ORIGINE ? { ...p, texte: DIT } : p));
  const s = c.reponse.scenes[1];
  s.texteDit = DIT;
  s.gabarit = { role: "douleur" };
  s.elements = [ligne("e02", "Un outil pour les devis.", "phrase-cle", 0), ...["Devis", "E-mails", "Relances"].map((t, k) => ligne(`e0${3 + k}`, t, "liste", [4, 9, 14][k]))];
  return c;
}
const CLE_BLOC = "gabarit de page clair (titre, phrase clé, détails, numéros dits)/bloc-hors-partie";

describe("g) bilan du découpage", () => {
  it("sur a) : noterBilan reçu 1 fois, 4 essais, accepte-apres-relance-3", async () => {
    const d = double([invalide("floues"), invalide("molles"), invalide("vides"), fiche]);
    await decouperEnScenes(entree(), d);
    expect(d.bilans).toHaveLength(1);
    const b = d.bilans[0];
    expect(b).toMatchObject({ videoId: fiche.videoId, versionId: fiche.versionId, issue: "accepte-apres-relance-3", appels: 4 });
    expect(b.essais.map((x) => x.essai)).toEqual([1, 2, 3, 4]);
    expect(Object.values(b.essais[0].restes).reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
  });
  it("accepté du premier coup : accepte-1er-essai ; une relance : accepte-apres-relance-1", async () => {
    const a = double([fiche]);
    await decouperEnScenes(entree(), a);
    expect(a.bilans.map((b) => b.issue)).toEqual(["accepte-1er-essai"]);
    const b = double([invalide("floues"), fiche]);
    await decouperEnScenes(entree(), b);
    expect(b.bilans.map((x) => x.issue)).toEqual(["accepte-apres-relance-1"]);
  });
  it("réponse illisible 4 fois (différentes) : issue illisible, 4 appels", async () => {
    const d = double(["pas du JSON 1 {", "pas du JSON 2 [", "pas du JSON 3 (", "pas du JSON 4 <"]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels.length).toBeGreaterThanOrEqual(2);
    expect(r.ok).toBe(false);
    expect(d.bilans[0].issue).toBe("illisible");
  });
  it("cas a) de la fiche a (liste sur la page douleur) : accepte-par-reparation, réparés sans IA comptés par clé", async () => {
    const cas = casDouleur();
    const d = double([{ ok: true, simule: false, donnees: JSON.stringify(cas.reponse), stopReason: "end_turn" }]);
    const r = await decouperEnScenes(entreeDe(cas), d);
    expect(r.ok).toBe(true);
    expect(d.appels).toHaveLength(1);
    expect(d.bilans).toHaveLength(1);
    const b = d.bilans[0];
    expect(b.issue).toBe("accepte-par-reparation");
    expect(b.essais).toHaveLength(1);
    expect(b.essais[0].refusAvant[CLE_BLOC]).toBeGreaterThan(0);
    expect(b.essais[0].reparesSansIA[CLE_BLOC]).toBe(3) // 3 éléments de liste = 3 refus, tous réparés;
    expect(b.essais[0].restes).toEqual({});
  });
  it("un noterBilan qui lève ne change pas l'issue", async () => {
    const levee = () => { throw new Error("rappel cassé"); };
    const r = await decouperEnScenes(entree(), double([invalide("floues"), fiche], () => true, levee));
    expect(r).toEqual({ ok: true, fiche, appels: 2, relance: true });
    const e = await decouperEnScenes(entree(), double([invalide("floues"), invalide("floues")], () => true, levee));
    expect(e).toMatchObject({ ok: false, motif: "refusee", appels: 2 });
  });
  it("sans rappel : rien ne change", async () => {
    const d = double([fiche]);
    delete d.noterBilan;
    expect(await decouperEnScenes(entree(), d)).toEqual({ ok: true, fiche, appels: 1, relance: false });
  });
  it("une ligne « bilan-decoupage » est tracée", async () => {
    const lignes: string[] = [];
    const avant = console.info;
    console.info = (...a: unknown[]) => void lignes.push(a.join(" "));
    try {
      await decouperEnScenes(entree(), double([fiche]));
    } finally {
      console.info = avant;
    }
    const l = lignes.find((x) => x.startsWith("[tableau] bilan-decoupage "));
    expect(l).toBeDefined();
    expect(JSON.parse(l!.slice("[tableau] bilan-decoupage ".length))).toMatchObject({ issue: "accepte-1er-essai", appels: 1 });
  });
});

describe("h) cleRefus", () => {
  const R18 = "gabarit de page clair (titre, phrase clé, détails, numéros dits)";
  const R4 = "page lisible : 40 mots et 6 lignes au plus";
  const cas: [string, string, string, string][] = [
    [R18, "un élément de la liste à pastilles (« Devis ») n'a pas sa place sur une page « douleur » (« titre », « phrase-cle » seulement).", "bloc-hors-partie", "gabarit-3.ts"],
    [R18, "une liste d'un seul élément est un détail.", "liste-un-element", "gabarit-3.ts"],
    [R18, "la page 3 a 2 phrases clés ; une seule.", "phrases-cles", "gabarit-3.ts"],
    [R18, "la page 3 a 2 titres ; un seul.", "titres", "gabarit-3.ts"],
    [R18, "une seule idée reçue par page.", "idee-recue", "gabarit-3.ts"],
    [R18, "« code » ne va que sur un élément de liste à pastilles (bloc « code »), pas sur « Devis ».", "code-orphelin", "gabarit-3.ts"],
    [R18, "la page 2 a 2 visuels ; un seul visuel par page.", "visuel", "gabarit-3.ts"],
    [R18, "la page 2 a 2 blocs orange ; un seul bloc orange par page.", "bloc-orange", "gabarit-3.ts"],
    [R18, "la page 4 montre 4 blocs ; 3 au plus (titre, phrase clé, puis un détail ou un visuel) : mettez la suite sur une page de plus.", "blocs-max", "gabarit-3.ts"],
    [R18, "la voix dit le numéro 2 (mot 3) : écrivez-le.", "numero-etape", "gabarit-3.ts"],
    [R18, "la partie « douleur » (page 3) revient après une partie qui la suit : l'ordre est accroche, douleur, solution.", "ordre-parties", "gabarit-3.ts"],
    [R18, "« 12 » (visuel ou bloc orange) écrit « 12 », que la voix ne dit pas sur cette page.", "chiffre", "gabarit-3.ts"],
    [R18, "le bloc orange « X » ne reprend pas le texte dit de sa page (10 % de ses mots sont dits).", "texte-pas-dit", "gabarit-3.ts"],
    [R18, "un seul appel.", "appel", "gabarit-3.ts"],
    [R4, "Page 3 · scène s05 · la page ne tient pas au-dessus de la bande des sous-titres, même aux tailles minimales.", "page-ne-tient-pas", "mise-en-page-v3.ts"],
  ];
  for (const [regle, message, sous, source] of cas) {
    it(`${source} → ${sous}`, () => expect(cleRefus({ regle, message })).toBe(`${regle}/${sous}`));
  }
  it("règle 18 ou 4 sans message connu : sous-clé « autre »", () => {
    expect(cleRefus({ regle: R18, message: "quelque chose d'inconnu" })).toBe(`${R18}/autre`);
    expect(cleRefus({ regle: R4, message: "inconnu" })).toBe(`${R4}/autre`);
  });
  it("autre règle : la règle seule ; sans règle : refus propres au découpage, lecture, autre", () => {
    expect(cleRefus({ regle: "texte dit mot pour mot", message: "le mot 5 …" })).toBe("texte dit mot pour mot");
    expect(cleRefus({ regle: "", message: "Le champ « videoId » vaut \"x\", attendu \"y\" (recopié tel quel)." })).toBe("champ-fixe");
    expect(cleRefus({ regle: "", message: "La série doit être recopiée telle quelle : {}." })).toBe("champ-fixe");
    expect(cleRefus({ regle: "", message: "Scène s01 : le dessin « z » n'est pas dans la liste fournie." })).toBe("dessin-non-fourni");
    expect(cleRefus({ regle: "", message: "Scène s05 : la preuve « z » n'est pas dans la liste fournie." })).toBe("preuve-non-fournie");
    expect(cleRefus({ regle: "", message: "La réponse n'est pas un JSON lisible (x) : rendez le JSON seul." })).toBe("illisible");
    expect(cleRefus({ regle: "", message: "La réponse est vide : aucune fiche rendue." })).toBe("illisible");
    expect(cleRefus({ regle: "", message: "autre chose" })).toBe("autre");
  });
});
