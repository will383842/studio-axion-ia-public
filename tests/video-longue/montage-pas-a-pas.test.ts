/**
 * FIN-8 : montage de la vidéo longue PAS À PAS. 3 chapitres, 5 plages, rendu simulé (soumettre / état), horloge simulée.
 * Chaque pas fait au plus UNE action de rendu et revient ; l'étape « montage » n'est faite qu'après le collage ;
 * 0 appel HeyGen / ElevenLabs ; aucun réseau, aucune dépense, rien d'allumé.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { ErreurRendu } from "@/fournisseurs/rendu/client";

const interdit = vi.fn(() => {
  throw new Error("fournisseur de voix interdit");
});
const hotesInterdits: string[] = [];
vi.spyOn(globalThis, "fetch").mockImplementation(async (entree) => {
  const url = String(typeof entree === "object" && "url" in entree ? entree.url : entree);
  if (/heygen|elevenlabs/i.test(url)) hotesInterdits.push(url);
  throw new Error(`réseau interdit : ${url}`);
});
vi.mock("@/fournisseurs/heygen/voix", async (orig) => ({ ...(await orig<object>()), creerFournisseurVoixHeygen: interdit }));
vi.mock("@/fournisseurs/credits/elevenlabs", async (orig) => ({ ...(await orig<object>()), creerLecteurElevenLabs: interdit }));

const { pasMontageVideoLongue, ErreurMontageVideoLongue } = await import("@/services/video-longue-montage");
const { avancerVideoLongue, ETAPES_FABRICATION } = await import("@/moteurs/montage-video-longue/chaine");
const { definitionVideoLongue } = await import("@/moteurs/montage-video-longue");
const { lireEntreesVideoLongue } = await import("@/moteurs/montage-video-longue/entrees");
const { creerDependancesVideoLongue } = await import("@/services/video-longue-branchements");
import type { PortsMontageVideoLongue } from "@/services/video-longue-montage";
import type { SuiviMontageVideoLongue, EtatVideoLongue } from "@/moteurs/montage-video-longue/chaine";

// 3 chapitres (100 s, 50 s, 110 s) : plages de 60 s au plus = 2 + 1 + 2 = 5 plages, puis 1 collage.
const BORNES = [
  { debutSec: 0, finSec: 100 },
  { debutSec: 100, finSec: 150 },
  { debutSec: 150, finSec: 260 },
];
const chapitresWeb = BORNES.map((b, i) => ({ ...b, libelle: `Chapitre ${i + 1}`, blocRecette: "chapitres" }));
const mots: MotHorodate[] = Array.from({ length: 260 }, (_, i) => ({ mot: i % 10 === 9 ? `mot${i}.` : `mot${i}`, debutSec: i, finSec: i + 1 }));
const ctx = { chapitres: chapitresWeb as never, mots, dureeSec: 260 };
const commande = { videoId: "v-pas", ratios: ["16:9"], distribution: [], entrees: { videoLongue: { chapitres: BORNES.map((_, i) => ({ id: `c${i + 1}`, titre: `Chapitre ${i + 1}`, texte: `texte ${i + 1}` })), sansVoix: true } } } as unknown as CommandeFabrication;
const PLAGES = 5;

interface Banc {
  ports: PortsMontageVideoLongue;
  soumis: DemandeRendu[];
  lectures: string[];
  notees: Record<string, { sortieCle: string; empreinte: string }>;
  etat: { actif: boolean; lecturesEnCours: number; reponse?: (id: string) => Awaited<ReturnType<ServiceRendu["etat"]>> | Error };
  horloge: { ms: number };
  appelsReseau(): number;
}

function banc(over: Partial<Banc["etat"]> = {}, notees: Banc["notees"] = {}): Banc {
  const b: Banc = { soumis: [], lectures: [], notees, etat: { actif: true, lecturesEnCours: 1, ...over }, horloge: { ms: 1_000_000 }, ports: undefined as never, appelsReseau: () => b.soumis.length + b.lectures.length };
  const vues = new Map<string, number>();
  const rendu: ServiceRendu = {
    soumettre: async (d) => (b.soumis.push(d), { idRendu: d.idRendu }),
    etat: async (id) => {
      b.lectures.push(id);
      const sortie = b.soumis.find((d) => d.idRendu === id)?.sortie.cle ?? "";
      const n = (vues.get(id) ?? 0) + 1;
      vues.set(id, n);
      const imposee = b.etat.reponse?.(id);
      if (imposee instanceof Error) throw imposee;
      if (imposee) return imposee;
      return n <= b.etat.lecturesEnCours ? { statut: "en_cours" as const, progression: 10 } : { statut: "termine" as const, sortieCle: sortie };
    },
  };
  b.ports = {
    rendu,
    signer: async (l, d) => ({ lectures: Object.fromEntries(Object.entries(l).map(([n, c]) => [n, `https://lire/${c}`])), depots: Object.fromEntries(d.map((x) => [x.cle, `https://deposer/${x.cle}`])) }),
    cle: (c, nom) => `studio/dev/videos/${c.videoId}/${nom}`,
    lirePlages: async () => b.notees,
    ecrirePlages: async (_v, p) => void (b.notees = { ...p }),
    actif: async () => b.etat.actif,
    maintenant: () => b.horloge.ms,
  };
  return b;
}

/** Un pas, en vérifiant qu'il fait au plus une action de rendu et revient sans attendre. */
async function unPas(b: Banc, suivi?: SuiviMontageVideoLongue) {
  const avant = b.appelsReseau();
  const r = await pasMontageVideoLongue(commande, "t-pas", ctx, b.ports, suivi);
  expect(b.appelsReseau() - avant).toBeLessThanOrEqual(1);
  b.horloge.ms += 500; // l'horloge simulée avance : jamais d'attente réelle
  return r;
}

