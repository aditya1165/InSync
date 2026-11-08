import type { DemoImpactResponse, EvidenceRecord } from './task-demo.ts'

export interface ChangeFile {
  path: string
  patch: string
}

export interface ExampleChange {
  id: string
  number: number
  title: string
  status: 'open' | 'draft'
  summary: string
  nextStep: string
  files: ChangeFile[]
  evidence: EvidenceRecord[]
}

const profilePhotoPatch = `@@ -1,4 +1,5 @@
 {
   "id": "123",
   "user_name": "alex",
+  "avatar_url": "https://example.com/avatar.png"
 }`

const profilePhotoNotePatch = `@@ -1,2 +1,3 @@
 # Profile information
 The response includes a name.
+It may also include an optional profile photo URL.`

/** Labeled local sample to exercise a multi-change, multi-file review. */
const photoChange: ExampleChange = {
  id: 'sample:github:pr:21',
  number: 21,
  title: 'Add an optional profile picture link',
  status: 'draft',
  summary: 'This draft adds a profile picture link. The existing profile page can keep working without it.',
  nextStep: 'Ask whether the profile page should show a picture before changing the page.',
  files: [
    { path: 'api/users.json', patch: profilePhotoPatch },
    { path: 'docs/profile.md', patch: profilePhotoNotePatch },
  ],
  evidence: [{
    id: 'sample:github:pr:21',
    title: 'Sample GitHub PR #21 · Add an optional profile picture link',
    source: 'github',
    location: 'Sample repository / pull requests',
    body: `${profilePhotoPatch}\n\n${profilePhotoNotePatch}`,
  }],
}

export function exampleChangesForImpact(impact: DemoImpactResponse): ExampleChange[] {
  if (!impact.pr || impact.impactUncertain || impact.error) return []

  const primary: ExampleChange = {
    id: impact.pr.id,
    number: impact.pr.number,
    title: impact.pr.title,
    status: 'open',
    summary: 'This open proposal replaces the profile name field. The current page may need an update if the change is merged.',
    nextStep: 'Ask the backend team when the old name will be removed before updating the profile page.',
    files: [{ path: 'api/users.json', patch: impact.pr.diff }],
    evidence: impact.evidence ?? [],
  }

  return impact.pr.number === 18 ? [primary, photoChange] : [primary]
}

export type DiffLineKind = 'added' | 'removed' | 'context'

export function diffLineKind(line: string): DiffLineKind {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'added'
  if (line.startsWith('-') && !line.startsWith('---')) return 'removed'
  return 'context'
}
