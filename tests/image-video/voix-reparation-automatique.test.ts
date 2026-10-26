/**
 * Voix · réparation automatique (ordre de Will : la génération ne bloque JAMAIS ; seuls arrêts réels : voix absente, rendu
 * impossible, image illisible, chiffre faux). Un test par cas qui arrêtait la fabrication avant :
 *  1 fin non muette sans texte · 2 lettre que la voix ne décompose pas (œ) · 3 tarif absent · 4 réservation non branchée
 *  5 ressemblance réglée autrement · 6 arrêt du corps (hésitation) · 7 corps hors référence · 8 fin hésitante sans secours
 *  9 réparations épuisées → voix gardée avec remarque · 10 relecture totale bornée à 3 · 11 conversion WAV (Q17) retentée
 *  12 coupe refusée à l'assemblage → voix relue · 13 coupe refusée à chaque fois → arrêt réel après 3 relectures.
 */
import { describe, expect, it, vi } from "vitest";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { ErreurVoixIV } from "@/moteurs/montage-image-video/voix";
import { avancerVoixIV, etatInitialVoixIV, relireLaVoixIV, REPARATIONS_VOIX_MAX_IV, segmentsVoixIV, type EtatVoixIV, type OutilsVoixIV } from "@/moteurs/montage-image-video/voix";
import type { PlanDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

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
  }) as never;

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
  });

  it.each([
    ["3 · tarif absent", { tarifCentimesParCaractere: 0 }],
    ["4 · réservation non branchée", { avantLecture: undefined }],
    ["5 · ressemblance réglée autrement", { ressemblance: { actif: false, relancesMax: 9 } }],
  ])("%s : la voix n'est PAS refusée (le prix et les réglages ne bloquent jamais)", async (_nom, plus) => {
    const o = outils({ ...plus, lireVoix: undefined } as never);
    let erreur: unknown;
    const etat = await avancerVoixIV(etatCorps(), o).catch((e) => ((erreur = e), undefined));
    // Sans lecteur de voix la lecture échoue en panne (réessayable), mais jamais en refus « budget » ou « Q16 » posé d'avance.
    expect(etat?.issue).toBeUndefined();
    void erreur;
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
  const demarrer = () => {
    const carte = carteFixe("A");
    const m = monde();
    return { o: outilsSimules(carte, m), e: etatInitialIV(demandeEssai(carte)) };
  };

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
});