async function mener(b: Banc, depart?: SuiviMontageVideoLongue, maxPas = 100) {
  let suivi = depart;
  const pas: Awaited<ReturnType<typeof unPas>>[] = [];
  for (let i = 0; i < maxPas; i++) {
    const r = await unPas(b, suivi);
    pas.push(r);
    if ("fini" in r) return { pas, suivi, fini: r.fini };
    suivi = r.enCours.suivi;
  }
  throw new Error("le montage ne se termine pas");
}

afterEach(() => vi.restoreAllMocks());

describe("FIN-8 : un pas = une action de rendu", () => {
  it("5 plages + 1 collage, au plus 1 appel de rendu par pas, sans doublon d'idRendu, aucun délai réel", async () => {
    const delais: number[] = [];
    const vrai = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((f: () => void, ms?: number, ...a: unknown[]) => (delais.push(ms ?? 0), vrai(f, ms, ...a))) as never);
    const b = banc();
    const { pas, fini } = await mener(b);
    expect(delais.filter((d) => d > 50)).toEqual([]);
    expect(b.soumis).toHaveLength(PLAGES + 1);
    expect(new Set(b.soumis.map((d) => d.idRendu)).size).toBe(PLAGES + 1);
    expect(b.soumis.filter((d) => d.operation === "composition")).toHaveLength(PLAGES);
    const collage = b.soumis.filter((d) => d.operation === "collage-chapitres");
    expect(collage).toHaveLength(1);
    expect((collage[0].parametres as { morceaux: string[]; voix?: string })).not.toHaveProperty("voix");
    expect((collage[0].parametres as { morceaux: string[] }).morceaux).toHaveLength(PLAGES);
    // Le dernier pas rend le fichier ; tous les autres sont « en cours » avec fait <= total.
    expect(fini.fichierCle).toContain("video-longue-t-pas-16x9.mp4");
    for (const r of pas.slice(0, -1)) {
      expect("enCours" in r).toBe(true);
      if ("enCours" in r) expect(r.enCours.fait).toBeLessThanOrEqual(r.enCours.total);
    }
    const premier = pas[0];
    expect("enCours" in premier && premier.enCours.total).toBe(PLAGES + 1);
    // Chaque plage soumise une fois, relue (en cours puis terminée) : bien plus d'un pas par plage.
    expect(pas.length).toBeGreaterThan(PLAGES + 1);
    expect(Object.keys(b.notees)).toHaveLength(PLAGES);
  });

  it("le collage n'est soumis qu'une fois toutes les plages terminées", async () => {
    const b = banc();
    await mener(b);
    const rang = b.soumis.findIndex((d) => d.operation === "collage-chapitres");
    expect(rang).toBe(PLAGES);
    expect(b.soumis.slice(0, PLAGES).every((d) => d.operation === "composition")).toBe(true);
  });
});

