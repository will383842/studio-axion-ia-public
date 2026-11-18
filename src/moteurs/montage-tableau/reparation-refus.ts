/**
 * RÉPARATION SANS IA DES REFUS DE FORME DU DÉCOUPAGE (FIX-DECOUPAGE-AUTOREPARE-a, 18/11/2026). PUR, déterministe, ne lève jamais.
 *
 * Le Studio refuse parfois un script juste parce que l'IA du découpage l'a mal RANGÉ (une liste sur la page « douleur »,
 * 4 blocs sur une page, deux phrases clés, une page qui ne tient pas). Ce module essaie, avant toute relance payante, de
 * réparer ce rangement SEUL, avec les mêmes mots :
 *  - le texte dit (`texteDit`) et le texte de chaque ligne ne bougent jamais : aucune ligne ajoutée, aucun mot changé ;
 *    ni la partie d'une page (`gabarit.role`), ni un numéro d'étape ne changent ;
 *  - opérations permises : l'étiquette `bloc` d'une ligne (vers « detail » / « phrase-cle »), retirer `code` ou la marque
 *    « barre » (et le geste « barrer » qui la vise), retirer un élément écrit en trop (liste, détail, visuel, bloc
 *    orange), passer une scène à une page de plus ;
 *  - chaque pas est JUGÉ par la vraie validation (le juge est INJECTÉ : ce module n'importe pas `fiche.ts` en valeur, cycle
 *    fiche/gabarit) : il n'est gardé que si le nombre de problèmes baisse STRICTEMENT, sans problème NOUVEAU (messages
 *    comparés sans leurs nombres), chaque page gardant du texte écrit et chaque scène un élément. 12 pas au plus ;
 *  - rien n'est retiré en silence : chaque pas est rendu (`ReparationForme`).
 * Aucune règle, borne ni liste de blocs permis n'est touchée ici : la scène visée est celle du problème rendu par le juge.
 */
import type { ElementLigne, ElementTableau, FicheTableau, SceneTableau } from "./fiche";
import { pageDePlus } from "./densite";

/** Un problème rendu par le juge (le message est celui de la vraie validation). */
export interface ProblemeJuge {
  message: string;
  sceneId?: string;
}

/** Le juge : la liste des problèmes de la fiche (contrôles du découpage + validation complète). Peut lever : le pas est alors oublié. */
export type Juge = (fiche: FicheTableau) => readonly ProblemeJuge[];

/** Une réparation faite : jamais en silence. */
export interface ReparationForme {
  cle: string;
  page: number;
  sceneId: string;
  elementId?: string;
  quoi: string;
}

export interface OptionsReparation {
  juger: Juge;
  /**
   * Facultatif : remise en forme déterministe passée sur chaque fiche candidate AVANT son jugement (le découpage y branche le
   * rythme : retirer une liste laisse un trou d'événements visuels que le rythme comble avec des gestes sûrs). Ne doit jamais
   * toucher au texte ; si elle lève, le pas est oublié.
   */
  remettre?: (fiche: FicheTableau) => FicheTableau;
}

interface Contexte {
  juger: Juge;
  remettre: (fiche: FicheTableau) => FicheTableau;
}

/** Nombre de pas au plus (dans toute la réparation). */
export const PAS_MAX_REPARATION = 12;

type Candidat = { fiche: FicheTableau; reparations: ReparationForme[] };
type Essai = () => Candidat | null;

const estLigne = (e: ElementTableau): e is ElementLigne => e.type === "ligne";
const lignesDe = (s: SceneTableau): ElementLigne[] => s.elements.filter(estLigne);
const sansNombres = (m: string) => m.replace(/\d+/g, "#");
const normaliser = (t: string) => t.split(/\s+/).filter(Boolean).join(" ");
const BLOCS_EN_LISTE = new Set(["liste", "code", "coche", "transformation", "avant", "apres", "idee-recue"]);

const indiceDe = (f: FicheTableau, sceneId: string | undefined) => f.scenes.findIndex((s) => s.id === sceneId);
const majScene = (f: FicheTableau, i: number, g: (s: SceneTableau) => SceneTableau): FicheTableau => ({ ...f, scenes: f.scenes.map((s, k) => (k === i ? g(s) : s)) });
const texteCite = (message: string): string | undefined => /« ([^»]+) »/u.exec(message)?.[1];

