// Per-game rules shown in the in-game "Game Rules" modal.
//
// Keyed by game id (must match the route slug / GAMES_CATALOG id). The slug
// page renders GAME_RULES[gameData.id]; if a game is missing here the modal
// falls back to a generic message rather than wrongly showing another game's
// rules (the old bug — every game showed the Property Empire rules).

export interface RuleSection {
  heading: string
  body: string
}

export interface GameRules {
  title: string
  sections: RuleSection[]
}

export const GAME_RULES: Record<string, GameRules> = {
  monopoly: {
    title: "Property Empire — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Become the wealthiest player by buying, renting, and trading properties. Force every opponent into bankruptcy to win." },
      { heading: "2. Turns & Rolling", body: "Roll the dice to move around the board. Roll doubles and you go again — but three doubles in a row sends you straight to jail." },
      { heading: "3. Buying & Rent", body: "Land on an unowned property and you may buy it from the bank. Land on someone else's property and you pay them rent." },
      { heading: "4. Color Groups & Houses", body: "Own a full color group to double the base rent, then build houses and hotels to raise rent dramatically. Build evenly across the set." },
      { heading: "5. Mortgages & Selling", body: "Need cash? Sell houses back for half price or mortgage properties for their mortgage value. Mortgaged properties collect no rent." },
      { heading: "6. Jail", body: "Escape jail by rolling doubles, paying the $50 fine, or using a Get Out of Jail Free card. After 3 turns you must pay the fine." },
    ],
  },
  catan: {
    title: "Hexland — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Be the first to reach the target victory points by building settlements, cities, and roads across the island." },
      { heading: "2. Resources", body: "Each turn the dice are rolled. Tiles matching the number produce resources (brick, wood, wool, grain, ore) for any settlement touching them." },
      { heading: "3. Building", body: "Spend resources to build: roads connect your network, settlements earn 1 point, and upgrading a settlement to a city earns 2 points and double resources." },
      { heading: "4. Trading", body: "Trade resources with other players or with the bank (at a worse rate) to get the materials you're missing." },
      { heading: "5. The Robber", body: "Roll a 7 and the robber moves — it blocks a tile from producing and lets you steal a resource from a player on that tile." },
    ],
  },
  battleship: {
    title: "Naval Clash — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Sink your opponent's entire fleet before they sink yours." },
      { heading: "2. Setup", body: "Secretly place your ships on your grid, horizontally or vertically. Ships cannot overlap or hang off the edge." },
      { heading: "3. Firing", body: "On your turn, call out a coordinate to fire at the enemy grid. You're told whether it's a hit or a miss." },
      { heading: "4. Hits & Sinks", body: "Hit every cell of a ship to sink it. Track your hits and misses to deduce where the remaining ships are hiding." },
      { heading: "5. Winning", body: "The first admiral to sink all of the opponent's ships wins the battle." },
    ],
  },
  uno: {
    title: "Color Clash — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Be the first to play all the cards from your hand." },
      { heading: "2. Playing a Card", body: "Match the top card of the discard pile by color or by number. If you can't match, draw a card from the deck." },
      { heading: "3. Action Cards", body: "Skip skips the next player, Reverse flips the direction of play, and Draw Two forces the next player to draw two cards and lose their turn." },
      { heading: "4. Wild Cards", body: "A Wild lets you choose the next color. Wild Draw Four does the same and makes the next player draw four cards." },
      { heading: "5. One Card Left", body: "When you're down to a single card, call it out — get caught silent and you draw a penalty." },
    ],
  },
  poker: {
    title: "Poker — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Win chips by making the best five-card hand, or by betting boldly enough that everyone else folds." },
      { heading: "2. The Deal", body: "Each player is dealt two private hole cards. Five community cards are revealed in stages — the flop (3), the turn (1), and the river (1)." },
      { heading: "3. Betting Rounds", body: "After each stage players take turns to check, bet, call, raise, or fold. The wager builds the pot in the middle." },
      { heading: "4. Hand Rankings", body: "From high to low: Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, Pair, High Card." },
      { heading: "5. Showdown", body: "If two or more players remain after the final bet, hands are revealed and the best five-card hand takes the pot." },
    ],
  },
  cluedo: {
    title: "Mystery Manor — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Be the first to correctly name the culprit, the weapon, and the room where the crime took place." },
      { heading: "2. Moving", body: "Roll the dice and move through the manor's corridors to enter rooms where you can investigate." },
      { heading: "3. Making a Suggestion", body: "Inside a room, suggest a suspect and a weapon. The named suspect and weapon are summoned to that room for examination." },
      { heading: "4. Disproving", body: "Other players, in turn, must privately show you one matching card from their hand if they can — quietly ruling out possibilities." },
      { heading: "5. The Accusation", body: "Once you're certain, make an accusation. Check the secret envelope: if you're right you win, if you're wrong you're out of the running." },
    ],
  },
  pictionary: {
    title: "Quick Draw — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "It's real team Pictionary. Players split into a Red team and a Blue team, and each team races its token across the board to the finish square." },
      { heading: "2. Your Turn", body: "On your team's turn one team-mate is the artist. The colour of your team's square picks a category on the card — Person, Object, Action or Difficult — and the artist sketches only that word. No letters or numbers." },
      { heading: "3. Guessing & Moving", body: "Only your team may guess your artist's drawing, typed into chat before time runs out. Guess it and your team rolls the die and advances that many squares; miss and you stay put. Then it's the other team's turn." },
      { heading: "4. All Play", body: "Land on a rainbow square and it's All Play: both teams' artists draw the SAME word at the same time on their own easel, and the first team to guess it advances." },
      { heading: "5. Winning", body: "The first team to reach the finish square wins Quick Draw." },
    ],
  },
  scribbleio: {
    title: "Doodle Dash — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Rack up the most points across the rounds by guessing words quickly and by drawing words others can guess." },
      { heading: "2. Choosing a Word", body: "When it's your turn to draw, pick one of three offered words, then sketch it on the shared canvas." },
      { heading: "3. Hints", body: "As the timer runs down, blanks for the word appear and letters are gradually revealed to help the guessers." },
      { heading: "4. Guessing & Scoring", body: "Type guesses in chat — faster correct guesses score more, and the drawer earns points for every player who gets it." },
      { heading: "5. Winning", body: "Everyone takes turns as the drawer. The player with the most points at the end wins." },
    ],
  },
  manhunt: {
    title: "Manhunt — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "One player is Mr X, the fugitive. The detectives win if one of them lands on Mr X's station; Mr X wins by staying free until the rounds run out." },
      { heading: "2. Moving", body: "On your turn, travel to a connected station using a matching ticket — Taxi (yellow), Bus (cyan), or Underground (pink). No ticket, no trip." },
      { heading: "3. Mr X is hidden", body: "Only Mr X sees his own location. Detectives see the transport he used each round (the travel log) — and his exact spot only when he surfaces on the reveal rounds." },
      { heading: "4. Black tickets", body: "Mr X also has black tickets that work on any line and hide which transport he took — perfect for slipping away right after surfacing." },
      { heading: "5. The hunt", body: "Spent detective tickets are handed to Mr X, so detectives can't move forever. Corner Mr X — or trap him with no legal move — to win." },
    ],
  },
  codenames: {
    title: "Spymaster — How to Play",
    sections: [
      { heading: "1. Object of the Game", body: "Two teams race to identify all of their own agents on the grid — without picking the assassin." },
      { heading: "2. Roles", body: "Each team has one Spymaster who knows which words belong to which team, and the rest are field operatives who guess." },
      { heading: "3. Giving Clues", body: "The Spymaster gives a single one-word clue plus a number — the number says how many words on the grid relate to that clue." },
      { heading: "4. Guessing", body: "Operatives tap words they think are their team's. A correct guess lets them keep going; a wrong one ends their turn." },
      { heading: "5. The Assassin", body: "Pick a neutral word and your turn ends. Pick the assassin and your team loses instantly — so guess carefully." },
    ],
  },
}

export function getGameRules(id: string | null | undefined): GameRules | null {
  if (!id) return null
  return GAME_RULES[id] ?? null
}
