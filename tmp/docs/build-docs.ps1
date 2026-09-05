param(
  [string]$Workspace = 'D:\Projects\billing-brilliance'
)

$ErrorActionPreference = 'Stop'
$docsDir = Join-Path $Workspace 'docs'
$qaDir = Join-Path $Workspace 'tmp\docs\qa'
New-Item -ItemType Directory -Force -Path $qaDir | Out-Null

function Convert-HexColor([string]$Hex) {
  $h = $Hex.TrimStart('#')
  $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
  return $r + ($g * 256) + ($b * 65536)
}

function Clean-Inline([string]$Text) {
  $value = $Text -replace '\*\*', ''
  $value = $value -replace '`', ''
  return $value.Trim()
}

function Set-DocumentStyles($Doc, [string]$Preset) {
  $navy = Convert-HexColor '#17365D'
  $blue = Convert-HexColor '#2E74B5'
  $gray = Convert-HexColor '#475467'

  $normal = $Doc.Styles.Item('Normal')
  $normal.Font.Name = 'Calibri'
  $normal.Font.Size = 11
  $normal.Font.Color = Convert-HexColor '#1F2937'
  $normal.ParagraphFormat.SpaceBefore = 0
  $normal.ParagraphFormat.WidowControl = -1

  $title = $Doc.Styles.Item('Title')
  $title.Font.Name = 'Calibri Light'
  $title.Font.Size = 26
  $title.Font.Bold = -1
  $title.Font.Color = $navy
  $title.ParagraphFormat.SpaceAfter = 14

  $subtitle = $Doc.Styles.Item('Subtitle')
  $subtitle.Font.Name = 'Calibri'
  $subtitle.Font.Size = 11
  $subtitle.Font.Color = $gray
  $subtitle.ParagraphFormat.SpaceAfter = 16

  $h1 = $Doc.Styles.Item('Heading 1')
  $h1.Font.Name = 'Calibri Light'
  $h1.Font.Size = 16
  $h1.Font.Bold = -1
  $h1.Font.Color = $blue
  $h1.ParagraphFormat.KeepWithNext = -1
  $h1.ParagraphFormat.SpaceBefore = 16
  $h1.ParagraphFormat.SpaceAfter = 8

  $h2 = $Doc.Styles.Item('Heading 2')
  $h2.Font.Name = 'Calibri'
  $h2.Font.Size = 13
  $h2.Font.Bold = -1
  $h2.Font.Color = $navy
  $h2.ParagraphFormat.KeepWithNext = -1
  $h2.ParagraphFormat.SpaceBefore = 12
  $h2.ParagraphFormat.SpaceAfter = 6

  $h3 = $Doc.Styles.Item('Heading 3')
  $h3.Font.Name = 'Calibri'
  $h3.Font.Size = 11
  $h3.Font.Bold = -1
  $h3.Font.Color = $navy
  $h3.ParagraphFormat.KeepWithNext = -1
  $h3.ParagraphFormat.SpaceBefore = 8
  $h3.ParagraphFormat.SpaceAfter = 4

  if ($Preset -eq 'compact') {
    $normal.ParagraphFormat.SpaceAfter = 6
    $normal.ParagraphFormat.LineSpacingRule = 5
    $normal.ParagraphFormat.LineSpacing = 13.75
    $h1.ParagraphFormat.SpaceBefore = 18
    $h1.ParagraphFormat.SpaceAfter = 10
    $h2.Font.Size = 14
    $h2.ParagraphFormat.SpaceBefore = 14
    $h2.ParagraphFormat.SpaceAfter = 7
    $h3.ParagraphFormat.SpaceBefore = 10
    $h3.ParagraphFormat.SpaceAfter = 5
  } else {
    $normal.ParagraphFormat.SpaceAfter = 6
    $normal.ParagraphFormat.LineSpacingRule = 5
    $normal.ParagraphFormat.LineSpacing = 12.1
  }
}

function Add-Paragraph($Doc, $Selection, [string]$Text, [string]$Style = 'Normal', [string]$ListKind = '', [bool]$PageBreakBefore = $false) {
  if (-not $ListKind) {
    $Selection.Range.ListFormat.RemoveNumbers(1)
    $Selection.ParagraphFormat.LeftIndent = 0
    $Selection.ParagraphFormat.FirstLineIndent = 0
  }
  $start = $Selection.Start
  $Selection.Style = $Style
  $Selection.ParagraphFormat.PageBreakBefore = if ($PageBreakBefore) { -1 } else { 0 }
  $Selection.TypeText((Clean-Inline $Text))
  $Selection.TypeParagraph()
  if ($ListKind) {
    $range = $Doc.Range($start, [Math]::Max($start, $Selection.Start - 1))
    if ($ListKind -eq 'bullet') { $range.ListFormat.ApplyBulletDefault() }
    if ($ListKind -eq 'number') { $range.ListFormat.ApplyNumberDefault() }
    $range.ParagraphFormat.LeftIndent = 36
    $range.ParagraphFormat.FirstLineIndent = -18
    $range.ParagraphFormat.SpaceAfter = 4
  }
}

