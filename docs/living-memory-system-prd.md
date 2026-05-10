# Living Memory System PRD

## Summary

Build a local-first memory layer that turns messy user captures into useful, searchable, reorganizable knowledge. The system should accept notes, voice notes, screenshots, links, and documents; extract what matters; connect new inputs with existing memories; and expose the result through skills, CLI workflows, and a lightweight visual reader.

This is not a full note-taking platform. The product is the memory substrate: storage, enrichment, organization, retrieval, and skill-facing workflows that tools like Claude, Codex, OpenCode, or future agents can use to create value without consuming unnecessary user context.

## Problem

People already capture useful information everywhere: screenshots, voice notes, links, chat fragments, documents, ideas, and quick notes. The failure is not capture. The failure is that captured information becomes a cemetery.

Most systems make the user responsible for deciding where something belongs, which tags to apply, when to revisit it, and how it connects to older ideas. That works for disciplined power users, but it fails for normal users and even for technical users under real cognitive load.

The system should remove the organization burden while keeping the user in control of meaningful structural changes.

## Product Thesis

A personal memory system should behave less like a folder tree and more like a living knowledge organism: it receives raw inputs, metabolizes them into structured memories, detects emerging themes, reorganizes categories as the user evolves, and resurfaces relevant context when it becomes useful.

The goal is to help common users behave like power users without forcing them to understand databases, embeddings, MCP servers, prompt engineering, or manual taxonomy design.

## Target Users

Primary users:

- Power users who capture many ideas but do not want to maintain a fragile knowledge system manually.
- Non-technical users who want AI-assisted organization without learning technical workflows.
- Builders, creators, consultants, students, researchers, and operators who need their personal knowledge to compound.

Secondary users:

- Developers using tools like Claude, Codex, OpenCode, or local agents who want persistent personal/project memory without stuffing everything into prompt context.

## Goals

- Accept low-friction captures from text, screenshots, voice notes, URLs, and documents.
- Convert each capture into a structured memory object.
- Enrich memories when they contain URLs or external references.
- Detect relationships between new and existing memories.
- Create, refine, split, and merge categories as patterns emerge.
- Provide retrieval through CLI and skills, not only through an app UI.
- Offer a visual reader for browsing memories, categories, clusters, and relationships.
- Keep token usage low by retrieving targeted context instead of loading the whole memory system into an MCP context window.

## Non-Goals

- Do not build a full Notion replacement.
- Do not require users to manually maintain a taxonomy.
- Do not make MCP the primary access path if a CLI can retrieve smaller, more intentional context.
- Do not assume every URL can be enriched successfully.
- Do not let AI silently make irreversible structural changes.
- Do not optimize for collecting more notes; optimize for useful resurfacing and synthesis.

## Core Concept

Every input becomes a memory object.

A memory object should preserve the original capture, but also include AI-generated structure that makes it useful for future retrieval and synthesis.

```txt
Memory
- id
- original_input
- extracted_text
- summary
- memory_type
- source_type
- source_url
- url_enrichment_status
- topics
- entities
- categories
- relationships
- confidence
- created_at
- updated_at
- provenance
- processing_history
```

The system should distinguish between raw capture, processed memory, synthesized insight, and user-approved knowledge.

## Inputs

| Input | Expected Processing |
| --- | --- |
| Text note | Extract intent, summary, topics, possible actions, related memories. |
| Voice note | Transcribe, summarize, identify topics, preserve audio reference. |
| Screenshot | OCR visible text, describe visual context, extract URLs/entities if present. |
| URL | Fetch accessible metadata/content, summarize, preserve source, handle failures. |
| Document | Extract sections, concepts, decisions, entities, and references. |
| Chat fragment | Identify people, commitments, questions, decisions, and context. |
| Image without text | Generate visual description and infer possible meaning with low confidence. |

## URL Enrichment Requirement

When an input contains one or more URLs, the system should attempt to enrich the memory before final classification.

