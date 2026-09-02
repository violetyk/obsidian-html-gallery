---
tags: [architecture, adr]
---
# ADR-001: Introduce a message queue between API and workers

Status: accepted (2026-08-10)

## Context

Synchronous calls from the API to the workers caused timeouts during peak load. The flow is illustrated in [[data-flow.html]].

## Decision

Insert a queue. Workers consume at their own pace; the API only enqueues.

## Consequences

- Latency for the caller drops from seconds to milliseconds
- We need idempotent workers and a dead-letter queue
