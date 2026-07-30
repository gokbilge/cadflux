# CadFlux â€” Product Specification and Development Roadmap

> **Working definition:** CadFlux is an open-source, local-first DWG/DXF viewer and vector PDF conversion platform that runs without AutoCAD or LibreCAD installation.
>
> **Recommended overall license:** `GPL-3.0-or-later`
>
> **Initial foundation:** Fork of `mlightcad/cad-viewer`, with DWG parsing provided through LibreDWG-based WebAssembly components.

---

## 1. Product vision

CadFlux should make opening, inspecting, organizing, plotting, and batch-converting CAD drawings straightforward for users who do not have AutoCAD installed.

The project should eventually support three complementary product surfaces:

1. **Web application**
   - Open local DWG and DXF files in a browser.
   - Drag and drop one or many drawings.
   - Inspect drawings without uploading them.
   - Export drawings and layouts to PDF.

2. **Command-line application**
   - Convert one file, multiple files, or a complete directory.
   - Suitable for scripts, scheduled jobs, CI pipelines, and server-side processing.
   - Return meaningful exit codes and machine-readable reports.

3. **Reusable conversion engine**
   - Shared parsing, normalization, layout, plotting, and export packages.
   - Usable by the web application and CLI.
   - Designed so additional formats and exporters can be added later.

---

## 2. Guiding principles

### 2.1 Local-first operation

By default, files must remain on the user's machine.

CadFlux should not require:

- cloud uploads;
- user accounts;
- a conversion server;
- AutoCAD;
- LibreCAD;
- internet access after installation;
- external browser extensions.

Any future cloud functionality must be optional, clearly disclosed, and disabled by default.

### 2.2 Vector-first PDF generation

The final goal is true vector PDF output.

CadFlux should avoid treating a canvas screenshot as the primary export method. Lines, arcs, circles, text, and dimensions should remain selectable or sharply scalable wherever possible.

A raster-based PDF may be offered as an explicit fallback mode for unsupported drawings.

### 2.3 Progressive fidelity

Version 0.1 should not attempt perfect AutoCAD-equivalent plotting.

Development should proceed in layers:

1. Reliable file loading.
2. Correct visible geometry.
3. Correct bounds and page fitting.
4. Vector PDF output.
5. Paper-space layouts.
6. Plot styles and advanced fonts.
7. Complex references and proxy entities.

### 2.4 One core, multiple interfaces

The web application, CLI, and future service interfaces must use the same conversion pipeline.

### 2.5 Platform boundary

CadFlux must not introduce:

- a Windows desktop application;
- Electron;
- Tauri;
- Windows installers;
- portable desktop executables;
- file associations;
- Explorer context-menu integration;
- desktop auto-update;
- Windows Registry integration;
- desktop-specific persistence.

Directory automation and unrestricted filesystem access belong in the Node.js CLI.

Interactive viewing, local-first conversion, and browser-safe batch workflows belong in the web application.

Business logic must not be embedded directly in UI components.

### 2.5 Transparent compatibility

CadFlux must report:

- detected DWG/DXF version;
- unsupported entities;
- missing fonts;
- missing Xrefs;
- missing raster images;
- substituted fonts;
- ignored plot styles;
- conversion warnings;
- whether the resulting PDF used vector or raster fallback.

A conversion should never silently claim full fidelity when information was skipped.

---

## 3. Licensing and attribution

### 3.1 Project license

Use:

```text
GPL-3.0-or-later
```

Recommended `package.json` field:

```json
{
  "license": "GPL-3.0-or-later"
}
```

### 3.2 Upstream licensing

The original MLightCAD viewer code is MIT-licensed. Preserve its original copyright and license notices in inherited files.

LibreDWG-based components are GPL-licensed. Because CadFlux will intentionally be open source, using `GPL-3.0-or-later` for the combined distributed product provides the clearest project-wide position.

### 3.3 Required repository files

Create and maintain:

```text
LICENSE
NOTICE
THIRD_PARTY_NOTICES.md
COPYRIGHT
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
GOVERNANCE.md
CHANGELOG.md
```

Recommended license directory:

```text
LICENSES/
â”œâ”€â”€ GPL-3.0-or-later.txt
â””â”€â”€ MIT.txt
```

### 3.4 Source headers

New substantial source files should include:

```typescript
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors
```

Do not overwrite upstream source headers.

### 3.5 Branding

Use the name:

```text
CadFlux
```

Suggested repository:

```text
cadflux
```

Suggested package namespace:

```text
@cadflux/*
```

Before a public launch, perform a basic trademark and package-name availability review.

---

# PART I â€” DAY 0 AND PROJECT RESHAPING

## 4. Day 0: fork, audit, and freeze the baseline

### 4.1 Fork the upstream project

Fork:

```text
mlightcad/cad-viewer
```

Rename the fork:

```text
cadflux
```

Keep the GitHub fork relationship visible initially.

### 4.2 Configure remotes

```bash
git clone https://github.com/YOUR_ORG/cadflux.git
cd cadflux

git remote add upstream https://github.com/mlightcad/cad-viewer.git
git remote -v
```

### 4.3 Create protected branches

Recommended branches:

```text
main
develop
```

Feature branches:

```text
feature/*
fix/*
refactor/*
docs/*
release/*
```

Protect `main`:

- require pull requests;
- require passing checks;
- require at least one review;
- prevent force pushes;
- prevent branch deletion;
- require signed commits if practical.

### 4.4 Record the upstream baseline

Create an annotated tag before major restructuring:

```bash
git tag -a upstream-baseline -m "Initial upstream baseline before CadFlux restructuring"
git push origin upstream-baseline
```

Create:

```text
docs/upstream-baseline.md
```

Record:

- upstream repository URL;
- upstream commit hash;
- date of fork;
- original version;
- original license;
- locally modified files;
- expected upstream synchronization policy.

### 4.5 Run and document the original project

Before changing architecture:

- install dependencies;
- run development mode;
- run production build;
- open representative DXF files;
- open representative DWG files;
- test model space;
- test paper space if available;
- record load times;
- record browser memory use;
- record current supported entities;
- save screenshots;
- document known defects.

Create:

```text
docs/baseline-test-results.md
```

### 4.6 Dependency and license audit

Produce an initial software bill of materials.

Check:

- direct npm dependencies;
- transitive npm dependencies;
- WebAssembly binaries;
- copied JavaScript bundles;
- fonts;
- example drawings;
- icons;
- screenshots;
- test fixtures;
- native binaries if any;
- build-time tools.

Recommended tools:

```bash
npm audit
npm ls --all
npx license-checker --summary
```

Add automated dependency review later.

### 4.7 Establish initial scope

The first public objective should be:

> Open multiple local DWG/DXF files, inspect them in tabs or a queue, configure page output, and export one or many drawings as PDFs without uploading the drawings.

Do not initially market CadFlux as:

- a full CAD editor;
- a complete AutoCAD replacement;
- a perfect print reproduction engine;
- a 3D CAD application;
- a Civil 3D converter.

---

## 5. Project restructuring strategy

Do not rewrite everything immediately.

