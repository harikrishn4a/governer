# AIReady Plan
Generated: 2026-06-09T10:58:35.911Z
Target: /Users/harikrishnannandakumar/governer
Overall: 30/100

## SUBSYSTEM SCORES
- identity: 41
- verification: 6
- state: 13
- memory: 27
- constraints: 65

## SUBSYSTEM SOURCES
- identity: CLAUDE.md
- verification: 
- state: CLAUDE.md
- memory: CLAUDE.md
- constraints: CLAUDE.md

## GENERATE
### AGENTS.md
- subsystem: identity
- template: examples/agents.md
- source_files: CLAUDE.md
- required: project description, stack with versions, verification commands, repo structure

### ARCHITECTURE.md
- subsystem: memory
- template: examples/architecture.md
- source_files: CLAUDE.md
- required: module map, module responsibilities, data flow

### DECISIONS.md
- subsystem: n/a
- template: examples/decisions.md
- source_files: AGENTS.md, package.json
- required: key decisions, rationale, alternatives considered

### structure.md
- subsystem: memory
- template: examples/structure.md
- source_files: CLAUDE.md
- required: directory structure, file layout, naming conventions

### CONSTRAINTS.md
- subsystem: constraints
- template: examples/constraints.md
- source_files: CLAUDE.md
- required: MUST/MUST NOT language, forbidden actions, domain-specific rules

### PROGRESS.md
- subsystem: state
- template: examples/progress.md
- source_files: CLAUDE.md
- required: current build status, completed/in-progress/blocked tasks, next best step

### SESSION-HANDOFF.md
- subsystem: state
- template: examples/session-handoff.md
- source_files: CLAUDE.md
- required: date, what was completed, what is broken, next best step

### TASK.md
- subsystem: n/a
- template: examples/task.md
- source_files: (template copy — no source context needed)
- required: current task, scope, acceptance criteria

### features.md
- subsystem: n/a
- template: examples/features.md
- source_files: (template copy — no source context needed)
- required: feature list with status

### feature_list.json
- subsystem: n/a
- template: examples/feature-list.json
- source_files: (template copy — no source context needed)
- required: JSON feature list with id, title, status fields

### feature-list-schema.json
- subsystem: n/a
- template: examples/feature-list-schema.json
- source_files: (template copy — no source context needed)
- required: JSON schema definition for feature_list.json

### QUALITY.md
- subsystem: n/a
- template: examples/quality.md
- source_files: (template copy — no source context needed)
- required: quality gates, test coverage requirements, definition of done

### quality-document.md
- subsystem: n/a
- template: examples/quality-document.md
- source_files: (template copy — no source context needed)
- required: quality metrics, testing standards, acceptance criteria

### evaluator_rubric.md
- subsystem: n/a
- template: examples/evaluator_rubric.md
- source_files: (template copy — no source context needed)
- required: evaluation rubric for assessing artifact quality

### clean-state-checklist.md
- subsystem: n/a
- template: examples/clean-state-checklist.md
- source_files: (template copy — no source context needed)
- required: checklist for clean session start and handoff

### startup.md
- subsystem: verification
- template: examples/startup.md
- source_files: (template copy — no source context needed)
- required: startup guide for new sessions, orientation steps

### Makefile
- subsystem: verification
- template: examples/Makefile
- source_files: (template copy — no source context needed)
- required: runnable build/test/lint commands, single canonical verification path

### scripts/init.sh
- subsystem: n/a
- template: examples/scripts/init.sh
- source_files: (template copy — no source context needed)
- required: dependency setup, environment initialization

### scripts/verify.sh
- subsystem: n/a
- template: examples/scripts/verify.sh
- source_files: (template copy — no source context needed)
- required: full verification sequence: build, typecheck, lint, test


## IMPROVE
(none)

## SKIP
(none)

## SOURCE CONTEXT
### CLAUDE.md
- subsystems: identity, state, memory, constraints
- reason: Useful context was found outside a canonical harness artifact.
