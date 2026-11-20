import Link from "next/link";
import { LONGUEUR_MAX_MENTION_IA } from "@/briques/mentions-legales/etiquetage-ia";
import { CLE_MENTION_TUTORIEL, type Consommation, type LigneReglage, type QuantitesConso, type VideoEnCours } from "@/services/tutoriel-console";

export interface VuePanneau {
  reglages: LigneReglage[];
  texteMention: string;
  videos: VideoEnCours[];
  consommation: Consommation;
}

interface Props {
  vue: VuePanneau;
  basculer: (donnees: FormData) => void | Promise<void>;
  enregistrerTexte: (donnees: FormData) => void | Promise<void>;
}

function phraseQuantites(q: QuantitesConso): string {
  if (q.nbDepenses === 0) return "Rien consommé pour l'instant.";
  const base = `${q.nbDepenses} dépense${q.nbDepenses > 1 ? "s" : ""} · Claude : ${q.appelsClaude} appel${q.appelsClaude > 1 ? "s" : ""} · Voix : ${q.caracteresVoix} caractères · Rendus : ${q.rendus}`;
  return q.essai ? `${base} · essai` : base;
}

/** Panneau du tutoriel d'outil : réglages (tous éteints par défaut), vidéos en cours, consommation en quantités. Aucun montant. */
export function PanneauConsole({ vue, basculer, enregistrerTexte }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="reglages-tutoriel" className="flex flex-col gap-3">
        <h2 id="reglages-tutoriel" className="text-lg font-semibold">
          Réglages
        </h2>
        <ul className="flex flex-col gap-3">
          {vue.reglages.map((r) => (
            <li key={r.cle} className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{r.libelle}</span>
                <span>{r.allume ? "Allumé" : "Éteint"}</span>
              </div>
              {!r.allume && <p className="text-sm text-texte-doux">{r.phraseEteint}</p>}
              <form action={basculer}>
                <input type="hidden" name="cle" value={r.cle} />
                <input type="hidden" name="valeur" value={r.allume ? "non" : "oui"} />
                <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
                  {r.allume ? "Éteindre" : "Allumer"}
                </button>
              </form>
              {r.cle === CLE_MENTION_TUTORIEL && (
                <form action={enregistrerTexte} className="flex flex-col gap-2">
                  <label htmlFor="texte-mention-tutoriel" className="text-sm font-semibold">
                    Texte de la mention
                  </label>
                  <input id="texte-mention-tutoriel" name="texte" type="text" defaultValue={vue.texteMention} maxLength={LONGUEUR_MAX_MENTION_IA} className="min-h-11 rounded-xl border border-trait px-3" />
                  <button type="submit" className="min-h-11 self-start rounded-full px-4 font-semibold">
                    Enregistrer le texte
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="videos-tutoriel" className="flex flex-col gap-3">
        <h2 id="videos-tutoriel" className="text-lg font-semibold">
          Vidéos en cours
        </h2>
        {vue.videos.length === 0 ? (
          <p className="text-sm text-texte-doux">Aucune vidéo en cours.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {vue.videos.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border border-trait p-4">
                <span className="flex flex-col">
                  <span className="font-semibold">{v.titre}</span>
                  <span className="text-sm text-texte-doux">{v.etat}</span>
                </span>
                <Link href={v.suivi} className="flex min-h-11 items-center font-semibold underline underline-offset-4">
                  Suivre
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/tutoriel-outil/scenes" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
          Scènes gardées
        </Link>
        <p className="text-sm text-texte-doux">Une vidéo bloquée vous prévient par la cloche.</p>
      </section>

      <section aria-labelledby="conso-tutoriel" className="flex flex-col gap-3">
        <h2 id="conso-tutoriel" className="text-lg font-semibold">
          Consommation
        </h2>
        <ul className="flex flex-col gap-3">
          {vue.consommation.parVideo.map((c) => (
            <li key={c.videoId} className="flex flex-col gap-1 rounded-2xl border border-trait p-4">
              <span className="font-semibold">{c.titre}</span>
              {c.devis && <span className="text-sm text-texte-doux">{c.devis}</span>}
              <span className="text-sm">{phraseQuantites(c)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">Ce mois-ci : {phraseQuantites(vue.consommation.moisEnCours)}</p>
        <p className="text-sm text-texte-doux">Plafond par vidéo : {vue.consommation.plafond}.</p>
      </section>
    </div>
  );
}
