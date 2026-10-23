/**
 * LOT G3 — CAS 35 H TRANSPOSÉ (critère de fin G3) : les scripts réels des deux bancs « fin des Excel » repassent dans
 * les contrôles par code ; CHAQUE défaut P0 et P1 relevé par les juges doit être détecté (B.7.6, `06-BANC-ESSAI-SCRIPTS-35H.md`,
 * `12-BANC-ESSAI-v4-RESULTATS.md`). Les défauts que l'addendum du 02/10 ou l'architecte ont retirés des règles sont
 * listés à part, avec leur raison (aucun n'est passé sous silence).
 */
import { describe, expect, it } from "vitest";
import { codesLeves, controlerFinalistes, controlerVersion, type EntreeControle } from "@/domaine/controles-script";
import { empreinte } from "@/domaine/derivations-generateur";
import type { SegmentScript } from "@/domaine/types";
import { choisirCombinaison } from "@/generateur/choix-combinaison";
import { entreeChoix } from "./helpers/g3-choix";
import { bloc, M, matiere, P, PARAMS, RECETTE, seg, temoin } from "./helpers/g3";

/* ------------------------------------------------------------------ */
/* Banc 06 (06/07) : le script maître de 19 segments, transposé       */
/* ------------------------------------------------------------------ */

function banc06(): EntreeControle {
  return temoin((e) => {
    e.ouverture = [bloc("accroche", seg("s1", "Trente-cinq heures par semaine dans Excel.", { preuveIds: ["P1"], nature: "fait", emphase: ["Excel"], incrustation: { type: "montant", texte: "35 h" }, marqueurs: ["preuve"] }))];
    e.corps = [
      bloc(
        "coeur",
        seg("s2", "Chez un client, un temps plein gérait ça.", { preuveIds: ["P1"], nature: "fait", intentionIllustration: "silhouette de bureau floue", marqueurs: ["preuve"] }),
        seg("s3", "On a automatisé tous ses Excel.", { preuveIds: ["P4"], nature: "fait", emphase: ["automatisé"], marqueurs: ["mot-cle"] }),
        seg("s4", "Et je vous dis ce qu'est devenue cette personne.", { marqueurs: ["boucle-ouverte"] }),
        seg("s5", "Excel, ça paraît gratuit.", { nature: "opinion", emphase: ["gratuit"] }),
        seg("s6", "Sauf que trente-cinq heures par semaine, c'est un poste entier.", { preuveIds: ["P1"], marqueurs: ["relance"], incrustation: { type: "montant", texte: "35 h = 1 poste" } }),
        seg("s7", "Ce calcul, votre D-A-F devrait le faire tout de suite.", { marqueurs: ["envoi"] }),
        seg("s8", "Chez ce client, seule une partie des données était exploitée.", { preuveIds: ["P2"], intentionIllustration: "jauge à moitié remplie", emphase: ["partie"] }),
        seg("s9", "Alors on a construit une console d'administration complète.", { preuveIds: ["P3"], ecran: { type: "capture", description: "capture réelle et anonymisée de la console" }, emphase: ["console"], marqueurs: ["relance"] }),
        seg("s10", "Toutes ses données, dans un seul tableau de bord.", { preuveIds: ["P3"] }),
        seg("s11", "Plus un seul Excel. Tout est automatisé.", { preuveIds: ["P4"], intentionIllustration: "icône Excel barrée", emphase: ["automatisé"] }),
        seg("s12", "Un problème ? Une alerte arrive sur Télégram.", { preuveIds: ["P7"], intentionIllustration: "notification Telegram générique", marqueurs: ["relance"] }),
      ),
      bloc(
        "preuve",
        seg("s13", "Résultat. Zéro heure par semaine sur cette tâche.", { preuveIds: ["P6", "P1"], emphase: ["Zéro"], incrustation: { type: "montant", texte: "35 h → 0 h" }, marqueurs: ["livraison"] }),
        seg("s14", "Cent pour cent des données exploitées, en temps réel.", { preuveIds: ["P8"], incrustation: { type: "montant", texte: "100 %" } }),
        seg("s15", "Et cette personne ? Affectée à un autre poste.", { preuveIds: ["P5"], pauseApresSec: 0.4, marqueurs: ["boucle-fermee", "emotion"], nature: "emotion" }),
        seg("s16", "En place en moins d'un mois, amorti en quelques semaines.", { preuveIds: ["P9", "P10"] }),
        seg("s17", "Pour le dirigeant, moins de pression.", { preuveIds: ["P11"], nature: "emotion", emphase: ["pression"] }),
      ),
    ];
    e.fin = [bloc("appel", seg("s18", "Quelle tâche refaites-vous encore à la main ?", { incrustation: { type: "objet", texte: "Votre réponse en commentaire" } })), bloc("boucle", seg("s19", "Chez lui, c'est fini, les…"))];
    e.appel = { type: "question-expert", texte: "Quelle tâche refaites-vous encore à la main ?", selonObjectif: false };
    e.motCle = "automatiser Excel";
    e.encadre = { texte: "Un poste entier avalé par Excel" };
    e.maitre!.ancrages = [];
    e.maitre!.exception = undefined;
    e.maitre!.emotion = "soulagement";
    e.prononciations = [{ forme: "DAF", dit: "D-A-F" }, { forme: "Telegram", dit: "Télégram" }];
    e.publication!.texte = "Un poste entier avalé par Excel. Chiffres vérifiés.";
  });
}

