/**
 * Voix · réparation automatique. Règle : la génération ne bloque jamais ; seuls arrêts réels : voix absente, rendu
 * impossible, image illisible, chiffre faux. Un test par cas qui arrêtait la fabrication avant :
 *  1 fin non muette sans texte · 2 lettre que la voix ne décompose pas (œ) · 3 tarif absent · 4 réservation non branchée
 *  (seul cas qui s'arrête, sans rien dépenser) · 5 ressemblance réglée autrement · 6 arrêt du corps (hésitation) · 7 corps
 *  hors référence · 8 fin hésitante sans secours · 9 réparations épuisées → voix gardée avec remarque · 10 relecture
 *  totale bornée à 3 · 11 conversion WAV (Q17) retentée · 12 coupe refusée à l'assemblage → voix relue · 13 coupe refusée
 *  à chaque fois → arrêt réel après 3 relectures. Puis : reprise, fins de secours, argent (caisse), erreurs d'entrée.
 */
import { describe, expect, it, vi } from "vitest";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { empreintePriseVoix } from "@/moteurs/montage-image-video/emprunts";
import type { PriseVoix } from "@/moteurs/montage-image-video/emprunts";
import { ErreurVoixIV } from "@/moteurs/montage-image-video/voix";
import {
  avancerVoixIV,
  coutMaxLectureIV,
  ErreurReservationIV,
  etatInitialVoixIV,
  outilsVoixCasConcretIV,
  relireLaVoixIV,
  repriseVoixIV,
  REPARATIONS_VOIX_MAX_IV,
  segmentsVoixIV,
  TARIF_VOIX_REPLI_IV,
  VOIX_IV,
  type EtatVoixIV,
  type OutilsVoixIV,
  type ReservationLectureIV,
} from "@/moteurs/montage-image-video/voix";
import type { PlanDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, MESURE_REFERENCE, monde, outilsSimules } from "./doubles-fabrication";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";

vi.setConfig({ testTimeout: 300_000 });

const ecran = (texteDit: string) => ({ texteDit }) as never;
const fiche = { ecrans: [ecran("Bonjour tout le monde."), ecran("Voici la suite.")] };
const planAvec = (fins: unknown[]) => ({ fins }) as unknown as PlanDesFinsIV;
const fin = (id: string, reseaux: string[], dit: string, muet = false) => ({ id, reseaux, muet, appels: dit ? [{ dit }] : [] });

const outils = (plus: Partial<OutilsVoixIV> = {}): OutilsVoixIV =>
  ({
    tarifCentimesParCaractere: 0.05,
    avantLecture: async () => undefined,
    lireVoix: async () => {
      throw new Error("aucune lecture dans ce test");
    },
    ...plus,
  }) as unknown as OutilsVoixIV;

const priseFaite = (ecarts?: string[]) =>
  ({
    texte: "t",
    empreinte: "e",
    etat: { phase: "faite", audio: { fichierCle: "k", dureeSec: 1, mots: [], ...(ecarts ? { ressemblance: { ressemblante: false, retenue: 0, prises: [{ ecarts, versionMesure: VERSION_MESURE_VOIX }] } } : {}) } },
    controle: { ok: true },
  }) as unknown as PriseVoix;

const etatCorps = (segments = segmentsVoixIV(fiche, planAvec([fin("fin-tiktok", ["tiktok"], "Dis-moi tout.")]))): EtatVoixIV => etatInitialVoixIV(segments);

