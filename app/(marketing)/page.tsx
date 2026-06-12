import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Gamepad2, Users, MessageSquare, Award, Clock, Star } from "lucide-react"

export default function MarketingPage() {
  const features = [
    {
      icon: <Gamepad2 className="h-8 w-8 text-primary" />,
      title: "Play Your Favorite Games",
      description: "Access a growing library of popular board games to play with friends or join public games."
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Connect with Friends",
      description: "Invite friends to your game room or meet new players from around the world."
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      title: "Real-time Chat",
      description: "Communicate with other players using our built-in chat system during games."
    },
    {
      icon: <Award className="h-8 w-8 text-primary" />,
      title: "Earn Achievements",
      description: "Complete challenges and earn achievements as you play your favorite games."
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Quick Matchmaking",
      description: "Find and join games quickly with our smart matchmaking system."
    },
    {
      icon: <Star className="h-8 w-8 text-primary" />,
      title: "Rate & Review",
      description: "Share your thoughts on games and help others find the best experiences."
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-primary/10 text-primary">
              <span className="mr-2">🎮</span> Play board games online with friends
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground mb-6">
              Play Board Games Together,
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Anytime, Anywhere
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Join thousands of players enjoying their favorite board games online with friends and family.
              No downloads required - just pick a game and start playing!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link href="/auth/sign-up">
                <Button size="lg" className="text-base">
                  Start Playing for Free
                </Button>
              </Link>
              <Link href="/games">
                <Button variant="outline" size="lg" className="text-base">
                  Browse Games
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need for Online Board Gaming</h2>
            <p className="text-muted-foreground">
              BoardGame Nexus brings the fun of tabletop gaming to your screen with an easy-to-use platform
              that works on any device.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-card p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Playing?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Join our community of board game enthusiasts and start playing your favorite games today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="text-base">
                Create Free Account
              </Button>
            </Link>
            <Link href="/games">
              <Button variant="outline" size="lg" className="text-base">
                Browse All Games
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
