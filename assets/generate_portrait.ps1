param(
  [string]$In,
  [string]$OutSvg,
  [string]$OutPng,
  [int]$CropX = 115, [int]$CropY = 20, [int]$CropW = 230, [int]$CropH = 290,
  [int]$Cols = 46, [int]$Rows = 58,
  [double]$Gamma = 1.0,
  [double]$Floor = 0.0,
  [switch]$Invert,
  [double]$Cutoff = 1.1,
  [double]$LoPct = 0.05,
  [double]$HiPct = 0.95
)

Add-Type -AssemblyName System.Drawing

$src  = [System.Drawing.Bitmap]::FromFile($In)
$rect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
$face = $src.Clone($rect, $src.PixelFormat)

$small = New-Object System.Drawing.Bitmap($Cols, $Rows)
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($face, 0, 0, $Cols, $Rows)
$g.Dispose()

# --- pass 1: luminance + contrast stretch bounds ---
$lum = New-Object 'double[,]' $Cols, $Rows
$all = New-Object System.Collections.Generic.List[double]
for ($y = 0; $y -lt $Rows; $y++) {
  for ($x = 0; $x -lt $Cols; $x++) {
    $p = $small.GetPixel($x, $y)
    $l = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B) / 255.0
    $lum[$x, $y] = $l
    $all.Add($l)
  }
}
# Percentile clipping: a few neon-bright background pixels would otherwise own the
# whole range and squash the face into the middle of it.
$sorted = $all.ToArray(); [Array]::Sort($sorted)
$n0 = [int][Math]::Floor($sorted.Length * $LoPct)
$n1 = [int][Math]::Floor($sorted.Length * $HiPct)
if ($n1 -ge $sorted.Length) { $n1 = $sorted.Length - 1 }
$min = $sorted[$n0]; $max = $sorted[$n1]
$range = $max - $min
if ($range -lt 0.001) { $range = 0.001 }
Write-Output ("lum p{0}={1:N3}  p{2}={3:N3}" -f ($LoPct*100), $min, ($HiPct*100), $max)

$cell = 8.0
$maxR = 3.7
$w = [int]($Cols * $cell)
$h = [int]($Rows * $cell)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$w`" height=`"$h`" viewBox=`"0 0 $w $h`" role=`"img`" aria-label=`"Portrait of Mohammad Parsa Karkooti rendered as a dot matrix`">")
[void]$sb.AppendLine("<defs>")
[void]$sb.AppendLine("<linearGradient id=`"dg`" x1=`"0`" y1=`"0`" x2=`"1`" y2=`"1`">")
[void]$sb.AppendLine("<stop offset=`"0`" stop-color=`"#00B4D8`"/><stop offset=`"0.55`" stop-color=`"#4B91F1`"/><stop offset=`"1`" stop-color=`"#7C3AED`"/>")
[void]$sb.AppendLine("</linearGradient>")
[void]$sb.AppendLine("</defs>")
[void]$sb.AppendLine("<style>")
[void]$sb.AppendLine("circle{fill:url(#dg);opacity:0;animation:pop .5s ease-out forwards}")
[void]$sb.AppendLine("@keyframes pop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}")
[void]$sb.AppendLine("</style>")

# --- pass 2: emit dots ---
$preview = New-Object System.Drawing.Bitmap($w, $h)
$pg = [System.Drawing.Graphics]::FromImage($preview)
$pg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$pg.Clear([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 160, 240))

$count = 0
for ($y = 0; $y -lt $Rows; $y++) {
  for ($x = 0; $x -lt $Cols; $x++) {
    $n = ($lum[$x, $y] - $min) / $range
    if ($n -lt 0) { $n = 0 }
    if ($n -gt 1) { $n = 1 }
    # Drop the brightest pixels outright — here that is the neon background.
    if ($n -gt $Cutoff) { continue }
    if ($Invert) { $n = 1.0 - $n }
    $n = [Math]::Pow($n, $Gamma)
    if ($n -lt $Floor) { continue }
    $r = [Math]::Round($maxR * $n, 2)
    if ($r -lt 0.35) { continue }
    $cx = [Math]::Round($x * $cell + $cell / 2, 1)
    $cy = [Math]::Round($y * $cell + $cell / 2, 1)
    $delay = [Math]::Round((($x + $y) * 0.012), 3)
    [void]$sb.AppendLine("<circle cx=`"$cx`" cy=`"$cy`" r=`"$r`" style=`"animation-delay:${delay}s;transform-origin:${cx}px ${cy}px`"/>")
    $pg.FillEllipse($brush, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
    $count++
  }
}
[void]$sb.AppendLine("</svg>")

[System.IO.File]::WriteAllText($OutSvg, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
$preview.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)

$pg.Dispose(); $preview.Dispose(); $small.Dispose(); $face.Dispose(); $src.Dispose()
Write-Output "dots=$count  size=${w}x${h}  svgBytes=$((Get-Item $OutSvg).Length)"