/** Une liste = un bloc : les éléments du même bloc (l'avant et l'après forment un seul groupe). */
const memeGroupe = (a: string | undefined, b: string | undefined): boolean => !!a && !!b && (a === b || ((a === "avant" || a === "apres") && (b === "avant" || b === "apres")));

/** Retire `code` et la marque « barre » : la ligne devient un détail (ou la phrase clé). */
function enBloc(l: ElementLigne, bloc: "detail" | "phrase-cle"): ElementLigne {
  const r: ElementLigne = { ...l, bloc };
  delete r.code;
  if (r.marque === "barre") delete r.marque;
  return r;
}

/** Change le bloc des lignes `ids` de la scène `i` ; retire le geste « barrer » qui visait une ligne dont la marque est retirée. */
function aplatir(f: FicheTableau, i: number, ids: ReadonlySet<string>, bloc: "detail" | "phrase-cle"): FicheTableau {
  return majScene(f, i, (s) => {
    const elements = s.elements.flatMap((e): ElementTableau[] => {
      if (estLigne(e) && ids.has(e.id)) return [enBloc(e, bloc)];
      if (e.type === "geste" && e.geste === "barrer" && ids.has(e.cibleId) && bloc !== "phrase-cle") return [];
      return [e];
    });
    return { ...s, elements };
  });
}

/** Retire les lignes `ids` de la scène `i` avec les gestes qui les visent. */
function retirerLignes(f: FicheTableau, i: number, ids: ReadonlySet<string>): FicheTableau {
  return majScene(f, i, (s) => ({ ...s, elements: s.elements.filter((e) => !(estLigne(e) && ids.has(e.id)) && !(e.type === "geste" && ids.has(e.cibleId))) }));
}

/** La scène `i` ouvre une page neuve : elle et tout ce qui la suit passent à la page suivante. `null` si elle ouvre déjà sa page. */
function tournerScene(f: FicheTableau, i: number): FicheTableau | null {
  const s = f.scenes[i];
  if (!s || !f.scenes.some((x, k) => k < i && x.page === s.page)) return null;
  return { ...f, scenes: f.scenes.map((x, k) => (k >= i ? { ...x, page: x.page + 1 } : x)) };
}

const dernierIndiceDePage = (f: FicheTableau, page: number) => f.scenes.reduce((n, s, k) => (s.page === page ? k : n), -1);

const rep = (f: FicheTableau, i: number, cle: string, quoi: string, elementId?: string): ReparationForme => ({ cle, page: f.scenes[i]?.page ?? 0, sceneId: f.scenes[i]?.id ?? "", ...(elementId ? { elementId } : {}), quoi });

/** Garde-fous communs : le texte de l'utilisateur est intact, chaque page garde du texte écrit, chaque scène un élément. */
function intact(avant: FicheTableau, apres: FicheTableau): boolean {
  if (normaliser(avant.scenes.map((s) => s.texteDit).join(" ")) !== normaliser(apres.scenes.map((s) => s.texteDit).join(" "))) return false;
  const textesAvant = new Set(avant.scenes.flatMap((s) => lignesDe(s).map((l) => l.texte)));
  if (!apres.scenes.every((s) => lignesDe(s).every((l) => textesAvant.has(l.texte)))) return false;
  // Ni la partie d'une page, ni le rôle d'une scène, ni un numéro d'étape ne changent (les identifiants peuvent être
  // renumérotés par une coupe : on compare les suites, doublons voisins réunis).
  const suite = (f: FicheTableau, de: (s: SceneTableau) => string) => f.scenes.map(de).filter((x, k, t) => k === 0 || x !== t[k - 1]).join("|");
  const parties = (s: SceneTableau) => `${s.gabarit?.role ?? ""}`;
  const roles = (s: SceneTableau) => `${s.role}`;
  if (suite(avant, parties) !== suite(apres, parties) || suite(avant, roles) !== suite(apres, roles)) return false;
  const numeros = (f: FicheTableau) => JSON.stringify(f.scenes.flatMap((s) => (s.gabarit?.numero ? [s.gabarit.numero] : [])));
  if (numeros(avant) !== numeros(apres) || !apres.scenes.every((s) => s.elements.length > 0)) return false;
  const pages = new Set(apres.scenes.map((s) => s.page));
  for (const p of pages) {
    const ecrit = apres.scenes.some((s) => s.page === p && s.elements.some((e) => estLigne(e) || (e.type === "preuve" && e.lignes.length > 0)));
    if (!ecrit) return false;
  }
  return true;
}

