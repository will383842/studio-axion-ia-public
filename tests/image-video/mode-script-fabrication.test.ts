/**
 * MODE « SCRIPT COMPLET » · le script collé remplace SEULEMENT l'écriture : aucun appel d'écriture, ses mots gardés à
 * l'identique, schéma conçu d'après le texte (simulateur), puis voix, scènes et contrôles comme pour une image. Gratuit.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type DecisionCarteIV, type DecisionScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { roleEcritureImageVideo } from "@/moteurs/montage-image-video/ecriture";
import { ecrireScriptColleIV, ecransDuScript, ficheDuScriptColle } from "@/moteurs/montage-image-video/script-colle";
import { cleDuTexte } from "@/moteurs/montage-image-video/texte/conception";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { appelerConceptionEnSimulation } from "@/moteurs/montage-image-video/texte/simulation";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const SCRIPT =
  "Vingt-trois heures quatorze. Un client vous écrit. Vous dormez, lui attend. Sauf si quelqu'un lui répond tout de suite. Le chatbot lit la demande, puis la réponse part en quatre secondes. Le ticket se ferme tout seul. Un e-mail propre part à la bonne équipe. Une alerte tombe sur Telegram. Le client est prévenu : réponse sous deux heures. Votre client a toujours une réponse.";
const mots = (t: string) => t.split(/\s+/).filter(Boolean);

/** Outils simulés : l'écriture est un piège (elle ne doit JAMAIS être appelée), la conception part du simulateur. */
function outilsScript() {
  const m = monde();
  const base = outilsSimules(carteFixe("C"), m);
  const ecritures: string[] = [];
  const appelerConception = appelerConceptionEnSimulation(lectureDeCarte(carteFixe("C")));
  const o: OutilsFabricationIV = {
    ...base,
    ecriture: {
      ...base.ecriture,
      appeler: async (role, entree) => {
        ecritures.push(role.id);
        return base.ecriture.appeler(role, entree);
      },
    },
    lireImageSource: async () => {
      throw new Error("aucun fichier image n'existe en mode script");
    },
    lecture: {
      convertir: async () => {
        throw new Error("aucune conversion d'image en mode script");
      },
      appeler: async (role, entree) => {
        m.appelsClaude.push({ role: role.id, variable: entree.variable });
        return appelerConception(role, entree);
      },
    },
  };
  return { o, m, ecritures };
}

const demandeScript = (script = SCRIPT) => demandeEssai(carteFixe("C"), { videoId: "v-script", image: { cle: `texte:${cleDuTexte(script)}` }, texte: script, scriptColle: true, plafondCentimes: 5000 });
const decisionCarte = (e: EtatFabricationIV): DecisionCarteIV => ({ proposition: e.propositionCarte!.empreinte, le: "2026-10-27T08:00:00.000Z" });
const decisionScript = (e: EtatFabricationIV): DecisionScriptIV => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