Restructure in three passes.

### Pass A â€” Stabilize

Keep upstream functionality working.

Actions:

- rename visible branding;
- add licensing files;
- add tests around file loading;
- identify viewer/parsing boundaries;
- identify global state;
- identify UI-coupled conversion logic;
- create an architecture decision record.

### Pass B â€” Extract core services

Move reusable logic into packages without changing behavior.

Extract:

- file ingestion;
- format detection;
- drawing session model;
- parser adapter;
- normalized drawing model;
- bounds calculation;
- unit conversion;
- logging;
- diagnostics.

### Pass C â€” Introduce applications

Create separate web and CLI entry points that use shared packages.

---

## 6. Target monorepo structure

Recommended final structure:
`	ext
cadflux/
??? apps/
?   ??? web/
?   ??? cli/
?   ??? docs/
?
??? packages/
?   ??? core/
?   ??? file-ingest/
?   ??? dwg-adapter/
?   ??? dxf-adapter/
?   ??? drawing-model/
?   ??? renderer-webgl/
?   ??? renderer-svg/
?   ??? renderer-pdf/
?   ??? plot-engine/
?   ??? batch-engine/
?   ??? diagnostics/
?   ??? presets/
?   ??? config/
?   ??? testing/
?
??? fixtures/
?   ??? public/
?   ??? generated/
?   ??? expected/
?
??? docs/
?   ??? architecture/
?   ??? decisions/
?   ??? compatibility/
?   ??? development/
?   ??? licensing/
?   ??? user-guide/
?
??? scripts/
??? tools/
??? .github/
?   ??? workflows/
?   ??? ISSUE_TEMPLATE/
?   ??? PULL_REQUEST_TEMPLATE.md
?
??? LICENSE
??? NOTICE.md
??? THIRD_PARTY_NOTICES.md
??? CONTRIBUTING.md
??? CODE_OF_CONDUCT.md
??? SECURITY.md
??? GOVERNANCE.md
??? CHANGELOG.md
??? package.json
??? pnpm-workspace.yaml
??? README.md
`
### 6.1 Recommended package responsibilities

#### `@cadflux/core`

- public API;
- conversion orchestration;
- conversion job model;
- cancellation;
- progress reporting;
- error mapping;
- shared types.

#### `@cadflux/file-ingest`

- file selection;
- drag and drop;
- directory traversal;
- file filtering;
- duplicate detection;
- hashing;
- file metadata;
- browser `File`, file handles, and CLI path abstraction.

#### `@cadflux/dwg-adapter`

- LibreDWG-Web initialization;
- WASM loading;
- DWG parsing;
- DWG version detection;
- parser warnings;
- conversion into normalized drawing data.

#### `@cadflux/dxf-adapter`

- DXF parsing;
- DXF version handling;
- normalized drawing conversion;
- malformed-file diagnostics.

#### `@cadflux/drawing-model`

- entities;
- layers;
- blocks;
- layouts;
- viewports;
- dimensions;
- text;
- resources;
- units;
- extents.

#### `@cadflux/plot-engine`

- paper sizes;
- margins;
- orientation;
- fixed scale;
- fit-to-page;
- centering;
- drawing-to-paper transformation;
- lineweight mapping;
- color mapping;
- page creation;
- multi-layout plotting.

#### `@cadflux/renderer-webgl`

- interactive viewport;
- pan;
- zoom;
- selection;
- visibility;
- layer rendering;
- preview rendering.

#### `@cadflux/renderer-svg`

- vector SVG export;
- geometry paths;
- text placement;
- clipping;
- reusable intermediate output.

#### `@cadflux/renderer-pdf`

- direct vector PDF output;
- page metadata;
- font embedding;
- vector paths;
- raster fallback;
- multi-page documents.

#### `@cadflux/batch-engine`

- job queue;
- configurable concurrency;
- pause;
- resume;
- retry;
- cancellation;
- output naming;
- conflict handling;
- report generation.

#### `@cadflux/diagnostics`

- structured warnings;
- unsupported entity reports;
- missing dependency reports;
- timing metrics;
- conversion manifests.

#### `@cadflux/presets`

- A0â€“A5 page presets;
- architectural page sizes;
- engineering scales;
- standard margins;
- monochrome/color presets.

---

# PART II â€” FUNCTIONAL REQUIREMENTS

## 7. File input features

### 7.1 Single-file opening

Users must be able to:

- click **Open File**;
- select one DWG or DXF;
- drag one DWG or DXF into the application;
- open a file passed from the CLI;
- reopen a recent file from browser or CLI history where that surface supports it.

Supported initial extensions:

```text
.dwg
.dxf
```

Future optional extensions:

```text
.dxb
.svg
.pdf
.dwf
```

### 7.2 Multiple-file selection

Users must be able to:

- select multiple files in the operating-system file picker;
- drag and drop multiple files simultaneously;
- append new files to the existing queue;
- replace the existing queue with a new selection;
- remove individual files before conversion;
- clear the entire queue;
- reorder queued files;
- select all or deselect all;
- filter queued items by status or format.

### 7.3 Drag-and-drop behavior

The drop zone should:

- accept one or many files;
- accept folders where the platform supports directory handles;
- visually highlight while files are dragged over it;
- reject unsupported extensions clearly;
- identify zero-byte files;
- identify duplicate files;
- ask whether duplicates should be skipped, replaced, or retained;
- avoid blocking the UI while large files are inspected;
- show the number of accepted and rejected files;
- preserve nested relative paths when importing a directory.

### 7.4 Folder selection

The CLI and compatible browser versions should support:

- **Choose Source Directory**;
- recursive or non-recursive scanning;
- configurable maximum depth;
- DWG-only, DXF-only, or both;
- include filename patterns;
- exclude filename patterns;
- skip hidden directories;
- skip temporary files;
- skip previously converted files;
- detect files added after scanning;
- show a review screen before conversion.

Example include patterns:

```text
*.dwg
*.dxf
*_FINAL.dwg
PROJECT-*.dwg
```

Example excludes:

```text
~$*
*.bak
*_old.*
archive/**
node_modules/**
```

### 7.5 Archive input

Future feature:

- open ZIP archives containing drawings;
- retain folder structure;
- find Xrefs and images inside the archive;
- reject unsafe archive paths;
- enforce decompression size limits;
- warn about password-protected archives.

### 7.6 Clipboard and URL input

Optional later features:

- paste a local file from the clipboard;
- paste a file from the operating system clipboard where the browser permits;
- load from a remote URL after explicit consent;
- import from GitHub releases or public URLs;
- never fetch remote files silently.

---

## 8. File queue and workspace

### 8.1 Queue item states

Each item must have one state:

```text
Pending
Inspecting
Ready
Parsing
Rendering
Exporting
Completed
Completed with warnings
Failed
Cancelled
Skipped
```

### 8.2 Queue columns

Recommended table columns:

- selection checkbox;
- file name;
- relative source path;
- format;
- file size;
- DWG/DXF version;
- units;
- model-space bounds;
- number of layouts;
- page preset;
- output path;
- status;
- duration;
- warning count;
- action menu.

