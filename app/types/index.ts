export interface Game {
  id: string
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  image: string
  duration: string // e.g. "60-120 min"
  complexity: 'Easy' | 'Medium' | 'Hard'
  category?: string[]
  created_by?: string
}

export interface UserParty {
  id: string
  name: string
  game: string
  game_id: string
  game_image: string
  max_players: number
  status: string
  created_at: string
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
}

export interface Party {
  id: string;
  name: string;
  max_players: number;
  created_by: string;
  created_by_user?: UserProfile;
  game?: string;
  map?: string;
  queue?: string;
  status?: string;
  created_at?: string;
}

export interface PartyMember {
  id: string;
  party_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: UserProfile;
}

export interface Message {
  id: string;
  party_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: UserProfile;
}

export interface Vote {
  id: string;
  party_id: string;
  user_id: string;
  game_id: string;
  game_name: string;
  user_name: string;
  created_at: string;
}

export interface Filters {
  players: string
  complexity: string
  duration: string
}
