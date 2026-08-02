Add-Type -AssemblyName System.Drawing

function Draw-Icon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # 1. Full-Bleed Orange Background Squircle
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $color1 = [System.Drawing.ColorTranslator]::FromHtml("#ff7347")
    $color2 = [System.Drawing.ColorTranslator]::FromHtml("#c8380e")
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $color1, $color2, 45
    
    $r = [float]($size * 0.16)
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bgPath.AddArc(0, 0, ($r*2), ($r*2), 180, 90)
    $bgPath.AddArc(($size - $r*2), 0, ($r*2), ($r*2), 270, 90)
    $bgPath.AddArc(($size - $r*2), ($size - $r*2), ($r*2), ($r*2), 0, 90)
    $bgPath.AddArc(0, ($size - $r*2), ($r*2), ($r*2), 90, 90)
    $bgPath.CloseFigure()
    $g.FillPath($bgBrush, $bgPath)
    
    # 2. AddString("R", ...) using Arial Bold
    $fontFamily = New-Object System.Drawing.FontFamily("Arial")
    $style = [int][System.Drawing.FontStyle]::Bold
    # Font size in emSize (approx 78% of icon height for a strong bold lettermark)
    $emSize = [float]($size * 0.76)
    
    # We want to center the text in the icon box
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    # Back R (Dark Obsidian Black #141416) shifted down and right
    $backPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $backRect = New-Object System.Drawing.RectangleF ([float]($size * 0.08)), ([float]($size * 0.08)), ([float]$size), ([float]$size)
    $backPath.AddString("R", $fontFamily, $style, $emSize, $backRect, $sf)
    $backBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#141416"))
    $g.FillPath($backBrush, $backPath)
    
    # Front R (Pure White #ffffff) shifted up and left
    $frontPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $frontRect = New-Object System.Drawing.RectangleF ([float](-$size * 0.04)), ([float](-$size * 0.04)), ([float]$size), ([float]$size)
    $frontPath.AddString("R", $fontFamily, $style, $emSize, $frontRect, $sf)
    $frontBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPath($frontBrush, $frontPath)
    
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Draw-Icon 16 (Join-Path $dir "icon16.png")
Draw-Icon 48 (Join-Path $dir "icon48.png")
Draw-Icon 128 (Join-Path $dir "icon128.png")
Write-Host "Double RR icons generated successfully with native font paths!"
