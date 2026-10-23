"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirDecorIaAction } from "@/app/(studio)/reglages/actions-decor";
import { carteReglagesAction } from "@/app/(studio)/videos/actions-options-payantes";
import { CarteOptionPayante } from "@/components/options-payantes/CarteOptionPayante";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";

/**
 * BLOC « DÉCOR IA » DE RÉGLAGES (lot L10, vidéos face caméra). Désactivé par défaut.
 * Aucun prix affiché (format sansPrix), SAUF la carte « Option payante » au moment d'allumer (lot J) ; chaque vidéo
 * demande ensuite sa propre confirmation sur « Votre vidéo ». La dépense est comptée dans le budget du mois et respecte
 * son plafond.
 * À poser dans `reglages/page.tsx` (voir docs/facecam/JOURNAL-E1.md) : `<DecorIa initial={await lireReglageDecorIa()} />`.
 */
export const TEXTES_DECOR_IA = {
  libelle: "Décor IA",
  allume: "Le studio remplace le décor derrière vous, en gardant votre visage, vos lèvres et votre voix.",
  eteint: "Votre vrai décor est gardé.",
  aide: "Une pièce décrite en mots simples : « bureau clair, grande fenêtre, plantes ».",
  retire: "Option retirée : votre vrai décor est toujours gardé, rien n'est dépensé.",
  regle: "Tout ou rien : si un seul passage n'est pas parfait, la vidéo garde son vrai décor. Option payante : chaque vidéo vous demande votre accord avant.",
} as const;

/** Vérif V4 : `retire` (règle de Will, Décor IA trop cher) : l'option ne s'allume plus ; on peut seulement l'éteindre. */
export function DecorIa({ initial, retire = false }: { initial: { actif: boolean; description: string }; retire?: boolean }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  const [description, setDescription] = useState(initial.description);
  const [enCours, demarrer] = useTransition();

  // Lot J : allumer une option payante montre d'abord la carte « Option payante » (montant estimé par le serveur).
  const [carte, setCarte] = useState<{ phrase: string } | null>(null);

  function demanderAllumage() {
    demarrer(async () => {
      const res = await carteReglagesAction("decor-ia");
      if (!res.ok) {
        notifier.erreur(res.message);
        return;
      }
      if ("plafond" in res.donnees) {
        notifier.erreur(res.donnees.plafond);
        return;
      }
      setCarte(res.donnees);
    });
  }

  function enregistrer(changement: { actif?: boolean; description?: string }, succes: string, confirme = false) {
    const avant = r;
    setR({ ...r, ...changement });
    setCarte(null);
    demarrer(async () => {
      const res = await definirDecorIaAction(changement, { confirme });
      if (!res.ok) {
        setR(avant);
        notifier.erreur(res.message);
        return;
      }
      setR({ actif: res.donnees.actif, description: res.donnees.description });
      notifier.succes(succes);
      router.refresh();
    });
  }

  if (retire) {
    return (
      <Interrupteur
        icone="image"
        libelle={TEXTES_DECOR_IA.libelle}
        detail={TEXTES_DECOR_IA.retire}
        coche={r.actif}
        desactive={enCours || !r.actif}
        onChange={(v) => !v && enregistrer({ actif: false }, "Décor IA désactivé")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Interrupteur
        icone="image"
        libelle={TEXTES_DECOR_IA.libelle}
        detail={r.actif ? TEXTES_DECOR_IA.allume : TEXTES_DECOR_IA.eteint}
        coche={r.actif}
        desactive={enCours}
        onChange={(v) => (v ? demanderAllumage() : enregistrer({ actif: false }, "Décor IA désactivé"))}
      />
      {carte && !r.actif && (
        <CarteOptionPayante libelle={TEXTES_DECOR_IA.libelle} phrase={carte.phrase} enCours={enCours} onConfirmer={() => enregistrer({ actif: true }, "Décor IA activé", true)} onAnnuler={() => setCarte(null)} />
      )}
      {r.actif && (
        <div className="space-y-2">
          <ZoneTexte libelle="Le décor voulu" aide={TEXTES_DECOR_IA.aide} longueurMax={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Bouton variante="secondaire" chargement={enCours} disabled={description === r.description} onClick={() => enregistrer({ description }, "Décor enregistré")}>
            Enregistrer le décor
          </Bouton>
          <p className="flex gap-2 text-xs text-texte-faible">
            <Icone nom="info" size={13} className="mt-0.5 shrink-0" />
            {TEXTES_DECOR_IA.regle}
          </p>
        </div>
      )}
    </div>
  );
}
