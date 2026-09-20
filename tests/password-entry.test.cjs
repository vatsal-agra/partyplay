const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')

const field = readFileSync('components/ui/password-field.tsx', 'utf8')
const signIn = readFileSync('app/auth/sign-in/page.tsx', 'utf8')
const signUp = readFileSync('app/auth/sign-up/page.tsx', 'utf8')

test('each password keeps its controlled value, label and password-manager purpose', () => {
  for (const [page, purpose, expected] of [
    [signIn, 'current-password', [['password', 'password', 'setPassword']]],
    [signUp, 'new-password', [['password', 'password', 'setPassword'], ['confirm-password', 'confirmPassword', 'setConfirmPassword']]],
  ]) {
    const fields = [...page.matchAll(/<PasswordField\s[\s\S]*?\/>/g)].map(match => match[0])
    assert.equal(fields.length, expected.length)
    for (const [id, value, setter] of expected) {
      const input = fields.find(input => input.includes(`id="${id}"`))
      assert.ok(input)
      assert.ok(page.includes(`<Label htmlFor="${id}">`))
      assert.ok(input.includes(`autoComplete="${purpose}"`))
      assert.ok(input.includes(`value={${value}}`))
      assert.ok(input.includes(`onChange={(e) => ${setter}(e.target.value)}`))
      assert.match(input, /\brequired\b/)
    }
  }
  assert.match(field, /type=\{visible \? "text" : "password"\}/)
  for (const prop of ['value', 'onChange', 'autoComplete']) {
    assert.ok(field.includes(`${prop}={${prop}}`))
  }
  assert.doesNotMatch(field, /setPassword|preventDefault|tabIndex=\{-1\}/)
})

test('visibility button has dynamic accessible state and decorative Eye icons', () => {
  const button = field.match(/<button\s[\s\S]*?<\/button>/)[0]
  assert.match(button, /type="button"/)
  assert.ok(button.includes('aria-label={`${visible ? "Hide" : "Show"} ${label}`}'))
  assert.match(button, /aria-pressed=\{visible\}/)
  assert.match(button, /aria-controls=\{id\}/)
  assert.match(button, /onClick=\{\(\) => setVisible\(\(current\) => !current\)\}/)
  for (const icon of ['Eye', 'EyeOff']) {
    assert.match(button, new RegExp(`<${icon} [^>]*aria-hidden="true"`))
  }
})

test('Caps Lock follows key down/up state, clears on blur and is announced', () => {
  assert.match(field, /setCapsLock\(event.getModifierState\("CapsLock"\)\)/)
  assert.match(field, /onKeyDown=\{updateCapsLock\}/)
  assert.match(field, /onKeyUp=\{updateCapsLock\}/)
  assert.match(field, /onBlur=\{\(\) => setCapsLock\(false\)\}/)
  assert.match(field, /aria-describedby=\{capsLock \? warningId : undefined\}/)
  assert.match(field, /id=\{warningId\} role="status"/)
  assert.match(field, /capsLock \? "Caps Lock is on" : ""/)
})

test('form and username errors are announced and auth pages contain no em dash', () => {
  for (const page of [signIn, signUp]) {
    assert.match(page, /<p role="alert"[^>]*>\{error\}<\/p>/)
    assert.doesNotMatch(page, /\u2014/)
  }
  assert.match(signUp, /role=\{usernameAvailable === false \? "alert" : undefined\}/)
})