### 8.3 File tabs

For interactive work:

- open drawings in tabs;
- close tabs independently of the batch queue;
- pin tabs;
- reorder tabs;
- show unsaved preset changes;
- optionally restore the previous browser workspace or CLI batch session;
- lazy-load inactive drawings to manage memory.

### 8.4 Duplicate detection

Support detection by:

1. exact path;
2. filename and size;
3. content hash;
4. drawing fingerprint.

The user should choose:

```text
Skip duplicates
Keep all
Replace earlier item
Use newest modified file
```

### 8.5 Large queue behavior

For hundreds or thousands of files:

- virtualize the table;
- avoid parsing every file immediately;
- inspect metadata incrementally;
- cap concurrent parsers;
- release drawing memory after export;
- retain lightweight job summaries;
- support queue persistence;
- support resume after an application restart.

---

## 9. Drawing viewer features

### 9.1 Navigation

- pan;
- zoom;
- zoom to extents;
- zoom window;
- zoom to selected entity;
- reset view;
- mouse wheel control;
- touchpad support;
- keyboard shortcuts;
- optional coordinate display.

### 9.2 Visual modes

- dark background;
- light background;
- paper preview;
- monochrome preview;
- grayscale preview;
- original CAD colors;
- lineweight preview;
- antialiasing control.

### 9.3 Layer controls

- list layers;
- search layers;
- show/hide;
- isolate;
- lock;
- restore layer state;
- include/exclude layers from export;
- save layer presets;
- apply a preset to selected queue items.

### 9.4 Layout navigation

- model space;
- paper-space layout list;
- layout thumbnails;
- select one layout;
- select multiple layouts;
- export all layouts;
- reorder layouts for PDF page order;
- exclude hidden or empty layouts.

### 9.5 Drawing information panel

Display:

- source format;
- file version;
- drawing units;
- insertion units;
- extents;
- entity counts;
- block count;
- layer count;
- layout count;
- text styles;
- linetypes;
- detected Xrefs;
- detected images;
- unsupported entities;
- parser warnings.

### 9.6 Optional inspection tools

Later:

- entity selection;
- entity property panel;
- distance measurement;
- angle measurement;
- area measurement;
- coordinate readout;
- layer identification;
- block reference inspection;
- text search;
- drawing compare.

---

## 10. Plot and PDF configuration

### 10.1 Paper sizes

Initial presets:

```text
A0
A1
A2
A3
A4
A5
Letter
Legal
Tabloid
```

Later:

- ANSI sizes;
- ARCH sizes;
- custom width and height;
- roll paper;
- automatic paper selection;
- page preset import/export.

### 10.2 Orientation

```text
Portrait
Landscape
Automatic
```

Automatic orientation should choose the orientation that best fits the drawing or selected layout.

### 10.3 Plot area

Support:

```text
Drawing extents
Visible view
Current selection
Layout
Named window
Custom coordinates
```

Initial release may support only:

```text
Drawing extents
Layout
```

### 10.4 Scale

Support:

- fit to page;
- 1:1;
- fixed engineering scales;
- custom scale;
- paper units to drawing units;
- lock scale;
- automatic scale suggestion.

Example presets:

```text
1:1
1:2
1:5
1:10
1:20
1:25
1:50
1:100
1:200
1:500
1:1000
```

### 10.5 Position

- centered;
- custom X/Y offset;
- align top-left;
- align center;
- align bottom-right;
- preserve layout origin;
- rotate drawing by 90Â°, 180Â°, or 270Â°.

### 10.6 Margins

- zero margins where supported;
- standard safe margins;
- printer-style margins;
- equal margins;
- independent top/right/bottom/left values;
- margin units in mm or inches.

### 10.7 Color modes

```text
Original colors
Monochrome
Grayscale
Custom color mapping
Dark-lines-on-white
White-lines-on-dark
```

### 10.8 Lineweights

- use drawing lineweights;
- ignore lineweights;
- minimum visible lineweight;
- global lineweight multiplier;
- map color to lineweight;
- clamp extreme lineweights;
- preview lineweights before export.

### 10.9 Linetypes

- continuous;
- dashed;
- dotted;
- dash-dot;
- drawing-defined patterns;
- linetype scaling;
- paper-space linetype scaling;
- fallback for unsupported complex linetypes.

### 10.10 Text and fonts

- TrueType/OpenType font discovery;
- embedded web fonts;
- font substitution map;
- missing-font warnings;
- SHX fallback;
- text width handling;
- MTEXT formatting;
- Unicode;
- right-to-left text where supported;
- text-to-path fallback;
- selectable text option;
- preserve text as vectors when embedding is unavailable.

### 10.11 Plot styles

Long-term:

- CTB import;
- STB import;
- color-dependent plot styles;
- named plot styles;
- screening;
- dithering;
- lineweight mapping;
- end styles;
- join styles;
- fill styles.

The initial release must clearly state when CTB/STB files are ignored.

### 10.12 PDF metadata

Allow configuration of:

- document title;
- author;
- subject;
- keywords;
- creator;
- creation time;
- source drawing name;
- CadFlux version;
- conversion manifest attachment, optionally.

### 10.13 Multi-page PDF

Support:

- one PDF per drawing;
- one PDF per layout;
- all layouts of a drawing in one PDF;
- all selected drawings in one combined PDF;
- cover page;
- bookmarks by drawing and layout;
- page labels;
- configurable ordering.

---

## 11. Export modes

### 11.1 PDF

Primary output.

Modes:

```text
Vector PDF
Hybrid PDF
Raster PDF fallback
PDF/A â€” future
```

### 11.2 SVG

Useful for:

- debugging;
- web display;
- intermediate vector rendering;
- downstream editing;
- testing expected output.

### 11.3 PNG

Useful for:

- thumbnails;
- previews;
- sharing;
- fallback rendering;
- regression testing.

Controls:

- DPI;
- width/height;
- transparent background;
- white background;
- crop to content.

### 11.4 JSON diagnostics

Each conversion may optionally produce:

```text
drawing.pdf
drawing.cadflux.json
```

The report should contain:

- source checksum;
- application version;
- parser version;
- source format/version;
- selected layout;
- page settings;
- output checksum;
- unsupported entities;
- missing files;
- substitutions;
- warnings;
- timings;
- success status.

### 11.5 Future formats

Potential future exporters:

- EPS;
- PostScript;
- flattened SVG;
- GeoJSON for suitable drawings;
- thumbnail package;
- searchable text index.

---

## 12. Batch conversion

### 12.1 Input modes

The batch engine must support:

```bash
cadflux convert file.dwg
cadflux convert file1.dwg file2.dxf
cadflux convert ./source-directory
cadflux convert ./source-directory --recursive
cadflux convert --input-list files.txt
```

### 12.2 Source directory conversion

Core behavior:

- scan a source directory;
- optionally scan subdirectories;
- filter supported files;
- inspect files before conversion;
- preserve or flatten directory structure;
- choose output directory;
- create output directories automatically;
- skip or overwrite existing PDFs;
- support incremental conversion;
- generate a final report.

Example:

