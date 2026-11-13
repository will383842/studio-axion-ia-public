/**
 * SCRIPT COLLÉ découpé au sens (GV2-19) : coupes aux fins de phrase et aux signes, jamais sur un mot outil,
 * phrase-choc = dernière vraie phrase ; les mots dits restent EXACTEMENT ceux du script.
 */
import { describe, expect, it } from "vitest";
import { ecransDuScript, ficheDuScriptColle } from "@/moteurs/montage-image-video/script-colle";
import { carteFixe } from "./doubles-fabrication";

const MOTS_OUTILS = new Set(["le", "la", "les", "de", "des", "du", "un", "une", "dans", "à", "au", "en"]);
const mots = (jetons: readonly string[]) => jetons.join(" ").split(/\s+/).filter(Boolean);
const dernierMot = (jetons: readonly string[]) => mots(jetons).at(-1)!.replace(/[^\p{L}\p{N}]+$/u, "").toLowerCase();

const SONDE =
  "Chaque lundi, Claire passe une heure à recopier les commandes du week-end dans le tableur parce que personne n'a pris le temps de brancher les deux outils. Ça coûte cher. Voici comment on règle ça. Premier réflexe : on liste les tâches répétitives. Ensuite on branche l'outil qui les fait seul. Et vous récupérez vos lundis. Maintenant.";

describe("découpage au sens", () => {
  it("la phrase de la sonde n'est plus coupée entre « dans le » et « tableur »", () => {
    const ecrans = ecransDuScript(SONDE).map((j) => j.join(" "));
    expect(ecrans.some((t) => /dans le$/.test(t))).toBe(false);
    expect(ecrans.some((t) => /^tableur/.test(t))).toBe(false);
  });

  it("aucun écran ne finit par un mot outil (sauf mot-outil qui finit sa phrase)", () => {
    const longue = "Quand une commande arrive par le site de la boutique, le système la recopie automatiquement dans le tableur de suivi et prévient ensuite l'équipe de la livraison dans une application. Le soir, un résumé part avec les chiffres de la journée pour le responsable du service. Voilà.";
    for (const s of [SONDE, longue]) {
      for (const e of ecransDuScript(s)) expect(MOTS_OUTILS.has(dernierMot(e)), e.join(" ")).toBe(false);
    }
  });

  it("les mots, mis bout à bout, sont exactement ceux du script", () => {
    for (const s of [SONDE, "Un. Deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept, dix-huit et dix-neuf vingt. Merci"]) {
      expect(ecransDuScript(s).flatMap(mots)).toEqual(s.normalize("NFC").split(/\s+/).filter(Boolean));
    }
  });
});

describe("phrase-choc", () => {
  it("« … Maintenant. Merci » : la phrase-choc n'est pas « Merci »", () => {
    const script = "Vous perdez des heures chaque semaine. Le tableur se remplit à la main. Les erreurs s'accumulent. On peut tout brancher en une après-midi. Vos équipes respirent enfin. Faites-le dès aujourd'hui. Maintenant. Merci";
    const fiche = ficheDuScriptColle(script, carteFixe("C"));
    const choc = fiche.ecrans.find((e) => e.partie === "phrase-choc")!;
    expect(choc.texteDit).not.toBe("Merci");
    expect(choc.texteDit).toContain("Maintenant.");
    expect(fiche.ecrans.flatMap((e) => e.texteDit.split(/\s+/))).toEqual(script.split(/\s+/));
  });

  it("sans phrase de plus de 2 mots, comportement d'aujourd'hui (dernier écran)", () => {
    const fiche = ficheDuScriptColle("Oui. Non. Peut-être. Bien sûr. Allez. Merci.", carteFixe("C"));
    expect(fiche.ecrans.at(-1)!.partie).toBe("phrase-choc");
  });
});