Expected behavior:

1. Detect URLs in text, OCR, transcription, or documents.
2. Attempt to fetch metadata and accessible content.
3. Extract title, author, date, summary, canonical URL, and relevant snippets when available.
4. Store enrichment status explicitly.
5. If the URL is inaccessible, preserve the URL and explain why enrichment failed.
6. Continue processing the memory even when enrichment fails.

Possible enrichment statuses:

```txt
not_applicable
pending
success
partial
blocked_auth
blocked_platform
not_found
network_error
unsupported_content
```

Important: inaccessible URLs are still valuable. A blocked X post, private Notion page, paywalled article, or authenticated app link should not break ingestion. The memory should record the URL, available metadata, user-provided context, and the failure reason.

## Organization Model

The system should avoid forcing a rigid folder hierarchy too early. It should evolve structure progressively.

```txt
Raw captures
→ processed memories
→ soft clusters
→ emerging topics
→ stable categories
→ synthesized knowledge
```

### Categories

Categories should be system-suggested and user-steerable.

The system may automatically assign provisional categories. It should ask for confirmation before important structural changes such as merging major categories, renaming long-lived categories, or changing a memory's canonical category with low confidence.

### Emerging Categories

When multiple memories form a repeated pattern, the system should propose a new category.

Example:

```txt
I found 11 memories related to AI-assisted personal knowledge workflows.
This looks stronger than a loose tag. Suggested category: Living Memory Systems.
```

## Retrieval Model

Retrieval should support both normal search and AI-assisted search.

### Text Search

Baseline search should work without AI:

- exact text search;
- title search;
- topic/category search;
- source URL search;
- date filters;
- memory type filters.

This matters because deterministic search is fast, cheap, explainable, and trustworthy.

### AI-Assisted Retrieval

AI retrieval should be available when the user asks fuzzy, semantic, or intent-based questions.

Examples:

- “What have I been thinking about personal memory lately?”
- “Find the screenshots related to the app idea I mentioned last week.”
- “What notes contradict my current plan?”
- “What should I revisit before working on this project?”

The AI should retrieve targeted memories first, then synthesize. It should not blindly load broad memory context.

## Skill-Oriented Access

The preferred integration surface is skills plus CLI.

Different AI tools should be able to call focused workflows such as:

```txt
memory ingest <file-or-text>
memory search "query"
memory related <memory-id>
memory brief --since 7d
memory categories suggest
memory synthesize --topic "..."
memory explain <memory-id>
```

Skills for Claude, Codex, OpenCode, and similar tools should describe when and how to call these commands. This keeps the heavy memory store outside the active conversation and returns only compact, relevant context.

## Why CLI First

A CLI-first design is preferred because:

- it is composable across tools;
- it avoids large MCP context payloads;
- it can return compact JSON or Markdown slices;
- it works locally and privately;
- it can be wrapped later by skills, UI, automations, or MCP servers;
- it gives power users scriptability without forcing non-technical users to see the complexity.

MCP can still exist as an optional bridge, but it should not be the primary architecture if it causes unnecessary token pressure.

## Visual Reader

The system should include a lightweight visual interface for humans to inspect and understand their memory.

The interface is primarily for reading, browsing, reviewing, and correcting. It is not the core ingestion engine.

Useful views:

- all memories;
- categories;
- emerging topics;
- related memories graph;
- timeline;
- source URLs;
- unprocessed or low-confidence items;
- daily/weekly syntheses;
- search results.

The UI should expose why the system organized something a certain way.

Example:

```txt
This memory is in “Product Ideas” because it mentions onboarding, user friction, and local-first memory.
Related memories: #42, #77, #103.
Confidence: 0.84.
```

## Feedback and Control

The system should automate reversible decisions and request confirmation for structural decisions.