```bash
cadflux convert "C:\Projects\Drawings" \
  --recursive \
  --output "C:\Projects\PDF" \
  --preserve-tree \
  --paper A3 \
  --orientation auto \
  --fit
```

### 12.3 Output path strategies

Support:

```text
Same directory as source
Dedicated output directory
Mirror source directory tree
Flatten all outputs
Custom path template
```

Example template variables:

```text
{basename}
{extension}
{relativeDir}
{layout}
{date}
{drawingVersion}
{paper}
```

Example:

```text
{relativeDir}/{basename}-{layout}-{paper}.pdf
```

### 12.4 Name collisions

Options:

```text
Overwrite
Skip
Fail
Append number
Append layout
Append timestamp
Append content hash
```

### 12.5 Concurrency

Batch configuration:

- automatic concurrency;
- manual worker count;
- one parser worker by default for memory safety;
- separate rendering concurrency;
- maximum memory target;
- release WASM resources where possible;
- pause when memory pressure is detected.

### 12.6 Pause, resume, and cancel

The user must be able to:

- pause after the current item;
- resume;
- cancel one item;
- cancel selected items;
- cancel all;
- retry failed items;
- retry items with warnings;
- resume an interrupted persisted queue.

### 12.7 Conversion profiles

Users should be able to save named profiles:

```text
A3 Monochrome Fit
A1 Color 1:100
All Layouts Combined
Model Space Preview
Archive PDF
```

Profiles should be serializable:

```json
{
  "name": "A3 Monochrome Fit",
  "paper": "A3",
  "orientation": "auto",
  "scaleMode": "fit",
  "colorMode": "monochrome",
  "plotArea": "extents",
  "outputMode": "one-pdf-per-drawing"
}
```

### 12.8 Per-file overrides

Apply a common profile to all files, then allow overrides for:

- paper;
- orientation;
- scale;
- selected layouts;
- layers;
- output path;
- font substitutions;
- Xref path;
- raster fallback.

### 12.9 Batch reports

Produce:

```text
batch-report.json
batch-report.csv
batch-report.html
```

Include:

- total files;
- successful;
- successful with warnings;
- failed;
- skipped;
- cancelled;
- total duration;
- average duration;
- total source size;
- total output size;
- warnings grouped by type;
- failures grouped by reason;
- file-by-file results.

---

## 13. Directory watch mode
CLI-only future feature:
`ash
cadflux watch "C:\IncomingDWG" --output "C:\ConvertedPDF"
`
Capabilities:
- detect newly created files;
- wait until file writing is complete;
- ignore temporary files;
- debounce repeated changes;
- reconvert modified files;
- maintain a processing ledger;
- retry locked files;
- archive source after success;
- move failed files to a quarantine directory;
- emit structured logs;
- recover cleanly after restart.
Safety controls:
- do not delete originals by default;
- require explicit flags to move or archive;
- prevent output-loop recursion;
- cap retry counts;
- log every destructive action.
---

## 14. Command-line interface

### 14.1 Initial commands

```bash
cadflux open drawing.dwg
cadflux inspect drawing.dwg
cadflux convert drawing.dwg
cadflux convert ./directory --recursive
cadflux presets list
cadflux presets validate preset.json
cadflux doctor
cadflux version
```

### 14.2 Convert command

Example:

```bash
cadflux convert drawing.dwg \
  --output drawing.pdf \
  --layout Model \
  --paper A3 \
  --orientation landscape \
  --scale fit \
  --color monochrome \
  --margin 10mm
```

### 14.3 Batch example

```bash
cadflux convert ./drawings \
  --recursive \
  --output ./pdf \
  --preserve-tree \
  --profile ./profiles/a3-mono.json \
  --workers 2 \
  --report ./reports/run.json
```

### 14.4 Machine-readable output

Support:

```bash
--json
--quiet
--log-level debug
--report path
```

### 14.5 Exit codes

Recommended:

```text
0  All conversions succeeded
1  General failure
2  Invalid arguments
3  Unsupported input
4  Parsing failure
5  Rendering failure
6  Output write failure
7  Completed with one or more failed files
8  Cancelled
9  License/configuration error
10 Environment or dependency failure
```

---

## 15. Platform scope
CadFlux 1.x targets only:
- a browser web application;
- a Node.js command-line application;
- reusable TypeScript conversion packages.
CadFlux must not add:
- Electron;
- Tauri;
- native Windows wrappers;
- installers for a desktop app;
- portable desktop builds;
- file associations;
- Explorer commands;
- desktop notifications;
- background services;
- native auto-update.
When unrestricted filesystem automation is required, implement it in the CLI.
When interactive local-first viewing and guided batch conversion are required, implement them in the web application.
## 16. Browser application

### 16.1 Browser compatibility

Target:

- current Chromium-based browsers;
- Firefox;
- Safari where WebAssembly and file APIs permit.

Document limitations by browser.

### 16.2 Offline-capable PWA

Future:

- installable PWA;
- cached application shell;
- offline WASM;
- offline fonts;
- no network requirement;
- explicit storage controls;
- clear-cache action.

### 16.3 Browser folder access

Use progressive enhancement:

1. File System Access API where available.
2. Directory upload input fallback.
3. Multiple-file input fallback.

Do not make folder conversion dependent on one browser-only API.

### 16.4 Browser memory management

- parse files sequentially by default;
- use Web Workers;
- transfer `ArrayBuffer` ownership;
- free inactive drawing models;
- cap previews;
- warn before loading extremely large files;
- provide a low-memory mode.

---

# PART III â€” CAD COMPATIBILITY

## 17. Initial entity support target

Priority 1:

- LINE;
- POINT;
- CIRCLE;
- ARC;
- ELLIPSE;
- LWPOLYLINE;
- POLYLINE;
- SOLID;
- TRACE;
- 3DFACE rendered in 2D projection;
- TEXT;
- basic MTEXT;
- INSERT;
- BLOCK;
- ATTRIB;
- ATTDEF;
- basic DIMENSION;
- basic HATCH.

Priority 2:

- SPLINE;
- LEADER;
- MLEADER;
- TABLE;
- WIPEOUT;
- IMAGE;
- UNDERLAY;
- complex hatches;
- advanced dimensions;
- OLE placeholders.

Priority 3:

- dynamic blocks;
- annotative entities;
- custom objects;
- proxy graphics;
- Civil 3D entities;
- Architecture entities;
- 3D solids;
- advanced materials and visual styles.

## 18. Blocks

Support:

- nested blocks;
- insertion transform;
- rotation;
- scaling;
- non-uniform scaling;
- attributes;
- layer inheritance;
- BYBLOCK/BYLAYER properties;
- cyclic-reference protection;
- maximum nesting depth;
- reusable geometry caching.

## 19. Xrefs

Phased support:

### Phase 1

- detect external references;
- list expected paths;
- warn when unresolved;
- allow manual attachment of missing files.

### Phase 2

- search relative paths;
- search user-configured directories;
- resolve packaged directory imports;
- preserve nested Xrefs;
- detect cycles.

### Phase 3

- ZIP project package;
- Xref path remapping;
- reference binding for export;
- manifest export.

