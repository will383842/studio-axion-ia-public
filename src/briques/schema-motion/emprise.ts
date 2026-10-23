/**
 * EMPRISE des composants « Image → vidéo » à un instant : les blocs posés, les textes (taille en pixels) et les icônes,
 * lus dans les MÊMES plans que les composants dessinent (`plan-objets.ts`). PUR, sans alias « @/ » : lu par
 * `studio-rendu` (galeries, tests) ET par le contrôle Q21 du moteur (`montage-image-video/controles.ts`). Sert au
 * contrôle de mise en page (`controlerMiseEnPage` de `mise-en-page.ts`) : remplissage de la zone utile, marges,
 * plancher de lisibilité, icônes jamais en double. (L'emprise des galeries de micro-objets reste dans `studio-rendu`.)
 */
import { ECRAN_IV, type SchemaEntree } from "./types";
import { zoneUtile, type BlocIV, type EmpriseIV, type TexteIV } from "./mise-en-page";
import {
  etatBenefices,
  geometrieEntonnoir,
  hauteurTexte,
  planAdditionneur,
  planAlerte,
  planBandeau,
  planCarteBenefice,
  planDossiers,
  planEcranPartage,
  planEmail,
  planEnsemble,
  planEntonnoir,
  planNuee,
  planPaperboard,
  planPhraseChoc,
  planRecap,
  planRecherche,
  planSources,
  TAILLE_ETIQUETTE_PX,
  type BeneficeIV,
  type ChampEmail,
  type ChiffreBandeau,
  type DeclencheurAlerte,
  type DossierIV,
  type OptionsPlanEnsemble,
  type SourceIV,
  type TamponIV,
  type ObjetSceneIV,
  type PlanEnsemble,
  type TexteAjuste,
} from "./plan-objets";

const H = ECRAN_IV.hauteur;

/** Ce que montre un moment (composants L9a) : un composant et ses données. */
export type CorpsMomentIV =
  | { sorte: "paperboard"; etapes: string[] }
  | { sorte: "benefices"; benefices: BeneficeIV[]; heures: number[] }
  | { sorte: "recap"; benefices: BeneficeIV[] }
  | { sorte: "bandeau"; chiffres: ChiffreBandeau[]; etiquette?: string }
  | { sorte: "recherche"; requete: string; frappe: number; mots?: number[]; trouve?: { texte: string; t: number } }
  | { sorte: "alerte"; source: string; moment?: string; message: string; t0: number; frappe?: number; declencheurs?: DeclencheurAlerte[]; tampon?: TamponIV }
  | { sorte: "email"; champs: ChampEmail[]; tampon?: TamponIV }
  | { sorte: "dossiers"; dossiers: DossierIV[] }
  | { sorte: "sources"; sources: SourceIV[]; cible: { icone: string } }
  | { sorte: "phrase-choc"; phrase: string; heures?: number[] }
  | { sorte: "ensemble"; schema: SchemaEntree; options: OptionsPlanEnsemble };

/** Un moment posé sur son intervalle (secondes depuis le début de la scène). */
export type MomentEmpriseIV = { debut: number; fin: number } & CorpsMomentIV;

const texte = (nom: string, a: Pick<TexteAjuste, "taille">): TexteIV => ({ texte: nom, taille: a.taille });
const iconesDe = (benefices: readonly BeneficeIV[]) => benefices.filter((b) => b.icone).map((b) => ({ element: b.titre, icone: b.icone! }));

/** Emprise de la vue d'ensemble : ses blocs, ses parts, ses libellés courts, l'icône de chaque bloc. */
export function empriseEnsemble(plan: PlanEnsemble): EmpriseIV {
  return {
    zone: zoneUtile(),
    blocs: [...plan.blocs.map((b) => ({ ...b, nom: b.id })), ...plan.chiffres.map((c) => ({ x: c.x, y: c.y, largeur: c.largeur, hauteur: c.hauteur, nom: c.texte }))],
    textes: [...plan.blocs.map((b) => ({ texte: b.libelle.lignes.map((l) => l.join(" ")).join(" "), taille: b.libelle.taille })), ...plan.chiffres.map((c) => ({ texte: c.texte, taille: c.taille * H }))],
    icones: plan.blocs.filter((b) => b.icone).map((b) => ({ element: b.id, icone: b.icone! })),
  };
}