describe("voix · cas qui arrêtaient avant la lecture : plus aucun arrêt", () => {
  it("1 · une fin non muette sans texte devient une version sans fin (corps seul)", () => {
    const s = segmentsVoixIV(fiche, planAvec([fin("fin-a", ["tiktok"], ""), fin("fin-b", ["instagram"], "Allez.")]));
    expect(s.versions.find((v) => v.id === "fin-a")?.segment).toBeNull();
    expect(s.versions.find((v) => v.id === "fin-b")?.segment).toBeTruthy();
  });

  it("2 · « œ » dans le texte lu d'un trait : réécrit « oe », même nombre de mots, aucun refus", () => {
    const f = { ecrans: [ecran("Mon cœur bat."), ecran("Voici la suite.")] };
    const s = segmentsVoixIV(f, planAvec([fin("fin-a", ["tiktok"], "Mon œuvre.")]), { lectureUnique: true });
    expect(s.corps).toContain("coeur");
    expect(s.corps).toContain("oeuvre");
    expect(s.lecture).toBeDefined();
    // Même nombre de mots et mêmes plages par version que le même script écrit sans ligature.
    const sans = segmentsVoixIV({ ecrans: [ecran("Mon coeur bat."), ecran("Voici la suite.")] }, planAvec([fin("fin-a", ["tiktok"], "Mon oeuvre.")]), { lectureUnique: true });
    expect(s.lecture).toEqual(sans.lecture);
    expect(s.corps).toBe(sans.corps);
    expect(s.versions).toEqual(sans.versions);
    expect(s.remarques).toBeUndefined();
  });

  it("2 bis · sans lecture d'un trait : le corps et les fins sont aussi réécrits (« œ » → « oe »)", () => {
    const s = segmentsVoixIV({ ecrans: [ecran("Mon cœur bat.")] }, planAvec([fin("fin-a", ["tiktok"], "Mon œuvre.")]));
    expect(s.lecture).toBeUndefined();
    expect(s.corps).toBe("Mon coeur bat.");
    expect(s.fins[0].texte).toBe("Mon oeuvre.");
  });

  // Faux lecteur de voix : la lecture est « faite » (appelée) puis s'arrête sur une erreur que le test attend.
  const lecteur = () => {
    const lire = vi.fn(async () => {
      throw new Error("lecture-faite");
    });
    const reservations: ReservationLectureIV[] = [];
    const plus = { voix: () => ({ id: "faux", capacites: { horodatageMots: true }, lire }), cle: (n: string) => n, avantLecture: async (l: ReservationLectureIV) => void reservations.push(l) };
    return { lire, reservations, plus };
  };

  it.each([
    ["3 · tarif absent", { tarifCentimesParCaractere: 0 }, TARIF_VOIX_REPLI_IV],
    ["5 · ressemblance réglée autrement", { ressemblance: { actif: false, relancesMax: 9 } }, 0.05],
  ])("%s : la voix n'est PAS refusée, la lecture a lieu avec sa réservation", async (_nom, plus, tarif) => {
    const l = lecteur();
    const o = outils({ ...plus, ...l.plus } as never);
    await expect(avancerVoixIV(etatCorps(), o)).rejects.toThrow("lecture-faite");
    expect(l.lire).toHaveBeenCalledTimes(1);
    expect(l.reservations).toHaveLength(1);
    expect(l.reservations[0]).toMatchObject({ prise: "corps", coutMaxCentimes: coutMaxLectureIV(l.reservations[0].texte, tarif) });
    expect(outilsVoixCasConcretIV(o).ressemblance).toEqual({ actif: true, relancesMax: 1 });
  });

  it("4 · réservation non branchée : AUCUNE lecture (ErreurReservationIV), rien n'est dépensé", async () => {
    const l = lecteur();
    const o = outils({ ...l.plus, avantLecture: undefined } as never);
    await expect(outilsVoixCasConcretIV(o).avantLecture!({ prise: "corps", texte: "x", caracteres: 1 })).rejects.toBeInstanceOf(ErreurReservationIV);
    const etat = await avancerVoixIV(etatCorps(), o);
    expect(l.lire).not.toHaveBeenCalled();
    expect(etat.issue).toMatchObject({ statut: "refus", message: expect.stringMatching(/Aucune réservation de dépense.*ni payée/) });
  });

  it("la voix et la vitesse ne changent jamais (aucune voix de repli)", () => {
    const c = outilsVoixCasConcretIV(outils({ reglages: { vitesse: 2, stabilite: 1, emotion: 1 }, lecturesSupplementairesRestantes: () => 0 } as never));
    expect(c.idVoix).toBe(VOIX_IV.idVoix);
    expect(c.fournisseurVoix).toBe(VOIX_IV.fournisseur);
    expect(c.reglages?.vitesse).toBe(VOIX_IV.vitesse);
    // Plafond de lectures supplémentaires épuisé : plus aucune relance de ressemblance.
    expect(c.ressemblance).toEqual({ actif: true, relancesMax: 0 });
  });
});

