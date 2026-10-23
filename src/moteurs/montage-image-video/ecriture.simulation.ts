/**
 * IMAGE → VIDÉO · Simulation de l'écriture (aucune clé, aucun appel). PUR, déterministe.
 *
 * Les fiches rendues sont les scripts A à F de `docs/formats/image-video/40-SCRIPTS-ET-STORYBOARDS-6-IMAGES.md` (ton
 * v4), découpés écran par écran d'après leurs storyboards, complétés de leur question de commentaire et, pour les
 * images d'automatisation (C à F), de l'annonce « Voici une situation type. ». Plus une fiche pour le faux schéma figé
 * à 16 blocs (très complexe, 3 chapitres).
 *
 * Écarts avec `40`, imposés par les règles du plan (§ 3, § 4, Q07, Q09) et signalés dans la PR :
 * - phrases de plus de 12 mots coupées par un point, MÊMES MOTS (B, C, D ; A en partie) ;
 * - l'accroche s'arrête à 8 mots : sa reprise passe dans la douleur (A « Oui, le premier. », B « Mais concrètement… »,
 *   D « Et toujours les mêmes questions. ») ;
 * - A : 136 mots (≈ 49 s) pour une image « simple » (30 à 40 s, 44 s au plus avec la tolérance) : resserré à 111 mots
 *   (« IA » retiré de l'accroche, phrases raccourcies), avec l'annonce « Voici cinq gains. » ;
 * - B : le récapitulatif muet du storyboard devient une partie « résultat » dite (« Cinq gains. Concrètement. ») ;
 * - accroches B (alternatives) ramenées à 8 mots au plus ; C : « huit sur dix » (absent de l'image) devient
 *   « quatre-vingts pour cent » ;
 * - A : question raccourcie (« … ne voulez-vous plus faire à la main ? ») : le plan des fins (L14) compte le « ? »
 *   détaché comme un mot et refusait la question de `40` (13 jetons).
 *
 * Débit recalibré à 3,4 mots/s (18/10/2026) : les mots de chaque classe sont désormais durée × 3,4 (Q10 : 92 à 149 mots en
 * simple, 123 à 187 en moyenne, 147 à 209 en branches, 184 à 287 en très complexe). Les scripts C, D, E, F et le faux
 * schéma ont reçu de courtes phrases complètes en fin de texte dit (douleur et explication), sans nouvel écran ni nouveau
 * chiffre, `refs` inchangés : C 142 → 159 mots, D 118 → 131, E 108 → 128, F 109 → 130,
 * faux schéma 155 → 190. A (111) et B (110) passent tels quels. Les ajouts de C sont dans des lignes présentes dans TOUS
 * les récits ; ceux du faux schéma restent dans leur chapitre (le chapitre « Support » est détachable, aucun renvoi après lui).
 */
import type { AccrocheFiche, EcranFiche, FicheImage, Partie, Scene } from "@/domaine/image-video/fiche";
import { motsDits, VERSION_FICHE_IMAGE } from "@/domaine/image-video/fiche";
import { texteCompare } from "@/domaine/controles-script/texte";
import { FOND_PAR_PARTIE, type CodeRecit } from "./recettes";

/** Une ligne de script : partie, scène, texte dit, ids de la carte, textes d'écran (`*mot*` orange). */
type Ligne = [Partie, Scene, string, string[], string[]];

interface ScriptSimule {
  empreinte: string;
  accroches: [AccrocheFiche, AccrocheFiche];
  lignes: Ligne[];
  question: { texteDit: string; texteEcran: string };
  /** Pour le très complexe : [titre, premier écran, dernier écran (rangs à partir de 1), essentiel]. */
  chapitres?: [string, number, number, boolean][];
}