/** Emprise d'un moment d'une galerie L9a à l'instant `t`. */
export function empriseMoment(m: MomentEmpriseIV, t: number): EmpriseIV {
  const zone = zoneUtile();
  switch (m.sorte) {
    case "paperboard": {
      const p = planPaperboard(m.etapes, t, m.debut + 0.2);
      return { zone, blocs: [{ nom: "paperboard", x: p.x, y: p.y, largeur: p.largeur, hauteur: p.hauteurTableau + p.pieds }], textes: m.etapes.map((e) => ({ texte: e, taille: p.taille })), icones: [] };
    }
    case "benefices": {
      const e = etatBenefices(m.heures, t);
      // Comme le composant (`Benefices`) : aucune carte avant la première heure (écran vide).
      if (e.courante < 0 || !m.benefices[e.courante]) return { zone, blocs: [], textes: [], icones: iconesDe(m.benefices) };
      const b = m.benefices[e.courante];
      const p = planCarteBenefice(b);
      const blocs: BlocIV[] = [{ nom: b.titre, ...p.boite }];
      if (p.microObjet && b.micro) blocs.push({ nom: `micro-objet ${b.micro}`, ...p.microObjet });
      return { zone, blocs, textes: [texte(b.titre, p.titre), ...(p.ligne && b.ligne ? [texte(b.ligne, p.ligne)] : [])], icones: iconesDe(m.benefices) };
    }
    case "recap": {
      const r = planRecap(m.benefices, t, m.debut + 0.3);
      return { zone, blocs: r.lignes.map((l, i) => ({ nom: m.benefices[i].titre, x: r.x, y: l.y, largeur: r.largeur, hauteur: l.hauteur })), textes: r.lignes.map((l, i) => texte(m.benefices[i].titre, l.titre)), icones: iconesDe(m.benefices) };
    }
    case "bandeau": {
      const b = planBandeau(m.chiffres, t);
      return {
        zone: zoneUtile({ sansTitre: true }),
        blocs: b.rangees.map((r, i) => ({ nom: m.chiffres[i].texte, x: zone.x, y: r.y, largeur: zone.largeur, hauteur: r.hauteur })),
        textes: b.rangees.flatMap((r, i) => [texte(m.chiffres[i].texte, r.chiffre), ...(r.legende ? [texte(m.chiffres[i].legende!, r.legende)] : [])]),
        icones: [],
      };
    }
    case "recherche": {
      const r = planRecherche({ requete: m.requete, debut: m.frappe, mots: m.mots, trouve: m.trouve }, t);
      const blocs: BlocIV[] = [{ nom: "barre de recherche", ...r.barre }];
      if (r.trouve && r.resultat > 0) blocs.push({ nom: "résultat", ...r.resultatBoite });
      return { zone, blocs, textes: [texte(m.requete, r.requete), ...(r.trouve && m.trouve ? [texte(m.trouve.texte, r.trouve)] : [])], icones: [] };
    }
    case "alerte": {
      const a = planAlerte({ source: m.source, moment: m.moment, message: m.message, t: m.t0, frappe: m.frappe, declencheurs: m.declencheurs, tampon: m.tampon }, t);
      return {
        zone,
        blocs: [{ nom: "téléphone", ...a.telephone }],
        textes: [
          texte(m.message, a.message),
          { texte: a.etiquette, taille: TAILLE_ETIQUETTE_PX, horsPlancher: true },
          ...a.declencheurs.map((d, i) => texte(m.declencheurs![i].texte, d.texte)),
          ...(a.tampon && a.tampon.opacite > 0 ? [{ texte: a.tampon.texte, taille: TAILLE_ETIQUETTE_PX, horsPlancher: true }] : []),
        ],
        icones: [],
      };
    }
    case "email": {
      const p = planEmail({ champs: m.champs, debut: m.debut + 0.2, tampon: m.tampon }, t);
      const tampon = p.tampon && p.tampon.opacite > 0 ? [{ texte: p.tampon.texte, taille: TAILLE_ETIQUETTE_PX, horsPlancher: true }] : [];
      return { zone, blocs: [{ nom: "e-mail", ...p.boite }], textes: [...p.champs.map((c) => ({ texte: c.nom, taille: c.tailleNom })), ...tampon], icones: [] };
    }
    case "dossiers": {
      const p = planDossiers({ dossiers: m.dossiers, debut: m.debut + 0.2 }, t);
      return {
        zone,
        blocs: p.dossiers.map((d, i) => ({ nom: m.dossiers[i].nom, x: d.cx - d.cote / 2, y: d.y, largeur: d.cote, hauteur: d.hauteur })),
        textes: p.dossiers.map((d, i) => texte(m.dossiers[i].nom, d.nom)),
        icones: [],
      };
    }
    case "sources": {
      const p = planSources({ sources: m.sources, cible: m.cible }, t);
      const blocs: BlocIV[] = p.sources.map((s, i) => ({ nom: m.sources[i].nom ?? `source ${i + 1}`, x: s.x - s.rayon, y: s.y - s.rayon, largeur: 2 * s.rayon, hauteur: 2 * s.rayon + (s.nom ? 12 + hauteurTexte(s.nom) : 0) }));
      blocs.push({ nom: "cible", x: p.cible.x - p.cible.rayon, y: p.cible.y - p.cible.rayon, largeur: 2 * p.cible.rayon, hauteur: 2 * p.cible.rayon });
      return {
        zone,
        blocs,
        textes: p.sources.flatMap((s, i) => (s.nom ? [texte(m.sources[i].nom!, s.nom)] : [])),
        icones: m.sources.map((s, i) => ({ element: s.nom ?? `source ${i + 1}`, icone: s.icone })),
      };
    }
    case "phrase-choc": {
      const p = planPhraseChoc({ phrase: m.phrase, debut: m.debut + 0.3, heures: m.heures }, t);
      // Un écran de phrase seule : centré, sans exigence de remplissage.
      return { zone, blocs: [], textes: [{ texte: m.phrase, taille: p.taille }], icones: [], remplir: false };
    }
    case "ensemble":
      return empriseEnsemble(planEnsemble(m.schema, m.options));
  }
}