## 20. Raster images

Support:

- detect image references;
- resolve local relative paths;
- prompt for missing images;
- support PNG/JPEG initially;
- crop and transform images;
- preserve image opacity;
- embed images into PDF;
- report missing or unsupported images.

## 21. Units

Detect and support:

```text
Unitless
Inches
Feet
Millimeters
Centimeters
Meters
Kilometers
Microinches
Mils
Yards
Miles
```

Requirements:

- display detected units;
- allow override;
- warn when unitless;
- save per-file override;
- include effective unit in report;
- use exact conversion constants.

## 22. Coordinate and geometry precision

- use double precision;
- protect against extremely large coordinates;
- normalize coordinates for rendering where necessary;
- retain original coordinates in the model;
- avoid precision loss in PDF transforms;
- test drawings far from origin;
- test tiny geometry;
- test mixed extreme scales.

## 23. Model space and paper space

### Model space

Initial:

- extents;
- selected entities;
- current view;
- fixed-scale export;
- fit-to-page.

### Paper space

Later:

- layout page settings;
- viewport transforms;
- viewport clipping;
- frozen layers per viewport;
- viewport scale;
- paperspace annotations;
- multiple layouts;
- page order.

---

# PART IV â€” PDF ENGINE

## 24. PDF implementation stages

### Stage 1: proof of concept

```text
DWG/DXF â†’ existing viewer â†’ high-resolution canvas â†’ PDF
```

Purpose:

- validate workflow;
- validate page settings;
- validate batch queue.

This is temporary and should be labeled raster output.

### Stage 2: SVG intermediary

```text
DWG/DXF â†’ normalized drawing â†’ SVG â†’ PDF
```

Benefits:

- vector geometry;
- debuggable output;
- reusable browser preview;
- simpler early implementation.

### Stage 3: direct PDF renderer

```text
DWG/DXF â†’ normalized drawing â†’ PDF operators
```

Benefits:

- better control;
- lower memory overhead;
- multi-page support;
- font embedding;
- clipping;
- bookmarks;
- optimized files.

### Stage 4: hybrid fidelity engine

- vector geometry;
- embedded raster references;
- rasterized unsupported regions;
- per-entity fallback;
- diagnostics showing fallback areas.

## 25. PDF quality requirements

- geometry must remain sharp at high zoom;
- page dimensions must be exact;
- margins must be deterministic;
- lineweights must be consistent;
- text must not unexpectedly mirror or rotate;
- clipping must remain inside the page;
- repeated blocks should not cause uncontrolled file growth;
- output should open in major PDF readers;
- large drawings should not create invalid PDFs;
- multi-page output should preserve order.

## 26. PDF optimization

Future:

- reuse PDF form XObjects for repeated blocks;
- deduplicate fonts;
- deduplicate images;
- compress content streams;
- subset embedded fonts;
- simplify excessive polyline vertices optionally;
- control numeric precision;
- remove off-page geometry safely;
- optimize for screen or print.

---

# PART V â€” USER EXPERIENCE

## 27. Main application layout

Recommended interface:

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Toolbar: Open | Add Folder | Convert | Pause | Settings     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ File queue        â”‚ Drawing preview                         â”‚
â”‚                   â”‚                                         â”‚
â”‚ [files/status]    â”‚                                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Preset / layout   â”‚ Diagnostics / file information          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 28. First-run experience

Show:

- what CadFlux does;
- files stay local;
- supported formats;
- DWG limitations;
- open files button;
- drag-and-drop area;
- sample drawing option;
- license and privacy links.

## 29. Conversion flow

1. Add files or a directory.
2. Inspect supported files.
3. Select a conversion profile.
4. Preview one representative drawing.
5. Resolve critical missing fonts or Xrefs.
6. Start conversion.
7. Observe progress.
8. Review warnings and failures.
9. Open output directory.
10. Export conversion report.

## 30. Progress display

Per job:

- current phase;
- percentage where measurable;
- elapsed time;
- parser progress;
- render progress;
- output size;
- warning count.

Overall:

- completed / total;
- active workers;
- estimated progress without promising exact time;
- failures;
- paused status.

## 31. Error experience

Errors must include:

- plain-language summary;
- technical details toggle;
- likely cause;
- source file;
- failed stage;
- retry action;
- report-copy action;
- GitHub issue template link;
- privacy reminder before attaching drawings publicly.

## 32. Accessibility

- keyboard operation;
- visible focus states;
- screen-reader labels;
- high-contrast mode;
- non-color status indicators;
- scalable UI;
- reduced-motion support;
- accessible progress announcements;
- localized number and unit display.

## 33. Localization

Prepare the application for translation from the beginning.

Initial languages:

```text
English
Turkish
```

Later:

- German;
- Italian;
- French;
- Spanish;
- Portuguese;
- Polish;
- Chinese;
- Japanese.

Do not hard-code UI text inside plotting logic.

---

# PART VI â€” PERFORMANCE AND RELIABILITY

## 34. Performance targets

Initial measurable goals:

- UI remains responsive during parsing;
- file inspection occurs outside the main thread;
- users can cancel long operations;
- queue supports at least 500 lightweight entries;
- completed drawings are released from memory;
- batch conversion does not continually increase memory;
- preview uses level-of-detail or culling for large drawings.

Performance targets should be based on a published benchmark fixture set rather than marketing claims.

## 35. Web Workers

Use workers for:

- DWG parsing;
- DXF parsing;
- bounds calculation;
- SVG generation;
- PDF generation where supported;
- hashing;
- image decoding.

Messages should be structured and versioned.

## 36. Job persistence
CLI:
- persist queue in a JSON ledger or filesystem-based state;
- persist profile;
- persist output settings;
- resume after restart;
- mark jobs interrupted by a crash or forced termination.
Browser:
- optional IndexedDB persistence;
- do not persist source file bytes without consent;
- store handles only where supported and permitted;
- offer clear workspace deletion.
## 37. Cancellation

Every expensive stage should accept an abort signal.

Cancellation must:

- stop pending work;
- terminate worker if required;
- delete partial output unless configured otherwise;
- preserve diagnostic logs;
- return a cancelled state rather than a generic failure.

## 38. Determinism

Given identical:

- source bytes;
- CadFlux version;
- profile;
- fonts;
- dependencies;

the output should be visually deterministic.

Optionally support reproducible PDF metadata by suppressing timestamps.

---

# PART VII â€” SECURITY AND PRIVACY

## 39. File safety

Treat CAD files as untrusted.

Requirements:

- parser runs in a worker or isolated process;
- validate input size;
- enforce entity-count limits;
- enforce nesting limits;
- protect against cyclic block references;
- protect against decompression bombs;
- do not execute embedded scripts or macros;
- sanitize generated SVG;
- avoid loading remote Xrefs automatically;
- avoid loading remote images automatically;
- validate output paths.

## 40. Local path safety

- prevent directory traversal;
- normalize paths;
- preserve Windows UNC paths;
- support long paths safely;
- do not overwrite source drawings;
- write to temporary output then atomically rename;
- avoid following symlinks unexpectedly;
- prevent output from escaping the selected directory.

