"use client";

/**
 * « HISTORIQUE » DE LA VIDÉO DU TABLEAU ANIMÉ : tout ce qui est arrivé à la vidéo, du plus ancien au plus récent, le
 * coût total, le fichier à télécharger et un petit formulaire « Publiée sur… ». Reçoit la vue toute faite
 * (`historiqueTableau`) ; l'aiguillage de la page ne le monte que pour ce format.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { noterPublicationAction, telechargerHistoriqueAction } from "@/app/(studio)/videos/actions-tableau-tracabilite";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { notifier } from "@/components/ui/Toast";
import { formaterMontant } from "@/lib/montants";
import type { VueHistorique } from "@/services/tableau-tracabilite";

const jourLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const quand = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${jourLong.format(d)} · ${heure.format(d)}`;
};

export function HistoriqueTableau({ videoId, vue }: { videoId: string; vue: VueHistorique }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [reseau, setReseau] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lien, setLien] = useState("");

  function telecharger() {
    demarrer(async () => {
      const r = await telechargerHistoriqueAction(videoId, "csv");
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const url = URL.createObjectURL(new Blob([r.donnees.contenu], { type: r.donnees.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.donnees.nom;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function noter() {
    demarrer(async () => {
      const r = await noterPublicationAction(videoId, reseau, date, lien);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes("Publication notée");
      setLien("");
      router.refresh();
    });
  }

  return (
    <Carte as="section" aria-label="Historique" className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-titre text-lg text-texte">Historique</h2>
          <p className="text-sm text-texte-doux">Coût total : {formaterMontant({ centimes: vue.coutTotalCentimes, devise: "EUR" })}</p>
        </div>
        <Bouton variante="secondaire" icone="telecharger" chargement={enCours} onClick={telecharger}>
          Télécharger l&apos;historique
        </Bouton>
      </div>

      {vue.lignes.length === 0 ? (
        <p className="text-[15px] text-texte-doux">Rien à raconter pour l&apos;instant.</p>
      ) : (
        <ol className="space-y-2">
          {vue.lignes.map((l) => (
            <li key={l.id} className="min-w-0 border-l-2 border-trait pl-3">
              <p className="text-[15px] text-texte">
                {l.phrase}
                {l.lien && (
                  <>
                    {" · "}
                    <a href={l.lien} target="_blank" rel="noreferrer" className="underline">
                      Voir
                    </a>
                  </>
                )}
              </p>
              <p className="text-xs text-texte-faible">{quand(l.date)}</p>
            </li>
          ))}
        </ol>
      )}

      <form
        className="space-y-3 border-t border-trait pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          noter();
        }}
      >
        <p className="text-sm font-semibold text-texte-doux">Publiée sur…</p>
        <div>
          <label htmlFor="trace-reseau" className="mb-1.5 block text-sm font-semibold text-texte-doux">
            Réseau
          </label>
          <select id="trace-reseau" value={reseau} onChange={(e) => setReseau(e.target.value)} required className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-texte">
            <option value="">Choisir…</option>
            {vue.reseaux.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </select>
        </div>
        <Champ libelle="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Champ libelle="Lien" type="url" placeholder="https://" value={lien} onChange={(e) => setLien(e.target.value)} />
        <div className="flex justify-end">
          <Bouton type="submit" chargement={enCours} disabled={!reseau || !date}>
            Noter
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}
