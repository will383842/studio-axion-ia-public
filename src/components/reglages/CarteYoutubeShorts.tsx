"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { definirYoutubeActifAction, enregistrerReglagesYoutubeAction } from "@/app/(studio)/reglages/actions-youtube";
import { Bouton } from "@/components/ui/Bouton";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { VueYoutube } from "@/domaine/chaine-youtube";
import { appliquerSuggestions, detailInterrupteur, reglagesModifies, TEXTES_LOGIQUE_YOUTUBE } from "./youtube-logique";
import { lireReglagesYoutube, PROPOSITION_YOUTUBE, type SourceTitreYoutube, type SynthetiqueYoutube, type VisibiliteYoutube } from "@/fournisseurs/publication/zernio-youtube";

export const TEXTES_YOUTUBE = {
  rappel: "Seuls les Shorts verticaux de 3 minutes au plus, 10 par jour et par compte.",
  suggestion: "Suggestion",
  suggestionAide: "Les suggestions ne s'appliquent jamais seules : rien ne change tant que vous ne cliquez pas.",
  utiliserSuggestions: "Remplir avec les suggestions",
  avertissementPublic: "Public : chaque Short sera visible de tout le monde dès sa publication. Pour un premier essai, choisissez plutôt « Privé ».",
  chaineRelie: "Chaîne reliée",
  chaineAbsente: "Aucune chaîne YouTube n'est reliée pour l'instant : rien ne peut partir.",
  chaineInconnue: "L'état de la chaîne n'est pas encore connu : utilisez « Tester » dans « Vos comptes de publication ».",
  interrupteur: "Envoyer les Shorts sur YouTube",
} as const;

const VISIBILITES: { valeur: VisibiliteYoutube; libelle: string }[] = [
  { valeur: "private", libelle: "Privé" },
  { valeur: "unlisted", libelle: "Non répertorié" },
  { valeur: "public", libelle: "Public" },
];
const SYNTHETIQUES: { valeur: SynthetiqueYoutube; libelle: string }[] = [
  { valeur: "oui", libelle: "Oui" },
  { valeur: "non", libelle: "Non" },
  { valeur: "selon-la-video", libelle: "Selon la vidéo" },
];
const TITRES: { valeur: SourceTitreYoutube; libelle: string }[] = [
  { valeur: "studio", libelle: "Titre préparé par le Studio" },
  { valeur: "premiere-ligne", libelle: "Première ligne du texte" },
];
const CATEGORIES: { id: string; libelle: string }[] = [
  { id: "27", libelle: "Éducation" },
  { id: "28", libelle: "Sciences et technologies" },
  { id: "26", libelle: "Comment faire et style" },
  { id: "22", libelle: "Personnes et blogs" },
  { id: "24", libelle: "Divertissement" },
  { id: "25", libelle: "Actualités et politique" },
];
const libelleDe = <V extends string>(liste: { valeur: V; libelle: string }[], v: V) => liste.find((x) => x.valeur === v)?.libelle ?? v;
const libelleCategorie = (id: string) => CATEGORIES.find((c) => c.id === id)?.libelle ?? `Catégorie ${id}`;

interface Brouillon {
  visibilite?: VisibiliteYoutube;
  categorieId: string;
  synthetique?: SynthetiqueYoutube;
  pourEnfants?: boolean;
  titre?: SourceTitreYoutube;
}

