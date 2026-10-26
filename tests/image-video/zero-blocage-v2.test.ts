/**
 * ZÉRO BLOCAGE v2 (chiffres et argent) : jamais d'arrêt pour un défaut de détail. Restent bloquants : voix absente, rendu impossible,
 * image illisible, chiffre faux, mots interdits (Q08), mesure absente (Q24).
 *  1. écran irrendable : texte seul au 1er échec de rendu (`ecransImposesRendu`), `IV_RENDU` au 2e, jamais de boucle ;
 *  2. lecture ou conception en panne (Claude) : `IV_PANNE` relancée seule ;
 *  3. piste voix introuvable : relue gratuitement ;
 *  4. transcription en panne : relancée une fois, puis remarque, sous conditions ; une attente remonte telle quelle ;
 *  5. « chiffres dits non confirmés » : remarque seulement si la carte n'a aucun chiffre à dire.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, ecransAAdapterIV, choisirEcransAAdapterIV, ErreurRenduDefinitifIV, pasMiseEnScene, estAttenteIV, etatInitialIV, RenduEnCoursIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { ecouterVersionIV, rmsSurLesMotsIV, type OutilsEcouteIV } from "@/moteurs/montage-image-video/ecoute";
import { empreinteSon } from "@/moteurs/montage-image-video/assemblage";
import type { MotHorodate } from "@/domaine/types";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    } else break;
  }
  return e;
}

/** Carte A : un chiffre à dire. Carte B : aucun chiffre. */
const carteA = carteFixe("A");
const carteB = carteFixe("B");
const demande = (c: typeof carteA) => demandeEssai(c, { formats: {} });
const panneTranscription = (o: OutilsFabricationIV, m: ReturnType<typeof monde>) => {
  o.controles = {
    ...o.controles,
    pauseRelectureMs: 0,
    transcrire: async (d) => {
      m.transcriptions.push(d.appelId);
      throw new Error("transcription en panne");
    },
  };
};

describe("rendu : écran irrendable", () => {
  it("référence : sans panne, la vidéo est prête", async () => {
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), outilsSimules(carteA, monde()));
    expect(e.etape).toBe("prete");
    expect(e.ecransImposesRendu).toBeUndefined();
  });

  it("1er échec : texte seul imposé (champ à part), vidéo prête, remarque dans les mentions ; ecransAdaptes non touché", async () => {
    const reference = await jusquAuBout(etatInitialIV(demande(carteA)), outilsSimules(carteA, monde()));
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1 : un texte ne tient pas à sa place."], ["e02"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(Object.values(e.ecransImposesRendu ?? {})[0]).toContain("e02");
    expect(e.remarques?.[0]).toMatch(/texte seul/);
    expect(e.controles?.verdict?.mentions.join(" ")).toMatch(/texte seul/);
    expect(e.ecransAdaptes).toEqual(reference.ecransAdaptes);
  });

  it("anti-boucle : un rendu toujours irrendable = IV_RENDU, 2 échecs au plus par version, pas de boucle jusqu'au maximum de pas", async () => {
    const o = outilsSimules(carteA, monde());
    let appels = 0;
    o.rendre = async () => {
      appels++;
      throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1"], ["e02"]);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "rendu", code: "IV_RENDU", reessayable: false });
    expect(appels).toBe(2);
  });

  it("l'imposition survit aux passages de mise en scène et les remarques sont recalculées, jamais cumulées", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", [], ["e02"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("prete");
    const versions = Object.keys(e.ecransImposesRendu ?? {}).length;
    expect(versions).toBeGreaterThan(0);
    for (let passage = 1; passage <= 2; passage++) {
      delete e.scenes;
      await pasMiseEnScene(e, o);
      expect(e.ecransImposesRendu && Object.keys(e.ecransImposesRendu)).toHaveLength(versions);
      expect(e.remarques, `passage ${passage}`).toHaveLength(versions);
    }
  });

  it("repli : un rendu qui ne nomme aucun écran retrouvé passe tous les écrans à texte en texte seul, et la remarque le dit", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("prete");
    expect(e.remarques?.[0]).toMatch(/repli sur tous les écrans/);
    expect(e.controles?.verdict?.mentions.join(" ")).toMatch(/repli sur tous les écrans/);
    const f = e.script!.fiche;
    expect(choisirEcransAAdapterIV(f, { blocs: [], plans: [] } as never, ["inconnu"])).toMatchObject({ repli: true });
  });

  it("panne passagère au 1er rendu puis écran irrendable à la relance : texte seul, pas IV_RENDU ; au 2e échec définitif : IV_RENDU", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new Error("rendu en panne");
      if (n === 2) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", [], ["e02"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(e.remarques?.[0]).toMatch(/texte seul/);

    const o2 = outilsSimules(carteA, monde());
    let m = 0;
    o2.rendre = async () => {
      m++;
      if (m === 1) throw new Error("rendu en panne");
      throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", [], ["e02"]);
    };
    const e2 = await jusquAuBout(etatInitialIV(demande(carteA)), o2);
    expect(e2.refus).toMatchObject({ etape: "rendu", code: "IV_RENDU" });
  });

  it("RenduEnCoursIV levé à la relance (-reprise) puis reprise : la relance repart au bon essai, le 1er appel en échec n'est pas relancé", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    const essais: number[] = [];
    let n = 0;
    o.rendre = async (d) => {
      essais.push(d.essai ?? 1);
      if (++n === 1) throw new Error("rendu en panne");
      if (n === 2) throw new RenduEnCoursIV("Le rendu");
      return rendre(d);
    };
    let e = await avancerJusquAArretIV(etatInitialIV(demande(carteA)), o);
    e = await jusquAuBout(e, o);
    expect(e.attente ?? "").toBe("");
    expect(essais.slice(0, 3)).toEqual([1, 2, 2]);
    expect(essais.filter((x) => x === 1)).toHaveLength(1);
    expect(essais.filter((x) => x === 3)).toHaveLength(0);
    expect(e.etape).toBe("prete");
  });

  it("correspondance : un bloc de la ligne de temps nommé par le rendu devient l'écran de la fiche qu'il montre ; sans nom, tous les écrans à texte", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let vue: Parameters<typeof rendre>[0] | undefined;
    o.rendre = async (d) => {
      vue ??= d;
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("prete");
    const fiche = e.script!.fiche;
    const ligne = vue!.ligne;
    const avecTexte = fiche.ecrans.filter((x) => x.textesEcran.length).map((x) => x.id);
    const bloc = ligne.blocs.find((b) => ligne.plans.some((p) => p.ecran && avecTexte.includes(p.ecran) && p.debut < b.fin && p.fin > b.debut));
    expect(bloc).toBeDefined();
    const attendus = [...new Set(ligne.plans.filter((p) => p.ecran && avecTexte.includes(p.ecran) && p.debut < bloc!.fin - 1e-6 && p.fin > bloc!.debut + 1e-6).map((p) => p.ecran!))];
    const trouves = ecransAAdapterIV(fiche, ligne, [bloc!.id]);
    expect(trouves.length).toBeGreaterThan(0);
    expect(trouves).toEqual(avecTexte.filter((x) => attendus.includes(x)));
    expect(ecransAAdapterIV(fiche, ligne, undefined)).toEqual(avecTexte);
    expect(ecransAAdapterIV(fiche, ligne, ["inconnu"])).toEqual(avecTexte);
  });
});