describe("voix · refus Q16 réparé par une lecture neuve, puis gardé avec remarque", () => {
  const arret = (reparations?: number): EtatVoixIV => {
    const e = etatCorps();
    e.voix.corps.prise = priseFaite();
    e.voix.corps.lectures = 2;
    e.voix.issue = { statut: "arret", message: "La phrase « x » a été refusée deux fois." };
    return { ...e, ...(reparations !== undefined ? { reparations } : {}) };
  };

  it("6 · arrêt du corps : relu en lecture neuve, pas d'arrêt, remarque", async () => {
    const r = await avancerVoixIV(arret(), outils());
    expect(r.issue).toBeUndefined();
    expect(r.reparations).toBe(1);
    expect(r.voix.corps.prise).toBeUndefined();
    expect(r.voix.corps.relireTel).toBe(true);
    expect(r.voix.issue).toBeUndefined();
    expect(r.remarques?.[0]).toContain("1/3");
  });

  it("7 · corps hors référence : relu en lecture neuve", async () => {
    const e = etatCorps();
    e.voix.corps.prise = priseFaite(["hauteur +20 %"]);
    e.voix.corps.retenu = true;
    e.voix.fins = [];
    e.voix.issue = { statut: "faite" };
    const r = await avancerVoixIV(e, outils());
    expect(r.issue).toBeUndefined();
    expect(r.voix.corps.retenu).toBeUndefined();
    expect(r.voix.corps.relireTel).toBe(true);
    expect(r.reparations).toBe(1);
  });

  it("8 · fin hésitante sans chaîne de secours (TikTok) : relue en lecture neuve", async () => {
    const e = etatCorps();
    e.voix.corps.prise = priseFaite();
    e.voix.corps.retenu = true;
    e.voix.fins[0].prise = { ...priseFaite(), controle: { rejet: "son", phrase: "Dis-moi tout.", detail: "euh" } } as never;
    e.voix.fins[0].lectures = 2;
    e.voix.issue = { statut: "faite" };
    const r = await avancerVoixIV(e, outils());
    expect(r.issue).toBeUndefined();
    expect(r.voix.fins[0].lectures).toBe(3);
    expect(r.voix.fins[0].prise?.etat).toEqual({ phase: "a-lire" });
    expect(r.voix.fins[0].prise?.essai).toBe(3);
  });

  it("9 · réparations épuisées : la voix est GARDÉE avec une remarque (jamais un arrêt)", async () => {
    const e = etatCorps();
    e.voix.corps.prise = priseFaite(["hauteur +20 %"]);
    e.voix.corps.retenu = true;
    e.voix.fins = [];
    e.voix.issue = { statut: "faite" };
    const r = await avancerVoixIV({ ...e, reparations: REPARATIONS_VOIX_MAX_IV }, outils());
    expect(r.issue).toEqual({ statut: "faite" });
    expect(r.remarques?.[0]).toContain("gardée");
    // Arrêt du corps à la limite : le corps est retenu, la suite se fait.
    const a = await avancerVoixIV(arret(REPARATIONS_VOIX_MAX_IV), outils());
    expect(a.issue).toBeUndefined();
    expect(a.voix.corps.retenu).toBe(true);
  });

  it("10 · relecture totale (assemblage) : bornée à 3, corps et fins en lecture neuve", () => {
    let e: EtatVoixIV | null = etatCorps();
    e.voix.corps.prise = priseFaite();
    e.voix.corps.retenu = true;
    e.issue = { statut: "faite" };
    for (let i = 1; i <= REPARATIONS_VOIX_MAX_IV; i++) {
      e = relireLaVoixIV(e, outils(), "coupe") as EtatVoixIV;
      expect(e.reparations).toBe(i);
      expect(e.issue).toBeUndefined();
      expect(e.voix.corps.relireTel).toBe(true);
      expect(e.voix.fins[0].prise?.etat).toEqual({ phase: "a-lire" });
      e.voix.corps.prise = priseFaite();
      e.voix.corps.retenu = true;
    }
    expect(relireLaVoixIV(e, outils(), "coupe")).toBeNull();
  });
});