/** Réglages › Publication : YouTube Shorts. Tout éteint par défaut ; les suggestions ne sont jamais appliquées sans clic. */
export function CarteYoutubeShorts({ vue }: { vue: VueYoutube }) {
  const router = useRouter();
  const idCategorie = useId();
  const [b, setB] = useState<Brouillon>(vue.reglages ?? { categorieId: "" });
  const [actif, setActif] = useState(vue.actif);
  const [enCours, demarrer] = useTransition();
  const complet = lireReglagesYoutube(b);
  const sugg = PROPOSITION_YOUTUBE;
  const modifie = reglagesModifies(b, vue.reglages);
  const categories = b.categorieId && !CATEGORIES.some((c) => c.id === b.categorieId) ? [...CATEGORIES, { id: b.categorieId, libelle: libelleCategorie(b.categorieId) }] : CATEGORIES;

  function appeler(action: () => Promise<{ ok: boolean; message?: string }>, succes: string, retour?: () => void) {
    demarrer(async () => {
      let r;
      try {
        r = await action();
      } catch {
        retour?.();
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        retour?.();
        notifier.erreur(r.message ?? "Le choix n'a pas été enregistré.");
        return;
      }
      notifier.succes(succes);
      router.refresh();
    });
  }

  function enregistrer() {
    if (!complet) return;
    appeler(() => enregistrerReglagesYoutubeAction(complet), "Réglages enregistrés");
  }

  function changerEnvoi(v: boolean) {
    const avant = actif;
    setActif(v);
    appeler(() => definirYoutubeActifAction(v), v ? "Envoi allumé" : "Envoi éteint", () => setActif(avant));
  }

  const chaine = vue.chaine;
  const pastilles = <V extends string>(liste: { valeur: V; libelle: string }[]) => liste.map((x) => ({ valeur: x.valeur, libelle: x.libelle }));

  return (
    <div className="space-y-5">
      <p className="text-sm text-texte-doux">{TEXTES_YOUTUBE.rappel}</p>

      <p role="status" className="text-sm text-texte">
        {chaine.etat === "relie" ? `${TEXTES_YOUTUBE.chaineRelie} : ${chaine.nom}.` : chaine.etat === "absent" ? TEXTES_YOUTUBE.chaineAbsente : TEXTES_YOUTUBE.chaineInconnue}
      </p>

      <p className="text-xs text-texte-doux">{TEXTES_YOUTUBE.suggestionAide}</p>

      <div className="space-y-1">
        <SelecteurPastilles<VisibiliteYoutube> libelle="Qui peut voir le Short" options={pastilles(VISIBILITES)} valeur={b.visibilite} onChange={(v) => setB((s) => ({ ...s, visibilite: v }))} />
        <p className="text-xs text-texte-faible">
          {TEXTES_YOUTUBE.suggestion} : {TEXTES_LOGIQUE_YOUTUBE.suggestionVisibilite}
        </p>
      </div>
      {b.visibilite === "public" && (
        <p role="alert" className="rounded-carte border border-ambre bg-surface-2 p-3 text-sm font-semibold text-ambre">
          {TEXTES_YOUTUBE.avertissementPublic}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={idCategorie} className="mb-1.5 block text-sm font-semibold text-texte-doux">
          Catégorie
        </label>
        <select
          id={idCategorie}
          value={b.categorieId}
          onChange={(e) => setB((s) => ({ ...s, categorieId: e.target.value }))}
          className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-texte"
        >
          <option value="">À choisir</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
        </select>
        <p className="text-xs text-texte-faible">
          {TEXTES_YOUTUBE.suggestion} : {libelleCategorie(sugg.categorieId)}
        </p>
      </div>

      <div className="space-y-1">
        <SelecteurPastilles<SynthetiqueYoutube> libelle="Contenu généré par IA" options={pastilles(SYNTHETIQUES)} valeur={b.synthetique} onChange={(v) => setB((s) => ({ ...s, synthetique: v }))} />
        <p className="text-xs text-texte-faible">
          {TEXTES_YOUTUBE.suggestion} : {libelleDe(SYNTHETIQUES, sugg.synthetique)}
        </p>
      </div>

      <div className="space-y-1">
        <SelecteurPastilles<"oui" | "non">
          libelle="Vidéo faite pour les enfants"
          options={[
            { valeur: "oui", libelle: "Oui" },
            { valeur: "non", libelle: "Non" },
          ]}
          valeur={b.pourEnfants === undefined ? undefined : b.pourEnfants ? "oui" : "non"}
          onChange={(v) => setB((s) => ({ ...s, pourEnfants: v === "oui" }))}
        />
        <p className="text-xs text-texte-faible">
          {TEXTES_YOUTUBE.suggestion} : {sugg.pourEnfants ? "Oui" : "Non"}
        </p>
      </div>

      <div className="space-y-1">
        <SelecteurPastilles<SourceTitreYoutube> libelle="D'où vient le titre" options={pastilles(TITRES)} valeur={b.titre} onChange={(v) => setB((s) => ({ ...s, titre: v }))} />
        <p className="text-xs text-texte-faible">
          {TEXTES_YOUTUBE.suggestion} : {libelleDe(TITRES, sugg.titre)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Bouton type="button" variante="secondaire" disabled={enCours} onClick={() => setB((s) => appliquerSuggestions(s))}>
          {TEXTES_YOUTUBE.utiliserSuggestions}
        </Bouton>
        <Bouton type="button" disabled={enCours || !complet} onClick={enregistrer}>
          Enregistrer ces réglages
        </Bouton>
      </div>
      {modifie && (
        <p role="status" className="text-sm font-semibold text-ambre">
          {TEXTES_LOGIQUE_YOUTUBE.nonEnregistre}
        </p>
      )}

      <div className="border-t border-trait pt-3">
        <Interrupteur
          libelle={TEXTES_YOUTUBE.interrupteur}
          detail={detailInterrupteur(vue.reglages)}
          coche={actif}
          desactive={enCours || (!vue.reglages && !actif) || (modifie && !actif)}
          onChange={changerEnvoi}
        />
      </div>
    </div>
  );
}