/** Rang du mot dit qui porte le mot orange (sinon le premier mot). */
function rangDuMotOrange(texteDit: string, textes: readonly string[]): number {
  const orange = textes.map((t) => /\*([^*]+)\*/.exec(t)?.[1]).find((x) => x !== undefined);
  if (!orange) return 0;
  const cible = texteCompare(orange).split(" ")[0];
  const i = motsDits(texteDit).findIndex((m) => texteCompare(m).replace(/'/g, " ").split(" ").includes(cible ?? ""));
  return Math.max(0, i);
}

function fiche(s: ScriptSimule): FicheImage {
  const id = (i: number) => `e${String(i + 1).padStart(2, "0")}`;
  const ecrans: EcranFiche[] = s.lignes.map(([partie, scene, texteDit, refs, textesEcran], i) => ({
    id: id(i),
    partie,
    scene,
    refs,
    texteDit,
    textesEcran,
    surMot: [{ mot: rangDuMotOrange(texteDit, textesEcran), action: "apparait", ...(refs[0] ? { ref: refs[0] } : {}) }],
    fond: FOND_PAR_PARTIE[partie],
  }));
  const chapitres = (s.chapitres ?? []).map(([titre, de, a, essentiel], i, tous) => ({
    repere: `${i + 1}/${tous.length}`,
    titre,
    ecrans: ecrans.slice(de - 1, a).map((e) => e.id),
    essentiel,
  }));
  return { version: VERSION_FICHE_IMAGE, empreinteCarte: s.empreinte, accroches: s.accroches, ecrans, questionCommentaire: s.question, chapitres };
}

const A: ScriptSimule = {
  empreinte: "essai-a",
  accroches: [
    { famille: "situation", texteDit: "Une formation qui sert dès le premier jour.", textesEcran: ["Une formation qui sert", "Dès le *1er* jour"] },
    { famille: "question", texteDit: "Une formation qui n'a rien changé lundi ?", textesEcran: ["Rien changé *lundi* ?"] },
  ],
  lignes: [
    ["accroche", "accroche", "Une formation qui sert dès le premier jour.", ["c01"], ["Une formation qui sert", "Dès le *1er* jour"]],
    ["douleur", "titre", "Oui, le premier. Vous connaissez la formation classique : beaucoup de théorie.", [], ["Beaucoup de *théorie*"]],
    ["douleur", "titre", "Et le lundi, rien ne change.", [], ["Le *lundi*, rien ne change"]],
    ["debut-reponse", "titre", "Chez Axion-IA, on fait l'inverse. Voici cinq gains.", ["g-gains"], ["Cinq *gains*"]],
    ["explication", "carte-benefice", "Un : vous gagnez du temps. Vos tâches répétitives s'automatisent.", ["n02"], ["Gain de *temps*"]],
    ["explication", "micro-objet", "Vous libérez jusqu'à plusieurs heures.", ["n02"], ["Jusqu'à plusieurs *heures*"]],
    ["explication", "carte-benefice", "Deux : plus de clarté. Vos idées, vos données, vos actions, enfin rangées.", ["n03"], ["Plus de *clarté*"]],
    ["explication", "carte-benefice", "Trois : plus de productivité. Des décisions plus rapides.", ["n04"], ["Plus de *productivité*"]],
    ["explication", "carte-benefice", "Quatre : moins de coûts. Moins d'erreurs, moins de temps perdu.", ["n05"], ["Moins de *coûts*"]],
    ["explication", "carte-benefice", "Cinq : des résultats concrets. Un impact mesuré dès le premier jour.", ["n06", "c01"], ["Résultats *concrets*", "Impact dès le 1er jour"]],
    ["resultat", "titre", "Comment ? Des cas concrets, des ateliers pratiques.", ["n07"], ["Cas concrets · *Ateliers*"]],
    ["resultat", "titre", "Des outils prêts à l'emploi, un accompagnement sur mesure.", ["n07"], ["Accompagnement *sur mesure*"]],
    ["phrase-choc", "phrase-choc", "Formez-vous aujourd'hui.", [], ["Formez-vous *aujourd'hui*"]],
    ["phrase-choc", "phrase-choc", "Transformez vos résultats dès demain.", [], ["Transformez vos résultats dès *demain*"]],
  ],
  question: { texteDit: "Et vous, quelle tâche ne voulez-vous plus faire à la main ?", texteEcran: "Quelle tâche ne plus faire ?" },
};

const B: ScriptSimule = {
  empreinte: "essai-b",
  accroches: [
    { famille: "situation", texteDit: "L'IA, tout le monde en parle.", textesEcran: ["L'*IA*, tout le monde en parle"] },
    { famille: "liste", texteDit: "Cinq choses changent quand vos équipes maîtrisent l'IA.", textesEcran: ["*5* choses changent"] },
  ],
  lignes: [
    ["accroche", "accroche", "L'IA, tout le monde en parle.", [], ["L'*IA*, tout le monde en parle"]],
    ["douleur", "titre", "Mais concrètement, vous y gagnez quoi ?", [], ["Vous y gagnez *quoi* ?"]],
    ["douleur", "titre", "Vous voyez vos concurrents s'y mettre. Et vous ne savez pas par où commencer.", [], ["Par où *commencer* ?"]],
    ["debut-reponse", "titre", "Voici ce que nos formations et nos interventions changent.", [], ["Vous gagnez. *Concrètement.*"]],
    ["debut-reponse", "titre", "Pour de vrai, et pour longtemps. Cinq choses.", [], ["*5* choses"]],
    ["explication", "carte-benefice", "Un. Vous gagnez du temps : les tâches qui vous mangent la journée s'automatisent.", ["n01"], ["Gagnez du *temps*"]],
    ["explication", "carte-benefice", "Deux. Vous décidez mieux : l'IA, plus vos données, pour décider plus vite et plus juste.", ["n02"], ["Décidez *mieux*"]],
    ["explication", "carte-benefice", "Trois. Vous prenez une longueur d'avance : vous innovez, vous optimisez, vous dépassez vos concurrents.", ["n03"], ["Une longueur d'*avance*"]],
    ["explication", "carte-benefice", "Quatre. Vous montez en compétences. Et en confiance.", ["n04"], ["Compétences et *confiance*"]],
    ["explication", "carte-benefice", "Cinq. Votre performance grimpe : des résultats et une rentabilité qui durent.", ["n05"], ["Votre performance *grimpe*"]],
    ["resultat", "carte-benefice", "Cinq gains. Concrètement.", ["n01", "n02", "n03", "n04", "n05"], ["Vous gagnez. *Concrètement.*"]],
    ["phrase-choc", "phrase-choc", "Comprendre.", [], ["*Comprendre.*"]],
    ["phrase-choc", "phrase-choc", "Former.", [], ["*Former.*"]],
    ["phrase-choc", "phrase-choc", "Transformer.", [], ["*Transformer.*"]],
  ],
  question: { texteDit: "Et vous, des cinq, lequel vous manque le plus ?", texteEcran: "Lequel vous manque le plus ?" },
};

const C: ScriptSimule = {
  empreinte: "essai-c",
  accroches: [
    { famille: "situation", texteDit: "Vingt-trois heures quatorze. Un client vous écrit.", textesEcran: ["*23:14*", "Un client vous écrit"] },
    { famille: "ratio", texteDit: "Quatre-vingts pour cent des messages se règlent seuls.", textesEcran: ["*80 %* des messages"] },
  ],
  lignes: [
    ["accroche", "accroche", "Vingt-trois heures quatorze. Un client vous écrit.", ["c01"], ["*23:14*", "Un client vous écrit"]],
    ["douleur", "titre", "Vous, vous dormez. Lui, il attend. Personne ne lui répond.", [], ["Lui, il *attend*"]],
    ["douleur", "titre", "Et demain matin, il a peut-être déjà vu ailleurs. Il risque de partir chez un concurrent, sans prévenir.", [], ["Il a vu *ailleurs*"]],
    ["debut-reponse", "titre", "Sauf si quelqu'un lui répond. Tout de suite.", [], ["Tout de *suite*"]],
    ["explication", "toile", "Voici une situation type. Son message arrive.", ["n01"], ["Situation type", "Message client entrant · *23h14*"]],
    ["explication", "embranchement", "Le chatbot lit la demande. Et là, deux chemins.", ["n02", "l02", "l06"], ["Chatbot IA", "*Deux* chemins"]],
    ["explication", "toile", "Quatre-vingts pour cent du temps, la réponse est connue.", ["l02", "c04", "n03"], ["*80 %* · Réponse connue"]],
    ["explication", "toile", "Il l'écrit, il l'envoie en quatre secondes.", ["n03", "n04", "c02"], ["Envoyée en *4 sec*"]],
    ["explication", "toile", "Et le ticket se ferme tout seul. Personne n'a bougé.", ["n05", "n06"], ["Résolu *sans intervention*"]],
    ["explication", "toile", "Les vingt pour cent restants, il atteint sa limite. Il sait quand s'arrêter.", ["n02", "l06", "c05"], ["*20 %* · Limite atteinte"]],
    ["explication", "email", "Alors il prépare un e-mail propre : l'objet, le contexte, la demande, l'urgence.", ["n07"], ["E-mail *structuré*", "Objet · Contexte · Demande · Urgence"]],
    ["explication", "email", "L'e-mail part à la bonne équipe.", ["n08"], ["Envoyé à l'*équipe*"]],
    ["explication", "alerte", "Une alerte tombe sur Telegram : intervention requise.", ["n09"], ["🔔 Intervention *requise*"]],
    ["explication", "toile", "Et le client est prévenu : réponse sous deux heures.", ["n10", "c03"], ["Réponse sous *2h*"]],
    ["resultat", "bandeau-chiffres", "Résultat : quatre-vingts pour cent résolus tout de suite.", ["c06"], ["*80 %* résolus"]],
    ["resultat", "bandeau-chiffres", "Zéro demande perdue. Vingt-quatre heures sur vingt-quatre.", ["c07", "c08"], ["*0* demande perdue", "24h/24"]],
    ["phrase-choc", "phrase-choc", "Votre client a toujours une réponse.", [], ["Votre client a *toujours* une réponse"]],
    ["phrase-choc", "phrase-choc", "Même à trois heures du matin.", ["c09"], ["Même à *3h* du matin"]],
  ],
  question: { texteDit: "Et chez vous, combien de messages attendent jusqu'au lendemain ?", texteEcran: "Combien attendent jusqu'au lendemain ?" },
};

const D: ScriptSimule = {
  empreinte: "essai-d",
  accroches: [
    { famille: "chiffre", texteDit: "Vingt e-mails ce matin.", textesEcran: ["*20* e-mails"] },
    { famille: "ratio", texteDit: "Seize e-mails sur vingt se passent de vous.", textesEcran: ["*16* sur 20"] },
  ],
  lignes: [
    ["accroche", "chiffre", "Vingt e-mails ce matin.", ["c01"], ["*20* e-mails"]],
    ["douleur", "titre", "Et toujours les mêmes questions.", [], ["Toujours les *mêmes*"]],
    ["douleur", "titre", "Vous répondez, vous copiez, vous collez. Les heures passent.", [], ["Copier, *coller*"]],
    ["douleur", "titre", "Et pendant ce temps… ceux qui comptent vraiment attendent au fond de la boîte. Vous les voyez trop tard.", [], ["Ceux qui comptent *vraiment*"]],
    ["debut-reponse", "titre", "Et si l'IA faisait le tri pour vous ?", [], ["Et si l'IA faisait le *tri* ?"]],
    ["explication", "entonnoir", "Voici une situation type. Les vingt e-mails arrivent.", ["n01", "c01"], ["Situation type", "*20* e-mails entrants"]],
    ["explication", "entonnoir", "Ils passent tous dans le même entonnoir. Tout passe au même endroit.", ["n02"], ["Le même *entonnoir*"]],
    ["explication", "entonnoir", "L'IA les lit, les classe, et répond.", ["n02"], ["IA classe et *répond*"]],
    ["explication", "nuee", "Seize sur vingt, c'est quatre-vingts pour cent, reçoivent leur réponse automatiquement.", ["n03", "c02"], ["16/20 = *80 %*"]],
    ["explication", "nuee", "En deux minutes.", ["n03", "c03"], ["Réponse en *2 min*"]],
    ["explication", "nuee", "Les quatre autres, les vingt pour cent qui restent, arrivent chez vous.", ["n04", "c04"], ["*20 %* pour vous"]],
    ["explication", "nuee", "Ceux qui comptent vraiment.", ["n04"], ["Ceux qui comptent *vraiment*"]],
    ["resultat", "bandeau-chiffres", "Au bout du compte : quatre-vingts pour cent traités tout seuls.", ["c05"], ["*80 %* traités auto"]],
    ["resultat", "bandeau-chiffres", "Deux heures récupérées par jour.", ["c06"], ["*2h* récupérées / jour"]],
    ["resultat", "bandeau-chiffres", "Et zéro question sans réponse.", ["c07"], ["*0* question sans réponse"]],
    ["phrase-choc", "phrase-choc", "Vous lisez ce qui compte.", [], ["Vous lisez ce qui *compte*"]],
    ["phrase-choc", "phrase-choc", "L'IA gère le reste.", [], ["L'IA gère le *reste*"]],
  ],
  question: { texteDit: "Et vous, combien d'e-mails par jour posent la même question ?", texteEcran: "Combien posent la même question ?" },
};

const E: ScriptSimule = {
  empreinte: "essai-e",
  accroches: [
    { famille: "chiffre", texteDit: "Vingt-trois minutes. Pour retrouver un seul document.", textesEcran: ["*23 min*"] },
    { famille: "question", texteDit: "Combien de temps pour retrouver un document ?", textesEcran: ["Combien de *temps* ?"] },
  ],
  lignes: [
    ["accroche", "chiffre", "Vingt-trois minutes. Pour retrouver un seul document.", ["n07", "c01"], ["*23 min*"]],
    ["douleur", "sources", "Il est arrivé par e-mail ? Par scan ?", ["n01", "n02"], ["Email · *Scan*"]],
    ["douleur", "sources", "Sur le Drive ? Sur WhatsApp ? Sur une clé USB ?", ["n03", "n04", "n05"], ["Drive · WhatsApp · *USB*"]],
    ["douleur", "toile", "Résultat : une pile en vrac. Des PDF, des Word, des Excel, des images.", ["n06"], ["Une pile en *vrac*"]],
    ["debut-reponse", "titre", "Maintenant, regardez ce qui se passe quand l'IA s'en occupe.", [], ["Quand l'*IA* s'en occupe"]],
    ["explication", "toile", "Voici une situation type. Chaque document qui arrive passe par elle. Rien ne lui échappe. Elle s'en charge.", ["n08"], ["Situation type", "Chaque *document* passe par l'IA"]],
    ["explication", "toile", "Elle le classe. Elle le renomme. Cela se fait sans vous, sans aucun effort.", ["n08"], ["Classe · *Renomme*"]],
    ["explication", "toile", "Elle l'archive. Et elle l'indexe, pour le retrouver ensuite. Plus rien ne se perd.", ["n08"], ["Archive · *Indexe*"]],
    ["explication", "dossiers", "Tout part dans le bon dossier : clients, fournisseurs, contrats, factures.", ["n09"], ["Le bon *dossier*"]],
    ["explication", "recherche", "Vous cherchez, par exemple, le bon de commande Martin.", ["n10"], ["Exemple", "Bon de commande *Martin*"]],
    ["explication", "recherche", "Trouvé. En trois secondes.", ["n11", "c02"], ["Trouvé — *3 s*"]],
    ["resultat", "ecran-partage", "Avant : vingt-trois minutes. Après : trois secondes.", ["c01", "c02"], ["*23 min* → 3 s"]],
    ["phrase-choc", "phrase-choc", "Vous cherchez. Vous trouvez.", [], ["Vous *trouvez*"]],
    ["phrase-choc", "phrase-choc", "En trois secondes.", ["c03"], ["En *3 secondes*"]],
  ],
  question: { texteDit: "Et vous, combien de temps pour retrouver votre dernière facture ?", texteEcran: "Votre dernière facture : combien de temps ?" },
};

const F: ScriptSimule = {
  empreinte: "essai-f",
  accroches: [
    { famille: "chiffre", texteDit: "Dix-neuf minutes. Pour saisir une seule commande.", textesEcran: ["*19 min*"] },
    { famille: "question", texteDit: "Vous tapez la même commande trois fois ?", textesEcran: ["La même commande *3 fois* ?"] },
  ],
  lignes: [
    ["accroche", "chiffre", "Dix-neuf minutes. Pour saisir une seule commande.", ["c04"], ["*19 min*"]],
    ["douleur", "toile", "La commande arrive. Il faut maintenant la saisir.", ["n01"], ["Commande *reçue*"]],
    ["douleur", "additionneur", "Vous la tapez dans le CRM : huit minutes.", ["n02", "c01"], ["Saisie CRM · *8 min*"]],
    ["douleur", "additionneur", "Puis dans la compta : six minutes.", ["n03", "c02"], ["Saisie Compta · *6 min*"]],
    ["douleur", "additionneur", "Puis dans le stock : cinq minutes.", ["n04", "c03"], ["Saisie Stock · *5 min*"]],
    ["douleur", "additionneur", "Trois fois la même chose. Et à chaque fois, un risque d'erreur. Élevé. C'est long et c'est pénible.", ["n05"], ["8 + 6 + 5 = *19*", "Risque d'erreur : élevé"]],
    ["debut-reponse", "titre", "Maintenant, la même commande, avec l'IA.", [], ["Avec l'*IA*"]],
    ["explication", "toile", "Voici une situation type. Vous la saisissez une seule fois. Le reste ne vous concerne plus.", ["n06", "c05"], ["Situation type", "Saisie *1 fois*"]],
    ["explication", "toile", "L'IA la reprend, et la remplit toute seule dans les trois outils. Vous n'avez rien à recopier.", ["n07"], ["IA · saisie *unique*"]],
    ["explication", "toile", "Le CRM : fait. La compta : faite. Le stock : fait.", ["n08", "n09", "n10"], ["CRM ✓ · Compta ✓ · *Stock* ✓"]],
    ["explication", "toile", "Instantanément.", ["n08", "n09", "n10"], ["*Instantané*"]],
    ["explication", "toile", "Quarante-cinq secondes en tout. Risque d'erreur : zéro.", ["n11", "c06"], ["*45 sec*", "Risque d'erreur : zéro"]],
    ["resultat", "bandeau-chiffres", "Dix-neuf minutes économisées par commande.", ["c07"], ["*19 min* économisées"]],
    ["resultat", "bandeau-chiffres", "Sur vingt commandes par jour, ça fait six heures récupérées.", ["c08", "c09"], ["20 cmd/jour = *6h*"]],
    ["phrase-choc", "phrase-choc", "Une saisie.", [], ["Une *saisie*"]],
    ["phrase-choc", "phrase-choc", "Trois outils.", [], ["Trois *outils*"]],
    ["phrase-choc", "phrase-choc", "Zéro erreur.", [], ["*Zéro* erreur"]],
  ],
  question: { texteDit: "Et chez vous, combien de fois tapez-vous la même information ?", texteEcran: "Combien de fois la même information ?" },
};

/** Faux schéma figé à 16 blocs et 3 branches (très complexe) : une vidéo en 3 chapitres, les 2 derniers détachables. */
const FAUX_16: ScriptSimule = {
  empreinte: "essai-faux16",
  accroches: [
    { famille: "situation", texteDit: "Toutes vos demandes. Une seule boîte.", textesEcran: ["Une seule *boîte*"] },
    { famille: "question", texteDit: "Qui trie vos demandes ce matin ?", textesEcran: ["Qui *trie* ?"] },
  ],
  lignes: [
    ["accroche", "accroche", "Toutes vos demandes. Une seule boîte.", [], ["Une seule *boîte*"]],
    ["douleur", "titre", "Devis, support, réclamations : tout arrive au même endroit. Rien ne les distingue au premier regard.", [], ["Tout au même *endroit*"]],
    ["douleur", "titre", "Vous triez à la main. Et les urgences attendent. Vous perdez du temps à chaque message.", [], ["Les urgences *attendent*"]],
    ["debut-reponse", "titre", "Et si chaque demande prenait seule le bon chemin ?", [], ["Le bon *chemin*"]],
    ["explication", "toile", "Voici une situation type. Une demande arrive.", ["n01"], ["Situation type", "Demande *reçue*"]],
    ["explication", "embranchement", "L'IA la lit et la trie. Elle repère le sujet de chaque demande.", ["n02"], ["L'IA *trie*"]],
    ["explication", "toile", "Soixante pour cent sont des devis.", ["l02", "c01", "n03"], ["*60 %* · Devis"]],
    ["explication", "toile", "Le devis est lu, puis vérifié.", ["n03", "n04"], ["Lu, *vérifié*"]],
    ["explication", "toile", "La réponse part, et le devis est classé. Le dossier reste à jour.", ["n05", "n06"], ["Réponse et *classement*"]],
    ["explication", "toile", "Le tableau de suivi se met à jour tout seul.", ["n15"], ["Tableau de *suivi*"]],
    ["explication", "toile", "Et chaque lundi, un rapport part de lui-même.", ["n16"], ["Rapport du *lundi*"]],
    ["explication", "ensemble", "Trente pour cent sont des questions de support.", ["l07", "c02", "n07"], ["*30 %* · Support"]],
    ["explication", "toile", "La question est lue, puis vérifiée. Rien ne part sans contrôle.", ["n07", "n08"], ["Lue, *vérifiée*"]],
    ["explication", "toile", "La réponse part tout de suite.", ["n09"], ["Réponse *immédiate*"]],
    ["explication", "toile", "Puis la demande est classée.", ["n10"], ["Demande *classée*"]],
    ["explication", "ensemble", "Dix pour cent sont des réclamations.", ["l12", "c03", "n11"], ["*10 %* · Réclamation"]],
    ["explication", "toile", "La réclamation est lue, puis vérifiée.", ["n11", "n12"], ["Lue, *vérifiée*"]],
    ["explication", "toile", "Une réponse soignée part au client.", ["n13"], ["Réponse *soignée*"]],
    ["explication", "toile", "Et la réclamation est classée. Plus rien ne traîne.", ["n14"], ["Réclamation *classée*"]],
    ["resultat", "ensemble", "Chaque demande suit sa voie, sans tri à la main.", ["n02"], ["Sans tri à la *main*"]],
    ["resultat", "titre", "Et vous gardez le temps pour les vrais échanges.", [], ["Les vrais *échanges*"]],
    ["phrase-choc", "phrase-choc", "Chaque demande trouve son chemin.", [], ["Chaque demande trouve son *chemin*"]],
  ],
  question: { texteDit: "Et chez vous, qui trie les demandes chaque matin ?", texteEcran: "Qui trie vos demandes ?" },
  chapitres: [
    ["Devis", 5, 11, true],
    ["Support", 12, 15, false],
    ["Réclamation", 16, 19, false],
  ],
};

/** Fiches simulées, par empreinte d'image (relue dans la partie variable de l'appel). */
export const FICHES_SIMULEES: Readonly<Record<string, FicheImage>> = Object.freeze(
  Object.fromEntries([A, B, C, D, E, F, FAUX_16].map((s) => [s.empreinte, fiche(s)])),
);

/** Fiche simulée d'une image ; `null` pour une image inconnue (aucune fiche inventée). */
export function ficheSimulee(empreinte: string): FicheImage | null {
  const f = FICHES_SIMULEES[empreinte];
  return f ? structuredClone(f) : null;
}

// ─── Déroulés du récit (variété, axe 2) : AJOUTS, les fiches ci-dessus ne changent pas ───────────────────────────────
//
// Image C racontée en REC-B, REC-C, REC-D : mêmes chiffres, même explication complète dans l'ordre réel du processus,
// même phrase-choc ; seuls changent la place du résultat (REC-B), le message suivi comme un personnage (REC-C) et
// l'annonce des trois étapes (REC-D).

const lignesC = (rangs: number[]) => rangs.map((i) => C.lignes[i]!);

const C_REC_B: ScriptSimule = {
  ...C,
  lignes: [
    C.lignes[0]!,
    ["resultat", "bandeau-chiffres", "Quatre-vingts pour cent résolus.", ["c06"], ["*80 %* résolus"]],
    C.lignes[15]!,
    ...lignesC([1, 2]),
    ["debut-reponse", "titre", "Voici comment. Quelqu'un lui répond, tout de suite.", [], ["Voici *comment*"]],
    ...lignesC([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    ...lignesC([16, 17]),
  ],
};

const C_REC_C: ScriptSimule = {
  ...C,
  lignes: [
    ...lignesC([0, 1, 2, 3]),
    ["explication", "toile", "Voici une situation type. Suivons son message.", ["n01"], ["Situation type", "Message client entrant · *23h14*"]],
    ["explication", "embranchement", "Le message arrive au chatbot. Et là, deux chemins.", ["n02", "l02", "l06"], ["Chatbot IA", "*Deux* chemins"]],
    C.lignes[6]!,
    ["explication", "toile", "Le message repart avec sa réponse, en quatre secondes.", ["n03", "n04", "c02"], ["Envoyée en *4 sec*"]],
    ...lignesC([8, 9]),
    ["explication", "email", "Le message devient un e-mail propre : l'objet, le contexte, la demande, l'urgence.", ["n07"], ["E-mail *structuré*", "Objet · Contexte · Demande · Urgence"]],
    ["explication", "email", "Il part à la bonne équipe.", ["n08"], ["Envoyé à l'*équipe*"]],
    ...lignesC([12, 13, 14, 15, 16, 17]),
  ],
};

const C_REC_D: ScriptSimule = {
  ...C,
  lignes: [
    ...lignesC([0, 1, 2]),
    ["debut-reponse", "titre", "Sauf si quelqu'un lui répond. Trois étapes.", [], ["Trois *étapes*"]],
    ["explication", "toile", "Voici une situation type. Un : son message arrive.", ["n01"], ["Situation type", "Message client entrant · *23h14*"]],
    ["explication", "embranchement", "Deux : le chatbot lit la demande. Et là, deux chemins.", ["n02", "l02", "l06"], ["Chatbot IA", "*Deux* chemins"]],
    ["explication", "toile", "Trois : quatre-vingts pour cent du temps, la réponse est connue.", ["l02", "c04", "n03"], ["*80 %* · Réponse connue"]],
    ...lignesC([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]),
  ],
};

/**
 * Déroulé simulé tiré d'un script de base (lot F, assemblage : seule l'image C en avait d'écrits à la main ; A et B n'ont que REC-A) : REC-D
 * ajoute « Trois étapes. » au début de réponse ; REC-B fait passer le résultat juste après l'accroche et ajoute
 * « Voici comment. » au début de réponse (les chapitres suivent leurs écrans). Rien d'autre ne change.
 */
function deroule(s: ScriptSimule, recit: "REC-B" | "REC-D"): ScriptSimule | null {
  const annonce = recit === "REC-D" ? "Trois étapes." : "Voici comment.";
  const k = s.lignes.findIndex((l) => l[0] === "debut-reponse");
  if (k < 0) return null;
  const lignes = s.lignes.map((l, i): Ligne => (i === k ? [l[0], l[1], `${l[2]} ${annonce}`, l[3], l[4]] : l));
  if (recit === "REC-D") return { ...s, lignes };
  const rangs = lignes.map((_, i) => i);
  const ordre = [...rangs.filter((i) => lignes[i][0] === "accroche"), ...rangs.filter((i) => lignes[i][0] === "resultat"), ...rangs.filter((i) => lignes[i][0] !== "accroche" && lignes[i][0] !== "resultat")];
  const place = (rang: number) => ordre.indexOf(rang - 1) + 1;
  const chapitres = s.chapitres?.map(([titre, de, a, essentiel]): [string, number, number, boolean] => [titre, place(de), place(a), essentiel]);
  // Un chapitre coupé par le déplacement : pas de déroulé simulé (la fiche de base sert alors).
  if (chapitres?.some(([, de, a], i) => a - de !== s.chapitres![i][2] - s.chapitres![i][1])) return null;
  return { ...s, lignes: ordre.map((i) => lignes[i]), ...(chapitres ? { chapitres } : {}) };
}
const derouleDe = (s: ScriptSimule, recit: "REC-B" | "REC-D") => {
  const d = deroule(s, recit);
  return d ? { [recit]: fiche(d) } : {};
};

/** Fiches simulées par déroulé du récit : empreinte de l'image → récit → fiche (REC-A : la fiche de base). */
export const FICHES_SIMULEES_RECIT: Readonly<Record<string, Readonly<Partial<Record<CodeRecit, FicheImage>>>>> = Object.freeze({
  [C.empreinte]: Object.freeze({ "REC-B": fiche(C_REC_B), "REC-C": fiche(C_REC_C), "REC-D": fiche(C_REC_D) }),
  ...Object.fromEntries([D, E, F, FAUX_16].map((s) => [s.empreinte, Object.freeze({ ...derouleDe(s, "REC-B"), ...derouleDe(s, "REC-D") })])),
});

/** Fiche simulée d'une image racontée selon un déroulé ; `null` s'il n'y en a pas (la fiche de base sert alors). */
export function ficheSimuleeRecit(empreinte: string, recit: CodeRecit): FicheImage | null {
  const f = FICHES_SIMULEES_RECIT[empreinte]?.[recit];
  return f ? structuredClone(f) : null;
}
