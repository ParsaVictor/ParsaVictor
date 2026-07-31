param(
  [string]$Sp,
  [string]$OutSvg,
  [string]$OutPngDir,
  [int]$N = 640,
  [int]$G = 110,        # sampling grid resolution
  [int]$View = 440      # svg viewBox size
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$rng = New-Object System.Random(20260731)

# ---------- helpers ----------

function New-Mask([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Black)
  return @{ bmp = $bmp; g = $g }
}

# Sample a bitmap into grid cells. Returns list of @{x;y;i} in grid coords.
# "Present" = pixel is opaque AND differs from the background colour at (0,0).
function Get-Points($bmp, [int]$grid, [double]$thresh, [switch]$DarkIsInk) {
  $small = New-Object System.Drawing.Bitmap($grid, $grid)
  $gg = [System.Drawing.Graphics]::FromImage($small)
  $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  # letterbox the source into the square grid, preserving aspect
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
      if ($DarkIsInk) {
        $ink = 1.0 - $lum
        if ($ink -lt $thresh) { continue }
        [void]$pts.Add(@{ x = $x; y = $y; i = $ink })
      } else {
        $d = ([Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)) / 765.0
        if ($bg.A -lt 40) { $d = 1.0 }
        if ($d -lt $thresh) { continue }
        [void]$pts.Add(@{ x = $x; y = $y; i = [Math]::Max(0.45, 1.0 - $lum * 0.55) })
      }
    }
  }
  $small.Dispose()
  return $pts
}

# Find the grid resolution whose "on" cell count lands closest to $target.
# Sampling on a regular grid keeps the shape legible; random sampling of the
# full-resolution mask just produces noise.
function Find-Grid($bmp, [double]$thresh, [switch]$DarkIsInk, [int]$target) {
  $best = $null; $bestGrid = 0; $bestDiff = [int]::MaxValue
  for ($g = 18; $g -le 120; $g += 2) {
    $p = Get-Points $bmp $g $thresh -DarkIsInk:$DarkIsInk
    $diff = [Math]::Abs($p.Count - $target)
    # prefer a grid that overshoots slightly, so we trim instead of duplicating
    if ($p.Count -lt $target) { $diff = $diff * 3 }
    if ($diff -lt $bestDiff) { $bestDiff = $diff; $best = $p; $bestGrid = $g }
  }
  return @{ pts = $best; grid = $bestGrid }
}

# Trim/extend a point list to exactly $N, then order by angle around the
# centroid so every shape uses the same traversal and dots travel short paths.
function Normalize-Shape($pts, [int]$count, $rand) {
  $arr = @($pts)
  if ($arr.Count -eq 0) { throw "empty shape" }
  # deterministic shuffle
  for ($i = $arr.Count - 1; $i -gt 0; $i--) {
    $j = $rand.Next($i + 1)
    $t = $arr[$i]; $arr[$i] = $arr[$j]; $arr[$j] = $t
  }
  $out = New-Object System.Collections.ArrayList
  for ($k = 0; $k -lt $count; $k++) { [void]$out.Add($arr[$k % $arr.Count]) }

  $cx = ($out | ForEach-Object { $_.x } | Measure-Object -Average).Average
  $cy = ($out | ForEach-Object { $_.y } | Measure-Object -Average).Average
  $sorted = $out | Sort-Object { [Math]::Atan2($_.y - $cy, $_.x - $cx) }
  return @($sorted)
}

# ---------- shape sources ----------

# 1. portrait, cropped tight to the face and masked to an oval so the busy
#    neon background never becomes dots
$avatar = [System.Drawing.Bitmap]::FromFile("$Sp\avatar.png")
$faceRect = New-Object System.Drawing.Rectangle(163, 45, 108, 140)
$faceCrop = $avatar.Clone($faceRect, $avatar.PixelFormat)

$face = New-Object System.Drawing.Bitmap(200, 260)
$fg = [System.Drawing.Graphics]::FromImage($face)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$ellipse = New-Object System.Drawing.Drawing2D.GraphicsPath
$ellipse.AddEllipse(4, 4, 192, 252)
$fg.SetClip($ellipse)
$fg.DrawImage($faceCrop, 0, 0, 200, 260)
$fg.Dispose(); $ellipse.Dispose(); $faceCrop.Dispose()

# 3. camera — drawn, stands for computer vision
$cam = New-Mask 200
$cg = $cam.g
$white = [System.Drawing.Brushes]::White
$black = [System.Drawing.Brushes]::Black
$cg.FillRectangle($white, 62, 40, 46, 18)                 # top bump
$cg.FillRectangle($white, 18, 56, 164, 104)               # body
$cg.FillEllipse($black, 62, 62, 76, 76)                   # lens gap
$cg.FillEllipse($white, 74, 74, 52, 52)                   # lens glass
$cg.FillEllipse($black, 90, 90, 20, 20)                   # aperture
$cg.FillEllipse($black, 148, 66, 16, 16)                  # flash hole
$cg.Dispose()

