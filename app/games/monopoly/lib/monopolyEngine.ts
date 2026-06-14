// Property Empire Game Engine
// Pure state management and gameplay rules

export type SpaceType = 'START' | 'PROPERTY' | 'RAILROAD' | 'UTILITY' | 'TAX' | 'CHANCE' | 'COMMUNITY_CHEST' | 'JAIL' | 'FREE_PARKING' | 'GO_TO_JAIL';
export type ColorGroup = 'BROWN' | 'LIGHT_BLUE' | 'PINK' | 'ORANGE' | 'RED' | 'YELLOW' | 'GREEN' | 'DARK_BLUE' | 'RAILROAD' | 'UTILITY' | 'SPECIAL';

export interface Space {
  index: number;
  name: string;
  type: SpaceType;
  group: ColorGroup;
  cost?: number;
  mortgageValue?: number;
  houseCost?: number;
  rents?: number[]; // [Base, 1 House, 2 Houses, 3 Houses, 4 Houses, Hotel]
  description?: string;
}

export interface Player {
  id: string;
  name: string;
  token: string;
  color: string;
  position: number;
  cash: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number; // Combined total
  isBankrupt: boolean;
  isBot: boolean;
}

export interface PropertyState {
  ownerId: string | null;
  houses: number; // 5 means a hotel
  isMortgaged: boolean;
}

export interface TradeOffer {
  cash: number;
  properties: number[]; // Space indices
}

export interface TradeSession {
  senderId: string;
  receiverId: string;
  senderOffer: TradeOffer;
  receiverOffer: TradeOffer;
  active: boolean;
}

export interface AuctionState {
  spaceIndex: number;
  highestBid: number;
  highestBidderId: string | null;
  activeBidderIds: string[];
  currentBidderIndex: number;
}

export interface MonopolyState {
  players: Player[];
  currentPlayerIndex: number;
  properties: { [key: number]: PropertyState }; // spaceIndex -> state
  log: string[];
  chanceDeck: number[];
  communityChestDeck: number[];
  chanceIndex: number;
  communityChestIndex: number;
  phase: 'ROLL' | 'BUY_OR_PASS' | 'RENT' | 'JAIL' | 'BANKRUPTCY' | 'GAME_OVER' | 'AUCTION';
  lastDice: [number, number];
  doubleCount: number;
  selectedSpaceIndex: number | null; // For info modal
  debtToPlayerId: string | null; // null means Bank
  debtAmount: number;
  winnerId: string | null;
  tradeSession: TradeSession | null;
  auctionState: AuctionState | null;
  lastCardDrawn: { type: 'CHANCE' | 'COMMUNITY_CHEST'; text: string } | null;
  lastRentPaid: { amount: number; from: string; to: string; propertyName: string } | null;
}

