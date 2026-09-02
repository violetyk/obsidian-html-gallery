---
tags: [architecture]
---
# System design notes

Working notes from the design session on 2026-08-03.

## Overview

The current shape of the platform is captured in the diagram below.

![[system-overview.html]]

## Data flow

Event flow between services: [[data-flow.html]]. The queue in the middle is the part we are still debating, see [[adr-001-message-queue]].
