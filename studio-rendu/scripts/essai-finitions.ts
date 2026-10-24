/**
 * ESSAI RÉEL des finitions après l'essai par l'interface : T21 (toutes variantes), T08, T22 (titre qui reprend la rubrique), T23 (avec et sans icônes), T26, rendus par le vrai
 * Remotion et MESURÉS (débordements, textes en zone réservée, chevauchements). Sans réseau extérieur, sans appel payant.
 * Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome-headless-shell npx tsx --tsconfig ../tsconfig.json scripts/essai-finitions.ts [dossier de sortie]
 * Sortie : un JPEG par cas dans le dossier donné (défaut : un dossier temporaire), hors dépôt.
 */
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { ICONES_ESSAI } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) throw new Error("STUDIO_RENDU_NAVIGATEUR doit désigner le Chrome Headless Shell de Remotion (Chrome for Testing 149).");

const sortie = resolve(process.argv[2] ?? mkdtempSync(join(tmpdir(), "essai-finitions-")));
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-finitions-travail-"));
const op = creerVisuelPage({ rendre: rendreAvecRemotion({ navigateur }), deposer: async (cible, chemin) => void copyFileSync(chemin, cible) });

const couverture = (titre: string) => ({ type: "T01", titre });
const questions = (icones: boolean) =>
  ["Combien de demandes restent sans réponse ?", "Qui relit les devis avant envoi ?", "Où rangez-vous les pièces du dossier ?"].map((question, i) => ({
    question,
    aide: "Une réponse honnête suffit pour commencer.",
    ...(icones ? { icone: ICONES_ESSAI[i] } : {}),
  }));

/** Chaque cas : un carrousel complet et l'index de la page à rendre (la page sombre change avec le titre de couverture). */
const essais: { nom: string; pages: Record<string, unknown>[]; index: number }[] = [
  ...["Répondre plus vite aux demandes", "Ranger les dossiers du cabinet", "Préparer un devis sans stress", "Relancer sans gêner"].map((titre, i) => ({
    nom: `t21-${i + 1}`,
    pages: [couverture(titre), { type: "T21" }],
    index: 1,
  })),
  { nom: "t08-idee-recue", pages: [couverture("Une couverture"), { type: "T08", titre: "Idée reçue, réalité", avant: "Il faut tout automatiser d'un coup.", apres: "Une tâche bien choisie suffit pour commencer." }, { type: "T21" }], index: 1 },
  { nom: "t08-autre-titre", pages: [couverture("Une couverture"), { type: "T08", titre: "Avant, après", avant: "Les relances se perdent.", apres: "Chaque relance part à temps." }, { type: "T21" }], index: 1 },
  { nom: "t22-idee-recue", pages: [couverture("Une couverture"), { type: "T22", titre: "Idée reçue, réalité", mythe: "Il faut tout automatiser d'un coup.", realite: "Une tâche bien choisie suffit pour commencer." }, { type: "T21" }], index: 1 },
  { nom: "t23-icones", pages: [couverture("Une couverture"), { type: "T23", titre: "Trois questions à se poser", questions: questions(true), annotation: "à voir ensemble" }, { type: "T21" }], index: 1 },
  { nom: "t23-sans-icones", pages: [couverture("Une couverture"), { type: "T23", titre: "Trois questions à se poser", questions: questions(false), annotation: "à voir ensemble" }, { type: "T21" }], index: 1 },
  {
    nom: "t26",
    pages: [
      couverture("Une couverture"),
      { type: "T26", titre: "Un cabinet, ses relances", avant: ["Relances oubliées", "Dossiers épars"], avec: ["Relances à date", "Dossiers rangés"], vous: "Et chez vous ?" },
      { type: "T21" },
    ],
    index: 1,
  },
];

const echecs: string[] = [];
for (const e of essais) {
  const spec = { version: "carrousel/1", alt: "Essai d'une page", pages: e.pages };
  const cible = join(travail, `${e.nom}.jpg`);
  try {
    const r = await op(
      { idRendu: e.nom, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: cible, cle: "essai" }, parametres: { proprietes: { spec, index: e.index }, scale: 1, jpegQuality: 90 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    copyFileSync(cible, join(sortie, `${e.nom}.jpg`));
    const m = (r.mesures ?? {}) as Record<string, number>;
    const fautes = [m.debordements !== 0 && "débordement", m.textesEnZone !== 0 && "texte en zone", m.chevauchements !== 0 && "chevauchement"].filter(Boolean);
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [débordements ${m.debordements}, zone ${m.textesEnZone}, chevauchements ${m.chevauchements}]`);
    if (fautes.length) echecs.push(e.nom);
  } catch (err) {
    console.log(`${e.nom} : ÉCHEC ${String(err instanceof Error ? err.message : err).slice(0, 300)}`);
    echecs.push(e.nom);
  }
}
console.log(`Sortie : ${sortie}`);
process.exit(echecs.length ? 1 : 0);
