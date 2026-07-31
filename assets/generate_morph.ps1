param(
  [string]$Sp,
  [string]$OutSvg,
  [string]$OutPngDir,
  [int]$N = 1200,
  [int]$View = 460
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$rng = New-Object System.Random(20260731)

# ---------------- colour helpers ----------------

function Boost([int]$r, [int]$g, [int]$b, [double]$sat, [double]$lift) {
  # Push saturation up and lift very dark pixels so dots stay visible on a
  # dark page background.
  $mean = ($r + $g + $b) / 3.0
  $r = $mean + ($r - $mean) * $sat
  $g = $mean + ($g - $mean) * $sat
  $b = $mean + ($b - $mean) * $sat
  $r = $r + (255 - $r) * $lift
  $g = $g + (255 - $g) * $lift
  $b = $b + (255 - $b) * $lift
  $c = @([Math]::Max(0, [Math]::Min(255, [int]$r)),
         [Math]::Max(0, [Math]::Min(255, [int]$g)),
         [Math]::Max(0, [Math]::Min(255, [int]$b)))
  return ('#{0:x2}{1:x2}{2:x2}' -f $c[0], $c[1], $c[2])
}

# Neutralise a colour cast and stretch contrast. The source photo is lit by
# magenta neon, which buries the skin tones; grey-world white balance plus a
# percentile stretch brings the face back.
function Fix-Photo($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  # Measure the white balance on the face box only. Using the whole oval lets
  # the magenta background dominate, and grey-world then turns the skin olive.
  $x0 = [int]($w * 0.26); $x1 = [int]($w * 0.74)
  $y0 = [int]($h * 0.18); $y1 = [int]($h * 0.68)
  $sumR = 0.0; $sumG = 0.0; $sumB = 0.0; $n = 0
  for ($y = $y0; $y -lt $y1; $y++) {
    for ($x = $x0; $x -lt $x1; $x++) {
      $p = $bmp.GetPixel($x, $y)
      if ($p.A -lt 40) { continue }
      $sumR += $p.R; $sumG += $p.G; $sumB += $p.B; $n++
    }
  }
  if ($n -eq 0) { return }
  $mR = $sumR / $n; $mG = $sumG / $n; $mB = $sumB / $n

  # Aim at a skin-tone ratio (R > G > B), not neutral grey.
  $tR = 1.00; $tG = 0.71; $tB = 0.60
  $scale = ($mR + $mG + $mB) / ($tR + $tG + $tB)
  $kR = ($tR * $scale) / [Math]::Max(1.0, $mR)
  $kG = ($tG * $scale) / [Math]::Max(1.0, $mG)
  $kB = ($tB * $scale) / [Math]::Max(1.0, $mB)

  $lums = New-Object System.Collections.ArrayList
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $p = $bmp.GetPixel($x, $y)
      if ($p.A -lt 40) { continue }
      [void]$lums.Add((0.299 * $p.R * $kR + 0.587 * $p.G * $kG + 0.114 * $p.B * $kB))
    }
  }
  $sorted = $lums.ToArray(); [Array]::Sort($sorted)
  $lo = $sorted[[int]($sorted.Count * 0.04)]
  $hi = $sorted[[int]($sorted.Count * 0.96)]
  $span = [Math]::Max(1.0, $hi - $lo)

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $p = $bmp.GetPixel($x, $y)
      if ($p.A -lt 40) { continue }
      $r = $p.R * $kR; $g = $p.G * $kG; $b = $p.B * $kB
      $l = [Math]::Max(1.0, 0.299 * $r + 0.587 * $g + 0.114 * $b)
      $target = (($l - $lo) / $span) * 232.0 + 22.0

      # Vignette: the neon background caught inside the oval is brighter than
      # the face, so fade the rim out and let the face carry the image.
      $dx = ($x - $w / 2.0) / ($w / 2.0)
      $dy = ($y - $h / 2.0) / ($h / 2.0)
      $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)
      if ($dist -gt 0.70) {
        $t = ($dist - 0.70) / 0.35
        if ($t -gt 1) { $t = 1 }
        $target = $target * (1.0 - 0.72 * $t)
      }

      if ($target -lt 4) { $target = 4 }
      if ($target -gt 255) { $target = 255 }
      $f = $target / $l
      $nr = [Math]::Max(0, [Math]::Min(255, [int]($r * $f)))
      $ng2 = [Math]::Max(0, [Math]::Min(255, [int]($g * $f)))
      $nb = [Math]::Max(0, [Math]::Min(255, [int]($b * $f)))
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $nr, $ng2, $nb))
    }
  }
}

# ---------------- sampling ----------------