describe("FIN-8 : l'étape montage n'est faite qu'après le collage", () => {
  it("la chaîne rappelle l'étape tant que le collage n'est pas fini", async () => {
    const b = banc();
    const lire = vi.fn();
    const monter = vi.fn(async () => ({ fichierCle: "ne-doit-pas-servir" }));
    const def = definitionVideoLongue(() => deps);
    const deps = { voix: { lire }, monter, monterPas: (r: never, c: never, s?: SuiviMontageVideoLongue) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s) };
    const entrees = lireEntreesVideoLongue(commande);
    const c = { commande, entrees, travailId: "t-pas", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
    let etat: EtatVideoLongue = { faites: ["reception", "voix", "chapitres"], voix: { mots, dureeSec: 260, morceaux: 0 }, chapitres: chapitresWeb as never, remarques: [], sorties: {} };
    let tours = 0;
    while (!etat.fini && !etat.echec && tours++ < 100) {
      const avant = etat.faites.includes("montage");
      expect(avant).toBe(false); // jamais faite avant que le collage ne soit rendu
      etat = await avancerVideoLongue(etat, c, deps);
      if (!etat.faites.includes("montage")) expect(etat.sorties["16:9"]).toBeUndefined();
      else break;
    }
    expect(tours).toBeGreaterThan(PLAGES + 1);
    expect(etat.faites).toContain("montage");
    expect(etat.sorties["16:9"]).toContain("video-longue-t-pas-16x9.mp4");
    expect(etat.montageSuivi).toBeUndefined();
    expect(monter).not.toHaveBeenCalled();
    expect(lire).not.toHaveBeenCalled();
    expect(b.soumis).toHaveLength(PLAGES + 1);
    expect(ETAPES_FABRICATION.find((e) => e.cle === "voix")!.nom).toBe("Voix ou temps de lecture");
  });
});

describe("FIN-8 : reprise", () => {
  it("après 2 plages, un nouvel état reprend sans re-soumettre les plages notées", async () => {
    const b = banc();
    let suivi: SuiviMontageVideoLongue | undefined;
    while (Object.keys(b.notees).length < 2) {
      const r = await unPas(b, suivi);
      if ("enCours" in r) suivi = r.enCours.suivi;
    }
    const dejaSoumises = new Set(b.soumis.map((d) => d.idRendu));
    const notees = Object.keys(b.notees);
    expect(notees).toHaveLength(2);
    // Redémarrage : le suivi de l'état est perdu, seules les plages notées restent.
    b.soumis.length = 0;
    await mener(b, undefined);
    expect(b.soumis.filter((d) => notees.includes(d.idRendu))).toEqual([]);
    expect(b.soumis).toHaveLength(PLAGES - 2 + 1);
    expect(dejaSoumises.size).toBeGreaterThanOrEqual(2);
    expect(Object.keys(b.notees)).toHaveLength(PLAGES);
  });

  it("une plage notée avec une AUTRE empreinte (contenu retouché) est refaite", async () => {
    const b = banc();
    await mener(b);
    const ids = Object.keys(b.notees);
    b.notees = Object.fromEntries(ids.map((id) => [id, { sortieCle: b.notees[id].sortieCle, empreinte: "autre" }]));
    b.soumis.length = 0;
    await mener(b, undefined);
    expect(b.soumis.filter((d) => d.operation === "composition")).toHaveLength(PLAGES);
  });
});

