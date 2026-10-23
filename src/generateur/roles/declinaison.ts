/**
 * RÔLE 11 · DÉCLINAISON PAR RÉSEAU (plan v5 B.3.5 étape 11 ; B.4.4, B.5 ; K3, K5, K7, K12, K13, K17, K20, K21, K25 ; lot G4).
 * Sonnet, effort `low`, un appel par réseau, en parallèle. L'accroche est PRISE parmi les finalistes et seulement
 * adaptée ; l'appel est celui que le code a choisi (objectif × réseau) ; la boucle s'accorde avec l'accroche.
 * Les règles et les champs du réseau arrivent en DONNÉES (aucun réseau nommé ici).
 */
import { z } from "zod";
import { MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, graine, lireVariable, raccourcir, REGLE_DONNEES, REGLE_RIEN_INVENTE, regleTon, sujetSimule, tirer, tutoyer } from "./commun";
import { ditNonProuve, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_DECLINAISON: readonly Evaluation<SortieDeclinaison>[] = [
  { id: "DEC-01", critique: true, texte: "accroche prise parmi les finalistes (C70)", verifier: (s, c) => (c.finalistes && !c.finalistes.includes(s.accrocheId) ? [`accroche ${s.accrocheId} hors finalistes`] : []) },
  { id: "DEC-02", texte: "appel du type demandé, 47 mots au plus", verifier: (s, c) => [c.appelsPermis && s.appel.texte && !c.appelsPermis.includes(s.appel.type) ? `appel ${s.appel.type} non permis` : null, mots(s.appel.texte) > 47 ? "appel trop long" : null].filter((x): x is string => !!x) },
  { id: "DEC-03", texte: "encadré de 5 mots au plus", verifier: (s) => (mots(s.encadre) > 5 ? [`encadré « ${s.encadre} »`] : []) },
  { id: "DEC-04", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => [s.accroche, s.appel.texte, s.publication.texte, s.publication.post?.texte ?? ""].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`) },
  { id: "DEC-05", texte: "justifications avec leur règle datée (K13)", verifier: (s) => s.publication.justifications.filter((j) => !j.regleId.trim()).map((j) => `sans règle : ${j.texte}`) },
];

export const CONSIGNE_DECLINAISON = consigne(
  "Tu déclines, pour UN réseau (<reseau>), une courte vidéo dont le corps est déjà écrit et validé (<corps>). Tu ne réécris jamais le corps.",
  "ACCROCHE : prends UNE des finalistes fournies (`accrocheId` = son id) et adapte seulement le « tu » ou le « vous » et le mot-clé : jamais plus longue que la finaliste (20 mots au plus), le mot-clé exact dedans. L'accroche + le corps doivent se lire d'une traite. `motCleVariante` : une autre façon de dire le mot-clé, reprise dans la publication.",
  "APPEL : du type imposé (<appel type=…>), 47 mots au plus, cohérent avec ce que la vidéo contient vraiment ; vide si le type est « aucun ». Jamais de réservation directe, jamais de prix. Un appel d'envoi nomme un rôle de la liste « Rôles destinataires d'un envoi » fournie, mot pour mot (« Envoyez-la à votre DAF. »), jamais « un collègue », ni la personne que la vidéo met en cause. BOUCLE (si le réseau en a une) : 6 mots au plus, qui forme avec l'accroche une phrase française naturelle ; sinon vide. Une boucle se pose par un enjeu, jamais par une annonce.",
  "ENCADRÉ : 5 mots au plus, avec le mot-clé mot pour mot (mêmes mots, même ordre, sans accord ni conjugaison), qui apporte autre chose que la parole (aucun autre mot de l'accroche). COUVERTURE : 5 mots au plus.",
  "PUBLICATION : suis les règles du réseau fournies (1re ligne, mots-dièse, champs propres). Un seul appel par publication. Chaque choix lié à une règle de plateforme se justifie avec l'identifiant de sa règle datée (`regleId`) ; aucune affirmation sur une plateforme sans elle.",
  "Délai, coût et retour sur investissement vont dans la légende seulement s'ils sont prouvés.",
  REGLE_RIEN_INVENTE,
  regleTon(),
  REGLE_DONNEES,
);

export const schemaDeclinaison = z.object({
  accrocheId: z.string(),
  accroche: z.string(),
  promesse: z.string().optional(),
  appel: z.object({ type: z.enum(["envoi", "sauvegarde", "question-expert", "episode-suivant", "diagnostic", "aucun"]), texte: z.string() }),
  boucle: z.string(),
  encadre: z.string(),
  couverture: z.string(),
  segmentFacultatifRetenu: z.boolean(),
  publication: z.object({
    premiereLigne: z.string(),
    texte: z.string(),
    motsDiese: z.array(z.string()),
    commentaireEpingle: z.string().optional(),
    titres: z.array(z.string()).optional(),
    motsClesDeclares: z.array(z.string()).optional(),
    motsClesBloques: z.array(z.string()).optional(),
    post: z.object({ texte: z.string(), detailAncrage: z.string() }).optional(),
    motCleVariante: z.string().optional(),
    justifications: z.array(z.object({ texte: z.string(), regleId: z.string() })),
  }),
});
export type SortieDeclinaison = z.infer<typeof schemaDeclinaison>;

export const roleDeclinaison: DefinitionRole<typeof schemaDeclinaison> = {
  id: "declinaison",
  version: 2,
  consigne: CONSIGNE_DECLINAISON,
  schema: schemaDeclinaison,
  modele: MODELE_JUGE,
  effort: "low",
  maxTokens: 6000,
  simuler(entree) {
    const l = lireVariable(entree.variable);
    const type = (/<appel type="([^"]+)"/.exec(entree.variable)?.[1] ?? "envoi") as SortieDeclinaison["appel"]["type"];
    const boucle = /boucle : (oui|sauf)/.test(entree.variable);
    const post = /<champ id="post"/.test(entree.variable);
    const titres = /<champ id="titres"/.test(entree.variable);
    const s = sujetSimule(l.idee, /Mot-clé : ([^\n]+)/.exec(entree.variable)?.[1]?.trim());
    const motCle = s.motCle;
    const destinataire = /Destinataire de l'envoi : ([^\n]+)/.exec(entree.variable)?.[1]?.trim() || "la personne qui s'en occupe";
    // Simulation qui VARIE (E2E n° 1, n° 14) : une accroche par réseau (finaliste et forme tirées par la graine du
    // réseau), les corrections demandées sont SUIVIES : « autre accroche » change d'accroche, « raccourcis » raccourcit
    // vraiment, « améliore » change l'appel et la publication.
    const corrections = /<corrections_demandees>\n([\s\S]*?)\n<\/corrections_demandees>/.exec(entree.variable)?.[1] ?? "";
    const aEviter = new Set([...corrections.matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1].trim()));
    const plusCourt = /raccourcis/i.test(corrections);
    const ameliorer = /Améliore/.test(corrections);
    const fins = l.finalistes.length ? l.finalistes : [{ id: "acc-1", dit: `${capitale(s.possessif)} : le coût caché.` }];
    const g = graine(l.idee, l.reseau);
    // Formes d'une finaliste (jamais plus longue) : telle quelle, raccourcie, raccourcie deux fois.
    const formes = fins.flatMap((f) => [f.dit, raccourcir(f.dit), raccourcir(raccourcir(f.dit))].map((dit) => ({ id: f.id, dit }))).filter((x, i, t) => t.findIndex((y) => y.dit === x.dit) === i);
    const candidats = formes.map((_, i) => formes[(i + g) % formes.length]);
    let choisie = candidats.find((x) => !aEviter.has(x.dit.trim())) ?? candidats[0];
    if (plusCourt) choisie = [...formes].sort((a, b) => a.dit.split(/\s+/).length - b.dit.split(/\s+/).length)[0];
    const t = (x: string) => tutoyer(x, l.adresse);
    const appels = {
      envoi: [t(`Envoyez-la à votre ${destinataire}.`), t(`À envoyer à votre ${destinataire}, aujourd'hui.`), t(`Votre ${destinataire} doit la voir.`)],
      question: [t(`Combien de temps passez-vous sur ${s.possessif} chaque semaine ?`), t(`Et chez vous, qui s'occupe de ${s.possessif} ?`), t(`Chez vous, ${s.possessif}, c'est combien d'heures ?`)],
      autre: [t("Le lien pour en parler est en commentaire."), t("Gardez-la pour le jour où vous en aurez besoin."), "La suite dans la prochaine vidéo."],
    };
    const pool = type === "envoi" ? appels.envoi : type === "question-expert" ? appels.question : appels.autre;
    const iAppel = plusCourt ? pool.reduce((k, x, i) => (x.length < pool[k].length ? i : k), 0) : (g + (ameliorer ? 1 : 0)) % pool.length;
    const appelTexte = type === "aucun" ? "" : pool[iAppel];
    const lignes = [`${capitale(motCle)} : ce que ça coûte vraiment`, `${capitale(s.possessif)}, sans le geste à la main`, `${capitale(motCle)} : le temps qu'on récupère`, `${capitale(motCle)} : par où commencer`, `${capitale(motCle)} : ce qu'on retire en premier`, `${capitale(motCle)} : l'erreur invisible`].map(t);
    const depart = (g + (ameliorer ? 1 : 0)) % lignes.length;
    const ligne = lignes.map((_, i) => lignes[(depart + i) % lignes.length]).find((x) => !aEviter.has(x)) ?? lignes[depart];
    const corpsPub = ameliorer ? t(`${capitale(s.court)}.\n\nCe qu'on retire, ce qu'on garde, et par où commencer.`) : t(`${capitale(s.court)}.\n\nLa tâche se supprime, elle ne s'accélère pas.`);
    return {
      accrocheId: choisie.id,
      accroche: choisie.dit,
      appel: { type, texte: appelTexte },
      boucle: boucle && !plusCourt ? tirer(["Et tout recommence.", "Chaque semaine.", "Encore et encore."], g) : "",
      encadre: `${motCle} : le vrai coût`.split(/\s+/).slice(0, 5).join(" "),
      couverture: tirer(["Le coût caché", `${capitale(motCle)}, le vrai prix`, "Le temps perdu"], g).split(/\s+/).slice(0, 5).join(" "),
      segmentFacultatifRetenu: false,
      publication: {
        premiereLigne: ligne,
        texte: `${ligne}.\n\n${corpsPub}`,
        motsDiese: tirer([["#pme", "#gestion"], ["#dirigeant", "#pme"], ["#automatisation", "#pme"]], g),
        ...(titres ? { titres: [`${capitale(motCle)} : combien d'heures perdues ?`, `${capitale(motCle)} : le coût caché`] } : {}),
        ...(post ? { post: { texte: `${ligne}.\n\n${appelTexte || corpsPub}`, detailAncrage: `${capitale(s.court)}.` } } : {}),
        justifications: [{ texte: "Mot-clé en première ligne.", regleId: "hyp-ecriture-reseau" }],
      },
    };
  },
};