# Sample a bitmap onto a grid. Returns @{x;y;i;c}.
#   mode 'mask'  -> every opaque cell counts (used for the photo)
#   mode 'ink'   -> cells that differ from the background colour (logos)
function Get-Points($bmp, [int]$grid, [double]$thresh, [string]$mode, [double]$sat, [double]$lift) {
  $small = New-Object System.Drawing.Bitmap($grid, $grid)
  $gg = [System.Drawing.Graphics]::FromImage($small)
  $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $sw = $bmp.Width; $sh = $bmp.Height
  $scale = [Math]::Min($grid / $sw, $grid / $sh)
  $dw = $sw * $scale; $dh = $sh * $scale
  $gg.DrawImage($bmp, [float](($grid - $dw) / 2), [float](($grid - $dh) / 2), [float]$dw, [float]$dh)
  $gg.Dispose()

  $bg = $small.GetPixel(0, 0)
  $pts = New-Object System.Collections.ArrayList
  for ($y = 0; $y -lt $grid; $y++) {
    for ($x = 0; $x -lt $grid; $x++) {
      $p = $small.GetPixel($x, $y)
      if ($p.A -lt 40) { continue }
      $lum = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B) / 255.0
      if ($mode -eq 'ink') {
        $d = ([Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)) / 765.0
        if ($bg.A -lt 40) { $d = 1.0 }
        if ($d -lt $thresh) { continue }
      }
      # For the photo, dot size follows brightness: the lit parts of the face
      # become large dots and the hair and shadows thin out to nothing. On a
      # dark page that reads far better than a constant-size colour mosaic,
      # where hair and skin merge into one blob.
      if ($mode -eq 'mask') { $ii = [Math]::Max(0.10, [Math]::Min(1.15, 0.16 + $lum * 1.05)) }
      else { $ii = [Math]::Max(0.55, [Math]::Min(1.0, 0.55 + $lum * 0.55)) }
      [void]$pts.Add(@{
        x = $x; y = $y; i = $ii
        c = (Boost $p.R $p.G $p.B $sat $lift)
      })
    }
  }
  $small.Dispose()
  return $pts
}

function Find-Grid($bmp, [double]$thresh, [string]$mode, [double]$sat, [double]$lift, [int]$target) {
  $best = $null; $bestGrid = 0; $bestDiff = [int]::MaxValue
  for ($g = 20; $g -le 108; $g += 3) {
    $p = Get-Points $bmp $g $thresh $mode $sat $lift
    $diff = [Math]::Abs($p.Count - $target)
    if ($p.Count -lt $target) { $diff = $diff * 3 }   # prefer overshoot
    if ($diff -lt $bestDiff) { $bestDiff = $diff; $best = $p; $bestGrid = $g }
  }
  return @{ pts = $best; grid = $bestGrid }
}

function Normalize-Shape($pts, [int]$count, $rand) {
  $arr = @($pts)
  for ($i = $arr.Count - 1; $i -gt 0; $i--) {
    $j = $rand.Next($i + 1); $t = $arr[$i]; $arr[$i] = $arr[$j]; $arr[$j] = $t
  }
  $out = New-Object System.Collections.ArrayList
  for ($k = 0; $k -lt $count; $k++) { [void]$out.Add($arr[$k % $arr.Count]) }
  $cx = ($out | ForEach-Object { $_.x } | Measure-Object -Average).Average
  $cy = ($out | ForEach-Object { $_.y } | Measure-Object -Average).Average
  return @($out | Sort-Object { [Math]::Atan2($_.y - $cy, $_.x - $cx) })
}

# ---------------- shapes ----------------

# 1. the photo: cropped to the head, masked to an oval, sampled in full colour
$avatar = [System.Drawing.Bitmap]::FromFile("$Sp\avatar.png")
$crop = $avatar.Clone((New-Object System.Drawing.Rectangle(158, 40, 118, 150)), $avatar.PixelFormat)
$face = New-Object System.Drawing.Bitmap(230, 290)
$fg = [System.Drawing.Graphics]::FromImage($face)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$oval = New-Object System.Drawing.Drawing2D.GraphicsPath
$oval.AddEllipse(2, 2, 226, 286)
$fg.SetClip($oval)
$fg.DrawImage($crop, 0, 0, 230, 290)
$fg.Dispose(); $oval.Dispose(); $crop.Dispose()
Fix-Photo $face
$face.Save("$Sp\face_corrected.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 3. camera, drawn in colour — computer vision
$cam = New-Object System.Drawing.Bitmap(220, 220)
$cg = [System.Drawing.Graphics]::FromImage($cam)
$cg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bBody  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 45, 105, 160))
$bTop   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 32, 74, 118))
$bRing  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 200, 232))
$bGlass = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 124, 58, 237))
$bFlash = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 209, 102))
$cg.FillRectangle($bTop, 72, 42, 52, 20)
$cg.FillRectangle($bBody, 20, 60, 180, 118)
$cg.FillEllipse($bRing, 68, 70, 84, 84)
$cg.FillEllipse($bGlass, 82, 84, 56, 56)
$cg.FillEllipse($bRing, 98, 100, 24, 24)
$cg.FillEllipse($bFlash, 164, 72, 18, 18)
$cg.Dispose()

