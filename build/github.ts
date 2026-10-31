export class GitHub {
  readonly repository: string
  private readonly token: string

  constructor(repository: string, token: string) {
    this.repository = repository
    this.token = token
  }

  async request<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(
      `https://api.github.com/repos/${this.repository}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      },
    )
    if (!response.ok)
      throw new Error(`GitHub ${method} ${path}: ${response.status}`)
    if (response.status === 204) return null as T
    return response.json() as Promise<T>
  }

  async list<T>(path: string): Promise<T[]> {
    const result: T[] = []
    for (let page = 1; ; page++) {
      const batch = (await this.request(
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      )) as T[]
      result.push(...batch)
      if (batch.length < 100) return result
    }
  }

  async bytes(
    path: string,
    accept = 'application/octet-stream',
  ): Promise<Uint8Array> {
    const response = await fetch(
      `https://api.github.com/repos/${this.repository}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(60_000),
      },
    )
    if (!response.ok)
      throw new Error(`GitHub download ${path}: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }

  async upload(releaseId: number, name: string, bytes: Uint8Array) {
    const response = await fetch(
      `https://uploads.github.com/repos/${this.repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
        signal: AbortSignal.timeout(60_000),
      },
    )
    if (!response.ok)
      throw new Error(`Release asset upload ${name}: ${response.status}`)
  }
}

export function githubFromEnvironment() {
  const { GITHUB_REPOSITORY, GH_TOKEN } = process.env
  if (!GITHUB_REPOSITORY || !GH_TOKEN)
    throw new Error('Missing GitHub configuration')
  return new GitHub(GITHUB_REPOSITORY, GH_TOKEN)
}
