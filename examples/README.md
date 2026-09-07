---
tags: [sample]
---
# Sample vault content for HTML Gallery

This folder contains a handful of diagrams, a PDF and the notes they came from, so you can see how HTML Gallery behaves before pointing it at your own vault.

SVG and PDF are off by default: turn on "Show SVG files" and "Show PDF files" in the plugin settings to see those two samples.

- Big picture: [[mindmap.html]] and [[system-overview.html]]
- Architecture decisions live in the `architecture` folder
- Meeting notes with their diagrams are in `meetings`
- `research` has script-rendered pages that show the fallback thumbnail
- `architecture/service-topology.svg` is an SVG diagram, searchable by its `<title>`, `<desc>` and text labels (search "service topology")
- `meetings/2026-Q3-rollout-plan.pdf` is a two-page PDF: the first page becomes the thumbnail and its text is searchable (search "idempotency", which only appears inside the PDF)
- `misc/index.html` is hidden by default (see the "Include index.html" setting)
