/**
 * T-EXT-12 · Pilote vidéo 05 Stocks : script court collé, scénario, données gardées, commande prête (éteinte).
 * Aucun appel (Claude, HeyGen), aucun navigateur, aucune voix : tout est lu sur disque ; les instants de mots sont FICTIFS
 * (1 mot = 0,4 s), écrits ici, jamais présentés comme une mesure.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { garderChiffres } from "../../../src/briques/donnees-video/garde-chiffres";
import { lireTableauDeBord } from "../../../src/briques/donnees-video/types";
import { calerScenario } from "../../../src/moteurs/montage-tutoriel-outil/calage-scenario";
import { lireEntreesTutoriel } from "../../../src/moteurs/montage-tutoriel-outil/entrees";
import { DUREE_CIBLE_SEC } from "../../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { MotTutoriel } from "../../../src/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { lireScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/05-stocks");
const lire = (n: string) => readFileSync(join(DOSSIER, n), "utf8");
const FICHIERS_PILOTE = ["script-court.txt", "scenario.json", "donnees.json", "commande-pilote.json"];

/** Empreinte du texte de Williams (à valider par Williams) : toute retouche, même typographique, la change. */
const SHA256_SCRIPT = "5c0fc598e8104e3e49122dcbf3895a37cefbf704d443f7014d01ecf0a256ad9b";
const IDS_PORTE = ["alerte", "seuil", "analyse", "proposition", "validation", "fin"];
/** Statut du script : écrit ici et dans la commande, pas dans le fichier. */
const STATUT_SCRIPT = "à valider par Williams";

const script = lire("script-court.txt");
const commande = JSON.parse(lire("commande-pilote.json")) as { etat: string; lancer: boolean; format: string; maquette: string; scenario: string; ratios: string[]; musique: boolean; motCle: string; script: { texteComplet: string }; entrees: Record<string, unknown> };
const paragraphes = script.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);

function motsFictifs(texte: string): MotTutoriel[] {
  return texte
    .split(/\s+/)
    .filter((m) => m.length > 0)
    .map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 }));
}

describe("pilote 05 · script court", () => {
  it("est la copie exacte du texte de Williams (sha256, 777 octets, 114 jetons)", () => {
    expect(createHash("sha256").update(readFileSync(join(DOSSIER, "script-court.txt"))).digest("hex")).toBe(SHA256_SCRIPT);
    expect(readFileSync(join(DOSSIER, "script-court.txt")).length).toBe(777);
    // La fiche annonce 111 mots : elle ne compte pas les 3 guillemets « » isolés ; 114 jetons séparés par des espaces.
    expect(script.split(/\s+/).filter(Boolean)).toHaveLength(114);
    expect(STATUT_SCRIPT).toBe("à valider par Williams");
  });

  it("compte 6 paragraphes, un par étape du scénario", () => {
    expect(paragraphes).toHaveLength(6);
  });

  it("est repris tel quel dans la commande, sans statut ajouté au texte", () => {
    expect(commande.script.texteComplet).toBe(script);
    expect(script).not.toMatch(/à valider/i);
  });
});

