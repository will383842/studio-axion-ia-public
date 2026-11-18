/**
 * T-EXT-13 · Pilote vidéo 07 Tâches : script court collé, scénario, données gardées, commande prête (éteinte).
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
import { DUREE_CIBLE_SEC, type FinChoisie } from "../../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { MotTutoriel } from "../../../src/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { lireScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/07-taches");
const lire = (n: string) => readFileSync(join(DOSSIER, n), "utf8");
const FICHIERS_PILOTE = ["script-court.txt", "scenario.json", "donnees.json", "commande-pilote.json"];

/** Empreinte du texte de Williams (à valider par Williams) : toute retouche, même typographique, la change. */
const SHA256_SCRIPT = "889d37778dbdd7fc6f292312a0c6cefc4d5afbeaa262fbf064a6ae821fc2c39c";
const IDS_PORTE = ["taches", "ensemble", "reponse", "relance", "recherche", "controle", "fin"];
const IDS_ETAPES = ["accroche", "eparpille", "ensemble", "reponse", "relance", "recherche", "controle", "fin"];
/** Statut du script : écrit ici et dans la commande, pas dans le fichier. */
const STATUT_SCRIPT = "à valider par Williams";

const script = lire("script-court.txt");
const commande = JSON.parse(lire("commande-pilote.json")) as { etat: string; lancer: boolean; format: string; maquette: string; scenario: string; ratios: string[]; musique: boolean; fin: string; motCle?: string; script: { texteComplet: string }; entrees: Record<string, unknown> };
const paragraphes = script.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);

function motsFictifs(texte: string): MotTutoriel[] {
  return texte
    .split(/\s+/)
    .filter((m) => m.length > 0)
    .map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 }));
}

describe("pilote 07 · script court", () => {
  it("est la copie exacte du texte de Williams (sha256, 758 octets, 116 jetons)", () => {
    expect(createHash("sha256").update(readFileSync(join(DOSSIER, "script-court.txt"))).digest("hex")).toBe(SHA256_SCRIPT);
    expect(readFileSync(join(DOSSIER, "script-court.txt")).length).toBe(758);
    // La fiche annonce 112 mots : elle ne compte pas les 4 guillemets « » isolés ; 116 jetons séparés par des espaces.
    expect(script.split(/\s+/).filter(Boolean)).toHaveLength(116);
    expect(STATUT_SCRIPT).toBe("à valider par Williams");
  });

  it("compte 6 paragraphes", () => {
    expect(paragraphes).toHaveLength(6);
  });

  it("est repris tel quel dans la commande, sans statut ajouté au texte", () => {
    expect(commande.script.texteComplet).toBe(script);
    expect(script).not.toMatch(/à valider/i);
  });
});

describe("pilote 07 · scénario", () => {
  const lecture = lireScenarioMaquette(JSON.parse(lire("scenario.json")));

  it("est lu sans erreur, 1080 × 1350, 8 étapes dont chaque « aller » est une étape de la porte", () => {
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.scenario.maquette).toBe("07-taches");
    expect([lecture.scenario.largeur, lecture.scenario.hauteur]).toEqual([1080, 1350]);
    expect(lecture.scenario.etapes.map((e) => e.id)).toEqual(IDS_ETAPES);
    for (const e of lecture.scenario.etapes) expect(IDS_PORTE, e.id).toContain(e.aller);
    expect(lecture.scenario.etapes.map((e) => e.role)).toEqual(["accroche", "probleme", "parcours", "parcours", "parcours", "parcours", "mise-en-garde", "appel"]);
  });

  it("les « aller » correspondent à la porte déclarée par index.html", () => {
    const index = lire("index.html");
    for (const id of IDS_PORTE) expect(index, id).toMatch(new RegExp(`\\b${id}\\s*:\\s*\\{`));
  });

  it("vise des éléments qui existent dans index.html", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const source = lire("index.html");
    for (const e of lecture.scenario.etapes) {
      expect(e.cible, e.id).toBeTruthy();
      expect([".kpis", ".cols", ".panel", ".table", ".blocksp"], e.id).toContain(e.cible);
      for (const [, classe] of e.cible!.matchAll(/\.([A-Za-z][\w-]*)/g)) expect(source, `${e.id} .${classe}`).toContain(classe!);
    }
  });

  it("ancre chaque étape sur un mot présent du script, dans l'ordre des paragraphes", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const ancres = lecture.scenario.etapes.map((e) => ("surMot" in e.ancre ? e.ancre.surMot : ""));
    expect(ancres).toEqual(["petites", "dispersent", "rassemble", "réponse", "relance", "retrouver", "vérifiée", "Pour"]);
    const paragrapheDe = [0, 1, 2, 3, 3, 3, 4, 5];
    ancres.forEach((mot, i) => expect(paragraphes[paragrapheDe[i]!], mot).toContain(mot));
  });

  it("se cale sur des mots FICTIFS : 8 étapes, aucune ancre manquante, durée signalée sans refus", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    const mots = motsFictifs(script);
    const dureeMs = Math.round(mots[mots.length - 1]!.finSec * 1000);
    const r = calerScenario(lecture.scenario, mots, dureeMs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etapes).toHaveLength(8);
    expect(r.etapes.map((e) => e.id)).toEqual(IDS_ETAPES);
    r.etapes.forEach((e, i) => {
      expect(e.finMs).toBeGreaterThan(e.debutMs);
      if (i > 0) expect(e.debutMs).toBeGreaterThanOrEqual(r.etapes[i - 1]!.debutMs);
    });
    // Ces instants sont fictifs : la durée cible (T-EXT-18) n'est qu'un repère, jamais un refus.
    const sec = dureeMs / 1000;
    const remarque = sec < DUREE_CIBLE_SEC[0] ? "plus court que la cible" : sec > DUREE_CIBLE_SEC[1] ? "plus long que la cible" : "dans la cible";
    expect(typeof remarque).toBe("string"); // remarque non bloquante : aucune borne n'est exigée
  });

  it("n'emploie jamais « automatiquement » dans les textes d'écran ni les annotations", () => {
    if (!lecture.ok) throw new Error("scénario illisible");
    for (const e of lecture.scenario.etapes) {
      const textes = [...(e.textesEcran ?? []), e.annotation ?? ""].join(" ");
      expect(textes.toLowerCase(), e.id).not.toContain("automatiquement");
    }
  });
});

