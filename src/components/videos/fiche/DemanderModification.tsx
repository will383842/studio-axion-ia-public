"use client";

/**
 * « DEMANDER UNE MODIFICATION » (lot M3 ; plan PARTIE A §2 étape 9 (c), B.9), sous le lecteur, en conversation :
 * « enlever le plan 2 », « le chiffre doit apparaître plus tôt », « plus de plans serrés au début ».
 * Le studio répond par ce qu'il va changer, les plans touchés et le prix ; RIEN ne part sans « Confirmer ».
 * Hors des capacités d'une retouche : une réponse claire, avec le prix de la vidéo à refaire.
 * 17/10 : les exemples viennent du serveur (`exemplesModification`), selon le format et la vidéo : chacun est compris.
 * Un format sans retouche n'en montre aucun, seulement sa note.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { abandonnerModificationAction, confirmerModificationAction, proposerModificationAction, suivreModificationAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { PropositionModification } from "@/services/modifications";

/** Cas concret : la demande est lue par Claude sans être attendue ; l'écran la relit à ce rythme (ms). */
const RELECTURE_MS = 3000;

const STATUTS: Partial<Record<PropositionModification["statut"], { libelle: string; ton: "sauge" | "neutre" | "orange" }>> = {
  "en-cours": { libelle: "Lecture…", ton: "neutre" },
  confirmee: { libelle: "Lancée", ton: "sauge" },
  abandonnee: { libelle: "Laissée", ton: "neutre" },
};

