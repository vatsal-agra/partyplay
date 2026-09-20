// Run with: node --test tests/play-again.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load() {
  const exports = {}
  const source = ts.transpileModule(readFileSync('lib/games-catalog.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, { exports, require: () => ({}) })
  return exports
}

const catalog = load()
const resolve = catalog.resolveCatalogGame

test('resolves by internal id and by display name', () => {
  assert.equal(resolve('uno').id, 'uno')
  assert.equal(resolve('Color Clash').id, 'uno')
  assert.equal(resolve('poker').name, "Texas Hold'em Poker")
  for (const game of catalog.GAMES_CATALOG) {
    assert.equal(resolve(game.id).id, game.id)
    assert.equal(resolve(game.name).id, game.id)
  }
})

test('matching ignores casing and surrounding whitespace', () => {
  for (const value of ['  Color Clash  ', 'color clash', 'COLOR CLASH', '\tcOlOr ClAsH\n', ' UNO ', 'UNO']) {
    assert.equal(resolve(value).id, 'uno', value)
  }
})

test('unknown, delisted and empty values resolve to nothing', () => {
  // 'manhunt' is deliberately absent from the catalog, so it must not resolve.
  for (const value of ['manhunt', 'Scotland Yard', 'Settlers of Catan', 'unknown-game', 'un', '', '   ', null, undefined, 42, {}]) {
    assert.equal(resolve(value), undefined, String(value))
  }
})

test('resolved games route through the public catalog path', () => {
  assert.equal(catalog.gamePath(resolve('Color Clash').id), '/games/color-clash')
  assert.equal(catalog.gamePath(resolve('poker').id), '/games/poker')
})