describe("FIN-8 : réglage éteint en cours de route", () => {
  it("arrêt net, rien de plus n'est soumis ni relu", async () => {
    const b = banc();
    let suivi: SuiviMontageVideoLongue | undefined;
    for (let i = 0; i < 3; i++) {
      const r = await unPas(b, suivi);
      if ("enCours" in r) suivi = r.enCours.suivi;
    }
    const avant = b.appelsReseau();
    b.etat.actif = false;
    await expect(pasMontageVideoLongue(commande, "t-pas", ctx, b.ports, suivi)).rejects.toThrow(/éteinte/);
    expect(b.appelsReseau()).toBe(avant);
  });
});

describe("FIN-8 : erreurs", () => {
  const erreur = (reessayable: boolean) => new ErreurRendu({ code: "RENDU", message: "service indisponible", reessayable } as never);

  it("erreur non réessayable : échec lisible, non réessayable", async () => {
    const b = banc({ reponse: () => erreur(false) });
    const r1 = await unPas(b);
    const e = await pasMontageVideoLongue(commande, "t-pas", ctx, b.ports, "enCours" in r1 ? r1.enCours.suivi : undefined).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurMontageVideoLongue);
    expect(e.reessayable).toBe(false);
    expect(e.message).toMatch(/le montage s'arrête/);
  });

  it("état « échec » du rendu : message lisible", async () => {
    const b = banc({ reponse: () => ({ statut: "echec", erreur: { code: "X", message: "boum", reessayable: false } as never }) });
    const r1 = await unPas(b);
    await expect(pasMontageVideoLongue(commande, "t-pas", ctx, b.ports, "enCours" in r1 ? r1.enCours.suivi : undefined)).rejects.toThrow(/a échoué : boum/);
  });

  it("erreur réessayable : on relit au pas suivant, la plage n'est pas resoumise", async () => {
    let n = 0;
    const b = banc({ reponse: () => (++n === 1 ? erreur(true) : undefined) as never });
    const r1 = await unPas(b);
    const r2 = await unPas(b, "enCours" in r1 ? r1.enCours.suivi : undefined);
    expect("enCours" in r2 && r2.enCours.suivi.enCours?.erreurs).toBe(1);
    expect(b.soumis).toHaveLength(1);
    const { fini } = await mener(b, "enCours" in r2 ? r2.enCours.suivi : undefined);
    expect(fini.fichierCle).toBeTruthy();
    expect(new Set(b.soumis.map((d) => d.idRendu)).size).toBe(b.soumis.length);
  });

  it("service redémarré (« inconnu ») : même demande soumise à nouveau, même identifiant", async () => {
    let n = 0;
    const b = banc({ reponse: () => (++n === 1 ? { statut: "inconnu" as const } : undefined) as never });
    const r1 = await unPas(b);
    const r2 = await unPas(b, "enCours" in r1 ? r1.enCours.suivi : undefined); // relit : « inconnu », rien d'autre dans ce pas
    expect(b.soumis).toHaveLength(1);
    await unPas(b, "enCours" in r2 ? r2.enCours.suivi : undefined); // la même demande repart
    expect(b.soumis).toHaveLength(2);
    expect(b.soumis[1].idRendu).toBe(b.soumis[0].idRendu);
  });

  it("délai d'une plage dépassé : échec", async () => {
    const b = banc({ lecturesEnCours: 1000 });
    b.ports.delaiPlageMs = 1000;
    const r1 = await unPas(b);
    b.horloge.ms += 5000;
    await expect(pasMontageVideoLongue(commande, "t-pas", ctx, b.ports, "enCours" in r1 ? r1.enCours.suivi : undefined)).rejects.toThrow(/délai dépassé/);
  });
});

