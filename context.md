# App Blueprint: Dice Alley

## 1. Project Breakdown

**App Name:** Dice Alley  
**Platform:** Web  
**Summary:** Dice Alley is a next-generation party gaming platform that connects people to play games together in real-time. Unlike traditional gaming sites, Dice Alley focuses on the social aspect of gaming by allowing users to create or join "parties" where they collectively decide which game to play through a democratic voting system. The platform will feature a curated selection of multiplayer games designed specifically for this social experience.

**Primary Use Case:**  
- Users create or join virtual gaming parties  
- Party members vote on which game to play from available options  
- The platform automatically launches the most voted game for all party members  
- Provides a seamless social gaming experience with strangers or friends  

**Authentication Requirements:**  
- Email/password authentication (via Supabase Auth)  
- Optional OAuth providers (Google, Discord)  
- Guest access with limited functionality  
- User profiles with gaming preferences  

## 2. Tech Stack Overview

**Frontend Framework:**  
- React + Next.js (App Router)  
- TypeScript for type safety  

**UI Library:**  
- Tailwind CSS for utility-first styling  
- ShadCN for accessible, customizable UI components  

**Backend Services:**  
- Supabase for:  
  - PostgreSQL database (parties, games, votes)  
  - Real-time subscriptions (vote updates, party chat)  
  - Authentication  
  - Storage for game assets  

**Deployment:**  
- Vercel for frontend hosting  
- Supabase for backend services  

## 3. Core Features

**1. Party System**  
- Create public/private gaming parties  
- Join existing parties via invite links or discovery  
- Set party size limits and visibility  

**2. Game Voting**  
- Dynamic game selection based on player count  
- Real-time voting interface with live updates  
- Timer-based voting rounds  

**3. Game Launcher**  
- Seamless transition from voting to gameplay  
- Synchronized start for all players  
- Game session management  

**4. Social Features**  
- In-party text chat (Supabase real-time)  
- Player profiles with gaming stats  
- Friend system and party history  

**5. Game Library**  
- Curated collection of multiplayer games  
- Categorized by genre/player count  
- Developer portal for future expansions  

## 4. User Flow

1. **Landing Page**  
   - New users see featured parties and game highlights  
   - Auth buttons prominently displayed  

2. **Authentication**  
   - Sign up/in via email or OAuth  
   - Guest option with limited features  

3. **Party Creation/Join**  
   - Create: Set name, privacy, max players  
   - Join: Browse public parties or use invite code  

4. **Lobby**  
   - See party members and their readiness  
   - Chat interface  
   - "Start Voting" button (host only)  

5. **Voting Phase**  
   - Game carousel with descriptions  
   - Real-time vote counters  
   - Timer display  

6. **Game Launch**  
   - Automatic redirect to winning game  
   - All players join simultaneously  

7. **Post-Game**  
   - Return to lobby  
   - Option to vote again or leave party  

## 5. Design & UI/UX Guidelines

**Visual Style:**  
- Vibrant, playful color scheme (purple/orange accents)  
- Rounded corners and soft shadows  
- Game-card design with cover images  

**Key Components (ShadCN):**  
- Custom Card components for games  
- Animated Progress bars for votes  
- Responsive grid layouts  
- Toast notifications for party events  

**UX Principles:**  
- Minimal clicks to start playing  
- Clear visual hierarchy in voting interface  
- Obvious feedback on user actions  
- Mobile-responsive design  

**Accessibility:**  
- WCAG 2.1 AA compliant  
- Keyboard navigable interface  
- Sufficient color contrast  

## 6. Technical Implementation

**Frontend Structure (Next.js):**  
- `/app` directory structure:  
  - `/(marketing)` - Landing page  
  - `/dashboard` - User home  
  - `/party/[id]` - Party lobby  
  - `/games/[slug]` - Game iframes  

**Supabase Integration:**  
1. Parties Table:  
   ```sql
   CREATE TABLE parties (
     id UUID PRIMARY KEY,
     name TEXT,
     host_id UUID REFERENCES users(id),
     max_players INT,
     current_game TEXT,
     is_public BOOLEAN,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. Real-time Voting:  
   - Subscribe to vote changes with Supabase channels  
   - Optimistic UI updates during voting  

3. Authentication:  
   - Next.js middleware for route protection  
   - Server components for secure data fetching  

**Performance Considerations:**  
- Static generation for game library pages  
- Dynamic server rendering for party pages  
- SWR for client-side data fetching  

## 7. Development Setup

**Requirements:**  
- Node.js v18+  
- Supabase account  
- Vercel account  

**Setup Instructions:**  
1. Clone repository  
2. Install dependencies:  
   ```bash
   npm install
   ```
3. Create `.env.local` with Supabase credentials:  
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   ```
4. Run development server:  
   ```bash
   npm run dev
   ```

**Recommended Tools:**  
- Supabase CLI for local development  
- Vercel CLI for deployments  
- Tailwind CSS IntelliSense for VS Code  

**Deployment Process:**  
1. Connect Git repo to Vercel  
2. Set environment variables  
3. Enable automatic deployments on push  

This blueprint provides a comprehensive foundation for building Dice Alley using the specified tech stack while focusing on the unique social gaming experience at its core.