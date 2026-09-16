// The live landing page is app/page.tsx. This route group predates it and is
// not what Next serves at "/", so it used to sit here quietly rotting with
// pre-rebrand copy ("BoardGame Nexus", only two playable games). Re-export the
// real page instead of keeping a second, stale copy of the marketing pitch.
export { default } from "../page"