describe("script complet · découpage en écrans, mots inchangés", () => {
  it("les mots dits des écrans, mis bout à bout, sont exactement ceux du script ; six parties dans l'ordre ; accroche courte", () => {
    const fiche = ficheDuScriptColle(SCRIPT, carteFixe("C"));
    expect(mots(fiche.ecrans.map((e) => e.texteDit).join(" "))).toEqual(mots(SCRIPT));
    expect(fiche.ecrans.length).toBeGreaterThanOrEqual(6);
    expect([...new Set(fiche.ecrans.map((e) => e.partie))]).toEqual(["accroche", "douleur", "debut-reponse", "explication", "resultat", "phrase-choc"]);
    expect(fiche.ecrans[0]!.texteDit.split(/\s+/).length).toBeLessThanOrEqual(8);
    // Chaque bloc de la carte est montré.
    const montres = new Set(fiche.ecrans.flatMap((e) => e.refs));
    for (const n of carteFixe("C").noeuds) expect(montres.has(n.id), n.id).toBe(true);
  });

  it("un signe seul (« … », emoji) ne fait jamais un écran muet", () => {
    const t = "Vous dormez. … Lui attend. Il relance chaque semaine sans y penser. Le client paie plus vite maintenant. Vous gagnez du temps chaque jour. Merci. 🚀";
    const ecrans = ecransDuScript(t);
    for (const e of ecrans) expect(e.some((j) => /[\p{L}\p{N}]/u.test(j)), e.join(" ")).toBe(true);
    expect(mots(ecrans.map((x) => x.join(" ")).join(" "))).toEqual(mots(t));
  });

  it("un script très court ou très long garde ses mots (six écrans au moins, soixante au plus)", () => {
    const court = "Un deux trois quatre cinq six sept.";
    expect(ecransDuScript(court).length).toBeGreaterThanOrEqual(6);
    expect(mots(ecransDuScript(court).map((x) => x.join(" ")).join(" "))).toEqual(mots(court));
    const long = Array.from({ length: 300 }, (_, i) => `mot${i}.`).join(" ");
    expect(ecransDuScript(long).length).toBeLessThanOrEqual(60);
    expect(mots(ecransDuScript(long).map((x) => x.join(" ")).join(" "))).toEqual(mots(long));
  });

  it("un chiffre du script absent du schéma est refusé ; un chiffre de l'image non dit ne bloque jamais", () => {
    const carte = carteFixe("C");
    const inventé = ecrireScriptColleIV({ script: `${SCRIPT} Cela fait gagner 45 minutes par jour.`, carte });
    expect(inventé.ok).toBe(false);
    expect(inventé).toMatchObject({ ok: false, motif: "refusee", appels: 0 });
    expect((inventé as { refus: string[] }).refus.join(" ")).toMatch(/45/);
    // Aucun des chiffres de l'image (23h14, 4 sec, 80 %, 2h…) n'est dit : le script passe.
    const sansChiffres = ecrireScriptColleIV({ script: "Un client vous écrit la nuit. Personne ne répond. Le chatbot lit la demande. Il répond tout de suite. Le ticket se ferme. L'équipe est prévenue. Le client repart content.", carte });
    expect(sansChiffres, JSON.stringify(sansChiffres)).toMatchObject({ ok: true, appels: 0 });
  });
});

describe("script complet · la fabrication ne réécrit pas", () => {
  it("script → schéma conçu → carte → script proposé à l'identique, SANS aucun appel d'écriture", async () => {
    const { o, m, ecritures } = outilsScript();
    let e = await avancerJusquAArretIV(etatInitialIV(demandeScript()), o);
    expect(e.etape).toBe("carte-a-valider");
    e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    expect(e.refus, JSON.stringify(e.refus)).toBeUndefined();
    expect(attendWillIV(e)).toBe("script");
    expect(ecritures).toEqual([]);
    expect(m.appelsClaude.map((a) => a.role)).not.toContain(roleEcritureImageVideo.id);
    expect(m.appelsClaude).toHaveLength(1);
    expect(mots(e.propositionScript!.fiche.ecrans.map((x) => x.texteDit).join(" "))).toEqual(mots(SCRIPT));
    expect(e.journal.join("\n")).toMatch(/aucun appel d'écriture/);
  });

  it("de bout en bout : script validé → voix → scènes → rendu → contrôles : la vidéo est prête, mots intacts", async () => {
    const { o, ecritures } = outilsScript();
    let e = await avancerJusquAArretIV(etatInitialIV(demandeScript()), o);
    e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee" && e.attente; i++) e = await avancerJusquAArretIV(e, o);
    expect(e.refus, JSON.stringify(e.refus)).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(ecritures).toEqual([]);
    expect(mots(e.script!.fiche.ecrans.map((x) => x.texteDit).join(" "))).toEqual(mots(SCRIPT));
  });

  it("un chiffre inventé : refus de l'écriture en phrases, aucun appel d'écriture, non réessayable tel quel", async () => {
    const { o, ecritures } = outilsScript();
    let e = await avancerJusquAArretIV(etatInitialIV(demandeScript(`${SCRIPT} Cela fait gagner 45 minutes par jour.`)), o);
    e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.etape).toBe("ecriture");
    expect(e.refus?.reessayable).toBe(false);
    expect(e.refus?.message).toMatch(/45/);
    expect(ecritures).toEqual([]);
  });
});
