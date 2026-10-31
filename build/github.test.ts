// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { GitHub } from './github'
import { preparePublication } from './publish'

afterEach(() => vi.unstubAllGlobals())

it('downloads an Actions artifact through the real publication client using GitHub API negotiation', async () => {
  const client = new GitHub('owner/repo', 'fixture-token')
  const sha = 'a'.repeat(40)
  const archive = new TextEncoder().encode('retained artifact archive')
  const digest = createHash('sha256').update(archive).digest('hex')
  const inspectArchive = vi.fn(async (bytes: Uint8Array) => {
    expect(bytes).toEqual(archive)
    throw new Error('Pre-publication archive validated')
  })
  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/actions/runs/123'))
        return Response.json({
          workflow_id: 1,
          head_branch: 'main',
          event: 'push',
        })
      if (url.endsWith('/actions/workflows/verify.yml'))
        return Response.json({ id: 1 })
      if (url.includes('/attempts/1/jobs'))
        return Response.json({
          jobs: [
            { name: 'verify', conclusion: 'success' },
            { name: 'staging', conclusion: 'success' },
          ],
        })
      if (url.includes('/deployments?environment=staging'))
        return Response.json([
          {
            id: 2,
            sha,
            payload: {
              kind: 'turbobard-staging',
              buildId: '123.1',
              sourceSha: sha,
              artifactId: '456',
              artifactDigest: digest,
              stagingAttempt: '1',
            },
          },
        ])
      if (url.includes('/deployments/2/statuses'))
        return Response.json([{ state: 'success' }])
      if (url.endsWith('/actions/artifacts/456'))
        return Response.json({
          id: 456,
          name: 'build-123.1',
          expired: false,
          digest: `sha256:${digest}`,
          workflow_run: { id: 123 },
        })
      if (url.endsWith('/actions/artifacts/456/zip')) {
        expect(new Headers(init?.headers).get('Accept')).toBe(
          'application/vnd.github+json',
        )
        return new Response(archive)
      }
      throw new Error(`Unexpected HTTP request: ${url}`)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  await expect(
    preparePublication(
      client,
      { buildId: '123.1', intent: '789', version: '', notes: '' },
      {
        assertOnMain: () => {},
        inspectArchive,
      },
    ),
  ).rejects.toThrow('Pre-publication archive validated')
  expect(inspectArchive).toHaveBeenCalledOnce()
})

it('keeps octet-stream negotiation for release asset bytes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Accept')).toBe(
        'application/octet-stream',
      )
      return new Response(new Uint8Array([1, 2, 3]))
    }),
  )
  await expect(
    new GitHub('owner/repo', 'fixture-token').bytes('releases/assets/456'),
  ).resolves.toEqual(new Uint8Array([1, 2, 3]))
})
