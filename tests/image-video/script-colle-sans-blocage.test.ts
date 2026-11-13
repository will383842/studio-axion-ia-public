/**
 * SCRIPT COLLÉ sans blocage : le texte de Will fait foi (remarques au lieu de refus).
 * B1 plafond de mots, B2 vidéo longue livrée, B3 chiffres, B4 interdits et phrases d'appel, C3 prix, M2 contrôle chiffres.
 */
import { describe, expect, it, vi } from "vitest";
import { ecrireScriptColleIV } from "@/moteurs/montage-image-video/script-colle";
import { SCRIPT_CARACTERES_MAX, SCRIPT_MOTS_MAX, refusScriptColle } from "@/moteurs/montage-image-video/texte/script-limites";
import { verdictReseau } from "@/moteurs/montage-image-video/reseaux";
import { dureeCibleDuScript } from "@/services/image-video-ecran";
import { ajouterIV } from "@/domaine/image-video/reserve";
import { avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { cleDuTexte, concevoirWorkflow } from "@/moteurs/montage-image-video/texte/conception";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { appelerConceptionEnSimulation, CONCEPTION_VIDE } from "@/moteurs/montage-image-video/texte/simulation";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const BASE =
  "Un client vous écrit la nuit. Personne ne répond. Le chatbot lit la demande. Il répond tout de suite. Le ticket se ferme. L'équipe est prévenue. Le client repart content.";
const carte = carteFixe("C");
const refusDe = (r: ReturnType<typeof ecrireScriptColleIV>) => (r.ok ? [] : (r as { refus?: string[] }).refus ?? []);

describe("B1 · plafond de mots", () => {
  it("450 mots au plus, sous la borne de caractères ; 380 mots acceptés, 460 refusés", () => {
    expect(SCRIPT_MOTS_MAX).toBe(450);
    expect(SCRIPT_MOTS_MAX * 8).toBeGreaterThan(0);
    const de = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
    expect(de(380).length).toBeLessThan(SCRIPT_CARACTERES_MAX);
    expect(refusScriptColle(de(380))).toBeNull();
    expect(refusScriptColle(de(450))).toBeNull();
    expect(refusScriptColle(de(460))?.motif).toBe("script-trop-long");
  });
  it("la réserve garde un script de 380 mots comme script (pas une idée réécrite)", () => {
    const texte = Array.from({ length: 380 }, () => "mot").join(" ");
    const r = ajouterIV({ elements: [] } as never, { nature: "script", texte, reseaux: ["linkedin"] }, "id1", "2026-11-11");
    expect(r.ok && r.element.nature).toBe("script");
  });
});

describe("B2 · vidéo longue livrée en script collé", () => {
  it("sans version courte : mention (longue) au lieu de « aucune », sauf Facebook au-delà de 180 s", () => {
    for (const r of ["youtube-shorts", "linkedin", "instagram"] as const) {
      expect(verdictReseau(r, 140, null, true), r).toMatchObject({ verdict: "mention", version: "longue", bloquant: false });
      expect(verdictReseau(r, 140, null, false), r).toMatchObject({ version: "aucune", bloquant: true });
    }
    expect(verdictReseau("facebook", 140, null, true)).toMatchObject({ verdict: "mention", version: "longue", bloquant: false });
    expect(verdictReseau("facebook", 190, null, true)).toMatchObject({ verdict: "non-livree", version: "aucune", bloquant: true });
    expect(verdictReseau("linkedin", 50, null, true)).toMatchObject({ verdict: "livree", version: "longue" });
  });
});

describe("B3 · chiffres du script", () => {
  it.each(["Vous recevez douze devis par semaine.", "En 2026, tout change.", "Vous gagnez 30 % de temps."])("« %s » n'est pas refusé", (phrase) => {
    const r = ecrireScriptColleIV({ script: `${BASE} ${phrase}`, carte });
    expect(r, JSON.stringify(refusDe(r))).toMatchObject({ ok: true, appels: 0 });
  });
});

describe("B4 · interdits et phrases d'appel", () => {
  it.each([
    "Le lien est en commentaire.",
    "Abonnez-vous pour la suite.",
    "Notre client a gagné du temps.",
    "Cette machine répond seule.",
    "Le lien entre vos outils se fait seul.",
  ])("« %s » ne bloque plus", (phrase) => {
    const r = ecrireScriptColleIV({ script: `${BASE} ${phrase}`, carte });
    expect(r, JSON.stringify(refusDe(r))).toMatchObject({ ok: true, appels: 0 });
  });
  it("un mot interdit de Will (liste de marque) bloque toujours", () => {
    const r = ecrireScriptColleIV({ script: `${BASE} Une solution certifiée.`, carte });
    expect(r.ok).toBe(false);
  });
});

describe("C3 · durée cible du prix", () => {
  it("mots / 3,3, bornée à 180 s", () => {
    expect(dureeCibleDuScript(165)).toBe(50);
    expect(dureeCibleDuScript(380)).toBe(116);
    expect(dureeCibleDuScript(450)).toBe(137);
    expect(dureeCibleDuScript(5000)).toBe(180);
  });
});

describe("B2 de bout en bout · script de 380 mots livré sur les réseaux", () => {
  it("YouTube Shorts, LinkedIn et Instagram reçoivent un fichier", async () => {
    const phrases = Array.from({ length: 54 }, (_, i) => `${BASE.split(". ")[i % 7]!.replace(/\.$/, "")}.`);
    const script = phrases.join(" ");
    const m = monde();
    const base = outilsSimules(carte, m);
    const appelerConception = appelerConceptionEnSimulation(lectureDeCarte(carte));
    const o: OutilsFabricationIV = {
      ...base,
      lireImageSource: async () => {
        throw new Error("aucun fichier image en mode script");
      },
      lecture: { convertir: async () => { throw new Error("aucune conversion"); }, appeler: async (role, entree) => appelerConception(role, entree) },
    };
    const demande = { ...demandeEssai(carte, { videoId: "v-long", image: { cle: `texte:${cleDuTexte(script)}` }, texte: script, scriptColle: true, plafondCentimes: 50000 }), reseaux: ["youtube-shorts", "linkedin", "instagram"] as never };
    let e: EtatFabricationIV = await avancerJusquAArretIV(etatInitialIV(demande), o);
    e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-27T08:00:00.000Z" }), o);
    e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee" && e.attente; i++) e = await avancerJusquAArretIV(e, o);
    expect(e.refus, JSON.stringify(e.refus)).toBeUndefined();
    expect(e.etape).toBe("prete");
    for (const r of ["youtube-shorts", "linkedin", "instagram"]) {
      const l = (e.livraison as { reseau: string; fichierCle?: string }[]).find((x) => x.reseau === r);
      expect(l?.fichierCle, r).toBeTruthy();
    }
  });
});

describe("GV2-19 · script sans automatisation en mode script", () => {
  const CONSEILS = "Dormez huit heures chaque nuit. Marchez vingt minutes tous les jours. Buvez de l'eau avant chaque repas. Coupez les écrans le soir. Ces trois conseils changent tout.";
  const budget = { reserver: async () => ({ ok: true as const }) };
  it("pas de refus « hors-sujet » : carte minimale faite des phrases du script (5 étapes au plus)", async () => {
    const r = await concevoirWorkflow({ videoId: "v-conseils", texte: CONSEILS, scriptColle: true }, { appeler: appelerConceptionEnSimulation(CONCEPTION_VIDE), budget });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.appels).toBe(1);
    expect(r.carte.noeuds.length).toBeGreaterThanOrEqual(3);
    expect(r.carte.noeuds.length).toBeLessThanOrEqual(5);
  });
  it("hors mode script, le refus actuel est gardé", async () => {
    const r = await concevoirWorkflow({ videoId: "v-idee", texte: CONSEILS }, { appeler: appelerConceptionEnSimulation(CONCEPTION_VIDE), budget });
    expect(r).toMatchObject({ ok: false, motif: "hors-sujet" });
  });
});