describe("pilote 05 · scénario", () => {
  const lecture = lireScenarioMaquette(JSON.parse(lire("scenario.json")));

  it("est lu sans erreur, 1080 × 1350, étapes de la porte de la maquette", () => {
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.scenario.maquette).toBe("05-stocks");
    expect([lecture.scenario.largeur, lecture.scenario.hauteur]).toEqual([1080, 1350]);
    expect(lecture.scenario.etapes.map((e) => e.id)).toEqual(IDS_PORTE);
    expect(lecture.scenario.etapes.map((e) => e.aller)).toEqual(IDS_PORTE);
    expect(lecture.scenario.etapes.map((e) => e.role)).toEqual(["accroche", "probleme", "parcours", "mise-en-garde", "bonne-pratique", "appel"]);
  });

  it("vise des éléments qui existent dans index.html ou app.js", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const source = `${lire("index.html")}\n${lire("app.js")}`;
    for (const e of lecture.scenario.etapes) {
      expect(e.cible, e.id).toBeTruthy();
      const cible = e.cible!;
      for (const [, classe] of cible.matchAll(/\.([A-Za-z][\w-]*)/g)) expect(source, `${e.id} .${classe}`).toContain(classe!);
      for (const [, id] of cible.matchAll(/#([A-Za-z][\w-]*)/g)) expect(source, `${e.id} #${id}`).toMatch(new RegExp(`id=["']${id}["']|id=${id}\\b|#${id}\\b`));
      for (const [, balise] of cible.matchAll(/(?:^|[\s>])([a-z][a-z0-9]*)(?=[.#:\s]|$)/g)) expect(source, `${e.id} <${balise}>`).toContain(`<${balise}`);
    }
  });

  it("ancre chaque étape sur un mot présent du script, dans l'ordre des paragraphes", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const ancres = lecture.scenario.etapes.map((e) => ("surMot" in e.ancre ? e.ancre.surMot : ""));
    expect(ancres).toEqual(["Votre", "produit", "rapproche", "propose", "responsable", "Commentez"]);
    ancres.forEach((mot, i) => expect(paragraphes[i]).toContain(mot));
  });

  it("se cale sur des mots FICTIFS : 6 étapes, aucune ancre manquante, durée dans DUREE_CIBLE_SEC", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const mots = motsFictifs(script);
    const dureeMs = Math.round(mots[mots.length - 1]!.finSec * 1000);
    const r = calerScenario(lecture.scenario, mots, dureeMs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etapes).toHaveLength(6);
    expect(r.etapes.map((e) => e.id)).toEqual(IDS_PORTE);
    r.etapes.forEach((e, i) => {
      expect(e.finMs).toBeGreaterThan(e.debutMs);
      if (i > 0) expect(e.debutMs).toBeGreaterThanOrEqual(r.etapes[i - 1]!.debutMs);
    });
    // Ces instants sont fictifs : la durée cible (T-EXT-18) n'est qu'un repère, jamais un refus.
    expect(dureeMs / 1000).toBeGreaterThanOrEqual(DUREE_CIBLE_SEC[0]);
    expect(dureeMs / 1000).toBeLessThanOrEqual(DUREE_CIBLE_SEC[1]);
  });
});

describe("pilote 05 · données gardées", () => {
  const lecture = lireTableauDeBord(JSON.parse(lire("donnees.json")));
  const lectureScenario = lireScenarioMaquette(JSON.parse(lire("scenario.json")));

  it("est un tableau-de-bord.v1 valide, source « exemple », sans montant", () => {
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.donnee.source).toMatch(/exemple/i);
    expect(lecture.donnee.calculs.map((c) => c.id)).toEqual(["sorties-7-jours", "couverture"]);
  });

  it("garde tous les textes d'écran et les paragraphes 1 à 5 : aucun nombre hors donnée", () => {
    if (!lecture.ok || !lectureScenario.ok) throw new Error("lecture impossible");
    const textesEcran = lectureScenario.scenario.etapes.flatMap((e) => e.textesEcran ?? []);
    expect(textesEcran.length).toBeGreaterThan(0);
    const v = garderChiffres(lecture.donnee, { textesEcran, texteDit: paragraphes.slice(0, 5).join("\n\n") });
    expect(v.horsDonnee).toEqual([]);
    expect(v.erreurs).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("contrôle le paragraphe 6 à part : identique au texte de Williams (le guide et le Diagnostic ne sont pas des données)", () => {
    if (!lecture.ok) throw new Error("lecture impossible");
    expect(paragraphes[5]).toBe(
      "Commentez « STOCK » pour recevoir « Les 12 automatisations pour mieux gérer ses stocks ». Vous pouvez aussi demander un Diagnostic IA gratuit de 45 minutes pour identifier les premières priorités.",
    );
    expect(commande.script.texteComplet.trim().endsWith(paragraphes[5]!)).toBe(true);
    const v = garderChiffres(lecture.donnee, { textesEcran: [], texteDit: paragraphes[5] });
    expect(v.horsDonnee.map((n) => n.valeur).sort((a, b) => a - b)).toEqual([12, 45]);
  });
});

describe("pilote 05 · commande prête, éteinte", () => {
  it("attend le oui de Williams et ne lance rien", () => {
    expect(commande.etat).toBe("attend-oui-williams");
    expect(commande.lancer).toBe(false);
    expect(commande.format).toBe("tutoriel-outil");
    expect(commande.maquette).toBe("05-stocks");
    expect(commande.scenario).toBe("scenario.json");
    expect(commande.ratios).toEqual(["4:5", "9:16", "1:1"]);
    expect(commande.musique).toBe(false);
    expect(commande.motCle).toBe("STOCK");
  });

  it("est lue par lireEntreesTutoriel comme un script collé", () => {
    expect(lireEntreesTutoriel(commande.entrees)).toEqual({ scriptColle: true });
  });

  it("ne contient aucun montant (€) dans les 4 fichiers", () => {
    for (const f of FICHIERS_PILOTE) expect(lire(f), f).not.toContain("€");
  });

  it("n'emploie ni étiquette interdite, ni marque, ni courriel dans les fichiers de données", () => {
    for (const f of ["scenario.json", "donnees.json", "commande-pilote.json"]) {
      const t = lire(f);
      expect(t, f).not.toMatch(/Douleur|Solution|Exemple\s*:|À vous|@/);
    }
  });
});