/** `sansPrix` (plan facecam v4, facultatif) : format qui ne montre aucun montant ; absent, rien ne change. */
export function DemanderModification({ videoId, historique: initial, possible, essai, sansPrix = false, exemples = [], note }: { videoId: string; historique: PropositionModification[]; possible: boolean; essai: boolean; sansPrix?: boolean; exemples?: string[]; note?: string }) {
  const router = useRouter();
  const [historique, setHistorique] = useState(initial);
  const [texte, setTexte] = useState("");
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  // Paquet 4 (D2) : prix renvoyé par le serveur au-delà du seuil ; c'est ce montant qui repart avec l'accord.
  const [montantAConfirmer, setMontantAConfirmer] = useState<number | undefined>(undefined);
  const [envoi, demarrer] = useTransition();

  const remplacer = (p: PropositionModification) => setHistorique((h) => h.map((x) => (x.id === p.id ? p : x)));

  // Une demande « en cours » (cas concret) est relue jusqu'à sa réponse : proposition, refus ou fin de lecture.
  const [tour, setTour] = useState(0);
  const enCours = historique.find((x) => x.statut === "en-cours");
  useEffect(() => {
    if (!enCours) return;
    const minuteur = setTimeout(async () => {
      const r = await suivreModificationAction(videoId, enCours.id);
      if (r.ok) {
        remplacer(r.donnees);
        setTour((n) => n + 1);
      } else {
        // Une erreur qui dure (proposition disparue, session…) : la relecture s'arrête, un seul message.
        notifier.erreur(r.message);
        remplacer({ ...enCours, statut: "incomprise", resume: r.message });
      }
    }, RELECTURE_MS);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCours?.id, tour, videoId]);

  function demander(t = texte) {
    if (!t.trim()) return;
    demarrer(async () => {
      const r = await proposerModificationAction(videoId, t);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      setHistorique((h) => [...h, r.donnees]);
      setTexte("");
    });
  }

  function confirmer(p: PropositionModification, auDela = false) {
    demarrer(async () => {
      const r = await confirmerModificationAction(videoId, p.id, auDela ? (montantAConfirmer ?? true) : false);
      if (!r.ok) {
        // Au-delà du seuil du mois : une seconde confirmation explicite (AV2.2-9).
        if (r.code === "CONFIRMATION_REQUISE") {
          setAConfirmer(p.id);
          setMontantAConfirmer(r.montant);
          return;
        }
        notifier.erreur(r.message);
        return;
      }
      setAConfirmer(null);
      remplacer({ ...p, statut: "confirmee", travailId: r.donnees.travailId });
      if (essai) notifier.essai("la modification est simulée, une nouvelle version arrive");
      else notifier.succes("Modification lancée", "Une nouvelle version arrive.");
      router.refresh();
    });
  }

  function laisser(p: PropositionModification) {
    demarrer(async () => {
      const r = await abandonnerModificationAction(videoId, p.id);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      remplacer({ ...p, statut: "abandonnee" });
    });
  }

  return (
    <section aria-label="Demander une modification" className="rounded-carte border border-trait bg-surface-1 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-texte-doux">
        <Icone nom="etincelles" size={16} className="text-orange-vif" />
        Demander une modification
      </h3>

      {historique.length > 0 && (
        <ol className="mb-4 space-y-3">
          {historique.map((p) => (
            <li key={p.id} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-orange-doux px-3 py-2 text-[15px] text-texte">{p.demande}</p>
              <div className={cn("max-w-[92%] rounded-2xl rounded-bl-md border px-3 py-2.5", p.statut === "hors-capacite" ? "border-ambre/40 bg-ambre-doux" : "border-trait bg-surface-2")}>
                <p className="text-[15px] text-texte">{p.resume}</p>
                {p.statut === "hors-capacite" && p.horsCapacite && p.horsCapacite.prixVideo.centimes > 0 && !sansPrix && <p className="mt-1 text-sm text-texte-doux">Refaire la vidéo : ≈ {formaterMontant(p.horsCapacite.prixVideo, { court: true })}</p>}
                {p.plansTouches.length > 0 && (
                  <p className="mt-1 text-sm text-texte-doux">
                    {p.unite === "ecran" ? "Écran" : "Plan"}{p.plansTouches.length > 1 ? "s" : ""} {p.plansTouches.join(", ")}{sansPrix ? "" : ` · ${p.cout.centimes ? `≈ ${formaterMontant(p.cout, { court: true })}` : "gratuit"}`}
                  </p>
                )}
                {p.statut === "proposee" && possible && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Bouton icone="coche" essai={essai} chargement={envoi} onClick={() => confirmer(p, aConfirmer === p.id)}>
                      {sansPrix ? "Confirmer" : aConfirmer === p.id ? `Confirmer${montantAConfirmer !== undefined ? ` · ${formaterMontant({ centimes: montantAConfirmer, devise: "EUR" }, { court: true })}` : " quand même"}` : `Confirmer${p.cout.centimes ? ` · ${formaterMontant(p.cout, { court: true })}` : ""}`}
                    </Bouton>
                    <Bouton variante="fantome" disabled={envoi} onClick={() => laisser(p)}>
                      Laisser
                    </Bouton>
                  </div>
                )}
                {STATUTS[p.statut] && (
                  <span className="mt-2 inline-block">
                    <Pastille ton={STATUTS[p.statut]!.ton}>{STATUTS[p.statut]!.libelle}</Pastille>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {possible ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            demander();
          }}
          className="space-y-3"
        >
          <ZoneTexte libelle="Votre demande" libelleMasque rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={exemples[0] ? `Ex. : ${exemples[0]}` : "Ce que vous voulez changer"} longueurMax={400} />
          {note && <p className="text-sm text-texte-faible">{note}</p>}
          {!historique.length && exemples.length > 0 && (
            <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4">
              {exemples.map((x) => (
                <button key={x} type="button" onClick={() => setTexte(x)} className="min-h-11 shrink-0 rounded-full border border-trait bg-surface-2 px-3.5 text-sm text-texte-doux hover:text-texte">
                  {x}
                </button>
              ))}
            </div>
          )}
          <Bouton type="submit" icone="envoyer" pleineLargeur chargement={envoi} disabled={!texte.trim()}>
            Voir ce qui changerait
          </Bouton>
        </form>
      ) : (
        <p className="text-sm text-texte-faible">Disponible quand la vidéo est prête.</p>
      )}
    </section>
  );
}