/* ------------------------------------------------------------------ */
/* Banc v4 (02/10), brief 1 : corps A, version TikTok                  */
/* ------------------------------------------------------------------ */

function bancV4(modif: (e: EntreeControle) => void = () => {}): EntreeControle {
  return temoin((e) => {
    e.ouverture = [bloc("accroche", seg("v1", "35 heures par semaine sur Excel.", { preuveIds: ["P1"], nature: "fait", marqueurs: ["mot-cle"] }))];
    const cs: SegmentScript[] = [
      seg("v2", "Chez un client, une personne tenait les données à temps plein.", { preuveIds: ["P1"], nature: "fait", matiereIds: ["m-cas"], marqueurs: ["preuve", "ancrage"] }),
      seg("v3", "Remplacer Excel, chez lui, c'était supprimer tous les fichiers.", { preuveIds: ["P4"], emphase: ["supprimer"], marqueurs: ["mot-cle"] }),
      seg("v4", "Car avec ces fichiers, seule une partie des données était exploitée.", { preuveIds: ["P2"], intentionIllustration: "onglets grisés", marqueurs: ["relance"] }),
      seg("v5", "Et la personne qui les tenait ?", { marqueurs: ["relance", "boucle-ouverte"], annotations: { pause: { sec: 0.3, proposee: true } } }),
      seg("v6", "Remplacer Excel, concrètement : une console, avec un tableau de bord de toutes ses données.", { preuveIds: ["P3"], marqueurs: ["mot-cle", "solution"] }),
      seg("v7", "Suivi automatique.", { preuveIds: ["P4"], marqueurs: ["solution"], coupeCourteVoulue: true }),
      seg("v8", "En cas de problème, une alerte part sur Telegram.", { preuveIds: ["P7"], marqueurs: ["solution"] }),
    ];
    const ps: SegmentScript[] = [
      seg("v9", "Aujourd'hui, cette tâche prend 0 heure par semaine.", { preuveIds: ["P6"], marqueurs: ["livraison", "relance"], emphase: ["0 heure"], incrustation: { type: "montant", texte: "35 h → 0 h", sens: "gain" } }),
      seg("v10", "La personne, elle, a changé de poste.", { preuveIds: ["P5"], marqueurs: ["boucle-fermee", "emotion"] }),
      seg("v11", "Ça ne marche pas quand vos données changent de forme chaque mois.", { marqueurs: ["exception"], annotations: { pause: { sec: 0.4, proposee: true } } }),
      seg("v12", "Chez lui, toutes les données sont passées en temps réel.", { preuveIds: ["P8"], incrustation: { type: "montant", texte: "100 %", sens: "gain" } }),
    ];
    e.corps = [bloc("coeur", ...cs), bloc("preuve", ...ps)];
    e.fin = [bloc("appel", seg("v13", "Envoyez-la à celui qui tient vos Excel.")), bloc("boucle", seg("v14", "Avant, la personne y passait…"))];
    e.appel = { type: "envoi", texte: "Envoyez-la à celui qui tient vos Excel.", selonObjectif: true };
    e.encadre = { texte: "Remplacer Excel · un temps plein" };
    e.maitre!.exception = { texte: "Ça ne marche pas quand vos données changent de forme chaque mois.", source: "proposition-machine", valideeParWill: false, restreint: 5 };
    e.maitre!.envoi = { destinataire: "celui qui tient vos Excel", phrase: "Envoyez-la à celui qui tient vos Excel.", preuveIds: [] };
    e.publication!.motsDiese = ["#excel", "#tableaudebord", "#automatisation", "#gestion"];
    modif(e);
  });
}

