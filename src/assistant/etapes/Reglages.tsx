"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Champ } from "@/components/ui/Champ";
import { Curseur } from "@/components/ui/Curseur";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { Pastille } from "@/components/ui/Pastille";
import { lutsConseilleesPour, sousTitresSurDecor } from "@/domaine/decors";
import { LUT_AUCUNE } from "@/donnees/luts-axion";
import { LIBELLES_BRIQUES } from "@/domaine/libelles";
import type { BriqueFacultative, NiveauIntensite, ReglageBruitages, StylesChoisis, TypeElement } from "@/domaine/types";
import { briquesCoupables, briquesEffectives, musiqueInterdite, musiqueRetenue, obtenirFormat } from "@/formats";
import type { ChampReglage } from "@/formats/types";
import { cn } from "@/lib/cn";
import type { ProprietesEtape } from "./types";

/** Formulaire GÉNÉRÉ depuis `format.reglages.champs` (réutilisable, ex. fiche vidéo > Réglages). */
export function ChampsReglages({ champs, valeurs, onChange }: { champs: ChampReglage[]; valeurs: Record<string, unknown>; onChange: (cle: string, valeur: unknown) => void }) {
  return (
    <div className="space-y-5">
      {champs.map((c) => {
        switch (c.type) {
          case "choix":
            return (
              <SelecteurPastilles
                key={c.cle}
                libelle={c.libelle}
                options={c.options.map((o) => ({ valeur: o.valeur, libelle: o.libelle, icone: o.icone }))}
                valeur={valeurs[c.cle] as string | undefined}
                onChange={(v) => onChange(c.cle, v)}
              />
            );
          case "interrupteur":
            return <Interrupteur key={c.cle} libelle={c.libelle} detail={c.aide} coche={!!valeurs[c.cle]} onChange={(v) => onChange(c.cle, v)} />;
          case "curseur":
            return <Curseur key={c.cle} libelle={c.libelle} min={c.min} max={c.max} pas={c.pas} unite={c.unite} valeur={Number(valeurs[c.cle] ?? c.min)} onChange={(v) => onChange(c.cle, v)} />;
          case "texte":
            return <Champ key={c.cle} libelle={c.libelle} aide={c.aide} placeholder={c.placeholder} value={String(valeurs[c.cle] ?? "")} onChange={(e) => onChange(c.cle, e.target.value)} />;
        }
      })}
    </div>
  );
}

/** Lot « intensité » (02/10) : réglage global de la vidéo, le même pour tous les effets. */
const NIVEAUX: { valeur: NiveauIntensite; libelle: string }[] = [
  { valeur: "sobre", libelle: "Sobre" },
  { valeur: "equilibre", libelle: "Équilibré" },
  { valeur: "tres-dynamique", libelle: "Très dynamique" },
];
const BRUITAGES: { valeur: ReglageBruitages; libelle: string }[] = [
  { valeur: "discrets", libelle: "Discrets" },
  { valeur: "aucun", libelle: "Aucun" },
];

function Bloc({ icone, titre, children, className }: { icone: NomIcone; titre: string; children: ReactNode; className?: string }) {
  return (
    <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className={cn("rounded-carte border border-trait bg-surface-1 p-4", className)}>
      <h2 className="mb-3 flex items-center gap-2 font-texte text-sm font-semibold text-texte-doux">
        <Icone nom={icone} size={16} className="text-orange-vif" />
        {titre}
      </h2>
      {children}
    </motion.section>
  );
}

/**
 * Étape « reglages » : interrupteurs des briques facultatives (AV2.7), LUT + intensité, sous-titres,
 * musique, son, rythme, habillage — tous PRÉREMPLIS par les styles du format — puis le formulaire généré du format.
 * Compact (bloc Style de l'écran « Votre vidéo », lot M3) : sans l'habillage ni le micro (il est dans le bloc Plateau) ;
 * LUT conseillées pour le décor choisi, et sur un décor clair, la règle des sous-titres (ombre renforcée ou Bandeau).
 */
