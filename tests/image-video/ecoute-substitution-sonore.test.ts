/**
 * Faux positif du contrôle « Écoute » (Q18) : la voix dit bien « chatbot IA » et « chatbot », mais Whisper écrit
 * « chat de Bottia » et « chat de votre ». Trois mots entendus sans correspondance dans le script suffisaient à refuser.
 * Une substitution SONORE (même suite de sons, même place dans le script) n'est plus un ajout bloquant ; les mots
 * restent des manques (donc comptés dans les 97 %). Aucun seuil n'est assoupli.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { texteDuCorps } from "@/domaine/image-video/fiche";
import { cleSonore, comparerAuScript, SEUILS_ECOUTE_IV, transcriptionUtile } from "@/moteurs/montage-image-video/ecoute";

interface Mot { mot: string; debutSec: number; finSec: number }
interface Piste { version: string; finVoixSec: number; fin: { muet?: boolean; question?: { dit?: string }; appels: { dit: string }[] }; transcription: Mot[] }
const FIXTURE = JSON.parse(readFileSync(join(__dirname, "fixtures", "ecoute-substitution-sonore.json"), "utf8")) as { fiche: Parameters<typeof texteDuCorps>[0]; pistes: Piste[] };

const scriptDe = (p: Piste): string => {
  const fin = p.fin && !p.fin.muet ? [p.fin.question?.dit ?? "", ...p.fin.appels.map((a) => a.dit)] : [];
  return [texteDuCorps(FIXTURE.fiche), ...fin].map((t) => t.trim()).filter(Boolean).join(" ");
};

const analyser = (p: Piste, transcription: Mot[] = p.transcription) => {
  const script = scriptDe(p);
  const u = transcriptionUtile(transcription, { finVoixSec: p.finVoixSec, script });
  return comparerAuScript(script, u.mots);
};
const bloquants = (c: ReturnType<typeof comparerAuScript>) => c.ajouts.filter((a) => a.mots > SEUILS_ECOUTE_IV.ajoutConsecutifMax && !a.remplace);

/** Remplace « avant » (suite de mots exacte) par « apres » dans la transcription ; échoue si la suite est absente. */
const remplacer = (l: Mot[], avant: string[], apres: string[]): Mot[] => {
  const sortie: Mot[] = [];
  let trouve = false;
  for (let i = 0; i < l.length; i++) {
    if (avant.every((m, k) => l[i + k]?.mot === m)) {
      trouve = true;
      apres.forEach((m, k) => sortie.push({ mot: m, debutSec: l[i].debutSec + k * 0.1, finSec: l[i].debutSec + k * 0.1 + 0.1 }));
      i += avant.length - 1;
    } else sortie.push(l[i]);
  }
  expect(trouve).toBe(true);
  return sortie;
};

describe("Écoute : substitution sonore (chatbot entendu « chat de Bottia »)", () => {
  it("garde-fou : seuils inchangés (97 %, 2 mots d'ajout)", () => {
    expect(SEUILS_ECOUTE_IV.retrouvesMin).toBe(0.97);
    expect(SEUILS_ECOUTE_IV.ajoutConsecutifMax).toBe(2);
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : aucun ajout bloquant, 97 % atteints, les manques restent comptés", (_v, p) => {
    const c = analyser(p);
    expect(bloquants(c)).toEqual([]);
    expect(c.part).toBeGreaterThanOrEqual(0.97);
    expect(c.manques).toContain("chatbot ia");
    expect(c.manques).toContain("chatbot");
    // Les deux substitutions sont signalées comme telles, avec le texte du script.
    expect(c.ajouts.filter((a) => a.remplace).map((a) => a.remplace)).toEqual(expect.arrayContaining(["chatbot ia", "chatbot"]));
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : garde de taille : « chatbot » entendu « chat de mon équipe » (4 mots) reste bloquant", (_v, p) => {
    const c = analyser(p, remplacer(p.transcription, ["chat", "de", "votre"], ["chat", "de", "mon", "équipe"]));
    expect(bloquants(c).map((a) => a.texte)).toContain("chat de mon équipe");
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : garde d'écart : « chatbot » entendu « chat de mon » (3 mots, écart sonore trop grand) reste bloquant", (_v, p) => {
    const c = analyser(p, remplacer(p.transcription, ["chat", "de", "votre"], ["chat", "de", "mon"]));
    expect(bloquants(c).map((a) => a.texte)).toContain("chat de mon");
  });

  it.each(FIXTURE.pistes.map((p) => [p.version, p] as const))("%s : « chatbot ia » entendu « concurrent humain » (écart 0,85) reste bloquant", (_v, p) => {
    const c = analyser(p, remplacer(p.transcription, ["chat", "de", "Bottia"], ["concurrent", "humain", "ici"]));
    expect(bloquants(c).map((a) => a.texte)).toContain("concurrent humain ici");
  });
});

describe("comparerAuScript : règle de substitution sonore, sans fixture", () => {
  const dit = (phrase: string) => phrase.split(" ").map((m, i) => ({ mot: m, debutSec: i, finSec: i + 0.5 }));
  const ajoutsDe = (script: string, entendu: string) => comparerAuScript(script, dit(entendu)).ajouts;

  it("un nombre entendu dans le groupe (« deux ») l'empêche d'être une substitution", () => {
    const a = ajoutsDe("Le chatbot répond.", "Le chat deux bot répond.");
    expect(a).toHaveLength(1);
    expect(a[0].remplace).toBeUndefined();
  });
  it("un nombre à trait d'union (« quatre-vingts ») l'empêche aussi", () => {
    const a = ajoutsDe("Le chatbot répond.", "Le chat quatre-vingts bot répond.");
    expect(a.every((x) => x.remplace === undefined)).toBe(true);
  });
  it("la substitution est reconnue au milieu, en tête et en fin de texte", () => {
    expect(ajoutsDe("Le chatbot répond.", "Le chat de bot répond.")[0].remplace).toBe("chatbot");
    expect(ajoutsDe("Chatbot répond ici.", "Chat de bot répond ici.")[0].remplace).toBe("chatbot");
    expect(ajoutsDe("Il parle au chatbot.", "Il parle au chat de bot.")[0].remplace).toBe("chatbot");
  });
  it("un groupe suivi de mots en trop après la fin n'est pas une substitution (trop long)", () => {
    const a = ajoutsDe("Il parle au chatbot.", "Il parle au chat de bot ensuite merci.");
    expect(a.every((x) => x.remplace === undefined)).toBe(true);
  });
  it("écart sonore : 0,30 passe, 0,40 ne passe pas", () => {
    expect(ajoutsDe("Voici monsalbino ici.", "Voici monsalbamu ici.")[0].remplace).toBe("monsalbino");
    expect(ajoutsDe("Voici monsalbino ici.", "Voici monsaltamu ici.")[0].remplace).toBeUndefined();
  });
});

describe("cleSonore : clé sonore pure", () => {
  it("rapproche les graphies proches", () => {
    expect(cleSonore("Télégram")).toBe(cleSonore("télégramme"));
  });
  it("retire accents, ponctuation et chiffres", () => {
    expect(cleSonore("É-té 12!")).toBe(cleSonore("ete"));
  });
});
