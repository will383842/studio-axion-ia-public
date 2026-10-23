"use client";

/**
 * COÛT ANNONCÉ AVANT LA VOIX (tâche TB-21) : la seule étape payante du tableau animé. Le prix est montré AVANT tout
 * lancement ; rien ne part sans « Lancer ». Le prix est reçu en centimes (calculé par `coutVoixCentimes`).
 */
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { formaterMontant } from "@/lib/montants";

/**
 * `voix` : après une fabrication arrêtée dont la voix est payée, l'écran l'annonce AVANT : « la voix déjà payée sera
 * réutilisée » (même texte dit) ou « la voix sera relue : ≈ X € » (le texte dit a changé).
 */
export function CoutVoixTableau({ centimes, onLancer, chargement, essai, voix = "neuve" }: { centimes: number; onLancer?: () => void; chargement?: boolean; essai?: boolean; voix?: "neuve" | "reutilisee" | "relue" }) {
  const prix = formaterMontant({ centimes: Math.max(0, Math.ceil(centimes)), devise: "EUR" });
  const titre = voix === "reutilisee" ? "La voix déjà payée sera réutilisée" : voix === "relue" ? `La voix sera relue : environ ${prix}` : `La voix : environ ${prix}`;
  const detail = voix === "reutilisee" ? "Le texte dit n'a pas changé : rien n'est repayé." : voix === "relue" ? "Le texte dit a changé depuis la voix déjà payée. Rien n'est payé avant votre accord." : essai ? "En essai, rien n'est payé." : "Rien n'est payé avant votre accord.";
  return (
    <section aria-label="Avant de lancer" className="space-y-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icone nom="euro" size={18} className="mt-0.5 shrink-0 text-orange-vif" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-texte">{titre}</p>
          <p className="text-sm text-texte-doux">{detail}</p>
        </div>
      </div>
      {onLancer && (
        <div className="flex justify-end">
          <Bouton icone="micro" chargement={chargement} essai={essai} onClick={onLancer}>
            Lancer
          </Bouton>
        </div>
      )}
    </section>
  );
}
