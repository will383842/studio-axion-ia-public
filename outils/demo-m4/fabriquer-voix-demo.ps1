# Voix de la VIDÉO DE DÉMONSTRATION du lot M4 : voix de synthèse de Windows (Hortense, fr-FR), sans aucun service
# payant, avec le début de chaque mot (événement SpeakProgress), comme `word_timestamps` de HeyGen.
# Le texte ENVOYÉ porte les prononciations substituées (« PV » -> « pé vé », « 135 € » -> « cent trente-cinq euros »).
# Usage : powershell -File outils/demo-m4/fabriquer-voix-demo.ps1
param([string]$Sortie = "outils/demo-m4/voix-demo")

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Hortense Desktop")
$s.Rate = 3

$ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
Vous recevez un pé vé de cent trente-cinq euros ?<break time="250ms"/>
Ne le payez pas tout de suite : je vous explique pourquoi.<break time="250ms"/>
Vous avez quarante-cinq jours pour le contester, et une seule erreur sur l'avis suffit.<break time="250ms"/>
Un client a économisé deux mille cinq cents euros comme ça.<break time="200ms"/>
Gardez cette vidéo pour le prochain pé vé.
</speak>
"@

$mots = New-Object System.Collections.ArrayList
$s.add_SpeakProgress({ param($o, $e) [void]$mots.Add([pscustomobject]@{ mot = $e.Text; debutSec = [math]::Round($e.AudioPosition.TotalSeconds, 3) }) })

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile("$Sortie.16k.wav", $format)
$s.SpeakSsml($ssml)
$s.SetOutputToNull()
$s.Dispose()

& ffmpeg -y -loglevel error -i "$Sortie.16k.wav" -ar 48000 -ac 1 -c:a pcm_s16le "$Sortie.wav"
Remove-Item "$Sortie.16k.wav"
$mots | ConvertTo-Json | Out-File -Encoding utf8 "$Sortie.debuts.json"
Write-Output "Son : $Sortie.wav ; débuts des mots : $Sortie.debuts.json ($($mots.Count) mots)"