describe("FIN-8 : chemin sans voix = 0 appel HeyGen / ElevenLabs", () => {
  it("chaîne complète par les dépendances gardées : aucun port de voix, aucun hôte de voix", async () => {
    const b = banc();
    const voix = vi.fn();
    const deps = creerDependancesVideoLongue(commande, {
      actif: async () => true,
      registre: { depense: voix, ecrireDepense: voix, morceauFait: voix, noterMorceau: voix } as never,
      montagePret: async () => true,
      reserver: voix,
      lireMorceau: voix,
      idVoix: voix,
      aligner: voix,
      monterPas: (_r, c, s) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s),
    });
    expect(deps.monterPas).toBeTypeOf("function");
    const def = definitionVideoLongue(() => deps);
    const entrees = lireEntreesVideoLongue(commande);
    const c = { commande, entrees, travailId: "t-pas", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
    let etat = def.etatInitial(entrees, commande);
    for (let i = 0; i < 100 && !etat.fini && !etat.echec; i++) etat = await avancerVideoLongue(etat, c, deps);
    expect(etat.fini).toBe(true);
    expect(etat.sorties["16:9"]).toBeTruthy();
    expect(b.soumis.filter((d) => d.operation === "collage-chapitres")).toHaveLength(1);
    expect(new Set(b.soumis.map((d) => d.idRendu)).size).toBe(b.soumis.length);
    expect(voix).not.toHaveBeenCalled();
    expect(interdit).not.toHaveBeenCalled();
    expect(hotesInterdits).toEqual([]);
  });

  it("réglage éteint : les dépendances refusent le pas avant tout rendu", async () => {
    const b = banc();
    const deps = creerDependancesVideoLongue(commande, {
      actif: async () => false,
      registre: {} as never,
      montagePret: async () => true,
      reserver: async () => undefined,
      lireMorceau: async () => ({ dureeSec: 0, mots: [] }),
      monterPas: (_r, c, s) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s),
    });
    await expect(deps.monterPas!("16:9", ctx, undefined)).rejects.toMatchObject({ motif: "eteint" });
    expect(b.appelsReseau()).toBe(0);
  });

  it("durée > 1 200 s : refus net à chaque pas, aucun rendu", async () => {
    const b = banc();
    const deps = creerDependancesVideoLongue(commande, {
      actif: async () => true,
      registre: {} as never,
      montagePret: async () => true,
      reserver: async () => undefined,
      lireMorceau: async () => ({ dureeSec: 0, mots: [] }),
      monterPas: (_r, c, s) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s),
    });
    await expect(deps.monterPas!("16:9", { ...ctx, dureeSec: 1201 }, undefined)).rejects.toMatchObject({ motif: "duree-depassee" });
    expect(b.appelsReseau()).toBe(0);
  });
});

/** Banc de la chaîne : l'état du gabarit, des dépendances GARDÉES (réglage, durée) et l'horloge simulée qui avance à chaque tour. */
function chaine(b: Banc, avance = 300) {
  const deps = creerDependancesVideoLongue(commande, {
    actif: async () => b.etat.actif,
    registre: {} as never,
    montagePret: async () => true,
    reserver: async () => undefined,
    lireMorceau: async () => ({ dureeSec: 0, mots: [] }),
    monterPas: (_r, c, s) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s),
  });
  const def = definitionVideoLongue(() => deps);
  const entrees = lireEntreesVideoLongue(commande);
  const c = (tentative: number) => ({ commande, entrees, travailId: "t-pas", versionId: "v", tentative, etapes: def.etapesFabrication });
  let etat: EtatVideoLongue = { faites: ["reception", "voix", "chapitres"], voix: { mots, dureeSec: 260, morceaux: 0 }, chapitres: chapitresWeb as never, remarques: [], sorties: {} };
  const tour = async (tentative: number) => {
    etat = await avancerVideoLongue(etat, c(tentative) as never, deps as never);
    b.horloge.ms += avance;
    return etat;
  };
  /** Tourne jusqu'à « montage » fait, un échec, ou `jusqua` vrai. */
  const jusqua = async (tentative: number, stop: (e: EtatVideoLongue) => boolean = () => false) => {
    for (let i = 0; i < 150 && !etat.faites.includes("montage") && !etat.echec && !stop(etat); i++) await tour(tentative);
    return etat;
  };
  return { tour, jusqua, lire: () => etat, poser: (e: EtatVideoLongue) => void (etat = e) };
}
const sansDoublon = (b: Banc) => {
  const ids = b.soumis.map((d) => d.idRendu);
  expect(ids.length - new Set(ids).size).toBeLessThanOrEqual(1); // au plus la demande interrompue, même idRendu
  expect(new Set(ids).size).toBe(PLAGES + 1);
};

