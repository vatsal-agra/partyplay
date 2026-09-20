// Run with: node --test tests/game-favorites.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(storage) {
  const exports = {}
  const source = ts.transpileModule(readFileSync('lib/game-favorites.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, { exports, ...(storage ? { window: { localStorage: storage } } : {}) })
  return exports
}

test('favorites round trip by stable id, deduplicate, toggle without mutating, and persist removal', () => {
  const values = new Map()
  const f = load({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) })
  assert.equal(f.readFavorites().size, 0)
  values.set(f.FAVORITES_STORAGE_KEY, '["uno","uno",null,3,""]')
  const original = f.readFavorites()
  assert.deepEqual([...original], ['uno'])
  const added = f.toggleFavorite(original, 'catan')
  assert.deepEqual([...original], ['uno'])
  f.saveFavorites(added)
  assert.deepEqual([...f.readFavorites()], ['uno', 'catan'])
  f.saveFavorites(f.toggleFavorite(f.toggleFavorite(added, 'uno'), 'catan'))
  assert.equal(f.readFavorites().size, 0)
})

test('missing window, invalid storage and denied storage are safe', () => {
  for (const value of ['{broken', '{}', 'null', '42']) {
    assert.equal(load({ getItem: () => value }).readFavorites().size, 0)
  }
  const unavailable = load({ getItem: () => { throw Error('denied') }, setItem: () => { throw Error('quota') } })
  assert.equal(unavailable.readFavorites().size, 0)
  assert.doesNotThrow(() => unavailable.saveFavorites(new Set(['uno'])))
  assert.equal(load().readFavorites().size, 0)
  assert.doesNotThrow(() => load().saveFavorites(new Set()))
})

const games = [
  { id: 'short', name: 'Quick Game', description: 'Cards', minPlayers: 2, maxPlayers: 4, complexity: 'Easy', duration: '15-30 min' },
  { id: 'medium', name: 'Middle Game', description: 'Trading', minPlayers: 3, maxPlayers: 6, complexity: 'Medium', duration: '30-60 min' },
  { id: 'long', name: 'Long Game', description: 'Trading', minPlayers: 6, maxPlayers: 8, complexity: 'Hard', duration: '60-120 min' },
]
const empty = { players: '', complexity: '', duration: '' }
const f = load()
const ids = (query = '', filters = empty, favorites = new Set(['short', 'medium', 'long']), only = true) =>
  Array.from(f.filterGames(games, query, filters, favorites, only), game => game.id)

test('favorites compose with search, players, complexity and duration', () => {
  assert.deepEqual(ids('TRADING', { players: '4', complexity: 'Medium', duration: '30-60' }), ['medium'])
  for (const filters of [{ players: '2' }, { complexity: 'Easy' }, { duration: '<30' }]) {
    assert.deepEqual(ids('Trading', { ...empty, ...filters }), [])
  }
  assert.deepEqual(ids('Quick', empty, new Set(['medium'])), [])
  assert.deepEqual(ids('', empty, new Set()), [])
  assert.deepEqual(ids('', empty, new Set(), false), ['short', 'medium', 'long'])
  assert.deepEqual(ids('', empty, new Set(['removed-game'])), [])
})

test('duration choices use minimum play time and 5+ includes games requiring six players', () => {
  assert.deepEqual(ids('', { ...empty, duration: '<30' }), ['short'])
  assert.deepEqual(ids('', { ...empty, duration: '30-60' }), ['medium'])
  assert.deepEqual(ids('', { ...empty, duration: '60+' }), ['long'])
  assert.deepEqual(ids('', { ...empty, players: '5+' }), ['medium', 'long'])
})

test('GameCard favorite button is accessible and isolated from Play and Vote in both modes', () => {
  const exports = {}
  const source = ts.transpileModule(readFileSync('components/games/GameCard.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'framer-motion' ? { motion: { div: 'div', span: 'span' }, AnimatePresence: 'section' }
      : name === 'next/image' ? { default: 'img' } : require(name),
  })
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(buttons)
    return [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)]
  }
  for (const votingEnabled of [false, true]) {
    for (const isFavorite of [false, true]) {
      let toggles = 0, plays = 0, votes = 0, stopped = 0
      const tree = exports.GameCard({
        game: games[0], votingEnabled, isFavorite,
        onToggleFavorite: () => toggles++, onPlay: () => plays++, onVote: () => votes++,
      })
      const button = buttons(tree).find(button => button.props['aria-label'])
      assert.equal(button.props.type, 'button')
      assert.equal(button.props['aria-pressed'], isFavorite)
      assert.equal(button.props['aria-label'], `${isFavorite ? 'Remove' : 'Add'} Quick Game ${isFavorite ? 'from' : 'to'} favorites`)
      button.props.onClick({ stopPropagation: () => stopped++ })
      assert.deepEqual([toggles, plays, votes, stopped], [1, 0, 0, 1])
    }
  }
})