# 4. neural network — drawn, stands for deep learning
$net = New-Mask 200
$ng = $net.g
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
$layers = @(
  @{ x = 36;  ys = @(58, 100, 142) },
  @{ x = 100; ys = @(34, 78, 122, 166) },
  @{ x = 164; ys = @(78, 122) }
)
for ($l = 0; $l -lt $layers.Count - 1; $l++) {
  foreach ($y1 in $layers[$l].ys) {
    foreach ($y2 in $layers[$l + 1].ys) {
      $ng.DrawLine($pen, [int]$layers[$l].x, [int]$y1, [int]$layers[$l + 1].x, [int]$y2)
    }
  }
}
foreach ($l in $layers) {
  foreach ($y in $l.ys) { $ng.FillEllipse($white, $l.x - 14, $y - 14, 28, 28) }
}
$pen.Dispose(); $ng.Dispose()

$sources = @(
  @{ name = 'portrait'; bmp = $face;                                              thresh = 0.60; dark = $true  },
  @{ name = 'python';   bmp = [System.Drawing.Bitmap]::FromFile("$Sp\python.png"); thresh = 0.10; dark = $false },
  @{ name = 'camera';   bmp = $cam.bmp;                                            thresh = 0.30; dark = $false },
  @{ name = 'network';  bmp = $net.bmp;                                            thresh = 0.30; dark = $false }
)

$shapes = @()
$grids = @()
foreach ($s in $sources) {
  $found = Find-Grid $s.bmp $s.thresh -DarkIsInk:$s.dark -target $N
  Write-Output ("{0,-9} grid={1,-3} cells={2}" -f $s.name, $found.grid, $found.pts.Count)
  $shapes += , (Normalize-Shape $found.pts $N $rng)
  $grids += $found.grid
}

# ---------- emit svg ----------
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$View`" height=`"$View`" viewBox=`"0 0 $View $View`" role=`"img`" aria-label=`"Animated dot matrix morphing between a portrait, the Python logo, a camera and the PyTorch logo`">")
[void]$sb.AppendLine("<defs><linearGradient id=`"dg`" x1=`"0`" y1=`"0`" x2=`"1`" y2=`"1`">")
[void]$sb.AppendLine("<stop offset=`"0`" stop-color=`"#00B4D8`"/><stop offset=`"0.5`" stop-color=`"#4B91F1`"/><stop offset=`"1`" stop-color=`"#7C3AED`"/>")
[void]$sb.AppendLine("</linearGradient></defs>")
[void]$sb.AppendLine("<g fill=`"url(#dg)`">")

$keyTimes = "0;0.18;0.25;0.43;0.50;0.68;0.75;0.93;1"
$dur = "24s"
# hold each shape, then morph: A A B B C C D D A
$order = @(0, 0, 1, 1, 2, 2, 3, 3, 0)

for ($d = 0; $d -lt $N; $d++) {
  $xs = @(); $ys = @(); $rs = @()
  foreach ($o in $order) {
    $p = $shapes[$o][$d]
    $k = $View / $grids[$o]                     # each shape has its own grid
    $xs += [int][Math]::Round(($p.x + 0.5) * $k)
    $ys += [int][Math]::Round(($p.y + 0.5) * $k)
    $rs += [Math]::Round($k * (0.20 + 0.20 * $p.i), 1)
  }
  $begin = [Math]::Round(-1.4 * $rng.NextDouble(), 2)
  $cxv = ($xs -join ';'); $cyv = ($ys -join ';'); $rv = ($rs -join ';')
  [void]$sb.Append("<circle r=`"$($rs[0])`">")
  [void]$sb.Append("<animate attributeName=`"cx`" values=`"$cxv`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${begin}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.Append("<animate attributeName=`"cy`" values=`"$cyv`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${begin}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.Append("<animate attributeName=`"r`" values=`"$rv`" keyTimes=`"$keyTimes`" dur=`"$dur`" begin=`"${begin}s`" repeatCount=`"indefinite`"/>")
  [void]$sb.AppendLine("</circle>")
}
[void]$sb.AppendLine("</g></svg>")
[System.IO.File]::WriteAllText($OutSvg, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

# ---------- png previews so the result can actually be inspected ----------
for ($s = 0; $s -lt $shapes.Count; $s++) {
  $pv = New-Object System.Drawing.Bitmap($View, $View)
  $pg = [System.Drawing.Graphics]::FromImage($pv)
  $pg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $pg.Clear([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
  $br = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 160, 240))
  $k = $View / $grids[$s]
  foreach ($p in $shapes[$s]) {
    $r = $k * (0.20 + 0.20 * $p.i)
    $cx = ($p.x + 0.5) * $k; $cy = ($p.y + 0.5) * $k
    $pg.FillEllipse($br, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
  }
  $pv.Save("$OutPngDir\shape_$($sources[$s].name).png", [System.Drawing.Imaging.ImageFormat]::Png)
  $pg.Dispose(); $pv.Dispose()
}

Write-Output "dots=$N  svgBytes=$((Get-Item $OutSvg).Length)"