// Property Empire Board Configuration
export const BOARD_SPACES: Space[] = [
  { index: 0, name: 'GO', type: 'START', group: 'SPECIAL', description: 'Collect $200 salary as you pass.' },
  { index: 1, name: 'Cairo', type: 'PROPERTY', group: 'BROWN', cost: 60, mortgageValue: 30, houseCost: 50, rents: [2, 10, 30, 90, 160, 250] },
  { index: 2, name: 'Treasury', type: 'COMMUNITY_CHEST', group: 'SPECIAL' },
  { index: 3, name: 'Mumbai', type: 'PROPERTY', group: 'BROWN', cost: 60, mortgageValue: 30, houseCost: 50, rents: [4, 20, 60, 180, 320, 450] },
  { index: 4, name: 'Income Tax', type: 'TAX', group: 'SPECIAL', cost: 200, description: 'Pay $200' },
  { index: 5, name: 'North Station', type: 'RAILROAD', group: 'RAILROAD', cost: 200, mortgageValue: 100, rents: [25, 50, 100, 200] },
  { index: 6, name: 'Bangkok', type: 'PROPERTY', group: 'LIGHT_BLUE', cost: 100, mortgageValue: 50, houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { index: 7, name: 'Fortune', type: 'CHANCE', group: 'SPECIAL' },
  { index: 8, name: 'Hanoi', type: 'PROPERTY', group: 'LIGHT_BLUE', cost: 100, mortgageValue: 50, houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { index: 9, name: 'Manila', type: 'PROPERTY', group: 'LIGHT_BLUE', cost: 120, mortgageValue: 60, houseCost: 50, rents: [8, 40, 100, 300, 450, 600] },
  { index: 10, name: 'Jail / Just Visiting', type: 'JAIL', group: 'SPECIAL', description: 'Just visiting or locked up' },
  { index: 11, name: 'Athens', type: 'PROPERTY', group: 'PINK', cost: 140, mortgageValue: 70, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { index: 12, name: 'Power Grid', type: 'UTILITY', group: 'UTILITY', cost: 150, mortgageValue: 75, description: 'Utility: Rent is 4x dice if 1 owned, 10x if both owned.' },
  { index: 13, name: 'Lisbon', type: 'PROPERTY', group: 'PINK', cost: 140, mortgageValue: 70, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { index: 14, name: 'Prague', type: 'PROPERTY', group: 'PINK', cost: 160, mortgageValue: 80, houseCost: 100, rents: [12, 60, 180, 500, 700, 900] },
  { index: 15, name: 'East Station', type: 'RAILROAD', group: 'RAILROAD', cost: 200, mortgageValue: 100, rents: [25, 50, 100, 200] },
  { index: 16, name: 'Dublin', type: 'PROPERTY', group: 'ORANGE', cost: 180, mortgageValue: 90, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { index: 17, name: 'Treasury', type: 'COMMUNITY_CHEST', group: 'SPECIAL' },
  { index: 18, name: 'Vienna', type: 'PROPERTY', group: 'ORANGE', cost: 180, mortgageValue: 90, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { index: 19, name: 'Madrid', type: 'PROPERTY', group: 'ORANGE', cost: 200, mortgageValue: 100, houseCost: 100, rents: [16, 80, 220, 600, 800, 1000] },
  { index: 20, name: 'Free Parking', type: 'FREE_PARKING', group: 'SPECIAL', description: 'Take a rest. No tax or rent.' },
  { index: 21, name: 'Berlin', type: 'PROPERTY', group: 'RED', cost: 220, mortgageValue: 110, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { index: 22, name: 'Fortune', type: 'CHANCE', group: 'SPECIAL' },
  { index: 23, name: 'Toronto', type: 'PROPERTY', group: 'RED', cost: 220, mortgageValue: 110, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { index: 24, name: 'Rome', type: 'PROPERTY', group: 'RED', cost: 240, mortgageValue: 120, houseCost: 150, rents: [20, 100, 300, 750, 925, 1100] },
  { index: 25, name: 'South Station', type: 'RAILROAD', group: 'RAILROAD', cost: 200, mortgageValue: 100, rents: [25, 50, 100, 200] },
  { index: 26, name: 'Amsterdam', type: 'PROPERTY', group: 'YELLOW', cost: 260, mortgageValue: 130, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { index: 27, name: 'Barcelona', type: 'PROPERTY', group: 'YELLOW', cost: 260, mortgageValue: 130, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { index: 28, name: 'Water Supply', type: 'UTILITY', group: 'UTILITY', cost: 150, mortgageValue: 75, description: 'Utility: Rent is 4x dice if 1 owned, 10x if both owned.' },
  { index: 29, name: 'Seoul', type: 'PROPERTY', group: 'YELLOW', cost: 280, mortgageValue: 140, houseCost: 150, rents: [24, 120, 360, 850, 1025, 1200] },
  { index: 30, name: 'Go to Jail', type: 'GO_TO_JAIL', group: 'SPECIAL', description: 'Go directly to jail. Do not pass GO. Do not collect $200.' },
  { index: 31, name: 'Sydney', type: 'PROPERTY', group: 'GREEN', cost: 300, mortgageValue: 150, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { index: 32, name: 'Dubai', type: 'PROPERTY', group: 'GREEN', cost: 300, mortgageValue: 150, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { index: 33, name: 'Treasury', type: 'COMMUNITY_CHEST', group: 'SPECIAL' },
  { index: 34, name: 'Hong Kong', type: 'PROPERTY', group: 'GREEN', cost: 320, mortgageValue: 160, houseCost: 200, rents: [28, 150, 450, 1000, 1200, 1400] },
  { index: 35, name: 'West Station', type: 'RAILROAD', group: 'RAILROAD', cost: 200, mortgageValue: 100, rents: [25, 50, 100, 200] },
  { index: 36, name: 'Fortune', type: 'CHANCE', group: 'SPECIAL' },
  { index: 37, name: 'Paris', type: 'PROPERTY', group: 'DARK_BLUE', cost: 350, mortgageValue: 175, houseCost: 200, rents: [35, 175, 500, 1100, 1300, 1500] },
  { index: 38, name: 'Luxury Tax', type: 'TAX', group: 'SPECIAL', cost: 100, description: 'Pay $100' },
  { index: 39, name: 'New York', type: 'PROPERTY', group: 'DARK_BLUE', cost: 400, mortgageValue: 200, houseCost: 200, rents: [50, 200, 600, 1400, 1700, 2000] }
];

export interface Card {
  text: string;
  action: (state: MonopolyState, playerId: string) => MonopolyState;
}

// Fortune Cards Deck
export const CHANCE_CARDS: Card[] = [
  {
    text: 'Advance to "GO" (Collect $200)',
    action: (state, pid) => movePlayerToSpace(state, pid, 0)
  },
  {
    text: 'Advance to Rome. If you pass GO, collect $200.',
    action: (state, pid) => movePlayerToSpace(state, pid, 24)
  },
  {
    text: 'Advance to Athens. If you pass GO, collect $200.',
    action: (state, pid) => movePlayerToSpace(state, pid, 11)
  },
  {
    text: 'Advance to the nearest Utility. If unowned, you may buy it. If owned, pay 10 times the dice throw.',
    action: (state, pid) => {
      const p = state.players.find(x => x.id === pid)!;
      const target = p.position > 12 && p.position < 28 ? 28 : 12;
      return movePlayerToSpace(state, pid, target);
    }
  },
  {
    text: 'Advance to the nearest Station. If unowned, buy it. If owned, pay double the fare.',
    action: (state, pid) => {
      const p = state.players.find(x => x.id === pid)!;
      let target = 5;
      if (p.position > 5 && p.position <= 15) target = 15;
      else if (p.position > 15 && p.position <= 25) target = 25;
      else if (p.position > 25 && p.position <= 35) target = 35;
      return movePlayerToSpace(state, pid, target);
    }
  },
  {
    text: 'Bank pays you dividend of $50.',
    action: (state, pid) => adjustCash(state, pid, 50, 'Bank pays dividend')
  },
  {
    text: 'Get out of Jail Free card.',
    action: (state, pid) => {
      const players = state.players.map(p => p.id === pid ? { ...p, getOutOfJailCards: p.getOutOfJailCards + 1 } : p);
      return { ...state, players, log: [...state.log, `${getPlayerName(state, pid)} received a Get Out Of Jail Free card.`] };
    }
  },
  {
    text: 'Go Back 3 Spaces.',
    action: (state, pid) => {
      const p = state.players.find(x => x.id === pid)!;
      let target = (p.position - 3 + 40) % 40;
      return movePlayerToSpace(state, pid, target);
    }
  },
  {
    text: 'Go directly to Jail. Do not pass GO, do not collect $200.',
    action: (state, pid) => sendPlayerToJail(state, pid)
  },
  {
    text: 'Make general repairs on all your property. For each house pay $25. For each hotel $100.',
    action: (state, pid) => {
      let cost = 0;
      Object.entries(state.properties).forEach(([idx, prop]) => {
        if (prop.ownerId === pid) {
          if (prop.houses === 5) cost += 100;
          else cost += prop.houses * 25;
        }
      });
      return chargeDebt(state, pid, null, cost, `Property Repairs fee: $${cost}`);
    }
  },
  {
    text: 'Speeding fine $15.',
    action: (state, pid) => adjustCash(state, pid, -15, 'Speeding fine')
  },
  {
    text: 'Take a trip to North Station. If you pass GO, collect $200.',
    action: (state, pid) => movePlayerToSpace(state, pid, 5)
  },
  {
    text: 'Advance to New York.',
    action: (state, pid) => movePlayerToSpace(state, pid, 39)
  },
  {
    text: 'You are elected city mayor. Pay each player $50.',
    action: (state, pid) => {
      let activeOpponentsCount = state.players.filter(p => p.id !== pid && !p.isBankrupt).length;
      let totalCost = activeOpponentsCount * 50;
      
      let tempState = state;
      state.players.forEach(other => {
        if (other.id !== pid && !other.isBankrupt) {
          tempState = adjustCash(tempState, other.id, 50, `Received $50 from Chairman election`);
        }
      });
      return chargeDebt(tempState, pid, null, totalCost, `Elected Chairman: Paid $${totalCost} to opponents`);
    }
  },
  {
    text: 'Your building loan matures. Collect $150.',
    action: (state, pid) => adjustCash(state, pid, 150, 'Building loan matures')
  }
];

// Treasury Cards Deck
export const COMMUNITY_CHEST_CARDS: Card[] = [
  {
    text: 'Advance to "GO" (Collect $200)',
    action: (state, pid) => movePlayerToSpace(state, pid, 0)
  },
  {
    text: 'Bank error in your favor. Collect $200.',
    action: (state, pid) => adjustCash(state, pid, 200, 'Bank error in your favor')
  },
  {
    text: 'Doctor\'s fees. Pay $50.',
    action: (state, pid) => adjustCash(state, pid, -50, 'Paid Doctor\'s fees')
  },
  {
    text: 'From sale of stock you get $50.',
    action: (state, pid) => adjustCash(state, pid, 50, 'Stock sale returns')
  },
  {
    text: 'Get Out of Jail Free card.',
    action: (state, pid) => {
      const players = state.players.map(p => p.id === pid ? { ...p, getOutOfJailCards: p.getOutOfJailCards + 1 } : p);
      return { ...state, players, log: [...state.log, `${getPlayerName(state, pid)} received a Get Out Of Jail Free card.`] };
    }
  },
  {
    text: 'Go directly to Jail. Do not pass GO, do not collect $200.',
    action: (state, pid) => sendPlayerToJail(state, pid)
  },
  {
    text: 'Holiday fund matures. Receive $100.',
    action: (state, pid) => adjustCash(state, pid, 100, 'Holiday fund matures')
  },
  {
    text: 'Income tax refund. Collect $20.',
    action: (state, pid) => adjustCash(state, pid, 20, 'Income tax refund')
  },
  {
    text: 'It is your birthday. Collect $10 from every player.',
    action: (state, pid) => {
      let activeOpponentsCount = state.players.filter(p => p.id !== pid && !p.isBankrupt).length;
      let totalCollect = activeOpponentsCount * 10;
      
      let tempState = state;
      state.players.forEach(other => {
        if (other.id !== pid && !other.isBankrupt) {
          tempState = adjustCash(tempState, other.id, -10, `Paid $10 for birthday gift`);
        }
      });
      return adjustCash(tempState, pid, totalCollect, `Collect birthday gift from players`);
    }
  },
  {
    text: 'Life insurance matures. Collect $100.',
    action: (state, pid) => adjustCash(state, pid, 100, 'Life insurance matures')
  },
  {
    text: 'Pay hospital fees of $100.',
    action: (state, pid) => adjustCash(state, pid, -100, 'Paid Hospital fees')
  },
  {
    text: 'Pay school fees of $50.',
    action: (state, pid) => adjustCash(state, pid, -50, 'Paid School fees')
  },
  {
    text: 'Receive $25 consultancy fee.',
    action: (state, pid) => adjustCash(state, pid, 25, 'Consultancy fee')
  },
  {
    text: 'You are assessed for street repairs. $40 per house. $115 per hotel.',
    action: (state, pid) => {
      let cost = 0;
      Object.entries(state.properties).forEach(([idx, prop]) => {
        if (prop.ownerId === pid) {
          if (prop.houses === 5) cost += 115;
          else cost += prop.houses * 40;
        }
      });
      return chargeDebt(state, pid, null, cost, `Street Repairs fee: $${cost}`);
    }
  },
  {
    text: 'You win second prize in a talent show. Collect $10.',
    action: (state, pid) => adjustCash(state, pid, 10, 'Beauty contest prize')
  },
  {
    text: 'You inherit $100.',
    action: (state, pid) => adjustCash(state, pid, 100, 'Inherit $100')
  }
];

// Helper Functions
export function getPlayerName(state: MonopolyState, pid: string): string {
  return state.players.find(p => p.id === pid)?.name || 'Unknown';
}

function getPlayer(state: MonopolyState, pid: string): Player {
  return state.players.find(p => p.id === pid)!;
}

function adjustCash(state: MonopolyState, pid: string, amount: number, logMsg?: string): MonopolyState {
  const players = state.players.map(p => {
    if (p.id === pid) {
      const newCash = p.cash + amount;
      return { ...p, cash: newCash };
    }
    return p;
  });

  const logs = [...state.log];
  if (logMsg) {
    logs.push(`${getPlayerName(state, pid)} cash adjusted by $${amount > 0 ? '+' : ''}${amount} (${logMsg}).`);
  }

  return { ...state, players, log: logs };
}

// Moves a player directly to a space index, managing Pass GO logic
export function movePlayerToSpace(state: MonopolyState, pid: string, targetIndex: number): MonopolyState {
  const p = state.players.find(x => x.id === pid)!;
  const currentPos = p.position;
  let newLogs = [...state.log];
  
  let passesGo = false;
  if (targetIndex < currentPos && targetIndex !== 10) {
    passesGo = true;
  }
  
  let updatedState = {
    ...state,
    players: state.players.map(x => x.id === pid ? { ...x, position: targetIndex } : x)
  };
  
  newLogs.push(`${p.name} moved to ${BOARD_SPACES[targetIndex].name}.`);
  updatedState.log = newLogs;

  if (passesGo) {
    updatedState = adjustCash(updatedState, pid, 200, 'Passed GO');
  }

  return evaluateLandingSpace(updatedState, pid, targetIndex);
}

// Puts player in jail
export function sendPlayerToJail(state: MonopolyState, pid: string): MonopolyState {
  const players = state.players.map(p => p.id === pid ? { ...p, position: 10, inJail: true, jailTurns: 0 } : p);
  return {
    ...state,
    players,
    phase: 'ROLL',
    doubleCount: 0,
    log: [...state.log, `${getPlayerName(state, pid)} was sent directly to Jail!`]
  };
}

// Charge debt, or trigger Bankruptcy phase if cannot afford
export function chargeDebt(state: MonopolyState, pid: string, creditorId: string | null, amount: number, logMsg: string): MonopolyState {
  const player = state.players.find(x => x.id === pid)!;
  
  if (player.cash >= amount) {
    let updated = adjustCash(state, pid, -amount, logMsg);
    if (creditorId) {
      updated = adjustCash(updated, creditorId, amount, `Rent paid by ${player.name}`);
    }
    return updated;
  } else {
    // Player cannot afford, goes into DEBT / BANKRUPTCY phase
    return {
      ...state,
      phase: 'BANKRUPTCY',
      debtToPlayerId: creditorId,
      debtAmount: amount,
      log: [...state.log, `⚠️ ${player.name} owes $${amount} but only has $${player.cash}! Must mortgage properties, sell houses, or declare Bankruptcy.`]
    };
  }
}

// Initial Game Setup
export function initializeGame(playersData: { id: string; name: string; isBot: boolean }[]): MonopolyState {
  const tokens = ['🚗', '🎩', '🚢', '👟', '🐕', '🪙'];
  const colors = [
    '#f43f5e', // Rose
    '#06b6d4', // Cyan
    '#a855f7', // Purple
    '#eab308', // Yellow
    '#10b981', // Green
    '#f97316'  // Orange
  ];

  const players: Player[] = playersData.map((pd, index) => ({
    id: pd.id,
    name: pd.name,
    token: tokens[index % tokens.length],
    color: colors[index % colors.length],
    position: 0,
    cash: 1500,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
    isBot: pd.isBot
  }));

  const properties: { [key: number]: PropertyState } = {};
  BOARD_SPACES.forEach((space) => {
    if (space.type === 'PROPERTY' || space.type === 'RAILROAD' || space.type === 'UTILITY') {
      properties[space.index] = {
        ownerId: null,
        houses: 0,
        isMortgaged: false
      };
    }
  });

  // Generate shuffled decks
  const shuffleDeck = (size: number) => Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5);

  return {
    players,
    currentPlayerIndex: 0,
    properties,
    log: ['🏆 Welcome to Property Empire! Game initialized.'],
    chanceDeck: shuffleDeck(CHANCE_CARDS.length),
    communityChestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS.length),
    chanceIndex: 0,
    communityChestIndex: 0,
    phase: 'ROLL',
    lastDice: [1, 1],
    doubleCount: 0,
    selectedSpaceIndex: null,
    debtToPlayerId: null,
    debtAmount: 0,
    winnerId: null,
    tradeSession: null,
    auctionState: null,
    lastCardDrawn: null,
    lastRentPaid: null
  };
}

// Core Game Step: Roll Dice
export function rollDice(state: MonopolyState, manualRoll?: [number, number]): MonopolyState {
  if (state.phase !== 'ROLL') return state;

  const dice1 = manualRoll ? manualRoll[0] : Math.floor(Math.random() * 6) + 1;
  const dice2 = manualRoll ? manualRoll[1] : Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2;
  const isDouble = dice1 === dice2;
  
  const currentPlayer = state.players[state.currentPlayerIndex];
  let nextLogs = [...state.log, `🎲 ${currentPlayer.name} rolled [${dice1}, ${dice2}] = ${total}.`];
  let nextDoubleCount = isDouble ? state.doubleCount + 1 : 0;
  
  let updatedState = {
    ...state,
    lastDice: [dice1, dice2] as [number, number],
    doubleCount: nextDoubleCount,
    lastCardDrawn: null,
    lastRentPaid: null,
    log: nextLogs
  };

  // Jail rules
  if (currentPlayer.inJail) {
    if (isDouble) {
      updatedState.log.push(`🔓 Double! ${currentPlayer.name} broke out of jail!`);
      updatedState.players = updatedState.players.map((p, idx) => 
        idx === state.currentPlayerIndex ? { ...p, inJail: false, position: (p.position + total) % 40 } : p
      );
      return evaluateLandingSpace(updatedState, currentPlayer.id, (currentPlayer.position + total) % 40);
    } else {
      const turns = currentPlayer.jailTurns + 1;
      updatedState.players = updatedState.players.map((p, idx) => 
        idx === state.currentPlayerIndex ? { ...p, jailTurns: turns } : p
      );
      if (turns >= 3) {
        updatedState.log.push(`👮 ${currentPlayer.name} was forced to pay $50 fine after 3 turns in jail.`);
        updatedState = chargeDebt(updatedState, currentPlayer.id, null, 50, 'Forced Jail Fine');
        
        // If they didn't go bankrupt, release them
        if (updatedState.phase !== 'BANKRUPTCY') {
          updatedState.players = updatedState.players.map((p, idx) => 
            idx === state.currentPlayerIndex ? { ...p, inJail: false, position: (p.position + total) % 40 } : p
          );
          return evaluateLandingSpace(updatedState, currentPlayer.id, (currentPlayer.position + total) % 40);
        }
        return updatedState;
      } else {
        updatedState.log.push(`${currentPlayer.name} remains in jail (Turn ${turns}/3).`);
        return endTurn(updatedState);
      }
    }
  }

  // 3 doubles sends you to jail
  if (nextDoubleCount === 3) {
    updatedState.log.push(`🚨 3 Doubles in a row! Speeding! Send ${currentPlayer.name} to Jail!`);
    return sendPlayerToJail(updatedState, currentPlayer.id);
  }

  const nextPos = (currentPlayer.position + total) % 40;
  const passesGo = nextPos < currentPlayer.position;

  updatedState.players = updatedState.players.map((p, idx) => 
    idx === state.currentPlayerIndex ? { ...p, position: nextPos } : p
  );

  if (passesGo) {
    updatedState = adjustCash(updatedState, currentPlayer.id, 200, 'Passed GO');
  }

  return evaluateLandingSpace(updatedState, currentPlayer.id, nextPos);
}

// Evaluate landing space rules
function evaluateLandingSpace(state: MonopolyState, pid: string, index: number): MonopolyState {
  const space = BOARD_SPACES[index];
  const prop = state.properties[index];
  const currentPlayer = state.players.find(x => x.id === pid)!;

  let nextLogs = [...state.log];

  if (space.type === 'PROPERTY' || space.type === 'RAILROAD' || space.type === 'UTILITY') {
    if (prop.ownerId === null) {
      // Space is unowned
      return {
        ...state,
        phase: 'BUY_OR_PASS',
        log: [...state.log, `🏠 Landed on unowned property ${space.name}. Cost is $${space.cost}.`]
      };
    } else if (prop.ownerId === pid) {
      // Space owned by landing player
      nextLogs.push(`Safe landing at owned property ${space.name}.`);
      return {
        ...state,
        phase: 'ROLL',
        log: nextLogs
      };
    } else {
      // Owned by another player
      const owner = state.players.find(p => p.id === prop.ownerId)!;
      if (owner.isBankrupt) {
        nextLogs.push(`Safely landed on bankrupt estate ${space.name}.`);
        return { ...state, log: nextLogs };
      }
      
      if (prop.isMortgaged) {
        nextLogs.push(`Rent is free because ${space.name} is mortgaged.`);
        return { ...state, log: nextLogs };
      }

      // Calculate Rent
      const rent = calculateRent(state, index);
      const withRentTracked = {
        ...state,
        lastRentPaid: {
          amount: rent,
          from: currentPlayer.name,
          to: owner.name,
          propertyName: space.name
        }
      };
      return chargeDebt({ ...withRentTracked, log: nextLogs }, pid, owner.id, rent, `Landed on ${space.name} owned by ${owner.name}`);
    }
  } else if (space.type === 'TAX') {
    const taxAmount = space.cost || 0;
    return chargeDebt(state, pid, null, taxAmount, `Landed on ${space.name}`);
  } else if (space.type === 'GO_TO_JAIL') {
    return sendPlayerToJail(state, pid);
  } else if (space.type === 'CHANCE') {
    return drawFortuneCard(state, pid);
  } else if (space.type === 'COMMUNITY_CHEST') {
    return drawCommunityChestCard(state, pid);
  }

  // Safe zones (GO, Jail Visiting, Free Parking)
  return state;
}

// Calculate rents based on owner sets, utilities, and railroads
export function calculateRent(state: MonopolyState, index: number): number {
  const space = BOARD_SPACES[index];
  const propState = state.properties[index];
  if (!propState.ownerId) return 0;

  const ownerId = propState.ownerId;

  if (space.type === 'PROPERTY') {
    // If hotels/houses are built, look up index
    if (propState.houses > 0) {
      return space.rents?.[propState.houses] || 0;
    }

    // Double rent if full color set is owned but no houses built
    const isSetOwned = isColorSetOwnedBy(state, space.group, ownerId);
    return isSetOwned ? (space.rents?.[0] || 0) * 2 : (space.rents?.[0] || 0);
  }

  if (space.type === 'RAILROAD') {
    // Number of railroads owned
    const rrOwned = Object.entries(state.properties).filter(([idx, p]) => {
      const sp = BOARD_SPACES[parseInt(idx)];
      return sp.type === 'RAILROAD' && p.ownerId === ownerId && !p.isMortgaged;
    }).length;

    return 25 * Math.pow(2, Math.max(0, rrOwned - 1));
  }

  if (space.type === 'UTILITY') {
    const utilitiesOwned = Object.entries(state.properties).filter(([idx, p]) => {
      const sp = BOARD_SPACES[parseInt(idx)];
      return sp.type === 'UTILITY' && p.ownerId === ownerId && !p.isMortgaged;
    }).length;

    const diceSum = state.lastDice[0] + state.lastDice[1];
    return utilitiesOwned === 2 ? diceSum * 10 : diceSum * 4;
  }

  return 0;
}

export function isColorSetOwnedBy(state: MonopolyState, colorGroup: ColorGroup, ownerId: string): boolean {
  const groupSpaces = BOARD_SPACES.filter(s => s.group === colorGroup);
  return groupSpaces.every(s => state.properties[s.index]?.ownerId === ownerId);
}

function isColorSetWithPotential(state: MonopolyState, colorGroup: ColorGroup, ownerId: string, landingIndex: number): boolean {
  if (colorGroup === 'SPECIAL' || colorGroup === 'RAILROAD' || colorGroup === 'UTILITY') return false;
  const groupSpaces = BOARD_SPACES.filter(s => s.group === colorGroup);
  return groupSpaces.every(s => s.index === landingIndex || state.properties[s.index]?.ownerId === ownerId);
}

// Draw card routines
function drawFortuneCard(state: MonopolyState, pid: string): MonopolyState {
  const cardIndex = state.chanceDeck[state.chanceIndex];
  const card = CHANCE_CARDS[cardIndex];
  
  let nextFortuneIndex = (state.chanceIndex + 1) % CHANCE_CARDS.length;
  let updated = {
    ...state,
    chanceIndex: nextFortuneIndex,
    lastCardDrawn: { type: 'CHANCE' as const, text: card.text },
    log: [...state.log, `🃏 ${getPlayerName(state, pid)} drew Fortune card: "${card.text}"`]
  };

  return card.action(updated, pid);
}

function drawCommunityChestCard(state: MonopolyState, pid: string): MonopolyState {
  const cardIndex = state.communityChestDeck[state.communityChestIndex];
  const card = COMMUNITY_CHEST_CARDS[cardIndex];
  
  let nextChestIndex = (state.communityChestIndex + 1) % COMMUNITY_CHEST_CARDS.length;
  let updated = {
    ...state,
    communityChestIndex: nextChestIndex,
    lastCardDrawn: { type: 'COMMUNITY_CHEST' as const, text: card.text },
    log: [...state.log, `📦 ${getPlayerName(state, pid)} drew Treasury card: "${card.text}"`]
  };

  return card.action(updated, pid);
}

// Action: Buy current property
export function buyProperty(state: MonopolyState): MonopolyState {
  if (state.phase !== 'BUY_OR_PASS') return state;

  const player = state.players[state.currentPlayerIndex];
  const spaceIndex = player.position;
  const space = BOARD_SPACES[spaceIndex];

  if (player.cash < (space.cost || 0)) {
    return {
      ...state,
      log: [...state.log, `❌ ${player.name} cannot afford to buy ${space.name}!`]
    };
  }

  let updatedState = adjustCash(state, player.id, -(space.cost || 0), `Bought ${space.name}`);
  
  updatedState.properties = {
    ...updatedState.properties,
    [spaceIndex]: {
      ...updatedState.properties[spaceIndex],
      ownerId: player.id
    }
  };

  updatedState.log.push(`🏡 ${player.name} bought property ${space.name} for $${space.cost}!`);
  updatedState.phase = 'ROLL'; // Move back to ready for ending turn
  return updatedState;
}

// Action: Pass on current property -> Triggers Auction
export function passProperty(state: MonopolyState): MonopolyState {
  if (state.phase !== 'BUY_OR_PASS') return state;

  const player = state.players[state.currentPlayerIndex];
  const spaceIndex = player.position;
  const space = BOARD_SPACES[spaceIndex];

  let nextLogs = [...state.log, `💸 ${player.name} passed on buying ${space.name}.`].slice(-100);

  return startAuction({ ...state, log: nextLogs }, spaceIndex);
}

// Action: Start an auction for a property
export function startAuction(state: MonopolyState, spaceIndex: number): MonopolyState {
  const activeBidderIds = state.players.filter(p => !p.isBankrupt).map(p => p.id);

  if (activeBidderIds.length === 0) {
    return {
      ...state,
      phase: 'ROLL',
      log: [...state.log, `🔨 Auction cancelled: no active players.`]
    };
  }

  // Start bidding from the current player
  let startIndex = activeBidderIds.indexOf(state.players[state.currentPlayerIndex].id);
  if (startIndex === -1) startIndex = 0;

  return {
    ...state,
    phase: 'AUCTION',
    auctionState: {
      spaceIndex,
      highestBid: 0,
      highestBidderId: null,
      activeBidderIds,
      currentBidderIndex: startIndex
    },
    log: [...state.log, `🔨 Auction started for ${BOARD_SPACES[spaceIndex].name}! Starting bid is $0.`].slice(-100)
  };
}

// Action: Place a bid in auction
export function bid(state: MonopolyState, amount: number): MonopolyState {
  if (state.phase !== 'AUCTION' || !state.auctionState) return state;

  const auc = state.auctionState;
  const bidderId = auc.activeBidderIds[auc.currentBidderIndex];
  const bidder = state.players.find(p => p.id === bidderId)!;

  if (amount <= auc.highestBid) {
    return {
      ...state,
      log: [...state.log, `❌ Bid of $${amount} must be higher than current highest bid ($${auc.highestBid}).`]
    };
  }

  if (bidder.cash < amount) {
    return {
      ...state,
      log: [...state.log, `❌ ${bidder.name} does not have enough cash to bid $${amount}.`]
    };
  }

  const nextAuc = {
    ...auc,
    highestBid: amount,
    highestBidderId: bidderId,
    currentBidderIndex: (auc.currentBidderIndex + 1) % auc.activeBidderIds.length
  };

  // If there's only 1 active bidder left, and they just bid, they win immediately!
  if (auc.activeBidderIds.length === 1) {
    const space = BOARD_SPACES[auc.spaceIndex];
    let updated = adjustCash(state, bidderId, -amount, `Won auction for ${space.name}`);
    updated.properties = {
      ...updated.properties,
      [auc.spaceIndex]: {
        ...updated.properties[auc.spaceIndex],
        ownerId: bidderId
      }
    };
    updated.phase = 'ROLL';
    updated.auctionState = null;
    updated.log = [...updated.log, `🔨 ${bidder.name} bid $${amount}!`, `🏆 ${bidder.name} won the auction for ${space.name} for $${amount}!`, `👉 It is now ${updated.players[updated.currentPlayerIndex].name}'s turn.`].slice(-100);
    return updated;
  }

  return {
    ...state,
    auctionState: nextAuc,
    log: [...state.log, `🔨 ${bidder.name} bid $${amount}!`].slice(-100)
  };
}

// Action: Fold/pass in auction
export function fold(state: MonopolyState): MonopolyState {
  if (state.phase !== 'AUCTION' || !state.auctionState) return state;

  const auc = state.auctionState;
  const bidderId = auc.activeBidderIds[auc.currentBidderIndex];
  const bidder = state.players.find(p => p.id === bidderId)!;

  const nextActiveBidderIds = auc.activeBidderIds.filter(id => id !== bidderId);
  let nextLogs = [...state.log, `👋 ${bidder.name} passed/folded in the auction.`].slice(-100);

  // Case 1: No active bidders left
  if (nextActiveBidderIds.length === 0) {
    return {
      ...state,
      phase: 'ROLL',
      auctionState: null,
      log: [...nextLogs, `🔨 Auction ended. No bids were placed for ${BOARD_SPACES[auc.spaceIndex].name}.`, `👉 It is now ${state.players[state.currentPlayerIndex].name}'s turn.`].slice(-100)
    };
  }

  // Case 2: Only 1 active bidder left AND there is a valid highest bid (meaning they win)
  if (nextActiveBidderIds.length === 1 && auc.highestBidderId !== null) {
    const winnerId = auc.highestBidderId;
    const winner = state.players.find(p => p.id === winnerId)!;
    const space = BOARD_SPACES[auc.spaceIndex];

    let updated = adjustCash(state, winnerId, -auc.highestBid, `Won auction for ${space.name}`);
    updated.properties = {
      ...updated.properties,
      [auc.spaceIndex]: {
        ...updated.properties[auc.spaceIndex],
        ownerId: winnerId
      }
    };
    updated.phase = 'ROLL';
    updated.auctionState = null;
    updated.log = [...nextLogs, `🏆 ${winner.name} won the auction for ${space.name} for $${auc.highestBid}!`, `👉 It is now ${updated.players[updated.currentPlayerIndex].name}'s turn.`].slice(-100);
    return updated;
  }

  // Case 3: Move to next bidder in auction
  let nextBidderIndex = auc.currentBidderIndex % nextActiveBidderIds.length;

  const nextAuc = {
    ...auc,
    activeBidderIds: nextActiveBidderIds,
    currentBidderIndex: nextBidderIndex
  };

  return {
    ...state,
    auctionState: nextAuc,
    log: nextLogs
  };
}

// Action: Pay Jail Fine ($50)
export function payJailFine(state: MonopolyState): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  if (!player.inJail || player.cash < 50) return state;

  let updated = adjustCash(state, player.id, -50, 'Paid Jail Fine');
  updated.players = updated.players.map((p, idx) => 
    idx === state.currentPlayerIndex ? { ...p, inJail: false, jailTurns: 0 } : p
  );
  updated.log.push(`🔓 ${player.name} paid $50 fine to get out of jail.`);
  return updated;
}

// Action: Use Get Out Of Jail card
export function useJailCard(state: MonopolyState): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  if (!player.inJail || player.getOutOfJailCards <= 0) return state;

  const players = state.players.map((p, idx) => 
    idx === state.currentPlayerIndex ? { ...p, inJail: false, jailTurns: 0, getOutOfJailCards: p.getOutOfJailCards - 1 } : p
  );

  return {
    ...state,
    players,
    log: [...state.log, `🔓 ${player.name} used a Get Out of Jail Free card.`]
  };
}

// Action: Build a house
export function buildHouse(state: MonopolyState, spaceIndex: number): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  const space = BOARD_SPACES[spaceIndex];
  const prop = state.properties[spaceIndex];

  if (!space.houseCost || !prop || prop.ownerId !== player.id || prop.isMortgaged || prop.houses === 5) return state;

  if (!isColorSetOwnedBy(state, space.group, player.id)) {
    return { ...state, log: [...state.log, `❌ You must own the complete color group before building houses.`] };
  }

  // Check even building rule
  const groupProperties = BOARD_SPACES.filter(s => s.group === space.group);
  const minHousesInGroup = Math.min(...groupProperties.map(s => state.properties[s.index].houses));
  
  if (prop.houses > minHousesInGroup) {
    return { ...state, log: [...state.log, `❌ Even building rule: build evenly across this color group.`] };
  }

  if (player.cash < space.houseCost) {
    return { ...state, log: [...state.log, `❌ Insufficient cash to build a house on ${space.name}.`] };
  }

  let updated = adjustCash(state, player.id, -space.houseCost, `Built house on ${space.name}`);
  updated.properties = {
    ...updated.properties,
    [spaceIndex]: {
      ...updated.properties[spaceIndex],
      houses: prop.houses + 1
    }
  };
  
  const isHotel = prop.houses + 1 === 5;
  updated.log.push(`🏗️ ${player.name} built a ${isHotel ? 'Hotel' : 'House'} on ${space.name} for $${space.houseCost}!`);
  return updated;
}

// Action: Sell a house
export function sellHouse(state: MonopolyState, spaceIndex: number): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  const space = BOARD_SPACES[spaceIndex];
  const prop = state.properties[spaceIndex];

  if (!space.houseCost || !prop || prop.ownerId !== player.id || prop.houses === 0) return state;

  // Check even selling rule
  const groupProperties = BOARD_SPACES.filter(s => s.group === space.group);
  const maxHousesInGroup = Math.max(...groupProperties.map(s => state.properties[s.index].houses));
  
  if (prop.houses < maxHousesInGroup) {
    return { ...state, log: [...state.log, `❌ Even selling rule: sell evenly across this color group.`] };
  }

  const sellPrice = Math.floor(space.houseCost / 2);
  let updated = adjustCash(state, player.id, sellPrice, `Sold house from ${space.name}`);
  
  updated.properties = {
    ...updated.properties,
    [spaceIndex]: {
      ...updated.properties[spaceIndex],
      houses: prop.houses - 1
    }
  };
  
  // Resolve debt if bankruptcy phase
  if (updated.phase === 'BANKRUPTCY' && updated.players[updated.currentPlayerIndex].cash >= updated.debtAmount) {
    // Afforded!
    updated = payOffDebt(updated);
  }

  updated.log.push(`📉 ${player.name} sold a house from ${space.name} for $${sellPrice}.`);
  return updated;
}

// Action: Mortgage a property
export function mortgageProperty(state: MonopolyState, spaceIndex: number): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  const space = BOARD_SPACES[spaceIndex];
  const prop = state.properties[spaceIndex];

  if (!space.mortgageValue || !prop || prop.ownerId !== player.id || prop.isMortgaged) return state;

  // Cannot mortgage if houses are built on any property in that color group
  const groupProperties = BOARD_SPACES.filter(s => s.group === space.group);
  const hasHouses = groupProperties.some(s => (state.properties[s.index]?.houses || 0) > 0);
  
  if (hasHouses) {
    return { ...state, log: [...state.log, `❌ You must sell all houses in the color group before mortgaging.`] };
  }

  let updated = adjustCash(state, player.id, space.mortgageValue, `Mortgaged ${space.name}`);
  updated.properties = {
    ...updated.properties,
    [spaceIndex]: {
      ...updated.properties[spaceIndex],
      isMortgaged: true
    }
  };

  // Resolve debt if bankruptcy phase
  if (updated.phase === 'BANKRUPTCY' && updated.players[updated.currentPlayerIndex].cash >= updated.debtAmount) {
    updated = payOffDebt(updated);
  }

  updated.log.push(`🏦 ${player.name} mortgaged ${space.name} for $${space.mortgageValue}.`);
  return updated;
}

// Action: Unmortgage a property
export function unmortgageProperty(state: MonopolyState, spaceIndex: number): MonopolyState {
  const player = state.players[state.currentPlayerIndex];
  const space = BOARD_SPACES[spaceIndex];
  const prop = state.properties[spaceIndex];

  if (!space.mortgageValue || !prop || prop.ownerId !== player.id || !prop.isMortgaged) return state;

  const unmortgageCost = Math.floor(space.mortgageValue * 1.1); // 10% fee

  if (player.cash < unmortgageCost) {
    return { ...state, log: [...state.log, `❌ Insufficient cash to unmortgage ${space.name}. Cost is $${unmortgageCost}.`] };
  }

  let updated = adjustCash(state, player.id, -unmortgageCost, `Unmortgaged ${space.name}`);
  updated.properties = {
    ...updated.properties,
    [spaceIndex]: {
      ...updated.properties[spaceIndex],
      isMortgaged: false
    }
  };

  updated.log.push(`🔓 ${player.name} unmortgaged ${space.name} for $${unmortgageCost}.`);
  return updated;
}

// Helper to pay off active debt when cash becomes sufficient during BANKRUPTCY phase
function payOffDebt(state: MonopolyState): MonopolyState {
  const debtor = state.players[state.currentPlayerIndex];
  const creditorId = state.debtToPlayerId;
  const amount = state.debtAmount;

  let updated = adjustCash(state, debtor.id, -amount, `Settled debt of $${amount}`);
  
  if (creditorId) {
    updated = adjustCash(updated, creditorId, amount, `Received debt settlement from ${debtor.name}`);
  }

  updated.phase = 'ROLL';
  updated.debtToPlayerId = null;
  updated.debtAmount = 0;
  updated.log.push(`✅ ${debtor.name} successfully paid off debt of $${amount}!`);
  return updated;
}

// Action: Declare Bankruptcy
export function declareBankruptcy(state: MonopolyState): MonopolyState {
  if (state.phase !== 'BANKRUPTCY') return state;

  const bankruptPlayer = state.players[state.currentPlayerIndex];
  const creditorId = state.debtToPlayerId;

  let nextLogs = [...state.log, `☠️ ${bankruptPlayer.name} declared BANKRUPTCY!`];

  // Transfer all property to creditor
  const properties = { ...state.properties };
  Object.keys(properties).forEach((idxStr) => {
    const idx = parseInt(idxStr);
    if (properties[idx].ownerId === bankruptPlayer.id) {
      if (creditorId) {
        // Creditor receives property (unmortgaged or mortgaged, but houses destroyed)
        properties[idx] = {
          ownerId: creditorId,
          houses: 0,
          isMortgaged: properties[idx].isMortgaged
        };
        nextLogs.push(`🏠 Property ${BOARD_SPACES[idx].name} transferred to ${getPlayerName(state, creditorId)}.`);
      } else {
        // Return to bank
        properties[idx] = {
          ownerId: null,
          houses: 0,
          isMortgaged: false
        };
      }
    }
  });

  // Transfer cash
  let updatedState = state;
  if (creditorId && bankruptPlayer.cash > 0) {
    updatedState = adjustCash(updatedState, creditorId, bankruptPlayer.cash, `Received remaining assets of bankrupt player`);
  }

  const players = state.players.map(p => p.id === bankruptPlayer.id ? { ...p, isBankrupt: true, cash: 0 } : p);

  // Check if game over
  const activePlayers = players.filter(p => !p.isBankrupt);
  let finalPhase: MonopolyState['phase'] = 'ROLL';
  let winnerId = null;

  if (activePlayers.length === 1) {
    finalPhase = 'GAME_OVER';
    winnerId = activePlayers[0].id;
    nextLogs.push(`🏆 GAME OVER! ${activePlayers[0].name} is the last remaining tycoon!`);
  }

  return {
    ...updatedState,
    players,
    properties,
    phase: finalPhase,
    winnerId,
    debtToPlayerId: null,
    debtAmount: 0,
    log: nextLogs
  };
}

// Action: Propose a trade
export function proposeTrade(state: MonopolyState, receiverId: string, offer: TradeOffer, request: TradeOffer): MonopolyState {
  const senderId = state.players[state.currentPlayerIndex].id;
  
  const tradeSession: TradeSession = {
    senderId,
    receiverId,
    senderOffer: offer,
    receiverOffer: request,
    active: true
  };

  return {
    ...state,
    tradeSession,
    log: [...state.log, `🤝 ${getPlayerName(state, senderId)} proposed a trade to ${getPlayerName(state, receiverId)}.`]
  };
}

// Action: Accept active trade
export function acceptTrade(state: MonopolyState): MonopolyState {
  const session = state.tradeSession;
  if (!session || !session.active) return state;

  const sender = state.players.find(p => p.id === session.senderId)!;
  const receiver = state.players.find(p => p.id === session.receiverId)!;

  // Validate cash
  if (sender.cash < session.senderOffer.cash || receiver.cash < session.receiverOffer.cash) {
    return { ...state, tradeSession: null, log: [...state.log, `❌ Trade failed: One of the players has insufficient funds.`] };
  }

  let updated = state;

  // Swap cash
  updated = adjustCash(updated, sender.id, -session.senderOffer.cash + session.receiverOffer.cash, 'Trade cash swap');
  updated = adjustCash(updated, receiver.id, -session.receiverOffer.cash + session.senderOffer.cash, 'Trade cash swap');

  // Swap properties
  const properties = { ...updated.properties };
  session.senderOffer.properties.forEach(idx => {
    properties[idx] = { ...properties[idx], ownerId: receiver.id };
  });
  session.receiverOffer.properties.forEach(idx => {
    properties[idx] = { ...properties[idx], ownerId: sender.id };
  });

  updated.properties = properties;
  updated.tradeSession = null;
  updated.log.push(`🤝 Trade ACCEPTED between ${sender.name} and ${receiver.name}!`);

  return updated;
}

// Action: Reject active trade
export function rejectTrade(state: MonopolyState): MonopolyState {
  const session = state.tradeSession;
  if (!session) return state;

  return {
    ...state,
    tradeSession: null,
    log: [...state.log, `🤝 Trade proposal from ${getPlayerName(state, session.senderId)} was REJECTED.`]
  };
}

// Action: End current turn
export function endTurn(state: MonopolyState): MonopolyState {
  if (state.phase !== 'ROLL' && state.phase !== 'GAME_OVER') return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  let nextLogs = [...state.log];
  
  // Can roll again if double rolled and NOT in jail
  let nextPlayerIndex = state.currentPlayerIndex;
  let nextDoubleCount = state.doubleCount;
  if (state.doubleCount > 0 && !currentPlayer.inJail && !currentPlayer.isBankrupt) {
    nextLogs.push(`🔄 Double rolled! ${currentPlayer.name} gets another throw.`);
  } else {
    // Move to next player that is NOT bankrupt
    let attempts = 0;
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
      attempts++;
    } while (state.players[nextPlayerIndex].isBankrupt && attempts < state.players.length);

    // Reset double count for next turn
    nextDoubleCount = 0;
  }

  const nextPlayer = state.players[nextPlayerIndex];

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    doubleCount: nextDoubleCount,
    phase: 'ROLL', // Reset phase
    log: [...nextLogs, `👉 It is now ${nextPlayer.name}'s turn.`]
  };
}

// AI Bot Strategy implementation
export function playBotTurn(state: MonopolyState): MonopolyState {
  const getActivePlayer = (s: MonopolyState) => s.players[s.currentPlayerIndex];
  let current = state;
  let bot = getActivePlayer(current);
  if (!bot || !bot.isBot || bot.isBankrupt) return state;

  // 1. Jail Decision
  if (bot.inJail) {
    if (bot.getOutOfJailCards > 0) {
      current = useJailCard(current);
    } else if (bot.cash > 250) {
      current = payJailFine(current);
    }
  }

  bot = getActivePlayer(current);

  // 2. Roll
  if (current.phase === 'ROLL') {
    current = rollDice(current);
  }

  bot = getActivePlayer(current);

  // 3. Buy Decision
  if (current.phase === 'BUY_OR_PASS') {
    const spaceIndex = bot.position;
    const space = BOARD_SPACES[spaceIndex];
    const wouldCompleteColorSet = isColorSetWithPotential(current, space.group, bot.id, spaceIndex);
    const cost = space.cost || 0;
    
    let shouldBuy = false;
    if (bot.cash >= cost) {
      if (space.type === 'RAILROAD' || space.type === 'UTILITY') {
        shouldBuy = bot.cash - cost >= 150;
      } else if (wouldCompleteColorSet) {
        shouldBuy = true;
      } else {
        shouldBuy = bot.cash - cost >= (cost > 200 ? 150 : 100);
      }
    }

    if (shouldBuy) {
      current = buyProperty(current);
    } else {
      current = passProperty(current);
    }
  }

  bot = getActivePlayer(current);

  // 4. Handle Bankruptcy if stuck
  if (current.phase === 'BANKRUPTCY') {
    let raisedAmount = 0;
    const botProps = Object.entries(current.properties).filter(([idx, prop]) => prop.ownerId === bot.id);
    
    // First, sell houses
    for (let i = 0; i < botProps.length; i++) {
      const [idxStr] = botProps[i];
      const idx = parseInt(idxStr);
      while (current.properties[idx].houses > 0 && getActivePlayer(current).cash < current.debtAmount) {
        current = sellHouse(current, idx);
      }
    }

    bot = getActivePlayer(current);

    // Next, mortgage unmortgaged properties
    for (let i = 0; i < botProps.length; i++) {
      const [idxStr] = botProps[i];
      const idx = parseInt(idxStr);
      if (!current.properties[idx].isMortgaged && current.properties[idx].houses === 0 && getActivePlayer(current).cash < current.debtAmount) {
        current = mortgageProperty(current, idx);
      }
    }

    bot = getActivePlayer(current);

    if (current.phase === 'BANKRUPTCY') {
      current = declareBankruptcy(current);
    }
  }

  bot = getActivePlayer(current);

  // 5. Build Houses Strategy
  if (current.phase === 'ROLL' && !bot.isBankrupt && !bot.inJail) {
    const botProps = Object.entries(current.properties).filter(([idx, prop]) => prop.ownerId === bot.id);
    for (let i = 0; i < botProps.length; i++) {
      const [idxStr] = botProps[i];
      const idx = parseInt(idxStr);
      const space = BOARD_SPACES[idx];
      if (space.type === 'PROPERTY' && current.properties[idx].houses < 5 && !current.properties[idx].isMortgaged) {
        if (isColorSetOwnedBy(current, space.group, bot.id) && getActivePlayer(current).cash - (space.houseCost || 0) >= 200) {
          const groupProperties = BOARD_SPACES.filter(s => s.group === space.group);
          const currentHouses = current.properties[idx].houses;
          const minHousesInGroup = Math.min(...groupProperties.map(s => current.properties[s.index]?.houses || 0));
          if (currentHouses === minHousesInGroup) {
            current = buildHouse(current, idx);
          }
        }
      }
    }
  }

  bot = getActivePlayer(current);

  // 6. End Turn
  if (current.phase === 'ROLL') {
    current = endTurn(current);
  }

  return current;
}

// AI Bot Auction Strategy implementation
export function playBotAuction(state: MonopolyState): MonopolyState {
  if (state.phase !== 'AUCTION' || !state.auctionState) return state;

  const auc = state.auctionState;
  const bidderId = auc.activeBidderIds[auc.currentBidderIndex];
  const bidder = state.players.find(p => p.id === bidderId)!;

  if (!bidder.isBot) return state;

  const space = BOARD_SPACES[auc.spaceIndex];
  const cost = space.cost || 100;
  const currentHighest = auc.highestBid;

  // Bot strategy:
  // 1. Calculate maximum bid bot is willing to place:
  // - Base: 80% of property cost.
  // - If it completes a color group: 120% of property cost.
  // - If bot has a lot of cash (cash > 800): add 10% of property cost.
  const wouldCompleteColorSet = isColorSetWithPotential(state, space.group, bidder.id, auc.spaceIndex);
  let maxBid = Math.floor(cost * (wouldCompleteColorSet ? 1.2 : 0.8));
  if (bidder.cash > 800) maxBid += Math.floor(cost * 0.1);

  // 2. Decide bid or pass
  if (currentHighest < maxBid && bidder.cash > currentHighest + 10) {
    // Place a bid: increment by a random amount between 5 and 15, capped at maxBid and bidder cash
    const increment = Math.floor(Math.random() * 11) + 5; // $5 to $15
    const bidAmount = Math.min(maxBid, Math.min(bidder.cash, currentHighest + increment));
    return bid(state, bidAmount);
  } else {
    // Fold
    return fold(state);
  }
}