## 41. Privacy

Default behavior:

- no file upload;
- no drawing telemetry;
- no filename telemetry;
- no path telemetry;
- no automatic crash attachment;
- no analytics by default.

If anonymous telemetry is ever added:

- opt in;
- explain exact fields;
- exclude filenames and drawing content;
- provide a local preview;
- provide deletion and disabling instructions.

## 42. Dependency security

Automate:

- dependency review;
- npm audit;
- lockfile validation;
- CodeQL;
- secret scanning;
- signed release checksums;
- SBOM generation;
- provenance where practical.

---

# PART VIII â€” TESTING

## 43. Test levels

### Unit tests

- geometry transforms;
- bounds calculation;
- unit conversion;
- scale calculation;
- paper placement;
- path templates;
- collision handling;
- profile validation;
- warning classification.

### Integration tests

- DWG parser to normalized model;
- DXF parser to normalized model;
- model to SVG;
- model to PDF;
- directory scanning;
- batch queue;
- cancellation;
- persistence.

### End-to-end tests

- drag multiple files;
- drag a directory;
- configure profile;
- convert;
- download/output PDFs;
- review errors;
- retry failures;
- reopen persisted queue.

### Visual regression tests

Compare:

- PNG previews;
- SVG rendering;
- rasterized PDF pages;
- entity placement;
- lineweights;
- text positions;
- clipping.

Use perceptual thresholds and retain human-review capability.

## 44. Fixture strategy

Only commit drawings that are:

- generated by the project;
- explicitly licensed for redistribution;
- contributed with permission;
- public-domain;
- minimal reproductions.

Never commit customer or confidential engineering drawings.

Fixture categories:

```text
basic-geometry
blocks
nested-blocks
text
mtext
dimensions
hatches
layouts
viewports
xrefs
images
large-coordinates
tiny-coordinates
malformed
unsupported
performance
```

## 45. Compatibility matrix

Maintain:

```text
docs/compatibility/dwg-versions.md
docs/compatibility/entities.md
docs/compatibility/fonts.md
docs/compatibility/layouts.md
```

For each entity:

```text
Parse
Preview
SVG
PDF
Known limitations
Test fixture
```

## 46. Golden files

For stable fixtures, store:

- source;
- normalized JSON snapshot;
- expected SVG;
- reference PNG;
- expected diagnostics;
- PDF structural assertions.

Avoid relying only on byte-for-byte PDF equality.

## 47. Fuzzing

Future:

- fuzz parser adapters;
- fuzz path generation;
- fuzz malformed DXF;
- entity-count stress tests;
- cyclic blocks;
- extreme coordinates;
- invalid strings;
- corrupted files.

---

# PART IX â€” DEVELOPMENT OPERATIONS

## 48. Package manager and tooling

Recommended:

```text
pnpm workspaces
TypeScript
Vite
Vitest
Playwright
ESLint
Prettier
Changesets
```

Use exact lockfile commits.

## 49. Continuous integration

Workflows:

```text
ci.yml
lint.yml
test.yml
visual-regression.yml
license-scan.yml
security.yml
build-web.yml
build-cli.yml
release.yml
```

Run on:

- Windows;
- Linux;
- macOS where relevant.

CLI release testing must include Windows, Linux, and macOS where supported.

## 50. Pull-request requirements

Every substantial PR should include:

- problem statement;
- implementation summary;
- tests;
- screenshots for UI changes;
- performance impact;
- compatibility impact;
- licensing impact;
- changelog entry where appropriate.

## 51. Architecture decisions

Create ADRs for:

```text
ADR-0001 Monorepo structure
ADR-0002 Overall GPL license
ADR-0003 Normalized drawing model
ADR-0004 PDF rendering strategy
ADR-0005 Web and CLI runtime boundaries
ADR-0006 Worker architecture
ADR-0007 Queue persistence
ADR-0008 Font handling
ADR-0009 Xref resolution
ADR-0010 Telemetry policy
```

## 52. Upstream synchronization

Maintain an `upstream-sync` branch.

Process:

1. fetch upstream;
2. merge upstream changes into `upstream-sync`;
3. resolve conflicts;
4. run full tests;
5. open PR into `develop`;
6. document upstream commit range;
7. never mix an upstream sync with unrelated CadFlux features.

Over time, if divergence becomes too great, document the decision to stop regular merges.

---

# PART X â€” RELEASE ROADMAP

## 53. Milestone 0: project foundation

### Goal

Create a legally and technically clean CadFlux repository without changing core viewer behavior.

### Deliverables

- fork and rename;
- baseline tag;
- GPL project license;
- preserved MIT notices;
- third-party notices;
- security and contribution files;
- baseline build;
- dependency audit;
- architecture documentation;
- CI for lint/build/test;
- sample fixture policy;
- initial roadmap.

### Exit criteria

- upstream application runs;
- production build succeeds;
- DWG and DXF sample files open;
- licenses are documented;
- CI passes on clean checkout.

---

## 54. Milestone 1: ingestion and workspace

### Goal

Support robust single-file and multi-file workflows.

### Features

- open one file;
- select multiple files;
- drag and drop multiple files;
- queue table;
- remove/clear/reorder;
- duplicate detection;
- file validation;
- unsupported-file reporting;
- basic file tabs;
- metadata inspection;
- non-blocking parsing;
- cancellation.

### Exit criteria

- at least 100 files can be queued without freezing;
- invalid files do not crash the app;
- duplicate policy works;
- individual files can be previewed.

---

## 55. Milestone 2: initial PDF proof of concept

### Goal

Deliver working PDF export, even if initially raster-based.

### Features

- A4/A3;
- portrait/landscape;
- fit-to-page;
- margins;
- model-space extents;
- color/monochrome;
- one PDF per drawing;
- download/open output;
- conversion diagnostics.

### Exit criteria

- PDF page dimensions are correct;
- output is not clipped for baseline fixtures;
- failures are reported clearly;
- raster mode is labeled accurately.

---

## 56. Milestone 3: source-directory batch conversion

### Goal

Convert a folder of drawings with a repeatable profile.

### Features

- choose source directory;
- recursive scan;
- filters;
- choose output directory;
- preserve folder tree;
- output naming templates;
- overwrite/skip policies;
- progress queue;
- pause/resume/cancel;
- retry failures;
- JSON/CSV report;
- browser or CLI implementation.

### Exit criteria

- nested directories convert correctly;
- originals remain untouched;
- interrupted jobs can be identified;
- report matches actual results;
- output collisions follow selected policy.

---

## 57. Milestone 4: SVG vector export

### Goal

Move from screenshot plotting to vector geometry.

### Features

- normalized geometry exporter;
- LINE;
- POLYLINE;
- LWPOLYLINE;
- ARC;
- CIRCLE;
- ELLIPSE;
- basic TEXT;
- basic blocks;
- layer visibility;
- SVG output;
- SVG-to-PDF pipeline.

### Exit criteria

- supported entities remain vector;
- geometry matches baseline screenshots;
- SVG opens in major browsers;
- PDF remains sharp at high zoom.

