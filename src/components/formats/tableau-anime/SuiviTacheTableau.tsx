"use client";

/**
 * SUIVI D'UNE TÂCHE DE FOND DU TABLEAU ANIMÉ (écriture du script, découpage en scènes). L'action a rendu la main tout de
 * suite ; ici, l'état est relu toutes les 3 s et dit en clair (« Je cherche cinq accroches… », « J'écris le script… »,
 * « Je le relis… », « Je découpe en scènes… »). Fini : la page est rechargée (le résultat s'affiche). Arrêtée (erreur,
 * interruption) : la raison en français et « Réessayer » / « Reprendre », qui ne repaie aucun appel déjà fait.
 * Découpage refusé (règles, réponse coupée ou illisible) : le message et les motifs restent affichés DURABLEMENT, avec
 * « Réessayer » (un découpage neuf, prix confirmé). Le prix est indicatif : il ne bloque pas et ne demande aucun clic.
 * Une action qui ne répond pas (réseau) n'ouvre jamais l'écran d'erreur générique : on le dit, et on réessaie.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { reprendreTacheTableauAction, suiviTacheTableauAction } from "@/app/(studio)/tableau/nouvelle/actions";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { Bouton } from "@/components/ui/Bouton";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import type { VueTacheTableau } from "@/services/tableau-taches";
import { versSuiviTacheTableau } from "./vues-gabarit";

/** Intervalle d'interrogation de l'état. */
export const INTERVALLE_SUIVI_TABLEAU_MS = 3_000;

const enMarche = (v: VueTacheTableau) => v.statut === "en-attente" || v.statut === "en-cours";

export function SuiviTacheTableau({ videoId, initiale, coutEcritureCentimes, coutDecoupageCentimes }: { videoId: string; initiale: VueTacheTableau; coutEcritureCentimes: number; coutDecoupageCentimes: number }) {
  const router = useRouter();
  const [vue, setVue] = useState(initiale);
  const [injoignable, setInjoignable] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const fini = useRef(false);

  useEffect(() => {
    if (!enMarche(vue)) return;
    let actif = true;
    const minuterie = setTimeout(async () => {
      const r = await suiviTacheTableauAction(videoId).catch(() => null);
      if (!actif) return;
      if (!r || !r.ok) {
        setInjoignable(true);
        setVue((v) => ({ ...v }));
        return;
      }
      setInjoignable(false);
      const suivante = r.donnees;
      if (!suivante) return;
      setVue(suivante);
      if ((suivante.statut === "terminee" || suivante.statut === "refusee") && !fini.current) {
        fini.current = true;
        router.refresh();
      }
    }, INTERVALLE_SUIVI_TABLEAU_MS);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [vue, videoId, router]);

  async function reprendre(montant = vue.type === "ecriture" ? coutEcritureCentimes : coutDecoupageCentimes, dejaRelance = false) {
    const message =
      vue.type === "ecriture"
        ? "La suite de l'écriture du script (les appels déjà faits ne sont pas repayés)."
        : vue.statut === "refusee"
          ? "Un nouveau découpage en scènes par Claude (deux appels au plus)."
          : "La suite du découpage en scènes (les appels déjà faits ne sont pas repayés).";
    const accord = await confirmerPrix({ message, montant });
    if (typeof accord !== "number") return;
    setPhrase(null);
    demarrer(async () => {
      const r = await reprendreTacheTableauAction(videoId, accord).catch(() => null);
      if (!r) return setPhrase("Le studio ne répond pas pour l'instant. Réessayez dans un instant.");
      if (!r.ok) return setPhrase(r.message);
      if (r.donnees.statut === "accord-requis") {
        // UNE seule relance automatique, jamais de boucle.
        if (dejaRelance) return setPhrase("Le prix a changé, réessayez.");
        return void reprendre(r.donnees.centimes, true);
      }
      if (r.donnees.statut === "refusee") return setPhrase(r.donnees.phrase);
      fini.current = false;
      setVue((v) => ({ ...v, statut: "en-attente", phrase: "Je reprends…" }));
    });
  }

  if (enMarche(vue)) {
    return (
      <section aria-label="Travail en cours" aria-live="polite" className="space-y-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-texte">
          <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-orange-vif border-t-transparent" />
          {vue.phrase}
        </p>
        {/* La phrase est dite juste au-dessus : le suivi ne la répète pas. */}
        <SuiviFabrication vue={{ ...versSuiviTacheTableau(vue), message: undefined }} compacte />
        <p className="text-sm text-texte-doux">
          {vue.appels > 0 ? `${vue.appels} appel${vue.appels > 1 ? "s" : ""} fait${vue.appels > 1 ? "s" : ""}, gardé${vue.appels > 1 ? "s" : ""}. ` : ""}
          Vous pouvez fermer cette page : le travail continue, vous le retrouverez dans « Tableau animé ».
        </p>
        {injoignable && <p className="text-sm text-texte-doux">Le studio ne répond pas pour l&apos;instant : je réessaie…</p>}
      </section>
    );
  }

  // Découpage refusé : le message et ses motifs restent à l'écran (l'écriture refusée est affichée par son écran).
  const decoupageRefuse = vue.statut === "refusee" && vue.type === "decoupage";
  if (vue.statut === "erreur" || vue.statut === "interrompue" || decoupageRefuse) {
    return (
      <section aria-label={decoupageRefuse ? "Découpage refusé" : vue.statut === "erreur" ? "Travail arrêté" : "Travail interrompu"} role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
        <SuiviFabrication vue={versSuiviTacheTableau(vue)} compacte />
        {vue.motifs.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-texte-doux">
            {vue.motifs.slice(0, decoupageRefuse ? 12 : 6).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        <Bouton icone="reessayer" chargement={enCours} onClick={() => void reprendre()}>
          Reprendre
        </Bouton>
        <BoutonAnnuler videoId={videoId} apres="/videos" />
        {phrase && <p className="text-sm text-texte-doux">{phrase}</p>}
      </section>
    );
  }
  return null;
}