/** Le pas est meilleur : strictement moins de problèmes, et aucun message nouveau (nombres mis à part). */
function meilleur(avant: readonly ProblemeJuge[], apres: readonly ProblemeJuge[]): boolean {
  if (apres.length >= avant.length) return false;
  const connus = new Set(avant.map((p) => sansNombres(p.message)));
  return apres.every((p) => connus.has(sansNombres(p.message)));
}

/** Les pages candidates pour « une page de plus » à partir de la scène `i` (déplacement ciblé, puis la page de plus du Studio). */
function pagesDePlus(f: FicheTableau, i: number): { fiche: FicheTableau; libelle: string }[] {
  const r: { fiche: FicheTableau; libelle: string }[] = [];
  const ciblee = tournerScene(f, i);
  if (ciblee) r.push({ fiche: ciblee, libelle: `la scène ${f.scenes[i].id} passe à une page de suite` });
  const page = f.scenes[i].page;
  const studio = pageDePlus(f, page);
  if (studio) r.push({ fiche: studio, libelle: `la page ${page} passe à une page de plus` });
  return r;
}

/** Les essais d'un problème, dans l'ordre du catalogue (CONCEPTION-DECOUPAGE-AUTOREPARE § 2.2). */
function essaisDe(f: FicheTableau, p: ProblemeJuge, ctx: Contexte, reste: number, profondeur: number): Essai[] {
  const i = indiceDe(f, p.sceneId);
  const m = p.message;
  const essais: Essai[] = [];
  const scene = f.scenes[i];

  // Règle 4 : la page ne tient pas (le texte du message nomme la page).
  if (/ne tient pas au-dessus de la bande/u.test(m)) {
    const page = Number(/page (\d+)/iu.exec(m)?.[1]);
    const j = Number.isInteger(page) ? dernierIndiceDePage(f, page) : -1;
    if (j >= 0) {
      essais.push(() => {
        const g = pageDePlus(f, page);
        return g ? { fiche: g, reparations: [rep(f, j, "page-ne-tient-pas", `la page ${page} passe à une page de plus`)] } : null;
      });
      // Le trou de `pageDePlus` : la page de plus casse une règle de page ; on la fait, puis on répare le candidat.
      if (profondeur < 1)
        essais.push(() => {
          const g = tournerScene(f, j);
          if (!g) return null;
          const dedans = boucle(g, ctx, reste - 1, profondeur + 1);
          return { fiche: dedans.fiche, reparations: [rep(f, j, "page-ne-tient-pas", `la scène ${f.scenes[j].id} passe à une page de plus, puis le rangement de la nouvelle page est réparé`), ...dedans.reparations] };
        });
    }
    return essais;
  }
  if (!scene) return essais;

  // Bloc hors partie : la liste de la scène visée (le cas du 18/11).
  if (/n'a pas sa place sur une page « |sur une scène « [^»]+ » : la douleur/u.test(m)) {
    const citee = /\(« ([^»]+) »\)/u.exec(m)?.[1];
    const cible = lignesDe(scene).find((l) => l.texte === citee);
    const bloc = cible?.bloc ?? lignesDe(scene).find((l) => l.bloc && BLOCS_EN_LISTE.has(l.bloc))?.bloc;
    const ids = new Set(lignesDe(scene).filter((l) => memeGroupe(l.bloc, bloc)).map((l) => l.id));
    if (ids.size) {
      const quoiAplati = `${ids.size} élément(s) « ${bloc} » deviennent des détails, mêmes mots`;
      essais.push(() => ({ fiche: aplatir(f, i, ids, "detail"), reparations: [rep(f, i, "bloc-hors-partie", quoiAplati)] }));
      for (const pp of pagesDePlus(aplatir(f, i, ids, "detail"), i))
        essais.push(() => ({ fiche: pp.fiche, reparations: [rep(f, i, "bloc-hors-partie", `${quoiAplati} ; ${pp.libelle}`)] }));
      essais.push(() => ({ fiche: retirerLignes(f, i, ids), reparations: [rep(f, i, "bloc-hors-partie", `la liste « ${bloc} » de ${ids.size} élément(s) est retirée (la voix dit toujours les mots)`)] }));
    }
    return essais;
  }

  const page = scene.page;
  const delaPage = f.scenes.flatMap((s, k) => (s.page === page ? [k] : []));

  if (/une liste d'un seul élément est un détail/u.test(m)) {
    const ids = new Set(lignesDe(scene).filter((l) => l.bloc === "code" || l.bloc === "coche").map((l) => l.id));
    if (ids.size) essais.push(() => ({ fiche: aplatir(f, i, ids, "detail"), reparations: [rep(f, i, "liste-un-element", "l'élément seul d'une liste devient un détail")] }));
  } else if (/phrases clés ; une seule/u.test(m)) {
    // Les suivantes deviennent des détails (le message le dit lui-même).
    let courante = f;
    const faits: ReparationForme[] = [];
    let vue = false;
    for (const k of delaPage)
      for (const l of lignesDe(f.scenes[k]))
        if (l.bloc === "phrase-cle") {
          if (!vue) vue = true;
          else {
            courante = aplatir(courante, k, new Set([l.id]), "detail");
            faits.push(rep(f, k, "phrases-cles", `la phrase clé suivante devient un détail : « ${l.texte} »`, l.id));
          }
        }
    if (faits.length) essais.push(() => ({ fiche: courante, reparations: faits }));
  } else if (/a \d+ titres ; un seul|(^|: )le titre « /u.test(m)) {
    const cite = texteCite(m);
    const titres = lignesDe(scene).filter((l) => l.bloc === "titre");
    const l = titres.find((x) => x.texte === cite) ?? titres.at(-1);
    if (l) {
      const aUnePhrase = delaPage.some((k) => lignesDe(f.scenes[k]).some((x) => x.bloc === "phrase-cle"));
      const vers = aUnePhrase ? "detail" : "phrase-cle";
      essais.push(() => ({ fiche: aplatir(f, i, new Set([l.id]), vers), reparations: [rep(f, i, "titres", `le titre « ${l.texte} » devient ${vers === "detail" ? "un détail" : "la phrase clé"}`, l.id)] }));
      if (vers === "phrase-cle") essais.push(() => ({ fiche: aplatir(f, i, new Set([l.id]), "detail"), reparations: [rep(f, i, "titres", `le titre « ${l.texte} » devient un détail`, l.id)] }));
    }
  } else if (/une seule idée reçue par page/u.test(m)) {
    let vue = false;
    for (const k of delaPage)
      for (const l of lignesDe(f.scenes[k]))
        if (l.bloc === "idee-recue") {
          if (!vue) vue = true;
          else essais.push(() => ({ fiche: aplatir(f, k, new Set([l.id]), "detail"), reparations: [rep(f, k, "idee-recue", `l'idée reçue en trop devient un détail : « ${l.texte} »`, l.id)] }));
        }
  } else if (/est barrée : au style|le geste « barrer » vise/u.test(m)) {
    const cite = texteCite(m);
    const fautives = lignesDe(scene).filter((l) => (cite ? l.texte === cite : l.marque === "barre") && l.bloc !== "idee-recue");
    if (fautives.length) {
      const ids = new Set(fautives.map((l) => l.id));
      essais.push(() => ({ fiche: majScene(f, i, (s) => ({ ...s, elements: s.elements.flatMap((e): ElementTableau[] => (estLigne(e) && ids.has(e.id) ? [sansMarque(e)] : e.type === "geste" && e.geste === "barrer" && ids.has(e.cibleId) ? [] : [e])) })), reparations: [rep(f, i, "idee-recue", "la marque « barre » est retirée d'une ligne qui n'est pas une idée reçue")] }));
    }
  } else if (/« code » ne va que sur/u.test(m)) {
    const cite = texteCite(m.replace(/^« code » ne va que sur un élément de liste à pastilles \(bloc « code »\), pas sur /u, ""));
    const cibles = lignesDe(scene).filter((l) => l.code && l.bloc !== "code" && (!cite || l.texte === cite));
    if (cibles.length) {
      const ids = new Set(cibles.map((l) => l.id));
      essais.push(() => ({ fiche: majScene(f, i, (s) => ({ ...s, elements: s.elements.map((e) => (estLigne(e) && ids.has(e.id) ? sansCode(e) : e)) })), reparations: [rep(f, i, "code-orphelin", "le champ « code » est retiré d'une ligne qui n'est pas dans la liste à pastilles")] }));
    }
  } else if (/visuels ; un seul visuel par page|ni visuel ni bloc orange/u.test(m) && scene.gabarit?.visuel) {
    essais.push(() => ({ fiche: majScene(f, i, (s) => ({ ...s, gabarit: sansChamp(s.gabarit, "visuel") })), reparations: [rep(f, i, "visuel", "le visuel en trop est retiré")] }));
  }
  if (/blocs orange ; un seul bloc orange par page|ni visuel ni bloc orange/u.test(m) && scene.gabarit?.bloc) {
    essais.push(() => ({ fiche: majScene(f, i, (s) => ({ ...s, gabarit: sansChamp(s.gabarit, "bloc") })), reparations: [rep(f, i, "bloc-orange", "le bloc orange en trop est retiré")] }));
  }
  if (/montre \d+ blocs/u.test(m)) {
    const j = dernierIndiceDePage(f, page);
    essais.push(() => {
      const g = pageDePlus(f, page);
      return g ? { fiche: g, reparations: [rep(f, j, "blocs-max", `la page ${page} passe à une page de plus`)] } : null;
    });
    if (profondeur < 1)
      essais.push(() => {
        const g = tournerScene(f, j);
        if (!g) return null;
        const dedans = boucle(g, ctx, reste - 1, profondeur + 1);
        return { fiche: dedans.fiche, reparations: [rep(f, j, "blocs-max", `la scène ${f.scenes[j].id} passe à une page de plus, puis le rangement de la nouvelle page est réparé`), ...dedans.reparations] };
      });
    // En dernier : le dernier détail de la page est retiré (la voix dit toujours les mots).
    for (const k of [...delaPage].reverse()) {
      const d = lignesDe(f.scenes[k]).filter((l) => l.bloc === "detail").at(-1);
      if (d) {
        essais.push(() => ({ fiche: retirerLignes(f, k, new Set([d.id])), reparations: [rep(f, k, "blocs-max", `le dernier détail de la page est retiré : « ${d.texte} » (la voix le dit)`, d.id)] }));
        break;
      }
    }
  }
  return essais;
}

