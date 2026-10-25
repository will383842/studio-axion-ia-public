"use client";

/**
 * ÉCRAN 2 · « CE QUE J'AI COMPRIS » (lot L16, plan § 8, décision B6). L'image à gauche ; à droite, la carte en blocs :
 * étapes numérotées, branches en couleur, chiffres en pastilles. Les écarts entre les deux lectures sont surlignés,
 * les doutes et les formules trop affirmatives sont à trancher. Will corrige un texte, passe un chiffre en « affiché
 * seulement », garde ou adoucit une formule, puis « Valider la carte » : la carte repasse les contrôles du moteur.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { validerCarteImageVideoAction } from "@/app/(studio)/image-video/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import type { CarteImage } from "@/domaine/image-video/carte";
import { cn } from "@/lib/cn";
import { jusquALaReprise } from "./reprise";
import { AUCUNE_CORRECTION, carteACorriger, carteCorrigeeParWill, type BlocCarte, type CorrectionsCarte, type VueCarte } from "./vue";

const PASTILLE_COULEUR: Record<BlocCarte["couleur"], string> = {
  orange: "bg-orange text-sur-orange",
  noir: "bg-texte text-fond",
  vert: "bg-sauge text-fond",
  neutre: "bg-surface-3 text-texte",
};

function Bloc({ b, edition, valeur, onChange }: { b: BlocCarte; edition: boolean; valeur?: string; onChange: (v: string) => void }) {
  return (
    <li className={cn("flex items-start gap-3 rounded-2xl border px-3 py-2.5", b.ecart ? "border-ambre bg-ambre-doux" : "border-trait bg-surface-1")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full font-titre text-sm tabular-nums", PASTILLE_COULEUR[b.couleur])}>{b.numero}</span>
      <div className="min-w-0 flex-1">
        {edition ? (
          <Champ libelle={`Bloc ${b.numero}`} libelleMasque value={valeur ?? b.libelle} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <p className="text-[15px] font-semibold text-texte">{valeur ?? b.libelle}</p>
        )}
        {b.detail && <p className="text-sm text-texte-doux">{b.detail}</p>}
        {(b.chiffres.length > 0 || b.photo || b.ecart) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {b.chiffres.map((c) => (
              <Pastille key={c} ton="orange">
                {c}
              </Pastille>
            ))}
            {b.photo && <Pastille>Photo redessinée, sans personne</Pastille>}
            {b.ecart && <Pastille ton="ambre">À vérifier</Pastille>}
          </div>
        )}
      </div>
    </li>
  );
}

export function CarteComprise({ videoId, vue, carte, imageUrl }: { videoId: string; vue: VueCarte; carte: CarteImage; imageUrl: string | null }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [c, setC] = useState<CorrectionsCarte>(AUCUNE_CORRECTION);
  const [occupe, setOccupe] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);

  const libelle = (id: string) => c.libelles[id];
  const changerLibelle = (id: string, v: string) => setC((x) => ({ ...x, libelles: { ...x.libelles, [id]: v } }));
  const formulesOuvertes = vue.formules.filter((f) => !f.choix && !c.formules[f.cle]);

  async function valider() {
    if (occupe) return;
    setOccupe(true);
    setPhrase(null);
    try {
      const r = await validerCarteImageVideoAction(videoId, carteCorrigeeParWill(carte, c));
      if (!r.ok) return setPhrase(r.message);
      const fin = await jusquALaReprise(videoId, r.donnees);
      if (fin) return setPhrase(fin);
      notifier.succes("Carte validée : le script s'écrit");
      router.refresh();
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section aria-label="Ce que j'ai compris" className="grid gap-6 md:grid-cols-2">
      <div className="md:sticky md:top-4 md:self-start">
        {carte.image.cle.startsWith("texte:") ? (
          // Mode texte : la carte vient de votre description, aucune image n'existe (rien à afficher, aucun fichier lu).
          <Carte className="grid aspect-[3/4] place-items-center p-6 text-center text-texte-faible">Schéma conçu depuis votre description : aucune image à afficher.</Carte>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Votre image" className="w-full rounded-carte border border-trait bg-surface-2 object-contain" />
        ) : (
          <Carte className="grid aspect-[3/4] place-items-center text-texte-faible">Image indisponible</Carte>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pastille ton="orange" taille="md">
            {vue.bandeau}
          </Pastille>
        </div>
        <h2 className="font-titre text-2xl text-texte">{vue.titre}</h2>

        {vue.doutes.length > 0 && (
          <Carte className="border-ambre bg-ambre-doux">
            <p className="mb-1 text-sm font-semibold text-ambre">À vérifier</p>
            <ul className="space-y-1 text-sm text-texte">
              {vue.doutes.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </Carte>
        )}

        {vue.blocs.length > 0 && (
          <ol className="space-y-2">
            {vue.blocs.map((b) => (
              <Bloc key={b.id} b={b} edition={edition} valeur={libelle(b.id)} onChange={(v) => changerLibelle(b.id, v)} />
            ))}
          </ol>
        )}

        {vue.branches.length > 0 && (
          <div className={cn("grid gap-3", vue.branches.length > 1 && "sm:grid-cols-2")}>
            {vue.branches.map((br) => (
              <div key={br.id} className={cn("rounded-carte border-2 p-3", br.majoritaire ? "border-orange" : "border-trait")}>
                <p className={cn("mb-2 text-sm font-semibold", br.majoritaire ? "text-orange-vif" : "text-texte-doux")}>{br.titre}</p>
                <ol className="space-y-2">
                  {br.blocs.map((b) => (
                    <Bloc key={b.id} b={b} edition={edition} valeur={libelle(b.id)} onChange={(v) => changerLibelle(b.id, v)} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {vue.chiffres.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-texte-doux">Les chiffres · touchez pour « affiché seulement »</p>
            <div className="flex flex-wrap gap-2">
              {vue.chiffres.map((x) => {
                const dit = c.aDire[x.id] ?? x.aDire;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={dit}
                    onClick={() => setC((v) => ({ ...v, aDire: { ...v.aDire, [x.id]: !dit } }))}
                    className={cn("min-h-11 rounded-full border px-3 text-sm font-semibold", dit ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-2 text-texte-faible line-through", x.unSeul && "ring-2 ring-ambre")}
                  >
                    {x.brut}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {vue.calculs.some((k) => !k.ok) && (
          <ul className="space-y-1">
            {vue.calculs
              .filter((k) => !k.ok)
              .map((k) => (
                <li key={k.calcul} className="rounded-2xl bg-ambre-doux px-3 py-2 text-sm text-texte">
                  {k.calcul} · dit tel qu&apos;écrit sur l&apos;image
                </li>
              ))}
          </ul>
        )}

        {vue.formules.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-texte-doux">Trop affirmatif ?</p>
            {vue.formules.map((f) => {
              const choix = c.formules[f.cle] ?? f.choix;
              return (
                <Carte key={f.cle} className={cn(!choix && "border-ambre")}>
                  <p className="text-[15px] text-texte">« {f.texte} »</p>
                  <p className="mb-2 text-sm text-texte-doux">Version prudente : « {f.proposition} »</p>
                  <div className="flex flex-wrap gap-2">
                    <Bouton variante={choix === "garder" ? "principal" : "secondaire"} aria-pressed={choix === "garder"} onClick={() => setC((v) => ({ ...v, formules: { ...v.formules, [f.cle]: "garder" } }))}>
                      Garder
                    </Bouton>
                    <Bouton variante={choix === "reformuler" ? "principal" : "secondaire"} aria-pressed={choix === "reformuler"} onClick={() => setC((v) => ({ ...v, formules: { ...v.formules, [f.cle]: "reformuler" } }))}>
                      Version prudente
                    </Bouton>
                  </div>
                </Carte>
              );
            })}
          </div>
        )}

        <Carte className="bg-surface-2">
          <p className="text-sm text-texte-doux">Phrase-choc</p>
          <p className="font-titre text-lg text-texte">{vue.phraseChoc}</p>
        </Carte>

        <div className="flex flex-wrap gap-2">
          <Bouton icone="coche" taille="lg" chargement={occupe} onClick={() => void valider()}>
            {carteACorriger(c) ? "Valider la carte corrigée" : "Valider la carte"}
          </Bouton>
          <Bouton variante="secondaire" icone="ecrire" onClick={() => setEdition((v) => !v)}>
            {edition ? "Fini" : "Corriger un texte"}
          </Bouton>
          {carteACorriger(c) && (
            <Bouton variante="fantome" onClick={() => setC(AUCUNE_CORRECTION)}>
              Annuler mes corrections
            </Bouton>
          )}
        </div>
        {formulesOuvertes.length > 0 && <p className="text-sm text-texte-faible">Vous pourrez aussi trancher ces phrases au script.</p>}
        {phrase && (
          <p role="alert" className="text-sm text-brique">
            {phrase}
          </p>
        )}
      </div>
    </section>
  );
}
