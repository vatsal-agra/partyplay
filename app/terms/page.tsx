import type { Metadata } from "next"
import { LegalPage } from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Terms | Dice Alley",
  description: "The ground rules for accounts, multiplayer games and optional cosmetics on Dice Alley.",
}

export default function TermsPage() {
  return <LegalPage title="Terms of play" intro="A few ground rules for sharing the table. By using Dice Alley, you agree to these terms." sections={[
    { title: "Welcome to Dice Alley", text: "Dice Alley is a browser-based multiplayer board game service operated by Vatsal Agrawal. You can host as a guest or sign in for account features. Use the service only where you are allowed to do so, and get a parent or guardian's permission if you need it to use the service or make a purchase." },
    { title: "Your account and your table", text: "Keep your sign-in details private and use an account you are authorized to access. You are responsible for your activity and what you share with other players. Guest sessions may not provide the same continuity as signed-in accounts. Do not impersonate others, harass players, cheat, exploit bugs or interfere with the service." },
    { title: "Games and availability", text: "Dice Alley is in beta. Games, stats, rankings and features may change, and bugs, interruptions or lost progress can occur. We cannot promise uninterrupted access or error-free play. Access may be restricted to address abuse, security issues or misuse." },
    { title: "Optional cosmetics and payments", text: "Cosmetics are optional digital items for use within Dice Alley. Paid cosmetics are not yet available. When checkout opens, payments will be processed through Razorpay. Review the item and price before paying and use an authorized payment method. Items are granted after payment verification. If verification is delayed, use the retry option before paying again." },
    { title: "Purchase problems", text: "For missing items, duplicate charges or refund questions, contact Vatsal Agrawal via the site's Feedback button with the relevant order identifier and a way to reply. Never include full card details or payment credentials. Requests need to be reviewed against the purchase record; no automatic refund outcome is promised here. These terms do not limit rights you have under applicable law." },
    { title: "Privacy and feedback", text: "Our Privacy page explains account information, party membership, game stats, browser storage and the service providers used by the site. Share only information you are comfortable providing. You can use the Feedback button to report a problem or ask about these terms without signing up." },
    { title: "Changes and contact", text: "The service and these terms may be updated as Dice Alley develops. Review this page when returning to the site. If you do not agree to the terms, stop using the service. For questions, contact the operator, Vatsal Agrawal, via the site." },
  ]} />
}