describe("lecture en panne", () => {
  it("panne de Claude : IV_PANNE réessayable (relancée une fois seule), pas IV_IMAGE", async () => {
    const o = outilsSimules(carteA, monde());
    const appeler = vi.fn(async () => {
      throw new Error("Claude ne répond pas");
    });
    o.lecture.appeler = appeler;
    o.pause = async () => {};
    const e = await avancerJusquAArretIV(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "lecture", code: "IV_PANNE", reessayable: true });
    expect(e.journal.join(" ")).toMatch(/nouvel essai automatique/);
  });
});

describe("piste voix introuvable", () => {
  it("introuvable au 1er essai puis trouvée : vidéo prête", async () => {
    const o = outilsSimules(carteA, monde());
    const lire = o.controles.lireSon;
    const vues = new Set<string>();
    o.controles = {
      ...o.controles,
      pauseRelectureMs: 0,
      lireSon: async (cle) => {
        if (!vues.has(cle)) {
          vues.add(cle);
          return null;
        }
        return lire(cle);
      },
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
  });

  it("toujours introuvable : refusée (voix absente)", async () => {
    const o = outilsSimules(carteA, monde());
    o.controles = { ...o.controles, pauseRelectureMs: 0, lireSon: async () => null };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
  });
});

describe("transcription en panne (fabrication complète)", () => {
  it("carte SANS chiffre à dire : relancée une fois sous une réservation neuve, puis remarque ; vidéo prête", async () => {
    const m = monde();
    const o = outilsSimules(carteB, m);
    panneTranscription(o, m);
    const e = await jusquAuBout(etatInitialIV(demande(carteB)), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    const relances = m.transcriptions.filter((x) => x.endsWith("-reprise")).length;
    expect(relances).toBeGreaterThan(0);
    expect(relances).toBe(m.transcriptions.length - relances);
    expect(e.controles?.verdict?.mentions.join(" ")).toMatch(/Q08.*Q05.*Q08bis.*script/);
  });

  it("carte AVEC chiffre à dire : les chiffres dits ne sont pas confirmés, refusée", async () => {
    const m = monde();
    const o = outilsSimules(carteA, m);
    panneTranscription(o, m);
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
    expect(e.refus?.phrases?.join(" ")).toMatch(/chiffres/i);
  });

  it("carte avec un chiffre à dire jamais affiché + panne de transcription : refusée en IV_CONTROLES (ligne CHIFFRES bloquante)", async () => {
    const m = monde();
    const o = outilsSimules(carteA, m);
    panneTranscription(o, m);
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES" });
    expect(e.refus?.phrases?.join(" ")).toMatch(/chiffres dits ne sont pas confirmés/);
  });

  it("transcription vide : refusée (voix absente)", async () => {
    const o = outilsSimules(carteB, monde());
    o.controles = { ...o.controles, transcrire: async () => ({ mots: [] }) };
    const e = await jusquAuBout(etatInitialIV(demande(carteB)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
  });

  it("transcription sous le taux de mots : refusée", async () => {
    const o = outilsSimules(carteB, monde());
    const transcrire = o.controles.transcrire;
    o.controles = { ...o.controles, transcrire: async (d) => ({ mots: (await transcrire(d)).mots.filter((_, i) => i % 3 === 0) }) };
    const e = await jusquAuBout(etatInitialIV(demande(carteB)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
  });

  it("transcription lente (RenduEnCoursIV) : attente, jamais une panne ni un 2e travail payé", async () => {
    const m = monde();
    const o = outilsSimules(carteB, m);
    o.controles = {
      ...o.controles,
      transcrire: async (d) => {
        m.transcriptions.push(d.appelId);
        throw new RenduEnCoursIV("La transcription");
      },
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteB)), o);
    expect(e.etape).toBe("controles");
    expect(e.refus).toBeUndefined();
    expect(e.attente).toMatch(/en cours/);
    expect(m.transcriptions.every((x) => !x.endsWith("-reprise"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* L'écoute seule                                                       */
/* ------------------------------------------------------------------ */

const FREQ = 8000;
function wav(e: Float32Array): Uint8Array {
  const b = new Uint8Array(44 + e.length * 2);
  const v = new DataView(b.buffer);
  const ecrire = (i: number, s: string) => [...s].forEach((c, k) => (b[i + k] = c.charCodeAt(0)));
  ecrire(0, "RIFF");
  v.setUint32(4, 36 + e.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, FREQ, true);
  v.setUint32(28, FREQ * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ecrire(36, "data");
  v.setUint32(40, e.length * 2, true);
  e.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
}

const MOTS: MotHorodate[] = ["un", "deux", "trois", "quatre", "cinq"].map((mot, i) => ({ mot, debutSec: 0.2 + i * 0.5, finSec: 0.6 + i * 0.5 }));
const DUREE = 3.4;
function piste(muet = false, mots: MotHorodate[] = MOTS) {
  const e = new Float32Array(Math.round(DUREE * FREQ));
  if (!muet) for (const m of MOTS) for (let i = Math.round(m.debutSec * FREQ); i < Math.round(m.finSec * FREQ); i++) e[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / FREQ);
  const octets = wav(e);
  return { octets, entree: { cle: "voix/p.wav", empreinte: empreinteSon(octets), finVoixSec: 2.7, dureeSec: DUREE, mots } };
}
function entree(p: ReturnType<typeof piste>, plus: { depenseAutorisee?: boolean; deja?: MotHorodate[] } = {}) {
  return { videoId: "v-test", script: "un deux trois quatre cinq", piste: p.entree, final: { dureeSec: DUREE + 1.6, finVoixSec: 2.7, empreinteVoixMixee: p.entree.empreinte }, depenseAutorisee: true, ...plus };
}
function outils(p: ReturnType<typeof piste>, o: Partial<OutilsEcouteIV> = {}): OutilsEcouteIV & { reservations: string[]; transcriptions: string[] } {
  const reservations: string[] = [];
  const transcriptions: string[] = [];
  return {
    reservations,
    transcriptions,
    pauseRelectureMs: 0,
    lireSon: async () => p.octets,
    transcrire: async (d) => {
      transcriptions.push(d.appelId);
      throw new Error("en panne");
    },
    budget: {
      reserver: async (d) => {
        reservations.push(d.appelId);
        return { ok: true };
      },
    },
    ...o,
  };
}

describe("écoute : panne de transcription", () => {
  it("piste lue, mots horodatés, du son : relancée une fois puis panneTranscription", async () => {
    const p = piste();
    const o = outils(p);
    const r = await ecouterVersionIV(entree(p), o);
    expect(o.transcriptions).toHaveLength(2);
    expect(o.reservations[1]).toMatch(/-reprise$/);
    expect(r.panneTranscription).toBe(true);
    expect(r.q17.ok).toBe(true);
    expect(r.q18).toMatchObject({ ok: false, nonFait: true });
    expect(rmsSurLesMotsIV(await import("@/moteurs/montage-image-video/emprunts").then((x) => x.lireWav(p.octets)), MOTS)).toBeGreaterThan(0.1);
  });

  it("2e réussite : transcription reprise, aucune remarque", async () => {
    const p = piste();
    let n = 0;
    const o = outils(p, {
      transcrire: async () => {
        if (++n === 1) throw new Error("en panne");
        return { mots: MOTS.map((m) => ({ ...m })) };
      },
    });
    const r = await ecouterVersionIV(entree(p), o);
    expect(r.panneTranscription).toBeUndefined();
    expect(r.q18.ok).toBe(true);
  });

  it("piste sans mots horodatés : bloquante, pas de remarque", async () => {
    const p = piste(false, []);
    const r = await ecouterVersionIV(entree(p), outils(p));
    expect(r.panneTranscription).toBeUndefined();
    expect(r.q18).toMatchObject({ ok: false, nonFait: true });
  });

  it("piste muette (aucun son sur les mots) : bloquante, pas de remarque", async () => {
    const p = piste(true);
    const r = await ecouterVersionIV(entree(p), outils(p));
    expect(r.panneTranscription).toBeUndefined();
    expect(r.q18).toMatchObject({ ok: false, nonFait: true });
  });

  it("dépense non autorisée : aucune transcription, jamais de remarque", async () => {
    const p = piste();
    const o = outils(p);
    const r = await ecouterVersionIV(entree(p, { depenseAutorisee: false }), o);
    expect(o.transcriptions).toHaveLength(0);
    expect(r.panneTranscription).toBeUndefined();
    expect(r.q18.nonFait).toBe(true);
  });

  it("réservation refusée au 2e essai : jamais en remarque", async () => {
    const p = piste();
    let n = 0;
    const o = outils(p, { budget: { reserver: async () => (++n === 1 ? { ok: true } : { ok: false, message: "plafond atteint" }) } });
    const r = await ecouterVersionIV(entree(p), o);
    expect(r.panneTranscription).toBeUndefined();
    expect(r.q18.details.join(" ")).toMatch(/plafond atteint/);
  });

  it("empreinte différente après les relectures : bloquante (Q17)", async () => {
    const p = piste();
    const autre = piste(true);
    let lectures = 0;
    const o = outils(p, {
      lireSon: async () => {
        lectures++;
        return autre.octets;
      },
    });
    const r = await ecouterVersionIV(entree(p), o);
    expect(lectures).toBe(4);
    expect(r.q17.ok).toBe(false);
    expect(r.q17.details.join(" ")).toMatch(/empreinte différente/);
    expect(r.panneTranscription).toBeUndefined();
  });

  it("WAV illisible : bloquante", async () => {
    const p = piste();
    const r = await ecouterVersionIV(entree(p), outils(p, { lireSon: async () => new Uint8Array([1, 2, 3]) }));
    expect(r.q17.ok).toBe(false);
    expect(r.panneTranscription).toBeUndefined();
  });

  it("piste relue gratuitement : introuvable deux fois puis trouvée, aucun appel payé en plus", async () => {
    const p = piste();
    let n = 0;
    const o = outils(p, {
      lireSon: async () => (++n <= 2 ? null : p.octets),
      transcrire: async () => ({ mots: MOTS.map((m) => ({ ...m })) }),
    });
    const r = await ecouterVersionIV(entree(p), o);
    expect(n).toBe(3);
    expect(r.q17.ok).toBe(true);
    expect(o.reservations).toHaveLength(1);
  });

  it("transcription lente : l'attente remonte telle quelle (estAttenteIV), sans 2e réservation", async () => {
    const p = piste();
    const o = outils(p, {
      transcrire: async () => {
        throw new RenduEnCoursIV("La transcription");
      },
    });
    const err = await ecouterVersionIV(entree(p), o).catch((x) => x);
    expect(estAttenteIV(err)).toBe(true);
    expect(o.reservations).toHaveLength(1);
  });
});

describe("étapes de fabrication prêtes sans identifiant", () => {
  it("un rendu irrendable sans identifiant : texte seul pour tous les écrans à texte, vidéo prête", async () => {
    const o = outilsSimules(carteA, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande(carteA)), o);
    expect(e.etape).toBe("prete");
    const imposes = Object.values(e.ecransImposesRendu ?? {})[0]!;
    expect(imposes).toEqual(e.script!.fiche.ecrans.filter((x) => x.textesEcran.length).map((x) => x.id));
  });
});
