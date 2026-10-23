/** RECHERCHE GLOBALE (AV2.1) : Sujets (générateur, lot G1b) · Vidéos · Scripts · Idées · Personnages · Bibliothèque. En mémoire. */
import "server-only";
import { texteScript } from "@/domaine/derivations";
import { ETAPES_EDITORIALES, NATURES_PERSONNAGE, STATUTS_VIDEO, TYPES_BIBLIOTHEQUE } from "@/domaine/libelles";
import { filtrerSujets } from "@/domaine/classement-generateur";
import { ETATS_SUJET_GENERATEUR } from "@/domaine/libelles";
import { nomCourtFormat, trouverFormat } from "@/formats";
import { codeDuFormat, listerCodes } from "@/formats/registre-codes";
import { listerSujets } from "./generateur";
import { contient, tronquer } from "@/lib/textes";
import { depots, filtreExemples } from "./_commun";
import { urlFichier } from "./fichiers";
import type { ResultatRecherche } from "./vues";

export async function rechercher(requete: string, limiteParGroupe = 6): Promise<ResultatRecherche> {
  const q = requete.trim();
  const vide: ResultatRecherche = { sujets: [], videos: [], scripts: [], idees: [], personnages: [], bibliotheque: [] };
  // « 7 » est un numéro de sujet : la recherche par code accepte un seul chiffre.
  if (q.length < 2 && !/^\d$/.test(q)) return vide;
  const d = depots();
  const ex = await filtreExemples<{ estDemo?: boolean }>();

  const videos = (await d.videos.lister((v) => ex(v) && (contient(v.titre, q) || contient(v.sujet, q)))).slice(0, limiteParGroupe);
  const scripts = (await d.scripts.lister((s) => ex(s) && (contient(s.sujet, q) || contient(texteScript(s.blocs), q)))).slice(0, limiteParGroupe);
  const idees = (await d.idees.lister((i) => ex(i) && contient(i.texte, q))).slice(0, limiteParGroupe);
  const personnages = (await d.personnages.lister((p) => ex(p) && (contient(p.nom, q) || contient(p.role, q)))).slice(0, limiteParGroupe);
  const elements = (await d.elements.lister((e) => ex(e) && !e.archiveLe && (contient(e.nom, q) || e.motsCles.some((m) => contient(m, q))))).slice(0, limiteParGroupe);

  const sujets = await rechercherSujets(q, limiteParGroupe);
  if (q.length < 2) return { ...vide, sujets };

  return {
    sujets,
    videos: await Promise.all(
      videos.map(async (v) => {
        const sortie = v.versionChoisieId ? await d.sorties.trouver((s) => s.versionId === v.versionChoisieId) : null;
        // Même règle que les cartes : la miniature choisie d'abord, puis la vignette de la sortie.
        const miniature = v.miniatureChoisieId ? await d.miniatures.obtenir(v.miniatureChoisieId) : null;
        const format = trouverFormat(v.formatId);
        // Le statut se lit comme partout ailleurs : étape de publication pour une vidéo prête, sinon son état.
        const etat = v.statut === "prete" && v.etapeEditoriale ? ETAPES_EDITORIALES[v.etapeEditoriale].libelle : STATUTS_VIDEO[v.statut].libelle;
        return {
          id: v.id,
          titre: v.titre,
          sousTitre: [format ? nomCourtFormat(format) : null, etat].filter(Boolean).join(" · "),
          lien: `/videos/${v.id}`,
          vignette: (await urlFichier(miniature?.fichierId)) ?? (await urlFichier(sortie?.vignetteFichierId)),
          icone: "video" as const,
        };
      }),
    ),
    scripts: scripts.map((s) => ({
      id: s.id,
      titre: s.sujet,
      // Un script de référence et sa copie portent le même sujet : on les distingue.
      sousTitre: [s.reference ? "Référence" : `Version ${s.version}`, tronquer(texteScript(s.blocs), 60)].join(" · "),
      lien: `/scripts/${s.id}`,
      icone: "document" as const,
    })),
    idees: idees.map((i) => ({ id: i.id, titre: i.texte, sousTitre: trouverFormat(i.formatSuggere ?? "")?.nom, lien: `/ecrire?onglet=idees`, icone: "idee" as const })),
    personnages: await Promise.all(
      personnages.map(async (p) => ({
        id: p.id,
        titre: p.nom,
        sousTitre: [NATURES_PERSONNAGE[p.nature]?.libelle, p.role].filter(Boolean).join(" · "),
        lien: `/personnages/${p.id}`,
        vignette: await urlFichier(p.photoFichierId),
        icone: "personnages" as const,
      })),
    ),
    bibliotheque: await Promise.all(
      elements.map(async (e) => ({ id: e.id, titre: e.nom, sousTitre: e.motsCles.slice(0, 3).join(" · "), lien: `/bibliotheque/${e.type}`, vignette: await urlFichier(e.vignetteFichierId), icone: "bibliotheque" as const })),
    ),
  };
}

