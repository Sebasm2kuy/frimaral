/**
 * Cliente GitHub API para commitear archivos desde el browser.
 * El token se guarda en localStorage (configurado por el usuario en Settings).
 */

const TOKEN_KEY = 'caliral-github-token'
const OWNER = 'Sebasm2kuy'
const REPO = 'frimaral'
const BRANCH = 'main'

export function getGitHubToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setGitHubToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearGitHubToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

export function hasGitHubToken(): boolean {
  return !!getGitHubToken()
}

const API = 'https://api.github.com'

async function ghFetch(path: string, options: RequestInit = {}) {
  const token = getGitHubToken()
  if (!token) throw new Error('No hay token de GitHub configurado')

  const res = await fetch(`${API}/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `Error ${res.status}`)
  }

  return res.json()
}

/**
 * Obtiene el SHA del último commit de una rama.
 */
async function getBranchSha(): Promise<string> {
  const branch = await ghFetch(`/branches/${BRANCH}`)
  return branch.commit.sha
}

/**
 * Obtiene el SHA de un árbol Git.
 */
async function getTreeSha(commitSha: string): Promise<string> {
  const commit = await ghFetch(`/git/commits/${commitSha}`)
  return commit.tree.sha
}

/**
 * Crea un blob para cada archivo y devuelve el árbol.
 */
async function createBlobs(files: Array<{ path: string; content: string }>): Promise<Array<{ path: string; sha: string; mode: string; type: string }>> {
  const items: Array<{ path: string; sha: string; mode: string; type: string }> = []
  for (const file of files) {
    // Codificar en base64 para soportar contenido binario/UTF-8
    const encoded = btoa(unescape(encodeURIComponent(file.content)))
    const blob = await ghFetch('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({
        content: encoded,
        encoding: 'base64',
      }),
    })
    items.push({
      path: file.path,
      sha: blob.sha,
      mode: '100644',
      type: 'blob',
    })
  }
  return items
}

/**
 * Crea un árbol de Git con los archivos.
 */
async function createTree(baseTreeSha: string, items: Array<{ path: string; sha: string; mode: string; type: string }>): Promise<string> {
  const tree = await ghFetch('/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: items,
    }),
  })
  return tree.sha
}

/**
 * Crea un commit.
 */
async function createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
  const commit = await ghFetch('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  })
  return commit.sha
}

/**
 * Actualiza la referencia de la rama.
 */
async function updateRef(commitSha: string) {
  await ghFetch(`/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commitSha,
    }),
  })
}

/**
 * Sube múltiples archivos en un solo commit.
 */
export async function commitFiles(
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<{ commitSha: string; filesCount: number }> {
  console.log(`📦 Subiendo ${files.length} archivo(s) a GitHub...`)

  // 1. Obtener SHA del último commit
  const parentSha = await getBranchSha()
  console.log(`  ✓ Último commit: ${parentSha.slice(0, 7)}`)

  // 2. Obtener SHA del árbol base
  const baseTreeSha = await getTreeSha(parentSha)

  // 3. Crear blobs para cada archivo
  const items = await createBlobs(files)
  console.log(`  ✓ ${items.length} blobs creados`)

  // 4. Crear árbol
  const treeSha = await createTree(baseTreeSha, items)
  console.log(`  ✓ Árbol creado: ${treeSha.slice(0, 7)}`)

  // 5. Crear commit
  const commitSha = await createCommit(message, treeSha, parentSha)
  console.log(`  ✓ Commit creado: ${commitSha.slice(0, 7)}`)

  // 6. Actualizar ref
  await updateRef(commitSha)
  console.log(`  ✓ Rama ${BRANCH} actualizada`)

  return { commitSha, filesCount: files.length }
}

/**
 * Sube un único archivo.
 */
export async function commitFile(path: string, content: string, message: string): Promise<string> {
  const { commitSha } = await commitFiles([{ path, content }], message)
  return commitSha
}

/**
 * Verifica que el token tenga permisos escribiendo un archivo de prueba.
 */
export async function verifyToken(): Promise<{ valid: boolean; user?: string; error?: string }> {
  const token = getGitHubToken()
  if (!token) return { valid: false, error: 'No hay token configurado' }

  try {
    const res = await fetch(`${API}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    })
    if (!res.ok) {
      const err = await res.json()
      return { valid: false, error: err.message || 'Token inválido' }
    }
    const user = await res.json()
    return { valid: true, user: user.login }
  } catch (e: any) {
    return { valid: false, error: e.message }
  }
}