| Decision | Default Behavior |
| --- | --- |
| Add provisional tags | Automatic |
| Link related memories | Automatic |
| Create temporary cluster | Automatic |
| Suggest new category | Automatic suggestion, user can approve |
| Merge categories | Requires confirmation |
| Rename stable category | Requires confirmation |
| Delete memory | Requires explicit user action |
| Rewrite original content | Never |

The original capture should remain immutable. AI-generated interpretations can evolve, but provenance must stay clear.

## Core User Stories

### Ingest a messy thought

As a user, I can send a messy note or voice memo so the system extracts the useful idea without requiring me to organize it.

Acceptance criteria:

- The original input is preserved.
- A summary is generated.
- Topics and entities are extracted.
- Related memories are suggested.
- Confidence is shown.

### Ingest a screenshot with a URL

As a user, I can upload a screenshot containing a URL so the system extracts visible text and tries to enrich the referenced page.

Acceptance criteria:

- OCR is attempted.
- URLs are detected from OCR text.
- URL enrichment is attempted.
- Failure is recorded without blocking ingestion.
- The screenshot remains linked to the memory.

### Discover a new category

As a user, I want the system to notice when many notes form a new theme so I do not need to design categories up front.

Acceptance criteria:

- The system detects repeated topic clusters.
- It proposes a category name and explanation.
- It shows sample memories that justify the proposal.
- The user can approve, rename, dismiss, or postpone.

### Search with normal text

As a user, I can search by words, titles, URLs, or categories without needing AI.

Acceptance criteria:

- Search is fast.
- Results show matched fields.
- Results link to original memory objects.

### Search with AI

As a user, I can ask fuzzy questions and receive relevant memories plus a synthesis.

Acceptance criteria:

- The system retrieves a bounded set of memories.
- The answer cites memory IDs or titles.
- The system separates retrieved evidence from generated interpretation.

## MVP Scope

The first version should prove the memory loop, not the full platform.

MVP capabilities:

1. Ingest text, URL, screenshot, and voice-note transcript.
2. Preserve original input and generated metadata.
3. Extract summary, topics, entities, and memory type.
4. Attempt URL enrichment with explicit status.
5. Store memories locally.
6. Provide CLI search and related-memory lookup.
7. Generate weekly synthesis for a topic or recent period.
8. Provide a simple visual reader for browsing categories and memories.

MVP should not require perfect autonomous organization. It should prove that the system can turn chaotic captures into useful resurfaced context.

## Success Metrics

Avoid vanity metrics like number of notes captured.

Better metrics:

- Percentage of captures successfully processed.
- Percentage of URL enrichments successful or partially successful.
- Number of useful resurfacing events accepted by the user.
- Number of AI-proposed categories accepted or renamed.
- Search success rate.
- Time from capture to useful retrieval.
- User-reported reduction in “where did I put that?” moments.

## Risks

### Over-automation

If the system reorganizes too aggressively, users lose trust.

Mitigation: keep original inputs immutable, explain changes, and require confirmation for structural edits.

### Token bloat

If integrations load too much memory into AI tools, the system becomes expensive and noisy.

Mitigation: CLI-first retrieval, bounded outputs, deterministic search before AI synthesis.

### Bad taxonomy too early

If categories are created too quickly, the system becomes another messy folder tree.

Mitigation: use soft clusters before stable categories.

### URL enrichment fragility

Many URLs will be inaccessible, authenticated, paywalled, deleted, or platform-blocked.

Mitigation: preserve URL, store failure reason, use available context, and never block ingestion.

## Open Questions

- Should the memory store be personal-only first, or support project-scoped memories from day one?
- Should categories be globally shared, per project, or both?
- How much user confirmation is acceptable before it becomes annoying?
- Should AI-generated summaries be regenerated as the category model evolves?
- What is the minimum visual UI needed to build trust?
- Should the system prefer local models for private extraction, or allow cloud models by configuration?

## Guiding Principle

The system should not ask users to become librarians. It should help them become better thinkers.

