$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$works = Get-Content -LiteralPath (Join-Path $root 'src\works.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$output = Join-Path $root 'public\audio'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$voice = New-Object -ComObject SAPI.SpVoice
$japanese = $voice.GetVoices('Language=411')
if ($japanese.Count -lt 1) { throw 'Japanese SAPI voice is unavailable.' }
$voice.Voice = $japanese.Item(0)
$voice.Rate = -2
foreach ($work in $works) {
    if (-not $work.verified) { continue }
    $base = "$($work.title)。$($work.background) $($work.look)"
    $guide1 = 'まず作品全体を眺め、目が自然に向かう場所を探してみましょう。次に、その近くの細部へ視線を移してください。'
    $guide2 = '少し離れて見ると、形や色のまとまりが見えてきます。近づくと、表情や素材の表現に気づけるかもしれません。'
    $guide3 = '背景を知ったうえで、もう一度作品の中心を見てください。作者が何を強調したか、自分の言葉で考えてみましょう。'
    $guide4 = '周囲の作品とも見比べてみてください。同じ時代でも、動きや静けさ、光の使い方は違います。'
    $guide5 = '今度は作品の端から中心へ、ゆっくり視線を動かしてみましょう。どこで立ち止まりたくなるでしょうか。'
    $guide6 = '最後に最初の印象を思い出してください。近くで見て変わったことがあれば、それもこの作品との出会いです。'
    $scripts = @{
        20 = $base
        40 = "$base $guide1"
        60 = "$base $guide1 $guide2 $guide3"
        120 = "$base $guide1 $guide2 $guide3 $guide4 $guide5 $guide6 $($work.background) $($work.look)"
    }
    foreach ($seconds in @(20,40,60,120)) {
        $voice.Rate = if ($seconds -eq 20) { 0 } else { -2 }
        $path = Join-Path $output "$($work.id)-$seconds.wav"
        $stream = New-Object -ComObject SAPI.SpFileStream
        $stream.Open($path, 3, $false)
        $voice.AudioOutputStream = $stream
        [void]$voice.Speak($scripts[$seconds], 0)
        $stream.Close()
    }
}
$voice.AudioOutputStream = $null
Write-Output "Generated $((Get-ChildItem -LiteralPath $output -Filter '*.wav').Count) WAV files."
