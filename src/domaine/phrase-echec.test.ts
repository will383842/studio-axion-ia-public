import { describe, expect, it } from "vitest";
import { phraseDEchec } from "./phrase-echec";

/** Huit messages techniques (anglais, avec faux jeton) → la phrase attendue. Rien du message brut ne doit ressortir. */
const CAS: { nom: string; message: string; definitive: boolean; outil?: string; attendu: string }[] = [
  { nom: "crédit épuisé", message: "402 Payment Required: insufficient credit, token=sk_test_abcdefghijklmnop0123", definitive: true, outil: "HeyGen", attendu: "HeyGen : crédit épuisé. Rechargez le compte, puis réessayez." },
  { nom: "clé refusée", message: "401 Unauthorized: invalid api key Bearer abcdefghijklmnop0123456789", definitive: true, outil: "fal.ai", attendu: "fal.ai : clé refusée. Vérifiez-la dans Réglages > Connexions, puis réessayez." },
  { nom: "modération", message: "Request blocked by content policy (moderation) https://api.exemple.test/v1/x?token=abcdef0123456789", definitive: true, outil: "HeyGen", attendu: "HeyGen : contenu refusé par la modération. Modifiez le texte ou l'image, puis réessayez." },
  { nom: "résultat vide", message: "Job done but empty output, key=AKIAABCDEFGHIJKLMNOP", definitive: true, outil: "ElevenLabs", attendu: "ElevenLabs : résultat vide. Réessayez." },
  { nom: "délai dépassé", message: "The operation timed out after 60000ms; token=ghp_abcdefghijklmnopqrstuvwxyz0123", definitive: true, outil: "HeyGen", attendu: "HeyGen : délai dépassé. Réessayez dans un instant." },
  { nom: "service indisponible", message: "503 Service Unavailable from https://api.exemple.test/render?sig=abcdef0123456789", definitive: true, outil: "HeyGen", attendu: "HeyGen : service indisponible. Réessayez dans un instant." },
  { nom: "inconnu, refus", message: "weird failure xyz token=abcdefghijklmnopqrstuvwxyz0123", definitive: true, outil: "HeyGen", attendu: "HeyGen : cet outil a refusé cette étape. Vous pouvez réessayer." },
  { nom: "inconnu, outil inconnu", message: "weird failure xyz", definitive: true, attendu: "Un outil a refusé cette étape. Vous pouvez réessayer." },
];

describe("phraseDEchec", () => {
  for (const c of CAS) {
    it(`${c.nom} → phrase de la liste fermée, sans jeton ni adresse`, () => {
      const p = phraseDEchec({ outil: c.outil, message: c.message, definitive: c.definitive });
      expect(p).toBe(c.attendu);
      expect(p).not.toMatch(/token|sk_|ghp_|AKIA|Bearer|https?:|abcdef/i);
    });
  }

  it("panne non définitive (24 h) : nomme l'outil, garde la durée", () => {
    expect(phraseDEchec({ outil: "HeyGen", message: "503 Service Unavailable", definitive: false })).toBe("HeyGen : resté indisponible pendant 24 h. Vous pouvez réessayer.");
    expect(phraseDEchec({ message: "boom", definitive: false })).toBe("Un outil est resté indisponible pendant 24 h. Vous pouvez réessayer.");
  });

  it("un nom d'outil qui ressemble à un secret n'est jamais recopié", () => {
    const p = phraseDEchec({ outil: "https://x.test/?token=abcdefghijklmnop", message: "zzz", definitive: true });
    expect(p).toBe("Un outil a refusé cette étape. Vous pouvez réessayer.");
  });

  it("aucun montant dans les phrases", () => {
    for (const c of CAS) expect(phraseDEchec({ outil: c.outil, message: c.message, definitive: c.definitive })).not.toMatch(/[€$]|\d+\s?(?:eur|usd)/i);
  });
});