function Add-Table($Doc, $Selection, [object[]]$Rows, [string]$Preset) {
  if ($Rows.Count -lt 2) { return }
  [single]$tableFontSize = if ($Preset -eq 'compact') { 9.0 } else { 8.5 }
  $columnCount = $Rows[0].Count
  $table = $Doc.Tables.Add($Selection.Range, $Rows.Count, $columnCount)
  $table.Borders.Enable = 1
  $table.AllowAutoFit = $false
  $table.Rows.Item(1).HeadingFormat = -1
  $totalWidth = 468
  for ($c = 1; $c -le $columnCount; $c++) {
    $table.Columns.Item($c).Width = $totalWidth / $columnCount
  }
  for ($r = 1; $r -le $Rows.Count; $r++) {
    $table.Rows.Item($r).AllowBreakAcrossPages = 0
    for ($c = 1; $c -le $columnCount; $c++) {
      $cell = $table.Cell($r, $c)
      $cell.Range.Text = Clean-Inline ([string]$Rows[$r - 1][$c - 1])
      $cell.Range.Font.Name = 'Calibri'
      $cell.Range.Font.Size = $tableFontSize
      $cell.VerticalAlignment = 0
      $cell.TopPadding = if ($Preset -eq 'compact') { 4 } else { 3 }
      $cell.BottomPadding = if ($Preset -eq 'compact') { 4 } else { 3 }
      $cell.LeftPadding = 5
      $cell.RightPadding = 5
      if ($r -eq 1) {
        $cell.Range.Font.Bold = -1
        $cell.Shading.BackgroundPatternColor = if ($Preset -eq 'compact') { Convert-HexColor '#E8EEF5' } else { Convert-HexColor '#F2F4F7' }
      } elseif (($r % 2) -eq 1) {
        $cell.Shading.BackgroundPatternColor = Convert-HexColor '#F8FAFC'
      }
    }
  }
  $Selection.SetRange($table.Range.End, $table.Range.End)
  $Selection.TypeParagraph()
}

function Set-HeaderFooter($Doc, [string]$HeaderText, [string]$FooterText) {
  foreach ($section in $Doc.Sections) {
    $section.PageSetup.OddAndEvenPagesHeaderFooter = 0
    $section.PageSetup.DifferentFirstPageHeaderFooter = 0
    foreach ($kind in 1..3) {
      $header = $section.Headers.Item($kind).Range
      $header.Text = $HeaderText
      $header.Font.Name = 'Calibri'
      $header.Font.Size = 8
      $header.Font.Bold = -1
      $header.Font.Color = Convert-HexColor '#475467'
      $header.ParagraphFormat.Alignment = 2
      $header.Borders.Item(-3).LineStyle = 1
      $header.Borders.Item(-3).Color = Convert-HexColor '#D0D5DD'

      $footer = $section.Footers.Item($kind).Range
      $footer.Text = "$FooterText  |  Page "
      $footer.Font.Name = 'Calibri'
      $footer.Font.Size = 8
      $footer.Font.Color = Convert-HexColor '#667085'
      $footer.ParagraphFormat.Alignment = 1
      $footer.Collapse(0)
      $Doc.Fields.Add($footer, -1, 'PAGE', $true) | Out-Null
    }
  }
}

function Scrub-DocxMetadata([string]$Path) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::Open($Path, [System.IO.Compression.ZipArchiveMode]::Update)
  try {
    $entry = $zip.GetEntry('docProps/core.xml')
    if ($entry) {
      $reader = [System.IO.StreamReader]::new($entry.Open())
      $xml = $reader.ReadToEnd()
      $reader.Dispose()
      $xml = $xml -replace '<dc:creator[^>]*>.*?</dc:creator>', '<dc:creator></dc:creator>'
      $xml = $xml -replace '<cp:lastModifiedBy[^>]*>.*?</cp:lastModifiedBy>', '<cp:lastModifiedBy></cp:lastModifiedBy>'
      $entry.Delete()
      $newEntry = $zip.CreateEntry('docProps/core.xml')
      $writer = [System.IO.StreamWriter]::new($newEntry.Open(), [System.Text.UTF8Encoding]::new($false))
      $writer.Write($xml)
      $writer.Dispose()
    }
    $custom = $zip.GetEntry('docProps/custom.xml')
    if ($custom) { $custom.Delete() }
  } finally {
    $zip.Dispose()
  }
}