/** Sujets du générateur : par code exact (« 42 », « 0042 », « 0042-AV-TT-L », « SAR ») ou par un mot de l'idée et de l'angle. */
async function rechercherSujets(q: string, limite: number): Promise<ResultatRecherche["sujets"]> {
  const vues = await listerSujets();
  const codes = Object.fromEntries(listerCodes().map((e) => [e.formatId, e.code]));
  const trouves = filtrerSujets(vues, { q }, codes).slice(0, limite);
  return trouves.map((v) => {
    const m = v.maitre;
    const formats = [...new Set(v.grille.map((l) => l.formatId))].map((f) => codeDuFormat(f) ?? f).join(", ");
    return {
      id: m.id,
      titre: m.numero !== undefined ? `n° ${m.numero} · ${m.angle?.titre ?? m.brief.idee}` : m.brief.idee,
      sousTitre: [formats, ETATS_SUJET_GENERATEUR[v.etat]?.libelle].filter(Boolean).join(" · "),
      lien: `/ecrire/sujets/${m.id}`,
      icone: "document" as const,
    };
  });
}

/**
 * Fiches à adresse variable (E2E-1 n° 23) : existe-t-elle ? Même règle que le `notFound()` de chaque page. Sert au proxy,
 * qui doit répondre 404 AVANT que la page ne commence à s'afficher (une page en cours d'affichage répond toujours 200).
 */
export type TypeFiche = "videos" | "personnages" | "scripts" | "formats" | "bibliotheque" | "sujets" | "nouvelle" | "seances" | "lectures";

export async function ficheExiste(type: TypeFiche, id: string): Promise<boolean> {
  const d = depots();
  switch (type) {
    case "videos":
      return !!(await d.videos.obtenir(id));
    case "personnages":
      return !!(await d.personnages.obtenir(id));
    case "scripts": {
      const s = await d.scripts.obtenir(id);
      return !!s && !!trouverFormat(s.formatId);
    }
    case "formats":
      return !!trouverFormat(id);
    case "bibliotheque":
      return id === "rushs" || TYPES_BIBLIOTHEQUE.some((t) => t.type === id);
    case "sujets":
      // E2E-2 parcours n° 26 : un sujet inconnu (/ecrire/sujets/…) répond 404, comme une vidéo inconnue.
      return !!(await d.scriptsMaitres.obtenir(id));
    // VERIF-E2E-2, gêne 3 : /nouvelle/[format], /ecrire/tournage/[id] et /ecrire/sujets/[id]/lire/[variante].
    case "nouvelle":
      return !!trouverFormat(id);
    case "seances": {
      const s = await d.sessionsTournage.obtenir(id);
      return !!s && !s.archiveLe;
    }
    case "lectures": {
      // « sujet|variante » : la page « Je lis » exige une version de CE sujet, avec un texte à lire.
      const [sujet, variante] = id.split("|");
      const v = variante ? await d.variantes.obtenir(variante) : null;
      return !!v && v.scriptMaitreId === sujet && !!v.prompteur;
    }
  }
}