describe("pilote 07 · données gardées", () => {
  const lecture = lireTableauDeBord(JSON.parse(lire("donnees.json")));
  const lectureScenario = lireScenarioMaquette(JSON.parse(lire("scenario.json")));

  it("est un tableau-de-bord.v1 valide, source fictive, chaque indicateur marqué « exemple »", () => {
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.donnee.source).toMatch(/données fictives/i);
    for (const i of lecture.donnee.indicateurs) expect(i.libelle, i.id).toMatch(/exemple/i);
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
      "Pour trouver vos premières pistes, commentez « AUTOMATISER » et recevez « Les 25 tâches que les TPE et PME peuvent automatiser grâce à l’IA ». Un Diagnostic IA gratuit de 45 minutes est aussi proposé.",
    );
    expect(commande.script.texteComplet.trim().endsWith(paragraphes[5]!)).toBe(true);
    const v = garderChiffres(lecture.donnee, { textesEcran: [], texteDit: paragraphes[5] });
    expect(v.horsDonnee.map((n) => n.valeur).sort((a, b) => a - b)).toEqual([25, 45]);
  });
});

describe("pilote 07 · commande prête, éteinte", () => {
  it("attend le oui de Williams et ne lance rien", () => {
    expect(commande.etat).toBe("attend-oui-williams");
    expect(commande.lancer).toBe(false);
    expect(commande.format).toBe("tutoriel-outil");
    expect(commande.maquette).toBe("07-taches");
    expect(commande.scenario).toBe("scenario.json");
    expect(commande.ratios).toEqual(["4:5", "9:16", "1:1"]);
    expect(commande.musique).toBe(false);
    // Même décision que le pilote 05 (décision 2 de Williams) : fin choisie dans le formulaire, pas de mot-clé imposé.
    // Écart à la fiche du 17/11, qui prévoyait motCle « AUTOMATISER » : la décision prime.
    expect(commande.motCle).toBeUndefined();
    const fin: FinChoisie = "prendre-rendez-vous";
    expect(commande.fin).toBe(fin);
  });

  it("est lue par lireEntreesTutoriel comme un script collé", () => {
    expect(lireEntreesTutoriel(commande.entrees)).toEqual({ scriptColle: true });
  });

  it("ne contient aucun montant (€) dans les 4 fichiers", () => {
    for (const f of FICHIERS_PILOTE) expect(lire(f), f).not.toContain("€");
  });

  it("n'emploie ni étiquette interdite, ni courriel dans les fichiers de données", () => {
    for (const f of ["scenario.json", "donnees.json", "commande-pilote.json"]) {
      expect(lire(f), f).not.toMatch(/Douleur|Solution|Exemple\s*:|À vous|@/);
    }
  });
});