const FINALISTES_V4 = [
  { id: "F1", famille: "chiffre-choc", dit: "Trente-cinq heures par semaine sur Excel.", preuveIds: ["P1"], porteAngle: false },
  { id: "F2", famille: "question", dit: "Combien d'heures par semaine partent dans vos Excel ?", preuveIds: [], porteAngle: false },
  { id: "F3", famille: "cible-nommee", dit: "Dirigeants : qui passe sa semaine sur vos Excel ?", preuveIds: [], porteAngle: false },
];
const ctxFinalistes = { preuves: Object.values(P), recette: RECETTE, disponibles: { types: ["cas-client"], preuveChiffree: true, accordAvantApres: true, scene: false } };

type Defaut = [banc: string, gravite: "P0" | "P1", defaut: string, code: string, cas: () => string[]];
const leves06 = () => codesLeves(controlerVersion(banc06()));
const lev = (f: (e: EntreeControle) => void) => () => codesLeves(controlerVersion(temoin(f)));
const levV4 = (f: (e: EntreeControle) => void) => () => codesLeves(controlerVersion(bancV4(f)));
const levesV4 = () => codesLeves(controlerVersion(bancV4()));

const DEFAUTS: Defaut[] = [
  // Banc 06 (B.7.6) : P0 et motifs de blocage communs.
  ["06", "P0", "rien de vrai qui vienne de chez Axion (aucun ancrage)", "C31", leves06],
  ["06", "P0", "« automatiser Excel » contredit P4 (mot-clé)", "C10 bis", leves06],
  ["06", "P0", "« automatisé » contredit P4 (texte dit)", "C1 bis", leves06],
  ["06", "P0", "jauge « à moitié » sur une preuve sans chiffre", "C17 bis", leves06],
  ["06", "P0", "émotion dite par le double", "C32", leves06],
  ["06", "P0", "téléprompteur : texte du double recopié", "C35", lev((e) => ((e.mode = "teleprompteur"), (e.empreinteCorpsAvatar = empreinte(JSON.stringify(e.corps.map((b) => [b.blocRecette, b.segments.map((s) => [s.texte.trim(), s.facultatif ?? ""])]))))))],
  ["06", "P0", "trame qui n'en est pas une (phrases entières, aucune case avis / limite)", "C35", lev((e) => ((e.mode = "trame"), (e.trame = { reperes: ["Chez un client une personne tenait les données à temps plein", "Tous les Excel ont été supprimés aujourd'hui"], chiffres: [], verbatim: { accroche: "x", appel: "y" }, casesWill: { limite: { texte: "" } } })))],
  ["06", "P0", "accroche interdite parmi les finalistes (« Arrêtez. » seul)", "C3 bis", lev((e) => (e.ouverture = [bloc("accroche", seg("t1", "Un temps plein dans Excel ? Arrêtez."))]))],
  ["06", "P0", "deux chiffres dans l'accroche (« Trente-cinq heures avant. Zéro aujourd'hui. »)", "C41", lev((e) => (e.ouverture = [bloc("accroche", seg("t1", "Trente-cinq heures avant. Zéro aujourd'hui.", { preuveIds: ["P1", "P6"] }))]))],
  ["06", "P1", "mot-clé : « automatiser Excel » jamais dit tel quel avant 5 s", "C10", leves06],
  ["06", "P1", "illustration interdite (silhouette, icône Excel, notification Telegram)", "C17", leves06],
  ["06", "P1", "emphase dès l'image 1 et sur trop de segments", "C22", leves06],
  ["06", "P1", "« 35 h » incrusté dès l'image 1", "C18", leves06],
  ["06", "P1", "encadré de 6 mots qui recopie la parole", "C19", leves06],
  ["06", "P1", "boucle ouverte annoncée (« Et je vous dis… »)", "C40", leves06],
  ["06", "P1", "tournure « Résultat. » en tête et « Et je vous dis »", "C5", leves06],
  ["06", "P1", "« D-A-F » et « Télégram » écrits sous leur forme dite", "C24", leves06],
  ["06", "P1", "capture réelle sans accord de capture", "C2", leves06],
  ["06", "P1", "11 preuves dites (3 au plus)", "C28", leves06],
  ["06", "P1", "pause posée par la machine, hors relance ou exception", "C73", leves06],
  ["06", "P1", "boucle après une question d'expert", "C21 bis", leves06],
  ["06", "P1", "« Chiffres vérifiés » dans la publication", "C37", leves06],
  ["06", "P1", "« garder » sans rien à garder (Facebook)", "C34", lev((e) => ((e.reseau = PARAMS.reseau("facebook")), (e.appel = { type: "sauvegarde", texte: "Gardez cette vidéo pour plus tard.", selonObjectif: false })))],
  ["06", "P1", "le double sur TikTok, en format avocat : « vous en personne » proposé", "C48", leves06],
  // Banc v4, brief 1 (juges 1 et 2) : critère v5 « C30 bis, C28, C39, C64, C21 bis, C69 sur le brief 1 ».
  ["v4", "P0", "limite inventée par la machine, dite dans le texte", "C30 bis", levesV4],
  ["v4", "P0", "limite inventée : version « à compléter »", "C30", levesV4],
  ["v4", "P0", "C28 compté par segment : 8 preuves dites dans la version", "C28", levesV4],
  ["v4", "P0", "envoi à la personne remplacée", "C64", levesV4],
  ["v4", "P0", "avis à portée juridique dit par le double (brief 2)", "C32", lev((e) => ((e.matieres = [...e.matieres, matiere("avis-will", "Pas sans règle écrite et sans outil adapté.", { id: "b2-avis" })]), (e.maitre!.appuiPrincipal = { matiereId: "b2-avis" }), (e.maitre!.brief = { ...e.maitre!.brief, sujetSensible: "juridique" })))],
  ["v4", "P0", "sujets trop pauvres écrits quand même (briefs 2 et 3) : arrêt avant toute dépense", "C67", () => {
    const q = matiere("question-recue", "Est-ce que je peux laisser mes salariés utiliser ChatGPT avec nos fichiers clients ?", { pilier: "ia", motsCles: ["chatgpt"] });
    const a = matiere("avis-will", "Pas sans règle écrite et sans outil adapté.", { pilier: "ia", motsCles: ["chatgpt"] });
    const r = choisirCombinaison(entreeChoix({ matieres: [q, a], preuves: [] }, { idee: "ChatGPT et fichiers clients", pilier: "ia", motsCles: ["chatgpt"] }));
    return !r.ok && r.manque.type === "MATIERE_INSUFFISANTE" ? ["C67"] : [];
  }],
  ["v4", "P1", "pente « catalogue » : 3 solutions de suite", "C39", levesV4],
  ["v4", "P1", "boucle agrammaticale une fois assemblée (« y … sur Excel »)", "C21 bis", levesV4],
  ["v4", "P1", "F1 sans marqueur d'anomalie retenue en finaliste", "C69", () => controlerFinalistes(FINALISTES_V4, ctxFinalistes).violations.map((v) => v.controle)],
  ["v4", "P1", "angle absent de toutes les accroches finalistes", "C69", () => (controlerFinalistes(FINALISTES_V4, ctxFinalistes).violations.some((v) => /angle/.test(v.message)) ? ["C69"] : [])],
  ["v4", "P1", "même preuve deux fois en 4 s", "C38 bis", levesV4],
  ["v4", "P1", "mot-clé plaqué : « Remplacer Excel, concrètement : »", "C10 ter", levesV4],
  ["v4", "P1", "tics : « Car » en tête, « concrètement »", "C5 ter", levesV4],
  ["v4", "P1", "exception qui ne restreint pas l'affirmation qui la précède", "C30 ter", levesV4],
  ["v4", "P1", "« la paix d'esprit » dans la légende (Reels)", "C5", levV4((e) => (e.publication!.texte = "Pour le dirigeant : la paix d'esprit."))],
  ["v4", "P1", "« validé » dans la description (Shorts)", "C37", levV4((e) => (e.publication!.texte = "Source : cas client Axion-IA validé."))],
  ["v4", "P1", "question Facebook sur une personne", "C34", levV4((e) => ((e.reseau = PARAMS.reseau("facebook")), (e.appel = { type: "question-expert", texte: "Qui tient vos Excel, chez vous ?", selonObjectif: false }), (e.fin = [bloc("appel", seg("v13", "Qui tient vos Excel, chez vous ?"))])))],
  ["v4", "P1", "#excel incompatible avec la preuve P4", "C75", levesV4],
  ["v4", "P1", "émotion sans phrase reliée, point de vue sans marque", "C65", levV4((e) => ((e.maitre!.pointDeVue = "un-dirigeant"), (e.maitre!.emotion = "surprise"), e.corps.forEach((b) => b.segments.forEach((s) => (s.marqueurs = (s.marqueurs ?? []).filter((m) => m !== "emotion"))))))],
  ["v4", "P1", "« informaticien » réfuté par « développeur » (brief 3)", "C68", () => {
    const i = matiere("idee-recue", "Il faut un informaticien pour automatiser.", { pilier: "auto", motsCles: ["automatiser"] });
    const o = matiere("observation", "La plupart des automatisations que je livre en PME se font sans développeur.", { pilier: "auto", motsCles: ["automatiser"] });
    const r = choisirCombinaison(entreeChoix({ matieres: [i, o], preuves: [] }, { idee: "Automatiser sans développeur", pilier: "auto", motsCles: ["automatiser"] }));
    return !r.ok && r.autres.some((x) => x.type === "TERME_A_CONFIRMER") ? ["C68"] : [];
  }],
  ["v4", "P1", "« outil adapté » gardé sans précision (brief 2)", "C76", () => {
    const q = matiere("question-recue", "Est-ce que je peux laisser mes salariés utiliser ChatGPT avec nos fichiers clients ?", { pilier: "ia", motsCles: ["chatgpt"] });
    const a = matiere("avis-will", "Pas sans règle écrite et sans outil adapté.", { pilier: "ia", motsCles: ["chatgpt"] });
    const r = choisirCombinaison(entreeChoix({ matieres: [q, a], preuves: [] }, { idee: "ChatGPT et fichiers clients", pilier: "ia", motsCles: ["chatgpt"] }));
    return !r.ok && r.autres.some((x) => x.type === "MATIERE_A_PRECISER") ? ["C76"] : [];
  }],
  ["v4", "P1", "accroche non permise gardée (« Arrêtez. » seul)", "C3 bis", levV4((e) => (e.ouverture = [bloc("accroche", seg("v1", "Un temps plein dans Excel ? Arrêtez.", { marqueurs: ["mot-cle"] }))]))],
  ["v4", "P1", "règle à retenir omise (S3, objectif « faire partager »)", "C67", () => {
    const r = choisirCombinaison(entreeChoix({ matieres: [M.cas], preuves: [P.P4] }, { structureImposee: "AV.S3" }));
    return !r.ok && /règle à retenir/.test(r.manque.ceQuIlFaudrait) ? ["C67"] : [];
  }],
  ["v4", "P1", "téléprompteur : ouvertures non copiées des versions réseau", "C35", lev((e) => ((e.mode = "teleprompteur"), (e.prompteur = "Dirigeants : combien d'heures sur Excel ?\nEnvoyez-la à votre DAF, il saura quoi en faire.")))],
  ["v4", "P1", "redondances (brief 2) : même matière trois fois", "C38 bis", lev((e) => ["c1", "c3", "c4"].forEach((id) => e.corps.forEach((b) => b.segments.forEach((s) => s.id === id && (s.matiereIds = ["m-limite"])))))],
];

