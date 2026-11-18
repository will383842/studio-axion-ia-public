/**
 * REGISTRE DES TEXTES VISIBLES du tutoriel de valeur (T-EXT-40) — PUR, rien ne l'appelle, aucun appel payant.
 *
 * Liste exacte de tous les textes que la vidéo dit ou montre, avec leur origine et qui les a choisis. Une fois
 * validé, le registre est figé (empreinte) ; `verifierRendu` compare mot pour mot le rendu au registre figé :
 * un texte absent ou différent bloque. Le Studio ne dit ni n'écrit jamais une phrase non écrite ou non choisie.
 *
 * Pièces non encore sur master (T-EXT-21/22/23) : types locaux minimaux ci-dessous, compatibles par structure.
 * ÉCART À LA FICHE (à trancher par le pilote) : la fiche dit « suite contiguë de mots d'UNE entrée voix ou fin » ;
 * ici un sous-titre peut chevaucher deux phrases voisines (suite contiguë de la voix entière dite, fin comprise).
 * La fiche a été lancée avant ses dépendances (T-EXT-21/22/23) : PR à garder en brouillon, types locaux à remplacer
 * par les imports réels (`./scenariste`, `./realisateur`, `./controleur`) après leur fusion.
 */
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import type { FinChoisie } from "./chef-de-projet";

/* ---- Types locaux minimaux (en attendant scenariste.ts, realisateur.ts, controleur.ts) ---- */
export interface ScriptChoisi {
  phrases: string[];
  /** "corrige" si Williams a corrigé une phrase ; sinon version A/B choisie. */
  origine?: "choisi" | "corrige";
}
export interface ParcoursTutoriel {
  etapes?: { id: string }[];
}
export interface ResultatControleTutoriel {
  id: string;
  ok: boolean;
  message: string;
  details: string[];
}
export interface VerdictControleur {
  verdict: "ok" | "bloque";
  resultats: ResultatControleTutoriel[];
}

/* ---- Types du registre ---- */
export type OuTexte = "voix" | "ecran-studio" | "maquette" | "conversation" | "fin";
export type OrigineTexte =
  | "script-choisi"
  | "script-corrige"
  | "fin-choisie"
  | "maquette-dossier"
  | "maquette-creee"
  | "conversation-dossier"
  | "proposition-studio";

export interface EntreeRegistre {
  id: string;
  texte: string;
  ou: OuTexte;
  origine: OrigineTexte;
  etapeId?: string;
  phraseIndex?: number;
  choisi: boolean;
}
export interface RegistreTextes {
  version: "registre-textes.v1";
  entrees: EntreeRegistre[];
  /** La fin est choisie mais son texte exact manque : jamais inventé, signalé par `verifierRendu`. */
  finSansTexte?: boolean;
  /** Fin choisie par l'utilisateur ("aucune" = rien après la dernière phrase). */
  fin?: FinChoisie;
  fige?: { empreinte: string; le: string };
}
export type ResultatModif = { ok: true; registre: RegistreTextes } | { ok: false; erreur: string };

const ERREUR_FIGE = "registre figé : revalider";

export function etablirRegistre(e: {
  script: ScriptChoisi;
  fin: FinChoisie;
  texteFin?: string;
  parcours: ParcoursTutoriel;
  textesMaquette: { etapeId: string; textes: string[]; creee: boolean }[];
  conversation?: { auteur: "client" | "assistant"; texte: string }[];
  propositions?: { id: string; texte: string; etapeId?: string }[];
}): RegistreTextes {
  const entrees: EntreeRegistre[] = [];
  const originePhrase: OrigineTexte = e.script.origine === "corrige" ? "script-corrige" : "script-choisi";
  e.script.phrases.forEach((texte, i) => {
    entrees.push({ id: `voix-${i + 1}`, texte, ou: "voix", origine: originePhrase, phraseIndex: i, choisi: true });
  });
  let finSansTexte = false;
  if (e.fin === "prendre-rendez-vous") {
    if (e.texteFin !== undefined && normaliser(e.texteFin) !== "") {
      entrees.push({ id: "fin-1", texte: e.texteFin, ou: "fin", origine: "fin-choisie", choisi: true });
    } else {
      finSansTexte = true;
    }
  }
  for (const m of e.textesMaquette) {
    m.textes.forEach((texte, i) => {
      entrees.push({
        id: `maquette-${m.etapeId}-${i + 1}`,
        texte,
        ou: "maquette",
        origine: m.creee ? "maquette-creee" : "maquette-dossier",
        etapeId: m.etapeId,
        choisi: true,
      });
    });
  }
  (e.conversation ?? []).forEach((c, i) => {
    entrees.push({ id: `conversation-${i + 1}`, texte: c.texte, ou: "conversation", origine: "conversation-dossier", choisi: true });
  });
  for (const p of e.propositions ?? []) {
    entrees.push({ id: p.id, texte: p.texte, ou: "ecran-studio", origine: "proposition-studio", etapeId: p.etapeId, choisi: false });
  }
  const r: RegistreTextes = { version: "registre-textes.v1", entrees, fin: e.fin };
  if (finSansTexte) r.finSansTexte = true;
  return r;
}