function Normalize-PageTopSpacing($Doc) {
  # Word's COM pagination can place the first body paragraph of a subsequent
  # page above the configured margin after long tables/lists. Detect that
  # condition from the rendered page coordinates and add only the missing
  # breathing room. Repeating handles paragraphs moved by the prior pass.
  foreach ($pass in 1..4) {
    $Doc.Repaginate()
    $seenPages = @{}
    foreach ($paragraph in $Doc.Paragraphs) {
      $page = [int]$paragraph.Range.Information(3)
      if ($seenPages.ContainsKey($page)) { continue }
      $seenPages[$page] = $true
      [single]$vertical = $paragraph.Range.Information(6)
      if ($page -gt 1 -and $vertical -ge 0 -and $vertical -lt 50) {
        [single]$current = $paragraph.Range.ParagraphFormat.SpaceBefore
        $paragraph.Range.ParagraphFormat.SpaceBefore = [single]($current + (64 - $vertical))
      }
    }
  }
}

function Build-Docx([string]$MarkdownPath, [string]$DocxPath, [string]$PdfPath, [string]$Preset, [string]$HeaderText, [string]$FooterText) {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try {
    $doc = $word.Documents.Add()
    # Letter size in points; setting dimensions directly avoids dependence on
    # the workstation's default printer paper catalogue.
    $doc.PageSetup.PageWidth = 612
    $doc.PageSetup.PageHeight = 792
    $doc.PageSetup.TopMargin = 72
    $doc.PageSetup.BottomMargin = 72
    $doc.PageSetup.LeftMargin = 72
    $doc.PageSetup.RightMargin = 72
    Set-DocumentStyles $doc $Preset
    Set-HeaderFooter $doc $HeaderText $FooterText
    $selection = $word.Selection
    $lines = Get-Content -LiteralPath $MarkdownPath -Encoding UTF8
    $firstTitle = $true
    $pageBreakBeforeNext = $false
    $i = 0
    while ($i -lt $lines.Count) {
      $line = $lines[$i]
      if ($line -match '^\|') {
        $tableLines = @()
        while ($i -lt $lines.Count -and $lines[$i] -match '^\|') {
          $tableLines += $lines[$i]
          $i++
        }
        $rows = @()
        foreach ($tableLine in $tableLines) {
          $cells = @($tableLine.Trim('|').Split('|') | ForEach-Object { $_.Trim() })
          $isSeparator = $true
          foreach ($cell in $cells) { if ($cell -notmatch '^:?-{3,}:?$') { $isSeparator = $false; break } }
          if (-not $isSeparator) { $rows += ,$cells }
        }
        Add-Table $doc $selection $rows $Preset
        continue
      }
      if ($line -match '^# (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Title' '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
        $firstTitle = $false
      } elseif ($line -match '^## (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Heading 1' '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ($line -match '^### (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Heading 2' '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ($line -match '^#### (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Heading 3' '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ($line -match '^- \[ \] (.+)$') {
        Add-Paragraph $doc $selection (([char]0x2610).ToString() + ' ' + $Matches[1]) 'Normal' '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ($line -eq '<!-- pagebreak -->') {
        $pageBreakBeforeNext = $true
      } elseif ($line -match '^- (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Normal' 'bullet' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ($line -match '^\d+\. (.+)$') {
        Add-Paragraph $doc $selection $Matches[1] 'Normal' 'number' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      } elseif ([string]::IsNullOrWhiteSpace($line)) {
        # Avoid piles of empty paragraphs while preserving section breathing room.
      } else {
        $style = if (-not $firstTitle -and $doc.Paragraphs.Count -le 2) { 'Subtitle' } else { 'Normal' }
        Add-Paragraph $doc $selection $line $style '' $pageBreakBeforeNext
        $pageBreakBeforeNext = $false
      }
      $i++
    }

    Normalize-PageTopSpacing $doc
    $lastParagraph = $doc.Paragraphs.Last
    if ($lastParagraph.Range.Text -eq "`r") {
      $lastParagraph.Range.Font.Size = 1
      $lastParagraph.Range.ParagraphFormat.SpaceAfter = 0
      $lastParagraph.Range.ParagraphFormat.LineSpacingRule = 0
    }

    $doc.SaveAs2($DocxPath, 16)
    $doc.ExportAsFixedFormat($PdfPath, 17)
    $doc.Close(0)
  } finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
  Scrub-DocxMetadata $DocxPath
}

Build-Docx `
  (Join-Path $docsDir 'PRODUCTION_READINESS_AUDIT_2026-09-05.md') `
  (Join-Path $docsDir 'Production_Readiness_Audit_2026-09-05.docx') `
  (Join-Path $qaDir 'Production_Readiness_Audit_2026-09-05.pdf') `
  'standard' `
  'DECISION MEMO  |  FINTAP PRODUCTION READINESS' `
  'Zynotch PVT Limited  |  Confidential'

Build-Docx `
  (Join-Path $docsDir '1BILL_HANDOVER_CHECKLIST_2026-09-05.md') `
  (Join-Path $docsDir '1BILL_Representative_Handover_Pack_2026-09-05.docx') `
  (Join-Path $qaDir '1BILL_Representative_Handover_Pack_2026-09-05.pdf') `
  'compact' `
  'ZYNOTCH  |  1BILL AGGREGATOR HANDOVER' `
  'Prefix 105172  |  Controlled working document'

Write-Output 'Created two DOCX deliverables and QA PDFs.'