# 5. neural network, drawn in colour — deep learning
$net = New-Object System.Drawing.Bitmap(220, 220)
$ng = [System.Drawing.Graphics]::FromImage($net)
$ng.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$edge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 60, 125, 217)), 3
$nodeIn  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 200, 232))
$nodeMid = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 145, 241))
$nodeOut = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 85, 247))
$layers = @(
  @{ x = 44;  ys = @(66, 110, 154); b = $nodeIn },
  @{ x = 110; ys = @(40, 86, 132, 178); b = $nodeMid },
  @{ x = 176; ys = @(86, 132); b = $nodeOut }
)
for ($l = 0; $l -lt $layers.Count - 1; $l++) {
  foreach ($y1 in $layers[$l].ys) { foreach ($y2 in $layers[$l + 1].ys) {
    $ng.DrawLine($edge, [int]$layers[$l].x, [int]$y1, [int]$layers[$l + 1].x, [int]$y2) } }
}
foreach ($l in $layers) { foreach ($y in $l.ys) { $ng.FillEllipse($l.b, $l.x - 15, $y - 15, 30, 30) } }
$edge.Dispose(); $ng.Dispose()

$sources = @(
  # Fix-Photo already balanced and stretched the photo, so no extra boost here.
  @{ name = 'portrait'; bmp = $face;                                              thresh = 0.0;  mode = 'mask'; sat = 1.00; lift = 0.00 },
  @{ name = 'python';   bmp = [System.Drawing.Bitmap]::FromFile("$Sp\python.png"); thresh = 0.10; mode = 'ink';  sat = 1.15; lift = 0.05 },
  @{ name = 'camera';   bmp = $cam;                                                thresh = 0.20; mode = 'ink';  sat = 1.10; lift = 0.02 },
  @{ name = 'opencv';   bmp = [System.Drawing.Bitmap]::FromFile("$Sp\opencv.png"); thresh = 0.10; mode = 'ink';  sat = 1.20; lift = 0.05 },
  @{ name = 'network';  bmp = $net;                                                thresh = 0.20; mode = 'ink';  sat = 1.10; lift = 0.02 }
)

$shapes = @(); $grids = @()
foreach ($s in $sources) {
  $f = Find-Grid $s.bmp $s.thresh $s.mode $s.sat $s.lift $N
  Write-Output ("{0,-9} grid={1,-4} cells={2}" -f $s.name, $f.grid, $f.pts.Count)
  $shapes += , (Normalize-Shape $f.pts $N $rng)
  $grids += $f.grid
}

# ---------------- emit ----------------

$keyTimes = "0;0.14;0.20;0.34;0.40;0.54;0.60;0.74;0.80;0.94;1"
$order = @(0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 0)
$dur = "30s"

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$View`" height=`"$View`" viewBox=`"0 0 $View $View`" role=`"img`" aria-label=`"Dot matrix morphing between a portrait, the Python logo, a camera, the OpenCV logo and a neural network`">")

for ($d = 0; $d -lt $N; $d++) {
  $xs = @(); $ys = @(); $rs = @(); $cs = @()
  foreach ($o in $order) {
    $p = $shapes[$o][$d]
    $k = $View / $grids[$o]
    $xs += [int][Math]::Round(($p.x + 0.5) * $k)
    $ys += [int][Math]::Round(($p.y + 0.5) * $k)
    $rs += [Math]::Round($k * 0.42 * $p.i, 1)
    $cs += $p.c
  }
  $b = [Math]::Round(-1.6 * $rng.NextDouble(), 2)
  [void]$sb.Append("<circle r=`"$($rs[0])`" fill=`"$($cs[0])`">")
  [void]$sb.Append("<animate attributeName=`"cx`" values=`"$($xs -join ';')`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${b}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.Append("<animate attributeName=`"cy`" values=`"$($ys -join ';')`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${b}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.Append("<animate attributeName=`"r`" values=`"$($rs -join ';')`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${b}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.Append("<animate attributeName=`"fill`" values=`"$($cs -join ';')`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${b}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.AppendLine("</circle>")
}
[void]$sb.AppendLine("</svg>")
[System.IO.File]::WriteAllText($OutSvg, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

# previews
for ($s = 0; $s -lt $shapes.Count; $s++) {
  $pv = New-Object System.Drawing.Bitmap($View, $View)
  $pg = [System.Drawing.Graphics]::FromImage($pv)
  $pg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $pg.Clear([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
  $k = $View / $grids[$s]
  foreach ($p in $shapes[$s]) {
    $col = [System.Drawing.ColorTranslator]::FromHtml($p.c)
    $br = New-Object System.Drawing.SolidBrush($col)
    $r = $k * 0.42 * $p.i
    $cx = ($p.x + 0.5) * $k; $cy = ($p.y + 0.5) * $k
    $pg.FillEllipse($br, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
    $br.Dispose()
  }
  $pv.Save("$OutPngDir\c_$($sources[$s].name).png", [System.Drawing.Imaging.ImageFormat]::Png)
  $pg.Dispose(); $pv.Dispose()
}

Write-Output "dots=$N  svgBytes=$((Get-Item $OutSvg).Length)"