function sansMarque(l: ElementLigne): ElementLigne {
  const r: ElementLigne = { ...l };
  if (r.marque === "barre") delete r.marque;
  return r;
}
function sansCode(l: ElementLigne): ElementLigne {
  const r: ElementLigne = { ...l };
  delete r.code;
  return r;
}
function sansChamp(g: SceneTableau["gabarit"], champ: "visuel" | "bloc"): SceneTableau["gabarit"] {
  if (!g) return g;
  const r = { ...g };
  delete r[champ];
  return r;
}

/** La boucle : un pas gardé à la fois, jugé par la vraie validation. */
function boucle(depart: FicheTableau, ctx: Contexte, pasMax: number, profondeur: number): Candidat {
  let courante = depart;
  const reparations: ReparationForme[] = [];
  let problemes = ctx.juger(courante);
  while (problemes.length && reparations.length < pasMax) {
    let pris: { c: Candidat; apres: readonly ProblemeJuge[] } | null = null;
    for (const p of problemes) {
      for (const essai of essaisDe(courante, p, ctx, pasMax - reparations.length, profondeur)) {
        let c: Candidat | null;
        let apres: readonly ProblemeJuge[];
        try {
          c = essai();
          if (!c) continue;
          c = { ...c, fiche: ctx.remettre(c.fiche) };
          if (!intact(depart, c.fiche)) continue;
          apres = ctx.juger(c.fiche);
        } catch {
          continue;
        }
        if (meilleur(problemes, apres)) {
          pris = { c, apres };
          break;
        }
      }
      if (pris) break;
    }
    if (!pris || reparations.length + pris.c.reparations.length > pasMax) break;
    courante = pris.c.fiche;
    reparations.push(...pris.c.reparations);
    problemes = pris.apres;
  }
  return { fiche: courante, reparations };
}

/**
 * Répare SANS IA les refus de forme d'une fiche (voir l'en-tête). Rend la fiche (la même si rien n'a pu être réparé) et la
 * liste des réparations faites. Ne lève jamais : un juge qui lève, une fiche illisible → fiche rendue telle quelle, aucune réparation.
 */
export function reparerRefusDeForme(fiche: FicheTableau, options: OptionsReparation): { fiche: FicheTableau; reparations: ReparationForme[] } {
  try {
    if (!fiche || !Array.isArray(fiche.scenes) || !fiche.scenes.length) return { fiche, reparations: [] };
    const r = boucle(fiche, { juger: options.juger, remettre: options.remettre ?? ((f) => f) }, PAS_MAX_REPARATION, 0);
    if (!r.reparations.length || !intact(fiche, r.fiche)) return { fiche, reparations: [] };
    return r;
  } catch {
    return { fiche, reparations: [] };
  }
}