describe("FIN-8 : « Réessayer » après un délai dépassé", () => {
  it("échec lisible, plages finies gardées, puis relance (echec retiré, tentative 2) jusqu'à « fini », horloge qui avance, délai gardé", async () => {
    const b = banc({ lecturesEnCours: 3 });
    b.ports.delaiPlageMs = 1000;
    const k = chaine(b);
    // Un pas soumet la plage, la plage reste « en cours » au-delà du délai.
    await k.tour(1);
    b.horloge.ms += 5000;
    const etat = await k.tour(1);
    expect(etat.echec?.message).toMatch(/délai dépassé/);
    expect(etat.echec?.reessayable).toBe(true);
    expect(etat.montageSuivi?.["16:9"]?.enCours).toBeUndefined();
    expect(etat.montageSuivi?.["16:9"]?.collage).toBeUndefined();
    // « Réessayer » : seul `echec` est retiré par le gabarit. Le délai reste à 1 000 ms et l'horloge avance de 300 ms par pas :
    // sans le correctif (ancienne horloge gardée), le premier pas relirait une demande déjà « trop vieille » et échouerait.
    k.poser({ ...etat, echec: undefined });
    const fin = await k.jusqua(2);
    expect(fin.echec).toBeUndefined();
    expect(fin.faites).toContain("montage");
    expect(fin.sorties["16:9"]).toContain("video-longue-t-pas-16x9.mp4");
    sansDoublon(b);
  });

  it("délai du collage dépassé : plages gardées, collage retiré, relance jusqu'à « fini » avec le même idCollage", async () => {
    const b = banc();
    b.ports.delaiCollageMs = 1000;
    let collageBloque = true;
    b.etat.reponse = (id) => (collageBloque && b.soumis.find((d) => d.idRendu === id)?.operation === "collage-chapitres" ? { statut: "en_cours" as const, progression: 10 } : undefined) as never;
    const k = chaine(b);
    await k.jusqua(1, () => b.soumis.some((d) => d.operation === "collage-chapitres"));
    b.horloge.ms += 5000;
    const etat = await k.tour(1);
    expect(etat.echec?.message).toMatch(/délai dépassé/);
    expect(etat.echec?.reessayable).toBe(true);
    expect(etat.montageSuivi?.["16:9"]?.collage).toBeUndefined();
    expect(Object.keys(etat.montageSuivi?.["16:9"]?.plages ?? {})).toHaveLength(PLAGES);
    collageBloque = false;
    k.poser({ ...etat, echec: undefined });
    const fin = await k.jusqua(2);
    expect(fin.echec).toBeUndefined();
    expect(fin.faites).toContain("montage");
    const collages = b.soumis.filter((d) => d.operation === "collage-chapitres").map((d) => d.idRendu);
    expect(collages).toHaveLength(2);
    expect(new Set(collages).size).toBe(1);
    sansDoublon(b);
  });
});