export function EtapeReglages({ formatId, brouillon, modifier, contexte, compacte }: ProprietesEtape) {
  const format = obtenirFormat(formatId);
  const def = format.stylesParDefaut;
  const decorId = brouillon.styles.decorId ?? def.decor;
  const decor = contexte.elements.find((e) => e.id === decorId);
  const valeurDecor = decor?.valeur.type === "decor" ? decor.valeur : null;
  const conseillees = new Set(lutsConseilleesPour(valeurDecor, contexte.elements).map((l) => l.id));
  const regleSousTitres = sousTitresSurDecor(valeurDecor);
  const champs = compacte ? format.reglages.champs.filter((c) => c.cle !== "micro") : format.reglages.champs;
  const actives = briquesEffectives(format, brouillon.briquesCoupees, brouillon.briquesAllumees);
  const coupables = briquesCoupables(format);
  const elements = (type: TypeElement) => contexte.elements.filter((e) => e.type === type);
  const s = brouillon.styles;
  // UNE règle de musique, la même que la commande (bug corrigé : l'écran montrait une musique jamais utilisée).
  const musiqueAffichee = musiqueRetenue(format, s.musiqueId, contexte.elements);
  const style = (patch: Partial<StylesChoisis>) => modifier({ styles: { ...brouillon.styles, ...patch } });
  const basculer = (b: BriqueFacultative, allumee: boolean) => {
    const coupees = allumee ? brouillon.briquesCoupees.filter((x) => x !== b) : [...brouillon.briquesCoupees, b];
    // Brique « coupée par défaut » (mention IA) : l'allumer l'ajoute aux briques allumées de la vidéo.
    if (format.briques[b] === "au-choix-coupee") {
      const allumees = allumee ? [...new Set([...brouillon.briquesAllumees, b])] : brouillon.briquesAllumees.filter((x) => x !== b);
      modifier({ briquesCoupees: coupees, briquesAllumees: allumees });
    } else modifier({ briquesCoupees: coupees });
  };

  const luts = elements("lut");
  const lutChoisie = s.lutId ?? def.lut;

  return (
    <div className="space-y-3">
      {coupables.length > 0 && (
        <Bloc icone="calques" titre="Dans la vidéo">
          <div className="-my-1 divide-y divide-trait">
            {coupables.map((b) => (
              // Format sans musique (avocat) : la brique « son » ne garde que le son et les bruitages, le libellé le dit.
              <Interrupteur key={b} icone={b === "son" && musiqueInterdite(format) ? "son" : LIBELLES_BRIQUES[b].icone} libelle={b === "son" && musiqueInterdite(format) ? "Son et bruitages" : LIBELLES_BRIQUES[b].libelle} coche={actives[b]} onChange={(v) => basculer(b, v)} className="py-1" />
            ))}
          </div>
          {!actives["mention-ia"] && coupables.includes("mention-ia") && (
            <p className="mt-2 flex items-center gap-2 text-xs text-texte-faible">
              <Icone nom="info" size={13} />
              {brouillon.mentionIA.dansLegende ? "La mention IA reste dans le texte de publication." : "Mention IA coupée : votre choix, jamais bloquant."}
            </p>
          )}
        </Bloc>
      )}

      <AnimatePresence initial={false}>
        {actives.etalonnage && luts.length > 0 && (
          <Bloc key="lut" icone="contraste" titre="Couleurs">
            <div role="radiogroup" aria-label="LUT" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {/* « Sans LUT » toujours possible (lot M4) : aucune couleur ajoutée, même pas celle du visage. */}
              <button
                type="button"
                role="radio"
                aria-checked={lutChoisie === LUT_AUCUNE}
                onClick={() => style({ lutId: LUT_AUCUNE })}
                className={cn("w-24 shrink-0 overflow-hidden rounded-xl border text-left transition-colors", lutChoisie === LUT_AUCUNE ? "border-orange ring-2 ring-orange/40" : "border-trait hover:border-trait-fort")}
              >
                <span className="relative grid aspect-video place-items-center bg-surface-2">
                  <Icone nom="nuancier" size={20} className="text-texte-faible" />
                </span>
                <span className="block truncate px-2.5 py-2 text-sm font-semibold text-texte">Sans</span>
              </button>
              {luts.map((l) => {
                const actif = l.id === lutChoisie;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => style({ lutId: l.id })}
                    className={cn("w-32 shrink-0 overflow-hidden rounded-xl border text-left transition-colors", actif ? "border-orange ring-2 ring-orange/40" : "border-trait hover:border-trait-fort")}
                  >
                    <span className="relative block aspect-video bg-surface-2">
                      {l.vignette ? <Image src={l.vignette} alt="" fill sizes="128px" className="object-cover" /> : <Icone nom="nuancier" size={20} className="absolute inset-0 m-auto text-texte-faible" />}
                      {conseillees.has(l.id) && !actif && (
                        <span className="absolute left-1.5 top-1.5">
                          <Pastille ton="orange" icone="etoile">
                            Conseillé
                          </Pastille>
                        </span>
                      )}
                      {actif && (
                        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-orange text-sur-orange">
                          <Icone nom="coche" size={13} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="block truncate px-2.5 py-2 text-sm font-semibold text-texte">{l.nom}</span>
                  </button>
                );
              })}
            </div>
            {lutChoisie !== LUT_AUCUNE && <Curseur libelle="Intensité" unite=" %" valeur={s.intensiteLut ?? def.intensiteLut ?? 70} onChange={(v) => style({ intensiteLut: v })} className="mt-3" />}
          </Bloc>
        )}

        {actives["sous-titres"] && elements("style-sous-titres").length > 0 && (
          <Bloc key="st" icone="sous-titres" titre="Sous-titres">
            <SelecteurPastilles
              libelle="Style des sous-titres"
              libelleMasque
              defilement
              options={elements("style-sous-titres").map((e) => ({ valeur: e.id, libelle: e.nom }))}
              valeur={s.sousTitresId ?? def.sousTitres}
              onChange={(v) => style({ sousTitresId: v })}
            />
            {regleSousTitres.mode !== "normal" && (
              <p className="mt-2 flex items-center gap-2 text-xs text-texte-faible">
                <Icone nom="info" size={13} />
                {regleSousTitres.mode === "ombre-renforcee" ? "Décor clair : l'ombre des sous-titres est renforcée." : "Décor clair : les sous-titres passent en bandeau pour rester lisibles."}
              </p>
            )}
          </Bloc>
        )}

        {actives.son && (
          <Bloc key="son" icone={musiqueInterdite(format) ? "son" : "musique"} titre={musiqueInterdite(format) ? "Son" : "Musique et son"}>
            <div className="space-y-4">
              {/* Format sans musique (avocat) : le sélecteur disparaît, le profil de son et les bruitages restent. */}
              {!musiqueInterdite(format) && elements("musique").length > 0 && (
                <SelecteurPastilles
                  libelle="Musique"
                  libelleMasque
                  defilement
                  options={elements("musique").map((e) => ({ valeur: e.id, libelle: e.nom, icone: "musique" as const }))}
                  valeur={musiqueAffichee}
                  onChange={(v) => style({ musiqueId: v })}
                />
              )}
              {elements("profil-son").length > 0 && (
                <SelecteurPastilles
                  libelle="Son"
                  defilement
                  options={elements("profil-son").map((e) => ({ valeur: e.id, libelle: e.nom }))}
                  valeur={s.profilSonId ?? def.profilSon}
                  onChange={(v) => style({ profilSonId: v })}
                />
              )}
            </div>
          </Bloc>
        )}

        {/* Lot « intensité · bruitages » (02/10) : UN réglage pour toute la vidéo (coupes, zooms, textes, sons). */}
        <Bloc key="intensite" icone="eclair" titre="Intensité">
          <div className="space-y-4">
            <SelecteurPastilles
              libelle="Intensité de la vidéo"
              libelleMasque
              options={NIVEAUX}
              valeur={s.intensite ?? s.sousTitresIntensite ?? format.profilRendu?.intensite ?? format.profilRendu?.sousTitresIntensite ?? "equilibre"}
              onChange={(v) => style({ intensite: v })}
            />
            {actives.son && (
              <SelecteurPastilles
                libelle="Bruitages"
                options={BRUITAGES}
                valeur={s.bruitages ?? format.profilRendu?.bruitages ?? "aucun"}
                onChange={(v) => style({ bruitages: v })}
              />
            )}
          </div>
        </Bloc>

        {elements("style-montage").length > 0 && (
          <Bloc key="montage" icone="ciseaux" titre="Rythme du montage">
            <SelecteurPastilles
              libelle="Style de montage"
              libelleMasque
              options={elements("style-montage").map((e) => ({ valeur: e.id, libelle: e.nom }))}
              valeur={s.styleMontageId ?? def.styleMontage}
              onChange={(v) => style({ styleMontageId: v })}
            />
          </Bloc>
        )}

        {!compacte && actives.habillage && elements("habillage").length > 0 && (
          <Bloc key="habillage" icone="calques" titre="Habillage">
            <SelecteurPastilles
              libelle="Habillage"
              libelleMasque
              options={elements("habillage").map((e) => ({ valeur: e.id, libelle: e.nom }))}
              valeur={s.habillageId ?? def.habillage}
              onChange={(v) => style({ habillageId: v })}
            />
          </Bloc>
        )}
      </AnimatePresence>

      {champs.length > 0 && (
        <Bloc icone="curseurs" titre={`Réglages ${format.nom.replace(/^Vidéo /, "")}`}>
          <ChampsReglages champs={champs} valeurs={brouillon.reglages} onChange={(cle, v) => modifier({ reglages: { ...brouillon.reglages, [cle]: v } })} />
        </Bloc>
      )}
    </div>
  );
}