describe("GV2-19 · branchement du script collé dans la fabrication (piste d)", () => {
  const CONSEILS = "Dormez huit heures chaque nuit. Marchez vingt minutes tous les jours. Buvez de l'eau avant chaque repas. Coupez les écrans le soir. Ces trois conseils changent tout.";
  it("un script de conseils en mode script n'est plus refusé : carte proposée, puis prête après validation, un seul appel de lecture", async () => {
    const m = monde();
    const base = outilsSimules(carte, m);
    const appelerConception = appelerConceptionEnSimulation(CONCEPTION_VIDE);
    let appels = 0;
    const o: OutilsFabricationIV = {
      ...base,
      lireImageSource: async () => {
        throw new Error("aucun fichier image en mode script");
      },
      lecture: { convertir: async () => { throw new Error("aucune conversion"); }, appeler: async (role, entree) => { appels++; return appelerConception(role, entree); } },
    };
    const demande = demandeEssai(carte, { videoId: "v-conseils-bout", image: { cle: `texte:${cleDuTexte(CONSEILS)}` }, texte: CONSEILS, scriptColle: true, plafondCentimes: 50000 });
    let e: EtatFabricationIV = await avancerJusquAArretIV(etatInitialIV(demande), o);
    expect(e.refus, JSON.stringify(e.refus)).toBeUndefined();
    expect(e.propositionCarte).toBeDefined();
    e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-27T08:00:00.000Z" }), o);
    e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee" && e.attente; i++) e = await avancerJusquAArretIV(e, o);
    expect(e.refus, JSON.stringify(e.refus)).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(appels).toBe(1);
  });
});