describe("FIN-8 : classement « réessayable » d'un échec de pas", () => {
  it("réglage éteint en cours de route : échec réessayable, plages gardées ; rallumé puis relance jusqu'à « fini »", async () => {
    const b = banc();
    const k = chaine(b);
    await k.jusqua(1, () => Object.keys(b.notees).length >= 2);
    expect(Object.keys(b.notees)).toHaveLength(2);
    b.etat.actif = false;
    const soumisAvant = b.soumis.length;
    const etat = await k.tour(1);
    expect(etat.echec?.reessayable).toBe(true);
    expect(etat.echec?.message).toMatch(/éteinte|éteint/);
    expect(b.soumis).toHaveLength(soumisAvant);
    expect(Object.keys(b.notees)).toHaveLength(2);
    b.etat.actif = true;
    k.poser({ ...etat, echec: undefined });
    const fin = await k.jusqua(2);
    expect(fin.echec).toBeUndefined();
    expect(fin.faites).toContain("montage");
    sansDoublon(b);
  });

  it("éteint entre la garde des dépendances et le pas (course) : même classement, message lisible", async () => {
    const b = banc();
    b.ports.actif = async () => false; // la garde des dépendances est passée (ou absente) : seul le pas voit « éteint »
    const deps = { voix: { lire: vi.fn() }, monter: vi.fn(), monterPas: (r: never, c: never, s?: SuiviMontageVideoLongue) => pasMontageVideoLongue(commande, "t-pas", c, b.ports, s) };
    const def = definitionVideoLongue(() => deps as never);
    const c = { commande, entrees: lireEntreesVideoLongue(commande), travailId: "t-pas", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
    const etat = await avancerVideoLongue({ faites: ["reception", "voix", "chapitres"], voix: { mots, dureeSec: 260, morceaux: 0 }, chapitres: chapitresWeb as never, remarques: [], sorties: {} }, c as never, deps as never);
    expect(etat.echec?.reessayable).toBe(true);
    expect(etat.echec?.message).toMatch(/éteinte.*Rallumez/);
    expect(b.appelsReseau()).toBe(0);
  });

  it("durée trop longue : échec NON réessayable (même refus à chaque essai)", async () => {
    const b = banc();
    const k = chaine(b);
    // La durée vient du contexte du montage (voix.dureeSec).
    k.poser({ faites: ["reception", "voix", "chapitres"], voix: { mots, dureeSec: 1201, morceaux: 0 }, chapitres: chapitresWeb as never, remarques: [], sorties: {} });
    const refus = await k.tour(1);
    expect(refus.echec?.reessayable).toBe(false);
    expect(b.appelsReseau()).toBe(0);
  });

  it("soumission refusée définitivement par le serveur : non réessayable, message lisible", async () => {
    const b = banc();
    b.ports.rendu.soumettre = async () => {
      throw new ErreurRendu({ code: "RENDU", message: "demande invalide", reessayable: false } as never);
    };
    const k = chaine(b);
    const etat = await k.tour(1);
    expect(etat.echec?.reessayable).toBe(false);
    expect(etat.echec?.message).toMatch(/demande invalide/);
    expect(etat.echec?.message).not.toMatch(/vous pouvez réessayer/);
  });

  it("soumission en erreur passagère (503) : réessayable", async () => {
    const b = banc();
    b.ports.rendu.soumettre = async () => {
      throw new ErreurRendu({ code: "RENDU", message: "service indisponible", reessayable: true } as never);
    };
    const k = chaine(b);
    const etat = await k.tour(1);
    expect(etat.echec?.reessayable).toBe(true);
    expect(etat.echec?.message).toMatch(/service indisponible/);
  });

  it("collage refusé définitivement à la soumission : non réessayable", async () => {
    const b = banc();
    const vraie = b.ports.rendu.soumettre;
    b.ports.rendu.soumettre = async (d) => {
      if (d.operation === "collage-chapitres") throw new ErreurRendu({ code: "RENDU", message: "accès refusé", reessayable: false } as never);
      return vraie(d);
    };
    const k = chaine(b);
    const etat = await k.jusqua(1);
    expect(etat.echec?.reessayable).toBe(false);
    expect(etat.echec?.message).toMatch(/accès refusé/);
  });
});