---

## 58. Milestone 5: direct vector PDF engine

### Goal

Generate PDF without relying on browser print output.

### Features

- direct PDF paths;
- precise page units;
- clipping;
- lineweight mapping;
- dashed lines;
- basic text;
- font embedding/substitution;
- repeated-block optimization;
- metadata;
- multi-page output.

### Exit criteria

- PDF passes structural validation;
- supported fixtures remain vector;
- file size is controlled;
- page dimensions and scales are deterministic.

---

## 59. Milestone 6: layouts and multi-page plotting

### Goal

Support paper-space workflows.

### Features

- layout discovery;
- layout selection;
- export all layouts;
- combined PDF;
- page ordering;
- bookmarks;
- layout page settings;
- basic viewport transformation;
- viewport clipping;
- per-layout warnings.

### Exit criteria

- selected layouts export in order;
- viewports are clipped;
- multi-page PDFs open reliably;
- unsupported viewport behavior is reported.

---

## 60. Milestone 7: production web application
### Goal
Provide a production-ready browser application for local-first viewing and guided batch conversion.
### Features
- source/output folder pickers where browser APIs permit;
- multiple file input fallback;
- directory upload fallback;
- recent files;
- saved profiles;
- queue persistence in IndexedDB where enabled;
- local logs;
- ZIP batch output fallback;
- browser limitation guidance.
### Exit criteria
- current Chromium-based browsers are supported;
- browser conversion works without uploads;
- batch export works through direct directory writing or ZIP download;
- limits are disclosed clearly when browser APIs do not permit direct filesystem access.
---
## 61. Milestone 8: production CLI

### Goal

Enable automation and scripting.

### Features

- single file;
- multiple files;
- recursive folder;
- input list;
- profile files;
- JSON output;
- reports;
- stable exit codes;
- cancellation signal handling;
- resumable batch ledger;
- watch mode preview.

### Exit criteria

- documented examples work in PowerShell and Command Prompt;
- scripts can distinguish warning and failure outcomes;
- output is deterministic;
- CLI and web application share the same core engine.

---

## 62. Milestone 9: fidelity improvements

### Features

- advanced MTEXT;
- dimensions;
- hatches;
- SPLINE;
- advanced linetypes;
- SHX handling;
- text style mapping;
- raster image references;
- Xrefs;
- BYLAYER/BYBLOCK correctness;
- fixed-scale plotting;
- custom windows;
- plot-style groundwork.

### Exit criteria

- compatibility matrix is published;
- major unsupported cases are visible;
- regression suite covers every supported entity.

---

## 63. Milestone 10: CTB/STB and advanced print workflows

### Features

- CTB reader;
- STB reader;
- screening;
- plot-style lineweights;
- plot-style colors;
- style preview;
- named page setups;
- import/export CadFlux plot profiles;
- auto paper selection;
- title-block detection experiments.

### Exit criteria

- output settings are explainable;
- plot-style effects are previewed;
- unsupported fields produce warnings;
- files are tested against licensed fixtures.

---

## 64. Milestone 11: directory watch and service mode

### Features

- watch source folder;
- wait for completed writes;
- convert automatically;
- retry locked files;
- archive success;
- quarantine failures;
- Windows service mode;
- event log integration;
- webhooks or local notifications as optional outputs.

### Exit criteria

- no duplicate conversion loops;
- restart resumes safely;
- destructive actions require explicit configuration;
- every processed file has a ledger entry.

---

## 65. Milestone 12: ecosystem and plugins

Possible APIs:

- custom exporters;
- custom entity renderers;
- custom plot profiles;
- custom font resolvers;
- Xref resolvers;
- output naming hooks;
- post-processing hooks;
- diagnostics extensions.

A plugin API must include:

- version compatibility;
- permission boundaries;
- failure isolation;
- clear licensing expectations;
- signed plugin metadata, optionally.

---

# PART XI â€” FEATURE BACKLOG

## 66. High-priority backlog

- multiple drag-and-drop;
- folder drag-and-drop;
- source directory batch conversion;
- output directory selection;
- recursive scanning;
- profile saving;
- per-file overrides;
- queue persistence;
- pause/resume;
- retry;
- conversion reports;
- vector SVG;
- vector PDF;
- paper size presets;
- scale presets;
- monochrome output;
- model/layout selection;
- unsupported-entity warnings.

## 67. Medium-priority backlog

- combined PDFs;
- bookmarks;
- thumbnails;
- directory watch;
- browser ZIP fallback improvements;
- PWA;
- Xrefs;
- images;
- advanced text;
- dimensions;
- hatches;
- custom margins;
- custom page sizes;
- fixed scale;
- font substitution editor;
- batch profile editor.

## 68. Lower-priority or research backlog

- CTB/STB;
- dynamic blocks;
- Civil 3D proxy graphics;
- Architecture objects;
- 3D solid projection;
- drawing comparison;
- OCR of raster title blocks;
- automatic title-block metadata extraction;
- automatic best-layout selection;
- cloud worker mode;
- collaborative review;
- annotations;
- redlining;
- PDF-to-DWG features.

---

# PART XII â€” DEFINITION OF DONE

## 69. Feature definition of done

A feature is complete only when it has:

- implementation;
- TypeScript types;
- user-visible error handling;
- unit or integration tests;
- documentation;
- accessibility review where relevant;
- localization keys;
- changelog entry;
- no new unexplained license issue;
- performance review for large files;
- telemetry/privacy review if data is involved.

## 70. Release definition of done

A release requires:

- clean CI;
- signed or checksummed artifacts;
- SBOM;
- dependency/license report;
- tested web build and CLI package;
- documented known limitations;
- updated compatibility matrix;
- migration notes;
- release notes;
- reproducible build instructions where practical;
- source archive corresponding to binaries.

---

# PART XIII â€” RECOMMENDED FIRST IMPLEMENTATION SPRINTS

## 71. Sprint 1: foundation

- fork and tag baseline;
- rename branding to CadFlux;
- add GPL licensing and notices;
- make original build reproducible;
- create CI;
- create architecture docs;
- create test fixture rules;
- add a smoke test for DWG and DXF loading.

## 72. Sprint 2: ingestion

- implement unified `InputSource`;
- multiple-file picker;
- drag-and-drop;
- queue model;
- validation;
- duplicate detection;
- queue UI;
- cancellation.

## 73. Sprint 3: plotting model

- define `PlotProfile`;
- define paper-size model;
- implement margins;
- orientation;
- fit-to-page transform;
- model-space bounds;
- preview page overlay.

## 74. Sprint 4: first PDF

- implement raster proof-of-concept;
- expose PDF export;
- queue conversion;
- output naming;
- warnings;
- per-file report.

## 75. Sprint 5: folder batch

- browser/CLI directory scanner;
- recursive option;
- include/exclude rules;
- output directory;
- preserve-tree mode;
- overwrite policy;
- JSON/CSV report.

## 76. Sprint 6: SVG vector path

- normalize core entities;
- generate SVG;
- add visual regression tests;
- convert SVG to PDF;
- compare against raster output.

