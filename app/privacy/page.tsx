import type { Metadata } from "next"
import { LegalPage } from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Privacy | Dice Alley",
  description: "How Dice Alley uses account, party, game and payment information.",
}

export default function PrivacyPage() {
  return <LegalPage title="Privacy" intro="Game night should feel welcoming. Here is what information Dice Alley uses and why." sections={[
    { title: "Who runs the table", text: "Dice Alley is operated by Vatsal Agrawal. For privacy questions or requests about your information, contact us via the site's Feedback button. Include a way to reply if you want a response, but never send passwords or payment credentials." },
    { title: "Accounts and guest play", text: "If you sign in, we use your account identifier, email and profile information to authenticate you and connect your activity to your account. Supabase provides authentication and data storage. Guest hosting is available without a regular sign-up, but guest play still involves session information and party activity." },
    { title: "Parties, stats and leaderboards", text: "We use party membership and game state to keep players together and run games. Game results, stats and leaderboard information support progress and rankings. Your display name, profile appearance and relevant game activity can be visible to other players, including through leaderboards." },
    { title: "Optional cosmetic purchases", text: "Paid cosmetics are not yet available. When checkout is enabled, the shop will use Razorpay to process your payment details. Dice Alley uses order and payment identifiers, amounts and purchase records to verify payment and grant your cosmetics. Payment verification information may also be saved in your browser so verification can be retried." },
    { title: "Cookies and browser storage", text: "Cookies and local storage support sign-in sessions and preferences such as muted sound effects and dismissed game instructions. You can clear them in your browser settings. Doing so may sign you out, reset preferences or remove locally saved payment verification information; it does not delete records stored with your account." },
    { title: "Analytics and feedback", text: "The site includes Microsoft Clarity for usage analytics and session insights, which can involve browser, device and interaction information. Feedback you submit, along with the page path, is sent through Web3Forms. The site also attempts to save it to Supabase as a backup, together with your browser's user-agent information. These services process information to provide their respective features. Avoid including sensitive information in feedback." },
    { title: "Your information and requests", text: "Information is used to run accounts, parties, games, rankings and purchases, and to understand and improve the site. Contact Vatsal Agrawal via the site to ask about access, correction or deletion. We may need to verify account ownership before acting. Some records may need to be retained for payment issues, security or legal obligations. This page will be updated when these practices change." },
  ]} />
}
