"use client";

/**
 * IMAGE → VIDÉO · MA RÉSERVE. Zone d'ajout (un script collé ou une idée, réseaux en pastilles, ajout en masse séparé par
 * une ligne `---`), puis trois listes : À faire, En cours, Fait. Un élément retiré est conservé mais n'est plus montré.
 * « Fabriquer le suivant » : UNE vidéo par clic ; le prix « au plus » n'est qu'une information, il ne désactive jamais le bouton.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ajouterReserveIVAction, fabriquerSuivantReserveIVAction, retirerReserveIVAction } from "@/app/(studio)/image-video/reserve/actions";
import { Bouton } from "@/components/ui/Bouton";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { prochainIV, type ElementReserveIV, type NatureReserveIV, type ReserveIV } from "@/domaine/image-video/reserve";
import { euros, nomReseau, RESEAUX_ECRAN_IV } from "./vue";

/** Au bout de ce nombre d'essais sans succès, l'élément s'affiche en rouge. */
export const ESSAIS_ROUGE_IV = 2;

const NATURES: { valeur: NatureReserveIV; libelle: string }[] = [
  { valeur: "script", libelle: "Coller un script" },
  { valeur: "idee", libelle: "Une idée" },
];

/** Plusieurs éléments collés d'un coup : séparés par une ligne qui ne contient que `---`. Les blocs vides sont ignorés. */
export function decouperEnMasse(texte: string): string[] {
  return texte
    .split(/^[ \t]*---[ \t]*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
}

const resume = (t: string) => {
  const c = Array.from(t.replace(/\s+/g, " "));
  return c.length > 140 ? `${c.slice(0, 140).join("")}…` : t.replace(/\s+/g, " ");
};

function Ligne({ e, onRetirer }: { e: ElementReserveIV; onRetirer?: (id: string) => void }) {
  const rouge = e.etat === "a-faire" && e.essais >= ESSAIS_ROUGE_IV;
  return (
    <li className={`rounded-2xl border px-3 py-2 ${rouge ? "border-brique/40 bg-brique-doux" : "border-trait bg-surface-1"}`}>
      <p className={`text-[15px] ${rouge ? "font-semibold text-brique" : "text-texte"}`}>{resume(e.texte)}</p>
      <p className="mt-1 text-sm text-texte-doux">
        {e.nature === "script" ? "Script" : "Idée"} · {e.reseaux.map((r) => nomReseau(r as ReseauIV)).join(", ")}
      </p>
      {rouge && <p className="mt-1 text-sm font-semibold text-brique">{`Pas réussi après ${e.essais} essais${e.note ? ` : ${e.note}` : "."}`}</p>}
      {!rouge && e.etat === "a-faire" && e.note && <p className="mt-1 text-sm text-texte-doux">{e.note}</p>}
      {e.etat === "en-cours" && (
        <p className="mt-1 text-sm">
          {e.videoId ? (
            <Link href={`/image-video/${e.videoId}`} className="underline">
              Ouvrir la vidéo
            </Link>
          ) : (
            <span className="text-texte-doux">Lancement en cours…</span>
          )}
          {e.note && <span className="ml-2 font-semibold text-ambre">{e.note}</span>}
        </p>
      )}
      {onRetirer && (
        <Bouton variante="fantome" taille="md" onClick={() => onRetirer(e.id)}>
          Retirer
        </Bouton>
      )}
    </li>
  );
}

function Colonne({ titre, elements, vide, onRetirer }: { titre: string; elements: ElementReserveIV[]; vide: string; onRetirer?: (id: string) => void }) {
  return (
    <section aria-label={titre} className="space-y-2">
      <h2 className="text-lg font-semibold text-texte">
        {titre} <span className="text-texte-doux">({elements.length})</span>
      </h2>
      {elements.length ? (
        <ul className="space-y-2">
          {elements.map((e) => (
            <Ligne key={e.id} e={e} onRetirer={onRetirer} />
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-texte-doux">{vide}</p>
      )}
    </section>
  );
}

export function Reserve({ reserve, montants }: { reserve: ReserveIV; /** Prix « au plus » par nombre de réseaux (centimes) : information seulement. */ montants: Record<number, number> }) {
  const router = useRouter();
  const [nature, setNature] = useState<NatureReserveIV>("script");
  const [texte, setTexte] = useState("");
  const [reseaux, setReseaux] = useState<ReseauIV[]>(RESEAUX_ECRAN_IV.map((r) => r.valeur));
  const [phrase, setPhrase] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const verrou = useRef(false);

  const aFaire = reserve.elements.filter((e) => e.etat === "a-faire").sort((a, b) => a.rang - b.rang);
  const enCours = reserve.elements.filter((e) => e.etat === "en-cours");
  const faits = reserve.elements.filter((e) => e.etat === "fait");
  const suivant = prochainIV(reserve);
  const prix = suivant ? (montants[suivant.reseaux.length] ?? montants[RESEAUX_IV.length] ?? 0) : 0;
  const blocs = decouperEnMasse(texte);

  async function ajouter() {
    if (verrou.current || !blocs.length) return;
    verrou.current = true;
    setOccupe(true);
    setPhrase(null);
    try {
      let refuses = 0;
      let derniere: string | null = null;
      const restes: string[] = [];
      for (const b of blocs) {
        const r = await ajouterReserveIVAction({ nature, texte: b, reseaux });
        const refus = !r.ok ? r.message : r.donnees.statut === "refuse" ? r.donnees.phrase : null;
        if (refus === null) continue;
        refuses++;
        derniere = refus;
        restes.push(b);
      }
      // Ce qui n'a pas pu être ajouté reste dans la zone pour être corrigé.
      setTexte(restes.join("\n---\n"));
      if (derniere) setPhrase(refuses > 1 ? `${refuses} éléments n'ont pas été ajoutés. ${derniere}` : derniere);
      router.refresh();
    } finally {
      verrou.current = false;
      setOccupe(false);
    }
  }

  async function retirer(id: string) {
    const r = await retirerReserveIVAction(id);
    if (!r.ok) setPhrase(r.message);
    router.refresh();
  }

  async function fabriquer() {
    if (verrou.current) return;
    verrou.current = true;
    setOccupe(true);
    setPhrase(null);
    try {
      const r = await fabriquerSuivantReserveIVAction();
      if (!r.ok) setPhrase(r.message);
      else if (r.donnees.statut === "vide") setPhrase("Rien à fabriquer : la réserve est vide.");
      else if (r.donnees.statut === "occupe") setPhrase("Un lancement est déjà en route.");
      else if (r.donnees.statut === "refusee") setPhrase(r.donnees.phrase);
      router.refresh();
    } finally {
      verrou.current = false;
      setOccupe(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-label="Ajouter à la réserve" className="space-y-4">
        <SelecteurPastilles libelle="Ce que vous ajoutez" libelleMasque options={NATURES} valeur={nature} onChange={setNature} />
        <ZoneTexte
          libelle={nature === "script" ? "Votre script" : "Votre idée"}
          aide="Pour en ajouter plusieurs d'un coup, séparez-les par une ligne qui contient seulement ---"
          placeholder={nature === "script" ? "Collez le script, dit tel quel." : "Décrivez l'idée avec vos mots."}
          value={texte}
          rows={6}
          onChange={(e) => setTexte(e.target.value)}
        />
        <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={setReseaux} />
        <Bouton variante="secondaire" disabled={!blocs.length || occupe} onClick={() => void ajouter()}>
          {blocs.length > 1 ? `Ajouter les ${blocs.length} éléments` : "Ajouter à la réserve"}
        </Bouton>
      </section>

      <div className="space-y-2">
        {/* Le prix informe seulement : le bouton n'est jamais désactivé par lui. */}
        <Bouton icone="film" taille="lg" pleineLargeur chargement={occupe} disabled={occupe} onClick={() => void fabriquer()}>
          {suivant ? `Fabriquer le suivant (au plus ${euros(prix)})` : "Fabriquer le suivant"}
        </Bouton>
        {phrase && (
          <p role="alert" className="text-sm text-brique">
            {phrase}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Colonne titre="À faire" elements={aFaire} vide="Rien en attente." onRetirer={(id) => void retirer(id)} />
        <Colonne titre="En cours" elements={enCours} vide="Aucune vidéo en route." />
        <Colonne titre="Fait" elements={faits} vide="Rien de fait pour le moment." />
      </div>
    </div>
  );
}