describe("cas 35 h transposé : chaque défaut P0 et P1 des deux bancs est détecté", () => {
  it.each(DEFAUTS)("banc %s · %s · %s → %s", (_b, _g, _d, code, cas) => {
    expect(cas()).toContain(code);
  });
});

describe("cas fixe n° 1, attendus de B.7.7", () => {
  it("avec une matière et une limite de Will : garde-fous verts (témoin)", () => expect(controlerVersion(temoin()).passe).toBe(true));
  it("aucune note écrite par le rédacteur (C27 : la note de 89 du banc 06)", () => expect(codesLeves(controlerVersion(temoin((e) => (e.corps[0].segments[0].texte = "Remplacer Excel, ici, voulait dire tout supprimer (89/100)."))))).toContain("C27"));
  it("téléprompteur : corps distinct sous le plafond, ouverture et fin copiées", () => {
    const r = controlerVersion(temoin((e) => ((e.mode = "teleprompteur"), (e.debit = 2.9), (e.prompteur = "Un temps plein, rien que pour des Excel.\n**Remplacer Excel**, ici,\nc'était tout supprimer.\nEnvoyez-la à votre DAF,\nil saura quoi en faire."))));
    expect(r.violations.filter((v) => v.controle === "C35")).toEqual([]);
    expect(r.violations.filter((v) => v.controle === "C12" && v.niveau === "correction")).toEqual([]);
  });
  it("trame : cases préremplies, fin sur l'appel, sans boucle", () => {
    const r = controlerVersion(temoin((e) => ((e.mode = "trame"), (e.boucle = false), (e.fin = [e.fin[0]]), (e.trame = { reperes: ["un temps plein", "tout supprimé", "0 heure"], chiffres: ["35 h → 0 h"], verbatim: { accroche: "Un temps plein, rien que pour des Excel.", appel: "Envoyez-la à votre DAF." }, casesWill: { limite: { texte: M.limite.texte, matiereId: "m-limite" } } }))));
    expect(r.violations.filter((v) => v.controle === "C35")).toEqual([]);
  });
});

describe("défauts des juges retirés des règles (et pourquoi) — ils ne doivent PAS bloquer", () => {
  it("pas d'exception : facultative depuis l'addendum (point 6 : 5 vidéos l'avocat de référence sur 18 en ont une)", () => {
    expect(codesLeves(controlerVersion(temoin((e) => (e.corps[1].segments[1].marqueurs = ["relance"]))), ["bloquant"])).not.toContain("C30");
  });
  it("« corps identique entre réseaux » (C12 bis) : supprimé en v5 (la règle Meta vise le contenu d'autrui)", () => {
    expect(codesLeves(controlerVersion(temoin((e) => (e.autresVersions = [{ reseau: "instagram", accrocheDite: "Autre accroche." }]))))).not.toContain("C12 bis");
  });
  it("« vécu de Will absent » : un ancrage réel suffit (décision des ancrages variés)", () => {
    expect(controlerVersion(temoin()).violations.filter((v) => v.controle === "C31")).toEqual([]);
  });
  it("le double sur TikTok n'est qu'une proposition (C48, information)", () => {
    expect(controlerVersion(temoin()).violations.find((v) => v.controle === "C48")?.niveau).toBe("info");
  });
});