describe("voix · reprise : le plafond de réparations est global, les fins de secours gardent leur chaîne", () => {
  /** Prise payée et contrôlée, avec l'empreinte exacte que la reprise attend. */
  const priseGardable = (texte: string, o: OutilsVoixIV, controle: unknown = { ok: true }, essai?: number) => {
    const c = outilsVoixCasConcretIV(o);
    return {
      texte,
      empreinte: empreintePriseVoix({ texte, fournisseurVoix: c.fournisseurVoix, idVoix: c.idVoix, reglages: c.reglages, regles: c.regles, ...(essai && essai > 1 ? { essai } : {}) }),
      etat: { phase: "faite", audio: { fichierCle: "k", dureeSec: 1, mots: [] } },
      controle,
      ...(essai && essai > 1 ? { essai } : {}),
    } as never;
  };
  const rejet = { rejet: "son", phrase: "Dis-moi tout.", detail: "euh" };
  /** Corps retenu + une fin rejetée à sa dernière lecture permise. */
  const avecFinRejetee = (o: OutilsVoixIV, reseaux: string[], reparations?: number): { precedent: EtatVoixIV; segments: ReturnType<typeof segmentsVoixIV> } => {
    const segments = segmentsVoixIV(fiche, planAvec([{ ...fin("fin-a", reseaux, "Dis-moi tout."), ...(reseaux.includes("facebook") ? { secours: true } : {}) }]));
    const precedent = etatInitialVoixIV(segments);
    precedent.voix.corps.prise = priseGardable(segments.corps, o);
    precedent.voix.corps.retenu = true;
    precedent.voix.fins[0].prise = priseGardable("Dis-moi tout.", o, rejet);
    precedent.voix.fins[0].lectures = 2;
    return { precedent: { ...precedent, ...(reparations !== undefined ? { reparations, remarques: ["déjà dit"] } : {}) }, segments };
  };

  it("la reprise recopie reparations et remarques (jamais remis à zéro), même sur un départ neuf", () => {
    const o = outils();
    const segments = segmentsVoixIV(fiche, planAvec([fin("fin-a", ["tiktok"], "Dis-moi tout.")]));
    const precedent: EtatVoixIV = { ...etatInitialVoixIV(segments), reparations: 2, remarques: ["déjà dit"] };
    // Corps pas retenu : départ neuf, mais le plafond est conservé.
    const neuf = repriseVoixIV(precedent, segments, o);
    expect(neuf.reparations).toBe(2);
    expect(neuf.remarques).toEqual(["déjà dit"]);
    // Corps repris tel quel : idem.
    const { precedent: p2, segments: s2 } = avecFinRejetee(o, ["tiktok"], 2);
    p2.voix.fins[0].prise = priseGardable("Dis-moi tout.", o);
    const repris = repriseVoixIV(p2, s2, o);
    expect(repris.reparations).toBe(2);
    expect(repris.remarques).toEqual(["déjà dit"]);
    expect(repris.voix.corps.retenu).toBe(true);
  });

  it("fin déjà rejetée à sa dernière lecture : réparée par une lecture neuve (plafond global), pas de refus Q16", () => {
    const o = outils();
    const { precedent, segments } = avecFinRejetee(o, ["tiktok"], 1);
    const repris = repriseVoixIV(precedent, segments, o);
    expect(repris.issue).toBeUndefined();
    expect(repris.reparations).toBe(2);
    expect(repris.voix.fins[0].lectures).toBe(3);
    expect(repris.voix.fins[0].prise?.etat).toEqual({ phase: "a-lire" });
    expect(repris.remarques?.some((r) => r.includes("2/3"))).toBe(true);
    // Plafond épuisé : la fin est gardée avec une remarque, la voix n'est pas arrêtée.
    const { precedent: p3, segments: s3 } = avecFinRejetee(o, ["tiktok"], REPARATIONS_VOIX_MAX_IV);
    const gardee = repriseVoixIV(p3, s3, o);
    expect(gardee.issue).toEqual({ statut: "faite" });
    expect(gardee.reparations).toBe(REPARATIONS_VOIX_MAX_IV);
    expect(gardee.remarques?.some((r) => r.includes("gardée"))).toBe(true);
  });

  it("exclusion des fins de secours : une fin de secours rejetée n'est jamais relue en silence (refus Q16, chaîne `secours.ts`)", () => {
    const o = outils();
    const { precedent, segments } = avecFinRejetee(o, ["facebook"], 1);
    const repris = repriseVoixIV(precedent, segments, o);
    expect(repris.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    expect(repris.voix.fins[0].lectures).toBe(2);
    expect(repris.reparations).toBe(1);
  });
});

describe("voix · assemblage : réparation dans la fabrication", () => {
  const decisionScript = (e: EtatFabricationIV) => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
  async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
    let e = await avancerJusquAArretIV(e0, o);
    for (let i = 0; i < 30 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
      if (e.attente) e = await avancerJusquAArretIV(e, o);
      else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-26T08:00:00.000Z" }), o);
      else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
      else break;
    }
    return e;
  }
  const demarrer = (options: Parameters<typeof outilsSimules>[2] = {}) => {
    const carte = carteFixe("A");
    const m = monde();
    return { m, o: outilsSimules(carte, m, options), e: etatInitialIV(demandeEssai(carte)) };
  };
  const reservationsVoix = (e: EtatFabricationIV) => e.caisse.reservations.filter((r) => r.etape === "voix");

  it("11 · conversion WAV (Q17) impossible deux fois : nouvel essai automatique, vidéo prête, sans relire la voix", async () => {
    const { o, e } = demarrer();
    const base = o.assemblage.lireSon;
    let absents = 0;
    // Le WAV du brut manque deux fois (rangement lent, conversion en panne) : refus Q17 avant, nouvel essai maintenant.
    o.assemblage.lireSon = async (cle) => (cle.startsWith("brut") && absents++ < 2 ? null : base(cle));
    const etat = await jusquAuBout(e, o);
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.journal.filter((l) => l.includes("nouvel essai automatique"))).toHaveLength(2);
    expect(etat.voix?.reparations).toBeUndefined();
  });

  it("12 · coupe refusée à l'assemblage : voix relue automatiquement, vidéo prête", async () => {
    const { o, e } = demarrer();
    const base = o.assemblage.traiterVoix;
    let appels = 0;
    o.assemblage.traiterVoix = async (d) => {
      if (appels++ === 0) throw new ErreurVoixIV("coupe", "coupe en plein son");
      return base(d);
    };
    const etat = await jusquAuBout(e, o);
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.voix?.reparations).toBe(1);
    expect(etat.journal.some((l) => l.includes("relue automatiquement (1/3)"))).toBe(true);
  });

  it("13 · coupe refusée à chaque fois : 3 relectures au plus, puis arrêt réel (rendu impossible)", async () => {
    const { o, e } = demarrer();
    o.assemblage.traiterVoix = async () => {
      throw new ErreurVoixIV("coupe", "coupe en plein son");
    };
    const etat = await jusquAuBout(e, o);
    expect(etat.etape).toBe("refusee");
    expect(etat.refus?.code).toBe("IV_VOIX");
    expect(etat.voix?.reparations).toBe(REPARATIONS_VOIX_MAX_IV);
  });

  it("14 · erreur d'entrée qui ne dépend pas de la lecture (son d'une version manque) : levée directement, voix NON relue", async () => {
    const { m, o, e } = demarrer();
    o.assemblage.traiterVoix = async () => {
      throw new ErreurVoixIV("entree", "Le son de la version fin-x manque.");
    };
    const etat = await jusquAuBout(e, o);
    expect(etat.etape).toBe("refusee");
    expect(etat.refus?.code).toBe("IV_VOIX");
    expect(etat.voix?.reparations).toBeUndefined();
    expect(m.lus).toHaveLength(1);
    expect(reservationsVoix(etat)).toHaveLength(1);
  });

  it.each([
    ["Q19 (piste sans aucun mot)", () => new ErreurVoixIV("Q19", "La piste voix seule x n'a aucun mot.")],
    ["décompte de mots différent", () => new ErreurVoixIV("entree", "Les mots de la voix du corps (3) ne correspondent pas au script (4).", true)],
  ])("15 · %s : la voix est relue (une lecture payée de plus, réservée)", async (_nom, erreur) => {
    const { m, o, e } = demarrer();
    const base = o.assemblage.traiterVoix;
    let appels = 0;
    o.assemblage.traiterVoix = async (d) => {
      if (appels++ === 0) throw erreur();
      return base(d);
    };
    const etat = await jusquAuBout(e, o);
    expect(etat.etape).toBe("prete");
    expect(etat.voix?.reparations).toBe(1);
    expect(m.lus).toHaveLength(2);
    expect(reservationsVoix(etat)).toHaveLength(2);
  });

  it("16 · argent : un identifiant d'appel distinct par lecture, jamais plus de 1 + 3 lectures (relances de ressemblance comprises)", async () => {
    // Voix toujours hors référence : chaque lecture est relancée une fois, chaque réparation relit : le plafond global tient.
    const horsReference = { ...MESURE_REFERENCE, "voix.hauteurHz": REFERENCE_V4_IV.hauteurHz * 1.5 };
    const { m, o, e } = demarrer({ mesureVoix: () => horsReference });
    const etat = await jusquAuBout(e, o);
    const voix = reservationsVoix(etat);
    expect(voix.length).toBeGreaterThan(1);
    expect(voix.length).toBeLessThanOrEqual(1 + REPARATIONS_VOIX_MAX_IV);
    expect(new Set(voix.map((r) => r.cle)).size).toBe(voix.length);
    expect(m.lus.length).toBeLessThanOrEqual(1 + REPARATIONS_VOIX_MAX_IV);
    expect(m.lus).toHaveLength(voix.length);
    expect(etat.refus?.code).not.toBe("IV_PLAFOND");
  });

  it("16 bis · coupe refusée à chaque fois : 4 lectures réservées au plus, une par réservation distincte", async () => {
    const { m, o, e } = demarrer();
    o.assemblage.traiterVoix = async () => {
      throw new ErreurVoixIV("coupe", "coupe en plein son");
    };
    const etat = await jusquAuBout(e, o);
    const voix = reservationsVoix(etat);
    expect(voix).toHaveLength(1 + REPARATIONS_VOIX_MAX_IV);
    expect(new Set(voix.map((r) => r.cle)).size).toBe(voix.length);
    expect(m.lus).toHaveLength(voix.length);
  });
});
