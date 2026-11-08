export const directory = 'insync-pagination-demo'
export const backendPath = `${directory}/backend/products.mjs`
export const frontendPath = `${directory}/frontend/ProductList.mjs`
export const testPath = `${directory}/contract.test.mjs`
export const baselineBackend = `// GET /products?offset=0&limit=2\nexport function listProducts(products, { offset = 0, limit = 2 } = {}) {\n  return { items: products.slice(offset, offset + limit), totalPages: Math.ceil(products.length / limit) };\n}\n`
export const cursorBackend = `// GET /products?cursor=0&limit=2\nexport function listProducts(products, { cursor = '0', limit = 2 } = {}) {\n  const start = Number(cursor);\n  const items = products.slice(start, start + limit);\n  return { items, nextCursor: start + limit < products.length ? String(start + limit) : null };\n}\n`
export const productList = `// Leo owns ProductList. It still consumes the offset API contract.\nexport function ProductList(response) {\n  if (!Number.isInteger(response.totalPages)) throw new Error('ProductList requires totalPages');\n  return { products: response.items, pageButtons: Array.from({ length: response.totalPages }, (_, i) => i + 1) };\n}\n`
export const contractTest = `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { listProducts } from './backend/products.mjs';\nimport { ProductList } from './frontend/ProductList.mjs';\ntest('ProductList can render the products response', () => {\n  const response = listProducts([{id: 1}, {id: 2}, {id: 3}]);\n  assert.deepEqual(ProductList(response).pageButtons, [1, 2]);\n});\n`
export const baselineFiles = { [backendPath]: baselineBackend, [frontendPath]: productList, [testPath]: contractTest,
  [`${directory}/README.md`]: '# Staged InSync pagination demo\nRun `node --test insync-pagination-demo/contract.test.mjs`. Baseline passes; PR head intentionally fails. No production code is changed. Weekdays are story labels, not platform dates.\n' }
export const prTitle = 'Replace offset pagination with cursor-based pagination'
export const decisionId = 'DEC-14'
export function stagedMessages(runId: string) {
  const tag = `[InSync staged demo ${runId}]`
  return [
    `${tag} [Simulated Tuesday — Maya, fictional backend developer] Offset pagination is too slow for large lists. I propose cursor-based pagination for GET /products, replacing totalPages with nextCursor. Leo owns ProductList and is away this week.`,
    `${tag} [Simulated Tuesday — Sam, fictional teammate] +1 to cursor-based pagination. ProductList will need a migration because it reads totalPages.`,
    `${tag} [Simulated Tuesday — Maya, fictional backend developer] Decision ${decisionId} confirmed: replace offset pagination with cursor-based pagination for GET /products; remove totalPages and return nextCursor. Coordinate the ProductList migration with Leo.`,
    `${tag} [Simulated Wednesday — Maya, fictional backend developer] Deployment timing remains unverified. The frontend migration and integration check must happen before release.`,
  ]
}