export function choisirProposition(r: RegistreTextes, id: string, choisi: boolean): ResultatModif {
  if (r.fige) return { ok: false, erreur: ERREUR_FIGE };
  const cible = r.entrees.find((x) => x.id === id);
  if (!cible || cible.origine !== "proposition-studio") return { ok: false, erreur: `proposition inconnue : ${id}` };
  return { ok: true, registre: { ...r, entrees: r.entrees.map((x) => (x.id === id ? { ...x, choisi } : x)) } };
}

function empreinteDe(r: RegistreTextes): string {
  const choisies = r.entrees.filter((x) => x.choisi).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return fnv1a64(jsonCanonique(choisies));
}

export function figerRegistre(r: RegistreTextes, le: string): ResultatModif {
  if (r.fige) return { ok: false, erreur: ERREUR_FIGE };
  return { ok: true, registre: { ...r, fige: { empreinte: empreinteDe(r), le } } };
}

/* ---- Vérification du rendu ---- */
/** Seules les espaces (insécables comprises) et les apostrophes typographiques sont normalisées. */
function normaliser(t: string): string {
  return t
    .replace(/[\s   ]+/g, " ")
    .replace(/[’‘ʼ]/g, "'")
    .trim();
}
function mots(t: string): string[] {
  const n = normaliser(t);
  return n === "" ? [] : n.split(" ");
}
function contigu(petit: string[], grand: string[]): boolean {
  if (petit.length === 0) return true;
  for (let i = 0; i + petit.length <= grand.length; i++) {
    if (petit.every((m, k) => grand[i + k] === m)) return true;
  }
  return false;
}

export function verifierRendu(
  r: RegistreTextes,
  rendu: { voix: string; sousTitres: string[]; ecran: { texte: string; ou: Exclude<OuTexte, "voix"> }[] },
): ResultatControleTutoriel {
  const id = "TUT-REGISTRE";
  if (!r.fige) return { id, ok: false, message: "pas encore validé", details: [] };
  if (r.fige.empreinte !== empreinteDe(r)) {
    return { id, ok: false, message: "registre modifié après validation : revalider", details: [] };
  }
  const details: string[] = [];
  const messages: string[] = [];
  const echec = (m: string, d: string[]) => {
    if (!messages.includes(m)) messages.push(m);
    details.push(...d);
  };

  if (r.finSansTexte) echec("texte de la fin choisie absent du registre", ["fin choisie sans texte"]);

  const parRang = (a: EntreeRegistre, b: EntreeRegistre) => (a.phraseIndex ?? 0) - (b.phraseIndex ?? 0);
  const voixEntrees = r.entrees.filter((x) => x.choisi && x.ou === "voix").sort(parRang);
  const finEntrees = r.entrees.filter((x) => x.choisi && x.ou === "fin").sort(parRang);
  if (r.fin !== "aucune" && finEntrees.length === 0 && !r.finSansTexte) {
    echec("texte de la fin choisie absent du registre", ["fin choisie sans texte"]);
  }
  const attendu = normaliser([...voixEntrees, ...finEntrees].map((x) => x.texte).join(" "));
  const dit = normaliser(rendu.voix);
  if (dit !== attendu) {
    if (r.fin === "aucune" && dit.startsWith(attendu) && dit.length > attendu.length) {
      echec("texte dit après la fin", [dit.slice(attendu.length).trim()]);
    } else if (finEntrees.length > 0 && !dit.includes(normaliser(finEntrees[0].texte))) {
      echec("la fin choisie n'est pas dite", [finEntrees[0].texte]);
    } else {
      echec("la voix diffère du registre", [rendu.voix]);
    }
  }

  const motsDits = mots([...voixEntrees, ...finEntrees].map((x) => x.texte).join(" "));
  for (const s of rendu.sousTitres) {
    if (!contigu(mots(s), motsDits)) echec("sous-titre absent du registre", [s]);
  }

  for (const ec of rendu.ecran) {
    const t = normaliser(ec.texte);
    const memeOu = r.entrees.filter((x) => x.ou === ec.ou && normaliser(x.texte) === t);
    if (memeOu.some((x) => x.choisi)) continue;
    if (memeOu.length > 0) echec("texte proposé non choisi", [ec.texte]);
    else echec("texte absent du registre", [ec.texte]);
  }

  if (messages.length === 0) return { id, ok: true, message: "tous les textes sont au registre", details: [] };
  return { id, ok: false, message: messages.join(" ; "), details };
}

export function ajouterAuVerdict(v: VerdictControleur, r: ResultatControleTutoriel): VerdictControleur {
  const resultats = [...v.resultats.filter((x) => x.id !== r.id), r];
  return { ...v, resultats, verdict: v.verdict === "bloque" || !r.ok ? "bloque" : "ok" };
}

export function lignesPourValidation(r: RegistreTextes): { texte: string; ou: string; origine: string; choisi: boolean }[] {
  const rang: Record<OuTexte, number> = { voix: 0, maquette: 1, conversation: 1, "ecran-studio": 1, fin: 2 };
  return r.entrees
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rang[a.x.ou] - rang[b.x.ou] || a.i - b.i)
    .map(({ x }) => ({ texte: x.texte, ou: x.ou, origine: x.origine, choisi: x.choisi }));
}