## 77. Sprint 7: direct PDF foundation

- PDF path primitives;
- direct geometry renderer;
- clipping;
- text fallback;
- multi-page foundation;
- deterministic output tests.

---

# PART XIV â€” PROPOSED PUBLIC ROADMAP LABELS

Use GitHub milestones:

```text
v0.0 Foundation
v0.1 Multi-file Viewer
v0.2 Basic PDF Export
v0.3 Batch Directory Conversion
v0.4 Vector SVG/PDF
v0.5 Layout Export
v0.6 Web Application
v0.7 CLI and Automation
v0.8 Fidelity
v0.9 Release Candidate
v1.0 Stable
```

Recommended issue labels:

```text
area:parser
area:renderer
area:pdf
area:batch
area:web
area:cli
area:fonts
area:layouts
area:xrefs
area:licensing
area:security
area:performance
type:bug
type:feature
type:refactor
type:documentation
type:test
priority:critical
priority:high
priority:medium
priority:low
good-first-issue
help-wanted
blocked
needs-fixture
```

---

# PART XV â€” VERSION 1.0 TARGET

CadFlux 1.0 should be considered ready when it can reliably:

1. Run locally in a browser or from the CLI without AutoCAD or LibreCAD installation.
2. Open DWG and DXF files through a picker or drag-and-drop.
3. Accept multiple drawings in one operation.
4. Scan and batch-convert a source directory.
5. Preserve an optional source-directory tree.
6. Apply saved conversion profiles.
7. Export supported geometry as vector PDF.
8. Export model space and supported paper-space layouts.
9. Produce one PDF per file, one PDF per layout, or combined PDFs.
10. Pause, resume, cancel, and retry batch jobs.
11. Persist and resume web or CLI queues where supported.
12. Report unsupported entities, missing fonts, Xrefs, and images.
13. Generate JSON and CSV conversion reports.
14. Provide a documented CLI.
15. Publish an accurate compatibility matrix.
16. Ship source code, license notices, SBOM, and reproducible build instructions.
17. Protect source drawings and never upload files by default.
18. Clearly distinguish vector, hybrid, and raster-fallback output.

---

# PART XVI â€” NON-GOALS FOR VERSION 1.0

CadFlux 1.0 does not need to be:

- a full CAD editor;
- a 3D modeling application;
- an AutoCAD command clone;
- a DWG writer;
- a Civil 3D object editor;
- a cloud document-management platform;
- a guaranteed pixel-identical AutoCAD plotter;
- a PDF-to-DWG converter.

Keeping these outside the initial product boundary will make a stable open-source converter achievable.

---

# PART XVII â€” INITIAL TECHNICAL API SKETCH

## 78. Core conversion API

```typescript
export interface ConversionRequest {
  inputs: InputSource[];
  output: OutputTarget;
  profile: PlotProfile;
  batch?: BatchOptions;
}

export interface PlotProfile {
  plotArea: "extents" | "layout" | "view" | "window";
  layouts?: string[];
  paper: PaperDefinition;
  orientation: "portrait" | "landscape" | "auto";
  scale:
    | { mode: "fit" }
    | { mode: "fixed"; numerator: number; denominator: number };
  margins: PageMargins;
  colorMode: "original" | "monochrome" | "grayscale";
  lineweightMode: "drawing" | "ignore" | "scaled";
  outputMode:
    | "one-per-drawing"
    | "one-per-layout"
    | "combined-per-drawing"
    | "combined-all";
  fallbackMode: "fail" | "hybrid" | "raster";
}

export interface ConversionResult {
  source: SourceDescriptor;
  outputs: OutputDescriptor[];
  status: "success" | "warning" | "failure" | "cancelled";
  diagnostics: Diagnostic[];
  metrics: ConversionMetrics;
}
```

## 79. CLI configuration file

Example `cadflux.config.json`:

```json
{
  "$schema": "https://cadflux.org/schemas/config-v1.json",
  "input": {
    "recursive": true,
    "include": ["**/*.dwg", "**/*.dxf"],
    "exclude": ["**/archive/**", "**/*.bak"]
  },
  "output": {
    "directory": "./pdf",
    "preserveTree": true,
    "collision": "append-number",
    "template": "{relativeDir}/{basename}-{layout}.pdf"
  },
  "plot": {
    "plotArea": "extents",
    "paper": "A3",
    "orientation": "auto",
    "scale": "fit",
    "margins": "10mm",
    "colorMode": "monochrome",
    "outputMode": "one-per-drawing",
    "fallbackMode": "hybrid"
  },
  "batch": {
    "workers": 2,
    "continueOnError": true,
    "report": "./reports/latest.json"
  }
}
```

---

# PART XVIII â€” DOCUMENTATION SET

Create:

```text
docs/
â”œâ”€â”€ getting-started.md
â”œâ”€â”€ installation.md
â”œâ”€â”€ web-app.md
â”œâ”€â”€ desktop-app.md
â”œâ”€â”€ cli.md
â”œâ”€â”€ batch-conversion.md
â”œâ”€â”€ plot-profiles.md
â”œâ”€â”€ fonts.md
â”œâ”€â”€ xrefs.md
â”œâ”€â”€ troubleshooting.md
â”œâ”€â”€ privacy.md
â”œâ”€â”€ security.md
â”œâ”€â”€ licensing.md
â”œâ”€â”€ building-from-source.md
â”œâ”€â”€ architecture.md
â””â”€â”€ compatibility/
    â”œâ”€â”€ dwg-versions.md
    â”œâ”€â”€ dxf-versions.md
    â”œâ”€â”€ entities.md
    â”œâ”€â”€ layouts.md
    â””â”€â”€ known-limitations.md
```

Every feature should have both:

- user documentation;
- developer/API documentation.

---

# PART XIX â€” SOURCE REFERENCES

The initial technical and licensing assumptions should be periodically rechecked against upstream projects:

- MLightCAD CAD Viewer: browser-based DWG/DXF viewer/editor, MIT-licensed.
- MLightCAD LibreDWG Web: DWG/DXF JavaScript parser based on LibreDWG, GPL-3.0.
- GNU LibreDWG: GPL version 3 or later.

Repository dependencies and licenses may change, so CadFlux should run automated license checks and pin reviewed versions before each release.

---

# PART XX â€” FINAL RECOMMENDATION

Begin with the existing viewer and avoid an immediate rewrite.

The best sequence is:

```text
Fork and audit
â†’ stabilize upstream viewer
â†’ add multi-file ingestion
â†’ add conversion queue
â†’ add basic raster PDF proof of concept
â†’ add source-directory batch conversion
â†’ extract a normalized drawing model
â†’ add SVG vector export
â†’ add direct vector PDF output
â†’ add layouts
â†’ package Windows desktop and CLI
â†’ improve fonts, Xrefs, images, and plot styles
â†’ release CadFlux 1.0
```

The most valuable early differentiator is not editing. It is a reliable, local, transparent conversion workflow:

```text
Many DWG/DXF files
â†’ one queue
â†’ one profile
â†’ predictable vector PDFs
â†’ complete diagnostics
```