/** Emprise d'un objet de L8 (images D, E, F) à l'instant `t`. */
export function empriseObjet(o: ObjetSceneIV, t: number): EmpriseIV {
  const zone = zoneUtile();
  switch (o.sorte) {
    case "entonnoir": {
      const G = geometrieEntonnoir();
      const p = planEntonnoir(o.proprietes, t);
      return {
        zone,
        blocs: [{ nom: "entonnoir", x: G.cx - G.demiBouche, y: G.bouche - G.ryBouche, largeur: 2 * G.demiBouche, hauteur: G.sortieGoulot - G.bouche + G.ryBouche }, ...p.bacs.map((b) => ({ nom: b.libelle, x: b.x, y: b.y, largeur: b.largeur, hauteur: b.hauteur }))],
        textes: [{ texte: o.proprietes.moteur, taille: 0.045 * H }, ...p.bacs.flatMap((b) => [{ texte: b.libelle, taille: b.tailleLibelle }, { texte: String(b.compte), taille: b.tailleCompte }, { texte: `${b.pourcent} %`, taille: b.taillePart }])],
        icones: [],
      };
    }
    case "nuee": {
      const p = planNuee(o.proprietes, t);
      const xs = p.objets.map((x) => x.x);
      const ys = p.objets.map((x) => x.y);
      const grille = { nom: "nuée", x: Math.min(...xs), y: Math.min(...ys), largeur: Math.max(...p.objets.map((x) => x.x + x.largeur)) - Math.min(...xs), hauteur: Math.max(...p.objets.map((x) => x.y + x.hauteur)) - Math.min(...ys) };
      return { zone, blocs: [grille, { nom: "compteur", x: zone.x, y: p.compteur.y, largeur: zone.largeur, hauteur: p.compteur.taille * 1.1 }], textes: [{ texte: p.compteur.texte, taille: p.compteur.taille }], icones: [] };
    }
    case "ecran-partage": {
      const p = planEcranPartage(o.proprietes, t);
      const textes: TexteIV[] = p.rangs.flatMap((r) => [r.avant, r.apres]).flatMap((l) => (l ? [...(l.texte ? [{ texte: l.texte, taille: l.tailleTexte }] : []), ...(l.valeur ? [{ texte: l.valeur, taille: l.tailleValeur }] : [])] : []));
      return { zone, blocs: [{ nom: "écran partagé", ...(o.proprietes.zone ?? zone) }], textes, icones: [] };
    }
    case "additionneur": {
      const p = planAdditionneur(o.proprietes, t);
      const g = p.geometrie;
      return {
        zone,
        blocs: [
          ...g.rangs.map((r, i) => ({ nom: o.proprietes.termes[i].libelle, ...r })),
          ...(p.equation.some((m) => m.entree > 0) || p.compteur ? [{ nom: "addition", ...g.bande }] : []),
          ...(p.detail && g.detail && p.detail.entree > 0 ? [{ nom: p.detail.libelle, ...g.detail }] : []),
        ],
        textes: [
          ...o.proprietes.termes.map((m) => ({ texte: m.libelle, taille: p.tailles.libelle })),
          { texte: "minuteur", taille: p.tailles.minuteur },
          { texte: "addition", taille: p.tailles.equation },
          ...(p.compteur ? [{ texte: p.compteur.texte, taille: p.tailles.compteur }] : []),
          ...(p.detail ? [{ texte: p.detail.libelle, taille: p.detail.taille }] : []),
        ],
        icones: [],
      };
    }
  }
}
