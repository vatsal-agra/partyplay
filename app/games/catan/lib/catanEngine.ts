// Hexland Game Engine
// Pure state management and Hexland gameplay rules

export type ResourceType = 'WOOD' | 'BRICK' | 'SHEEP' | 'WHEAT' | 'ORE';
export type TerrainType = 'FOREST' | 'HILLS' | 'PASTURE' | 'FIELDS' | 'MOUNTAINS' | 'DESERT';
export type DevCardType = 'KNIGHT' | 'ROAD_BUILDING' | 'YEAR_OF_PLENTY' | 'MONOPOLY' | 'VICTORY_POINT';

export const RESOURCES: ResourceType[] = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

export interface ResourceMap {
  WOOD: number;
  BRICK: number;
  SHEEP: number;
  WHEAT: number;
  ORE: number;
}

export interface DevCardMap {
  KNIGHT: number;
  ROAD_BUILDING: number;
  YEAR_OF_PLENTY: number;
  MONOPOLY: number;
  VICTORY_POINT: number;
}

export interface CatanPlayer {
  id: string;
  name: string;
  color: string;
  token: string;
  isBot: boolean;
  resources: ResourceMap;
  devCards: DevCardMap;
  playedKnights: number;
  victoryPoints: number;
  longestRoad: number;
  longestRoadActive: boolean;
  largestArmyActive: boolean;
}

export interface CatanHexState {
  index: number;
  q: number;
  r: number;
  terrain: TerrainType;
  numberToken: number; // 2..12, 0 for desert
  hasRobber: boolean;
}

export interface CatanTradeOffer {
  senderId: string;
  receiverId: string;
  senderOffer: ResourceMap;
  receiverOffer: ResourceMap;
  active: boolean;
}

export interface CatanState {
  players: CatanPlayer[];
  currentPlayerIndex: number;
  hexes: CatanHexState[];
  settlements: { [vertexId: number]: { playerId: string; type: 'settlement' | 'city' } };
  roads: { [edgeId: number]: string }; // edgeId -> playerId
  phase: 'SETUP_1' | 'SETUP_2' | 'ROLL' | 'ROBBER_DISCARD' | 'ROBBER_MOVE' | 'MAIN' | 'GAME_OVER';
  dice: [number, number];
  robberHexIndex: number;
  log: string[];
  devCardDeck: DevCardType[];
  winnerId: string | null;
  tradeOffer: CatanTradeOffer | null;
  playedDevCardThisTurn: boolean;
  robberStealOptions: string[];
  discardRequiredPlayers: string[];
  discardCount: { [playerId: string]: number };
}

// -------------------------------------------------------------
// Board layout structures & static graph generator
// -------------------------------------------------------------

export interface HexLayout {
  index: number;
  q: number;
  r: number;
  x: number;
  y: number;
  vertices: number[]; // 6 vertex IDs
  edges: number[];    // 6 edge IDs
}

export interface VertexLayout {
  id: number;
  x: number;
  y: number;
  adjacentVertices: number[];
  adjacentEdges: number[];
  adjacentHexes: number[];
}

export interface EdgeLayout {
  id: number;
  vertices: [number, number];
  adjacentEdges: number[];
  adjacentHexes: number[];
}

export interface HarborLayout {
  resource: ResourceType | 'GENERIC';
  vertices: [number, number];
}

export interface BoardLayout {
  hexes: HexLayout[];
  vertices: VertexLayout[];
  edges: EdgeLayout[];
  harbors: HarborLayout[];
}

let cachedBoardLayout: BoardLayout | null = null;

export function getBoardLayout(): BoardLayout {
  if (cachedBoardLayout) return cachedBoardLayout;
  cachedBoardLayout = generateBoardLayout();
  return cachedBoardLayout;
}

function generateBoardLayout(): BoardLayout {
  const hexCoords = [
    { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
    { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
    { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
    { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
    { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }
  ];

  const vertices: { x: number; y: number; id: number; adjacentHexes: number[] }[] = [];
  const edges: { vertices: [number, number]; id: number; adjacentHexes: number[] }[] = [];

  // 1. Generate centers and corners of 19 hexes
  const hexes: HexLayout[] = hexCoords.map((coord, index) => {
    // Pointy-topped hexagon centers
    const cx = Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r;
    const cy = 1.5 * coord.r;

    const hexVertices: number[] = [];
    for (let i = 0; i < 6; i++) {
      // 30, 90, 150, 210, 270, 330 degrees
      const angle = ((30 + 60 * i) * Math.PI) / 180;
      const px = cx + Math.cos(angle);
      const py = cy + Math.sin(angle);

      let vIdx = vertices.findIndex(v => Math.hypot(v.x - px, v.y - py) < 0.05);
      if (vIdx === -1) {
        vIdx = vertices.length;
        vertices.push({ x: px, y: py, id: vIdx, adjacentHexes: [] });
      }
      vertices[vIdx].adjacentHexes.push(index);
      hexVertices.push(vIdx);
    }

    return {
      index,
      q: coord.q,
      r: coord.r,
      x: cx,
      y: cy,
      vertices: hexVertices,
      edges: []
    };
  });

  // 2. Generate unique edges
  hexes.forEach(hex => {
    const hexEdges: number[] = [];
    for (let i = 0; i < 6; i++) {
      const v1 = hex.vertices[i];
      const v2 = hex.vertices[(i + 1) % 6];

      const vMin = Math.min(v1, v2);
      const vMax = Math.max(v1, v2);

      let eIdx = edges.findIndex(e => e.vertices[0] === vMin && e.vertices[1] === vMax);
      if (eIdx === -1) {
        eIdx = edges.length;
        edges.push({ vertices: [vMin, vMax], id: eIdx, adjacentHexes: [] });
      }
      edges[eIdx].adjacentHexes.push(hex.index);
      hexEdges.push(eIdx);
    }
    hex.edges = hexEdges;
  });

  // 3. Build vertex layout details
  const vertexLayouts: VertexLayout[] = vertices.map(v => {
    const adjVertsSet = new Set<number>();
    const adjEdges: number[] = [];
    edges.forEach(e => {
      if (e.vertices[0] === v.id) {
        adjVertsSet.add(e.vertices[1]);
        adjEdges.push(e.id);
      } else if (e.vertices[1] === v.id) {
        adjVertsSet.add(e.vertices[0]);
        adjEdges.push(e.id);
      }
    });
    return {
      id: v.id,
      x: v.x,
      y: v.y,
      adjacentVertices: Array.from(adjVertsSet).sort((a,b)=>a-b),
      adjacentEdges: adjEdges.sort((a,b)=>a-b),
      adjacentHexes: v.adjacentHexes.sort((a,b)=>a-b)
    };
  });

  // 4. Build edge layout details
  const edgeLayouts: EdgeLayout[] = edges.map(e => {
    const adjEdgesSet = new Set<number>();
    edges.forEach(other => {
      if (other.id === e.id) return;
      if (other.vertices.includes(e.vertices[0]) || other.vertices.includes(e.vertices[1])) {
        adjEdgesSet.add(other.id);
      }
    });
    return {
      id: e.id,
      vertices: e.vertices,
      adjacentEdges: Array.from(adjEdgesSet).sort((a,b)=>a-b),
      adjacentHexes: e.adjacentHexes.sort((a,b)=>a-b)
    };
  });

  // 5. Place outer harbors
  // Find border edges (touching only 1 hex) and sort them in a topological ring
  const borderEdges = edgeLayouts.filter(e => e.adjacentHexes.length === 1);
  const ring: number[] = [];
  
  if (borderEdges.length > 0) {
    let curr = borderEdges[0];
    const visited = new Set<number>([curr.id]);
    ring.push(curr.id);

    while (ring.length < borderEdges.length) {
      const nextEdge = borderEdges.find(other => {
        if (visited.has(other.id)) return false;
        return other.vertices.some(v => curr.vertices.includes(v));
      });
      if (!nextEdge) break;
      visited.add(nextEdge.id);
      ring.push(nextEdge.id);
      curr = nextEdge;
    }
  }

  // Place 9 harbors around the outer ring
  const harborTypes: (ResourceType | 'GENERIC')[] = [
    'GENERIC', 'WOOD', 'GENERIC', 'BRICK', 'GENERIC', 'SHEEP', 'GENERIC', 'WHEAT', 'ORE'
  ];

  const harbors: HarborLayout[] = [];
  for (let i = 0; i < 9; i++) {
    // Select border edges spaced out by index
    const ringIdx = Math.floor((i * ring.length) / 9);
    const edgeId = ring[ringIdx];
    const edge = edgeLayouts.find(e => e.id === edgeId)!;
    harbors.push({
      resource: harborTypes[i],
      vertices: edge.vertices
    });
  }

  return {
    hexes,
    vertices: vertexLayouts,
    edges: edgeLayouts,
    harbors
  };
}

// -------------------------------------------------------------
// Engine Game Action Handlers
// -------------------------------------------------------------

const TERRAINS: TerrainType[] = [
  'FOREST', 'FOREST', 'FOREST', 'FOREST', // 4 Wood
  'PASTURE', 'PASTURE', 'PASTURE', 'PASTURE', // 4 Sheep
  'FIELDS', 'FIELDS', 'FIELDS', 'FIELDS', // 4 Wheat
  'MOUNTAINS', 'MOUNTAINS', 'MOUNTAINS', // 3 Ore
  'HILLS', 'HILLS', 'HILLS', // 3 Brick
  'DESERT' // 1 Desert
];

const TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

export function initializeGame(playersData: { id: string; name: string; isBot: boolean }[]): CatanState {
  const layout = getBoardLayout();

  // 1. Shuffle terrains
  const shuffledTerrains = [...TERRAINS].sort(() => Math.random() - 0.5);
  // 2. Shuffle number tokens
  const shuffledTokens = [...TOKENS].sort(() => Math.random() - 0.5);

  let tokenIdx = 0;
  let desertIdx = 0;

  const hexes: CatanHexState[] = layout.hexes.map((hex, i) => {
    const terrain = shuffledTerrains[i];
    const isDesert = terrain === 'DESERT';
    if (isDesert) desertIdx = i;

    return {
      index: hex.index,
      q: hex.q,
      r: hex.r,
      terrain,
      numberToken: isDesert ? 0 : shuffledTokens[tokenIdx++],
      hasRobber: isDesert
    };
  });

  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b'];
  const tokens = ['🚗', '⛵', '🚁', '🚜'];

  const players: CatanPlayer[] = playersData.map((p, idx) => ({
    id: p.id,
    name: p.name,
    color: colors[idx % colors.length],
    token: tokens[idx % tokens.length],
    isBot: p.isBot,
    resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 },
    devCards: { KNIGHT: 0, ROAD_BUILDING: 0, YEAR_OF_PLENTY: 0, MONOPOLY: 0, VICTORY_POINT: 0 },
    playedKnights: 0,
    victoryPoints: 0,
    longestRoad: 0,
    longestRoadActive: false,
    largestArmyActive: false
  }));

  // Build Dev Card Deck (14 Knights, 2 Road Building, 2 Year of Plenty, 2 Embargo, 5 VP)
  const devCardDeck: DevCardType[] = [
    ...Array(14).fill('KNIGHT'),
    ...Array(2).fill('ROAD_BUILDING'),
    ...Array(2).fill('YEAR_OF_PLENTY'),
    ...Array(2).fill('MONOPOLY'),
    ...Array(5).fill('VICTORY_POINT')
  ].sort(() => Math.random() - 0.5);

  const state: CatanState = {
    players,
    currentPlayerIndex: 0,
    hexes,
    settlements: {},
    roads: {},
    phase: 'SETUP_1',
    dice: [1, 1],
    robberHexIndex: desertIdx,
    log: [`🎲 Game initialized with ${players.length} players. Initial placement setup starting!`],
    devCardDeck,
    winnerId: null,
    tradeOffer: null,
    playedDevCardThisTurn: false,
    robberStealOptions: [],
    discardRequiredPlayers: [],
    discardCount: {}
  };

  return recalculateVPs(state);
}

// Roll Dice
export function rollDice(state: CatanState): CatanState {
  if (state.phase !== 'ROLL') return state;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const roll = d1 + d2;

  const player = state.players[state.currentPlayerIndex];
  let updated = {
    ...state,
    dice: [d1, d2] as [number, number],
    log: [...state.log, `🎲 ${player.name} rolled a ${roll} (${d1} + ${d2}).`]
  };

  if (roll === 7) {
    // Robber phase
    // 1. Check if anyone needs to discard
    const discardRequired: string[] = [];
    const counts: { [id: string]: number } = {};

    updated.players.forEach(p => {
      const sum = p.resources.WOOD + p.resources.BRICK + p.resources.SHEEP + p.resources.WHEAT + p.resources.ORE;
      if (sum > 7) {
        discardRequired.push(p.id);
        counts[p.id] = Math.floor(sum / 2);
      }
    });

    if (discardRequired.length > 0) {
      updated.phase = 'ROBBER_DISCARD';
      updated.discardRequiredPlayers = discardRequired;
      updated.discardCount = counts;
      updated.log.push(`⚠️ Robber triggered! Players with > 7 resources must discard half: ${discardRequired.map(id => getPlayerName(updated, id)).join(', ')}.`);
    } else {
      updated.phase = 'ROBBER_MOVE';
      updated.log.push(`🕵️ Robber triggered! ${player.name} must move the Robber.`);
    }
  } else {
    // Resource distribution
    updated = distributeResources(updated, roll);
    updated.phase = 'MAIN';
  }

  return updated;
}

function distributeResources(state: CatanState, roll: number): CatanState {
  const layout = getBoardLayout();
  const nextPlayers = state.players.map(p => ({
    ...p,
    resources: { ...p.resources }
  }));

  const distributions: string[] = [];

  state.hexes.forEach(hex => {
    if (hex.numberToken === roll && !hex.hasRobber) {
      const terrainRes = getTerrainResource(hex.terrain);
      if (!terrainRes) return;

      // Check all vertices adjacent to this hex
      const hexLayout = layout.hexes[hex.index];
      hexLayout.vertices.forEach(vId => {
        const settlement = state.settlements[vId];
        if (settlement) {
          const recPlayer = nextPlayers.find(p => p.id === settlement.playerId)!;
          const count = settlement.type === 'city' ? 2 : 1;
          recPlayer.resources[terrainRes] += count;
          distributions.push(`${recPlayer.name} received ${count} ${terrainRes} from hex ${hex.index}`);
        }
      });
    }
  });

  let nextLogs = [...state.log];
  if (distributions.length > 0) {
    nextLogs.push(`📦 Resources distributed: ` + distributions.join(', '));
  } else {
    nextLogs.push(`📦 No resources produced this roll.`);
  }

  return {
    ...state,
    players: nextPlayers,
    log: nextLogs
  };
}

// Initial placement settlement placement
export function placeSettlement(state: CatanState, vertexId: number): CatanState {
  const player = state.players[state.currentPlayerIndex];
  const layout = getBoardLayout();

  // Validate vertex exists and is empty
  if (state.settlements[vertexId]) return state;

  // Validate Distance Rule: adjacent vertices must be empty
  const vertex = layout.vertices[vertexId];
  const isAdjacentOccupied = vertex.adjacentVertices.some(v => state.settlements[v]);
  if (isAdjacentOccupied) {
    return { ...state, log: [...state.log, `❌ Cannot build here: Violates the distance rule.`] };
  }

  // Validate connectivity: must connect to a road (except in setup phase)
  const isSetup = state.phase === 'SETUP_1' || state.phase === 'SETUP_2';
  if (!isSetup) {
    // Check player has a connected road
    const hasConnectedRoad = vertex.adjacentEdges.some(eId => state.roads[eId] === player.id);
    if (!hasConnectedRoad) {
      return { ...state, log: [...state.log, `❌ Settlements must connect to at least one of your roads.`] };
    }

    // Check resource costs
    if (player.resources.WOOD < 1 || player.resources.BRICK < 1 || player.resources.SHEEP < 1 || player.resources.WHEAT < 1) {
      return { ...state, log: [...state.log, `❌ Insufficient resources to build a settlement.`] };
    }
  }

  // Deduct resources if not setup
  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    if (isSetup) return p;
    return {
      ...p,
      resources: {
        WOOD: p.resources.WOOD - 1,
        BRICK: p.resources.BRICK - 1,
        SHEEP: p.resources.SHEEP - 1,
        WHEAT: p.resources.WHEAT - 1,
        ORE: p.resources.ORE
      }
    };
  });

  const nextSettlements = {
    ...state.settlements,
    [vertexId]: { playerId: player.id, type: 'settlement' as const }
  };

  let nextLogs = [...state.log, `🏠 ${player.name} built a settlement.`];

  // Award starting resources on SETUP_2
  if (state.phase === 'SETUP_2') {
    const startResources: string[] = [];
    vertex.adjacentHexes.forEach(hexIdx => {
      const hex = state.hexes[hexIdx];
      const res = getTerrainResource(hex.terrain);
      if (res) {
        const pState = nextPlayers.find(p => p.id === player.id)!;
        pState.resources[res]++;
        startResources.push(res);
      }
    });
    if (startResources.length > 0) {
      nextLogs.push(`📦 Starting resources for ${player.name}: ${startResources.join(', ')}`);
    }
  }

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    settlements: nextSettlements,
    log: nextLogs
  };

  updated = recalculateVPs(updated);
  return updated;
}

// Build Road
export function placeRoad(state: CatanState, edgeId: number): CatanState {
  const player = state.players[state.currentPlayerIndex];
  const layout = getBoardLayout();

  // Validate edge is empty
  if (state.roads[edgeId]) return state;

  // Validate connectivity: road must connect to player's road, settlement, or city
  const edge = layout.edges[edgeId];
  const connectsToBuilding = edge.vertices.some(vId => state.settlements[vId]?.playerId === player.id);
  const connectsToRoad = edge.adjacentEdges.some(eId => state.roads[eId] === player.id);

  if (!connectsToBuilding && !connectsToRoad) {
    return { ...state, log: [...state.log, `❌ Roads must connect to your existing roads or settlements.`] };
  }

  const isSetup = state.phase === 'SETUP_1' || state.phase === 'SETUP_2';
  if (!isSetup) {
    // Check cost
    if (player.resources.WOOD < 1 || player.resources.BRICK < 1) {
      return { ...state, log: [...state.log, `❌ Insufficient resources to build a road.`] };
    }
  }

  // Deduct resources
  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    if (isSetup) return p;
    return {
      ...p,
      resources: {
        ...p.resources,
        WOOD: p.resources.WOOD - 1,
        BRICK: p.resources.BRICK - 1
      }
    };
  });

  const nextRoads = {
    ...state.roads,
    [edgeId]: player.id
  };

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    roads: nextRoads,
    log: [...state.log, `🛣️ ${player.name} built a road.`]
  };

  // Turn transitions for setup phases
  if (isSetup) {
    updated = advanceSetupPhase(updated);
  }

  updated = recalculateLongestRoad(updated);
  updated = recalculateVPs(updated);
  return updated;
}

// Upgrade settlement to city
export function upgradeToCity(state: CatanState, vertexId: number): CatanState {
  if (state.phase !== 'MAIN') return state;

  const player = state.players[state.currentPlayerIndex];
  const building = state.settlements[vertexId];

  if (!building || building.playerId !== player.id || building.type !== 'settlement') {
    return { ...state, log: [...state.log, `❌ You must own a settlement at this spot to upgrade to a city.`] };
  }

  if (player.resources.ORE < 3 || player.resources.WHEAT < 2) {
    return { ...state, log: [...state.log, `❌ Insufficient resources to upgrade to a city.`] };
  }

  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      resources: {
        ...p.resources,
        ORE: p.resources.ORE - 3,
        WHEAT: p.resources.WHEAT - 2
      }
    };
  });

  const nextSettlements = {
    ...state.settlements,
    [vertexId]: { playerId: player.id, type: 'city' as const }
  };

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    settlements: nextSettlements,
    log: [...state.log, `🏰 ${player.name} upgraded a settlement to a City.`]
  };

  updated = recalculateVPs(updated);
  return updated;
}

// Buy Dev Card
export function buyDevCard(state: CatanState): CatanState {
  if (state.phase !== 'MAIN') return state;
  if (state.devCardDeck.length === 0) {
    return { ...state, log: [...state.log, `❌ Development card deck is empty.`] };
  }

  const player = state.players[state.currentPlayerIndex];
  if (player.resources.ORE < 1 || player.resources.WHEAT < 1 || player.resources.SHEEP < 1) {
    return { ...state, log: [...state.log, `❌ Insufficient resources to buy a Development Card.`] };
  }

  const nextDeck = [...state.devCardDeck];
  const card = nextDeck.pop()!;

  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      resources: {
        ...p.resources,
        ORE: p.resources.ORE - 1,
        WHEAT: p.resources.WHEAT - 1,
        SHEEP: p.resources.SHEEP - 1
      },
      devCards: {
        ...p.devCards,
        [card]: p.devCards[card] + 1
      }
    };
  });

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    devCardDeck: nextDeck,
    log: [...state.log, `🃏 ${player.name} purchased a Development Card.`]
  };

  updated = recalculateVPs(updated);
  return updated;
}

// Play Dev Card actions
export function playKnight(state: CatanState, targetHexIndex: number, stealPlayerId: string | null): CatanState {
  if (state.phase !== 'MAIN' || state.playedDevCardThisTurn) return state;

  const player = state.players[state.currentPlayerIndex];
  if (player.devCards.KNIGHT <= 0) return state;

  // Deduct Knight
  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      playedKnights: p.playedKnights + 1,
      devCards: {
        ...p.devCards,
        KNIGHT: p.devCards.KNIGHT - 1
      }
    };
  });

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    playedDevCardThisTurn: true,
    log: [...state.log, `⚔️ ${player.name} played a Knight card!`]
  };

  // Move Robber
  updated = executeRobberMove(updated, targetHexIndex);

  let targetId = stealPlayerId;
  if (!targetId && player.isBot && updated.robberStealOptions.length > 0) {
    // Steal from opponent with most cards
    let maxCards = -1;
    updated.robberStealOptions.forEach(id => {
      const opp = updated.players.find(x => x.id === id)!;
      const count = opp.resources.WOOD + opp.resources.BRICK + opp.resources.SHEEP + opp.resources.WHEAT + opp.resources.ORE;
      if (count > maxCards) {
        maxCards = count;
        targetId = id;
      }
    });
  }

  if (targetId) {
    updated = executeSteal(updated, targetId);
  }

  updated = recalculateLargestArmy(updated);
  updated = recalculateVPs(updated);
  return updated;
}

export function playRoadBuilding(state: CatanState, edge1: number, edge2: number): CatanState {
  if (state.phase !== 'MAIN' || state.playedDevCardThisTurn) return state;

  const player = state.players[state.currentPlayerIndex];
  if (player.devCards.ROAD_BUILDING <= 0) return state;

  // Validate roads can be placed
  const layout = getBoardLayout();
  const valid1 = !state.roads[edge1];
  const valid2 = !state.roads[edge2];

  if (!valid1 && !valid2) {
    return { ...state, log: [...state.log, `❌ Cannot build roads: selection is occupied.`] };
  }

  // Place roads for free
  const nextRoads = { ...state.roads };
  if (valid1) nextRoads[edge1] = player.id;
  if (valid2) nextRoads[edge2] = player.id;

  // Deduct card
  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      devCards: {
        ...p.devCards,
        ROAD_BUILDING: p.devCards.ROAD_BUILDING - 1
      }
    };
  });

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    roads: nextRoads,
    playedDevCardThisTurn: true,
    log: [...state.log, `🃏 ${player.name} played Road Building card.`]
  };

  updated = recalculateLongestRoad(updated);
  updated = recalculateVPs(updated);
  return updated;
}

export function playYearOfPlenty(state: CatanState, r1: ResourceType, r2: ResourceType): CatanState {
  if (state.phase !== 'MAIN' || state.playedDevCardThisTurn) return state;

  const player = state.players[state.currentPlayerIndex];
  if (player.devCards.YEAR_OF_PLENTY <= 0) return state;

  // Award resource choices
  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    const nextRes = { ...p.resources };
    nextRes[r1]++;
    nextRes[r2]++;
    return {
      ...p,
      resources: nextRes,
      devCards: {
        ...p.devCards,
        YEAR_OF_PLENTY: p.devCards.YEAR_OF_PLENTY - 1
      }
    };
  });

  return {
    ...state,
    players: nextPlayers,
    playedDevCardThisTurn: true,
    log: [...state.log, `🃏 ${player.name} played Year of Plenty (received ${r1} and ${r2}).`]
  };
}

export function playMonopoly(state: CatanState, resource: ResourceType): CatanState {
  if (state.phase !== 'MAIN' || state.playedDevCardThisTurn) return state;

  const activePlayer = state.players[state.currentPlayerIndex];
  if (activePlayer.devCards.MONOPOLY <= 0) return state;

  let totalStolen = 0;

  const nextPlayers = state.players.map(p => {
    if (p.id === activePlayer.id) return p; // Will update after
    const amt = p.resources[resource];
    totalStolen += amt;
    return {
      ...p,
      resources: {
        ...p.resources,
        [resource]: 0
      }
    };
  });

  // Award to active player
  const finalPlayers = nextPlayers.map(p => {
    if (p.id !== activePlayer.id) return p;
    return {
      ...p,
      resources: {
        ...p.resources,
        [resource]: p.resources[resource] + totalStolen
      },
      devCards: {
        ...p.devCards,
        MONOPOLY: p.devCards.MONOPOLY - 1
      }
    };
  });

  return {
    ...state,
    players: finalPlayers,
    playedDevCardThisTurn: true,
    log: [...state.log, `🃏 ${activePlayer.name} played Embargo on ${resource}! Stole ${totalStolen} cards from opponents.`]
  };
}

// Robber Move
export function moveRobber(state: CatanState, hexIndex: number): CatanState {
  if (state.phase !== 'ROBBER_MOVE') return state;
  return executeRobberMove(state, hexIndex);
}

function executeRobberMove(state: CatanState, hexIndex: number): CatanState {
  const layout = getBoardLayout();
  const player = state.players[state.currentPlayerIndex];

  if (state.hexes[hexIndex].terrain === 'DESERT' && state.hexes[hexIndex].hasRobber) return state; // Can't select same desert spot
  if (state.robberHexIndex === hexIndex) {
    return { ...state, log: [...state.log, `❌ You must place the Robber on a different hex.`] };
  }

  const nextHexes = state.hexes.map((h, i) => ({
    ...h,
    hasRobber: i === hexIndex
  }));

  // Identify players adjacent to new robber hex that we can steal from
  const hex = layout.hexes[hexIndex];
  const stealOptionsSet = new Set<string>();

  hex.vertices.forEach(vId => {
    const settlement = state.settlements[vId];
    if (settlement && settlement.playerId !== player.id) {
      // Opponent exists! Verify they have cards to steal
      const opp = state.players.find(p => p.id === settlement.playerId)!;
      const sum = opp.resources.WOOD + opp.resources.BRICK + opp.resources.SHEEP + opp.resources.WHEAT + opp.resources.ORE;
      if (sum > 0) {
        stealOptionsSet.add(opp.id);
      }
    }
  });

  const stealOptions = Array.from(stealOptionsSet);

  let updated: CatanState = {
    ...state,
    hexes: nextHexes,
    robberHexIndex: hexIndex,
    robberStealOptions: stealOptions,
    log: [...state.log, `🕵️ ${player.name} moved the Robber to hex ${hexIndex}.`]
  };

  if (stealOptions.length === 0) {
    updated.phase = 'MAIN';
    updated.log.push(`🕵️ No opponents to steal from on hex ${hexIndex}. Transitioning to Main phase.`);
  } else {
    // Wait for active player to select target to steal from
    // (If playing single-player or bots, the interface handles auto-triggering the choice)
  }

  return updated;
}

// Steal Resource card
export function stealResource(state: CatanState, targetPlayerId: string): CatanState {
  if (state.robberStealOptions.length === 0) return state;
  return executeSteal(state, targetPlayerId);
}

function executeSteal(state: CatanState, targetPlayerId: string): CatanState {
  const activePlayer = state.players[state.currentPlayerIndex];
  const target = state.players.find(p => p.id === targetPlayerId)!;

  const totalCards = target.resources.WOOD + target.resources.BRICK + target.resources.SHEEP + target.resources.WHEAT + target.resources.ORE;
  if (totalCards === 0) {
    return {
      ...state,
      phase: 'MAIN',
      robberStealOptions: [],
      log: [...state.log, `📦 Steal failed: ${target.name} has no resources.`]
    };
  }

  // Draw 1 random card
  const cardsPool: ResourceType[] = [];
  RESOURCES.forEach(r => {
    for (let i = 0; i < target.resources[r]; i++) {
      cardsPool.push(r);
    }
  });

  const stolenRes = cardsPool[Math.floor(Math.random() * cardsPool.length)];

  const nextPlayers = state.players.map(p => {
    if (p.id === activePlayer.id) {
      return {
        ...p,
        resources: {
          ...p.resources,
          [stolenRes]: p.resources[stolenRes] + 1
        }
      };
    }
    if (p.id === target.id) {
      return {
        ...p,
        resources: {
          ...p.resources,
          [stolenRes]: p.resources[stolenRes] - 1
        }
      };
    }
    return p;
  });

  return {
    ...state,
    players: nextPlayers,
    phase: 'MAIN',
    robberStealOptions: [],
    log: [...state.log, `🕵️ ${activePlayer.name} stole a card from ${target.name}.`]
  };
}

// Discard excess cards when 7 is rolled
export function discardCards(state: CatanState, playerId: string, discards: ResourceMap): CatanState {
  if (state.phase !== 'ROBBER_DISCARD') return state;

  const player = state.players.find(p => p.id === playerId)!;
  const targetCount = state.discardCount[playerId] || 0;

  const count = discards.WOOD + discards.BRICK + discards.SHEEP + discards.WHEAT + discards.ORE;
  if (count !== targetCount) {
    return { ...state, log: [...state.log, `❌ Discard error: must discard exactly ${targetCount} cards.`] };
  }

  const nextPlayers = state.players.map(p => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      resources: {
        WOOD: p.resources.WOOD - discards.WOOD,
        BRICK: p.resources.BRICK - discards.BRICK,
        SHEEP: p.resources.SHEEP - discards.SHEEP,
        WHEAT: p.resources.WHEAT - discards.WHEAT,
        ORE: p.resources.ORE - discards.ORE
      }
    };
  });

  const nextRequired = state.discardRequiredPlayers.filter(id => id !== playerId);

  let updated: CatanState = {
    ...state,
    players: nextPlayers,
    discardRequiredPlayers: nextRequired,
    log: [...state.log, `🚮 ${player.name} discarded ${count} cards.`]
  };

  if (nextRequired.length === 0) {
    updated.phase = 'ROBBER_MOVE';
    updated.log.push(`👉 Discards complete. ${state.players[state.currentPlayerIndex].name} must move the Robber.`);
  }

  return updated;
}

// Domestic Trade Proposals
export function proposeTrade(state: CatanState, receiverId: string, offer: ResourceMap, request: ResourceMap): CatanState {
  if (state.phase !== 'MAIN') return state;

  const senderId = state.players[state.currentPlayerIndex].id;
  const tradeOffer: CatanTradeOffer = {
    senderId,
    receiverId,
    senderOffer: offer,
    receiverOffer: request,
    active: true
  };

  return {
    ...state,
    tradeOffer,
    log: [...state.log, `🤝 ${getPlayerName(state, senderId)} proposed a trade to ${getPlayerName(state, receiverId)}.`].slice(-100)
  };
}

export function acceptTrade(state: CatanState): CatanState {
  const offer = state.tradeOffer;
  if (!offer || !offer.active) return state;

  const sender = state.players.find(p => p.id === offer.senderId)!;
  const receiver = state.players.find(p => p.id === offer.receiverId)!;

  // Validate resources
  const senderValid = RESOURCES.every(r => sender.resources[r] >= offer.senderOffer[r]);
  const receiverValid = RESOURCES.every(r => receiver.resources[r] >= offer.receiverOffer[r]);

  if (!senderValid || !receiverValid) {
    return {
      ...state,
      tradeOffer: null,
      log: [...state.log, `❌ Trade failed: players have insufficient resources.`]
    };
  }

  // Swap resources
  const nextPlayers = state.players.map(p => {
    if (p.id === sender.id) {
      return {
        ...p,
        resources: {
          WOOD: p.resources.WOOD - offer.senderOffer.WOOD + offer.receiverOffer.WOOD,
          BRICK: p.resources.BRICK - offer.senderOffer.BRICK + offer.receiverOffer.BRICK,
          SHEEP: p.resources.SHEEP - offer.senderOffer.SHEEP + offer.receiverOffer.SHEEP,
          WHEAT: p.resources.WHEAT - offer.senderOffer.WHEAT + offer.receiverOffer.WHEAT,
          ORE: p.resources.ORE - offer.senderOffer.ORE + offer.receiverOffer.ORE
        }
      };
    }
    if (p.id === receiver.id) {
      return {
        ...p,
        resources: {
          WOOD: p.resources.WOOD - offer.receiverOffer.WOOD + offer.senderOffer.WOOD,
          BRICK: p.resources.BRICK - offer.receiverOffer.BRICK + offer.senderOffer.BRICK,
          SHEEP: p.resources.SHEEP - offer.receiverOffer.SHEEP + offer.senderOffer.SHEEP,
          WHEAT: p.resources.WHEAT - offer.receiverOffer.WHEAT + offer.senderOffer.WHEAT,
          ORE: p.resources.ORE - offer.receiverOffer.ORE + offer.senderOffer.ORE
        }
      };
    }
    return p;
  });

  return {
    ...state,
    players: nextPlayers,
    tradeOffer: null,
    log: [...state.log, `🤝 Trade deal accepted between ${sender.name} and ${receiver.name}!`]
  };
}

export function rejectTrade(state: CatanState): CatanState {
  const offer = state.tradeOffer;
  if (!offer) return state;

  return {
    ...state,
    tradeOffer: null,
    log: [...state.log, `🤝 Trade proposed by ${getPlayerName(state, offer.senderId)} was declined.`].slice(-100)
  };
}

// Maritime trade with Bank (detect harbor discounts)
export function maritimeTrade(state: CatanState, give: ResourceType, get: ResourceType): CatanState {
  if (state.phase !== 'MAIN') return state;

  const player = state.players[state.currentPlayerIndex];
  const layout = getBoardLayout();

  // Find best trade rate for player: default is 4:1
  let rate = 4;

  // Scan harbors to see if player has settlements on them
  layout.harbors.forEach(h => {
    const isAdjacentOccupiedByMe = h.vertices.some(vId => state.settlements[vId]?.playerId === player.id);
    if (isAdjacentOccupiedByMe) {
      if (h.resource === give) {
        rate = Math.min(rate, 2); // 2:1 specific harbor
      } else if (h.resource === 'GENERIC') {
        rate = Math.min(rate, 3); // 3:1 generic harbor
      }
    }
  });

  if (player.resources[give] < rate) {
    return { ...state, log: [...state.log, `❌ Cannot perform maritime trade: need ${rate} ${give} for 1 ${get}.`] };
  }

  const nextPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      resources: {
        ...p.resources,
        [give]: p.resources[give] - rate,
        [get]: p.resources[get] + 1
      }
    };
  });

  return {
    ...state,
    players: nextPlayers,
    log: [...state.log, `🏦 ${player.name} traded ${rate} ${give} for 1 ${get} with the Bank.`]
  };
}

// End Turn. A finished game is frozen — allowing endTurn after GAME_OVER used
// to flip the phase back to ROLL (the bot turn loop always ends with endTurn),
// which buried the winner screen and soft-locked the table.
export function endTurn(state: CatanState): CatanState {
  if (state.phase !== 'MAIN' || state.winnerId) return state;

  // Move to next active player
  let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;

  const nextPlayer = state.players[nextIdx];

  return {
    ...state,
    currentPlayerIndex: nextIdx,
    phase: 'ROLL',
    playedDevCardThisTurn: false,
    log: [...state.log, `👉 It is now ${nextPlayer.name}'s turn.`].slice(-100)
  };
}

// Advance setup phase turn ordering (1-2-3-4 then 4-3-2-1)
function advanceSetupPhase(state: CatanState): CatanState {
  const len = state.players.length;
  let nextIdx = state.currentPlayerIndex;
  let nextPhase = state.phase;

  if (state.phase === 'SETUP_1') {
    if (state.currentPlayerIndex === len - 1) {
      nextPhase = 'SETUP_2';
      // setup_2 goes in reverse order: starts with last player
    } else {
      nextIdx = state.currentPlayerIndex + 1;
    }
  } else if (state.phase === 'SETUP_2') {
    if (state.currentPlayerIndex === 0) {
      nextPhase = 'ROLL';
    } else {
      nextIdx = state.currentPlayerIndex - 1;
    }
  }

  const player = state.players[nextIdx];

  return {
    ...state,
    currentPlayerIndex: nextIdx,
    phase: nextPhase,
    log: [...state.log, `👉 Setup placement turn for ${player.name}.`]
  };
}

// -------------------------------------------------------------
// Score calculations, Longest Road & Largest Army
// -------------------------------------------------------------

function recalculateVPs(state: CatanState): CatanState {
  let winnerId: string | null = null;
  let nextPhase = state.phase;

  const nextPlayers = state.players.map(p => {
    let vp = 0;

    // 1 VP per settlement, 2 VPs per City
    Object.values(state.settlements).forEach(s => {
      if (s.playerId === p.id) {
        vp += s.type === 'city' ? 2 : 1;
      }
    });

    // Dev card VPs
    vp += p.devCards.VICTORY_POINT;

    // Longest Road card (+2 VPs)
    if (p.longestRoadActive) vp += 2;

    // Largest Army card (+2 VPs)
    if (p.largestArmyActive) vp += 2;

    if (vp >= 10 && nextPhase !== 'GAME_OVER') {
      winnerId = p.id;
      nextPhase = 'GAME_OVER';
    }

    return {
      ...p,
      victoryPoints: vp
    };
  });

  const logs = [...state.log];
  if (winnerId) {
    const winnerName = nextPlayers.find(p => p.id === winnerId)!.name;
    logs.push(`🏆 GAME OVER! ${winnerName} won Hexland by reaching ${nextPlayers.find(p => p.id === winnerId)!.victoryPoints} Victory Points!`);
  }

  return {
    ...state,
    players: nextPlayers,
    phase: nextPhase,
    winnerId,
    log: logs
  };
}

function recalculateLargestArmy(state: CatanState): CatanState {
  let highestKnights = Math.max(2, ...state.players.map(p => p.playedKnights));
  if (highestKnights < 3) return state; // Needs at least 3 played knights

  let currentArmyHolder = state.players.find(p => p.largestArmyActive);

  // If a player has STRICTLY more knights than the current holder, they take the card
  let armyWinnerId = '';
  state.players.forEach(p => {
    if (p.playedKnights > (currentArmyHolder ? currentArmyHolder.playedKnights : 2)) {
      armyWinnerId = p.id;
    }
  });

  if (!armyWinnerId) return state;

  const nextPlayers = state.players.map(p => ({
    ...p,
    largestArmyActive: p.id === armyWinnerId
  }));

  const winner = nextPlayers.find(p => p.id === armyWinnerId)!;
  return {
    ...state,
    players: nextPlayers,
    log: [...state.log, `⚔️ ${winner.name} claimed the Largest Army card (+2 VPs) with ${winner.playedKnights} Knight cards played.`]
  };
}

// Calculate the longest road for all players and award the card
function recalculateLongestRoad(state: CatanState): CatanState {
  const nextPlayers = state.players.map(p => {
    const roadLen = calculatePlayerRoadLength(state, p.id);
    return {
      ...p,
      longestRoad: roadLen
    };
  });

  let highestRoad = Math.max(4, ...nextPlayers.map(p => p.longestRoad));
  if (highestRoad < 5) return { ...state, players: nextPlayers }; // Must be at least 5 segments

  let currentRoadHolder = nextPlayers.find(p => p.longestRoadActive);

  let roadWinnerId = '';
  nextPlayers.forEach(p => {
    if (p.longestRoad > (currentRoadHolder ? currentRoadHolder.longestRoad : 4)) {
      roadWinnerId = p.id;
    }
  });

  if (!roadWinnerId) return { ...state, players: nextPlayers };

  const finalPlayers = nextPlayers.map(p => ({
    ...p,
    longestRoadActive: p.id === roadWinnerId
  }));

  const winner = finalPlayers.find(p => p.id === roadWinnerId)!;
  return {
    ...state,
    players: finalPlayers,
    log: [...state.log, `🛣️ ${winner.name} claimed the Longest Road card (+2 VPs) with a continuous path of ${winner.longestRoad} road segments.`]
  };
}

function calculatePlayerRoadLength(state: CatanState, playerId: string): number {
  const layout = getBoardLayout();
  const playerRoadIds = Object.entries(state.roads)
    .filter(([, id]) => id === playerId)
    .map(([eId]) => parseInt(eId));

  if (playerRoadIds.length === 0) return 0;

  // Build local adjacency list of nodes connected by player's roads
  const nodeConnections = new Map<number, number[]>();
  playerRoadIds.forEach(eId => {
    const edge = layout.edges[eId];
    if (!nodeConnections.has(edge.vertices[0])) nodeConnections.set(edge.vertices[0], []);
    if (!nodeConnections.has(edge.vertices[1])) nodeConnections.set(edge.vertices[1], []);
    
    nodeConnections.get(edge.vertices[0])!.push(edge.vertices[1]);
    nodeConnections.get(edge.vertices[1])!.push(edge.vertices[0]);
  });

  let maxLen = 0;

  // DFS solver to find longest continuous path of roads (no edge reused)
  function dfs(currNode: number, visitedEdges: Set<string>): number {
    // If node is blocked by opponent building, road segment terminates here
    const building = state.settlements[currNode];
    if (building && building.playerId !== playerId) {
      return 0;
    }

    const neighbors = nodeConnections.get(currNode) || [];
    let longestBranch = 0;

    neighbors.forEach(neigh => {
      // Sort vertex pair to form unique edge representation
      const vMin = Math.min(currNode, neigh);
      const vMax = Math.max(currNode, neigh);
      const edgeKey = `${vMin}-${vMax}`;

      if (!visitedEdges.has(edgeKey)) {
        visitedEdges.add(edgeKey);
        const len = 1 + dfs(neigh, visitedEdges);
        longestBranch = Math.max(longestBranch, len);
        visitedEdges.delete(edgeKey);
      }
    });

    return longestBranch;
  }

  // Run DFS starting at every node in the player's road system
  Array.from(nodeConnections.keys()).forEach(node => {
    const visited = new Set<string>();
    const len = dfs(node, visited);
    maxLen = Math.max(maxLen, len);
  });

  return maxLen;
}

// -------------------------------------------------------------
// AI Bot Turn Decision logic
// -------------------------------------------------------------

export function playBotTurn(state: CatanState): CatanState {
  if (state.phase === 'GAME_OVER') return state;

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !activePlayer.isBot) return state;

  let current = state;

  // 1. SETUP PLACEMENTS
  if (current.phase === 'SETUP_1' || current.phase === 'SETUP_2') {
    const layout = getBoardLayout();
    
    // Find highest producing valid vertex
    let bestVertex = -1;
    let bestScore = -9999;

    layout.vertices.forEach(v => {
      // Must not be occupied and respect distance rule
      if (current.settlements[v.id]) return;
      const distBlocked = v.adjacentVertices.some(adj => current.settlements[adj]);
      if (distBlocked) return;

      // Score vertex based on adjacent number token yields
      let yieldScore = 0;
      v.adjacentHexes.forEach(hexIdx => {
        const hex = current.hexes[hexIdx];
        if (hex.terrain !== 'DESERT') {
          // Token yield weight (6 - abs(7 - roll))
          yieldScore += 6 - Math.abs(7 - hex.numberToken);
        }
      });

      if (yieldScore > bestScore) {
        bestScore = yieldScore;
        bestVertex = v.id;
      }
    });

    if (bestVertex !== -1) {
      current = placeSettlement(current, bestVertex);

      // Now place an adjacent road
      const vertex = layout.vertices[bestVertex];
      const roadTarget = vertex.adjacentEdges.find(eId => !current.roads[eId]);
      if (roadTarget !== undefined) {
        current = placeRoad(current, roadTarget);
      }
    }
    return current;
  }

  // 2. DISCARD CARDS
  if (current.phase === 'ROBBER_DISCARD') {
    // Process discard for all bots that need to discard
    let updated = current;
    current.discardRequiredPlayers.forEach(id => {
      const p = updated.players.find(x => x.id === id)!;
      if (p.isBot) {
        const target = updated.discardCount[id] || 0;
        const discards: ResourceMap = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
        
        let discardedCount = 0;
        const pool: ResourceType[] = [];
        RESOURCES.forEach(r => {
          for (let i = 0; i < p.resources[r]; i++) {
            pool.push(r);
          }
        });
        
        // Randomly select cards from bot hand
        for (let i = 0; i < target; i++) {
          if (pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            const res = pool.splice(idx, 1)[0];
            discards[res]++;
          }
        }
        updated = discardCards(updated, id, discards);
      }
    });
    return updated;
  }

  // 3. MOVE ROBBER
  if (current.phase === 'ROBBER_MOVE') {
    const layout = getBoardLayout();
    
    // Choose a hex containing opponent buildings and not desert
    let bestHex = -1;
    let maxOppBuildings = -1;

    current.hexes.forEach((hex, i) => {
      if (hex.terrain === 'DESERT' || hex.hasRobber) return;

      let oppBuildCount = 0;
      let botBuildCount = 0;

      const hexLayout = layout.hexes[i];
      hexLayout.vertices.forEach(vId => {
        const b = current.settlements[vId];
        if (b) {
          if (b.playerId === activePlayer.id) botBuildCount++;
          else oppBuildCount++;
        }
      });

      // Avoid placing on bot's own yielding hexes
      if (botBuildCount === 0 && oppBuildCount > maxOppBuildings) {
        maxOppBuildings = oppBuildCount;
        bestHex = i;
      }
    });

    if (bestHex === -1) {
      // Fallback to any non-desert hex without active bot buildings
      bestHex = current.hexes.findIndex(hex => !hex.hasRobber && hex.terrain !== 'DESERT');
    }

    current = executeRobberMove(current, bestHex);

    // Auto-steal if options exist
    if (current.robberStealOptions.length > 0) {
      // Steal from opponent with most cards
      let targetId = current.robberStealOptions[0];
      let maxCards = -1;
      current.robberStealOptions.forEach(id => {
        const opp = current.players.find(x => x.id === id)!;
        const count = opp.resources.WOOD + opp.resources.BRICK + opp.resources.SHEEP + opp.resources.WHEAT + opp.resources.ORE;
        if (count > maxCards) {
          maxCards = count;
          targetId = id;
        }
      });
      current = executeSteal(current, targetId);
    }
    return current;
  }

  // 4. ROLL DICE
  if (current.phase === 'ROLL') {
    current = rollDice(current);
    // If 7 was rolled, phase changes to ROBBER_DISCARD/ROBBER_MOVE, return and handle on next loop
    if (current.phase !== 'MAIN') return current;
  }

  // 5. MAIN PHASE DECISIONS
  if (current.phase === 'MAIN') {
    let loop = true;
    let limit = 0; // prevent infinite loops

    while (loop && limit < 10) {
      limit++;
      loop = false;
      const bot = current.players[current.currentPlayerIndex];

      // 1. Play Dev Cards if has Knight and Robber blocks one of our hexes
      if (bot.devCards.KNIGHT > 0 && !current.playedDevCardThisTurn) {
        const blocksMyHex = blocksMyHighYieldHex(current, bot.id);
        if (blocksMyHex) {
          // Play Knight, move robber to highest ranked opponent hex
          const layout = getBoardLayout();
          let targetHex = -1;
          let maxOpp = -1;
          current.hexes.forEach((hex, idx) => {
            if (hex.terrain === 'DESERT' || idx === current.robberHexIndex) return;
            let oppCount = 0;
            let botCount = 0;
            layout.hexes[idx].vertices.forEach(vId => {
              const b = current.settlements[vId];
              if (b) {
                if (b.playerId === bot.id) botCount++;
                else oppCount++;
              }
            });
            if (botCount === 0 && oppCount > maxOpp) {
              maxOpp = oppCount;
              targetHex = idx;
            }
          });
          if (targetHex !== -1) {
            current = playKnight(current, targetHex, null);
            loop = true;
            continue;
          }
        }
      }

      // 2. Can build city? (Upgrade settlement)
      if (bot.resources.ORE >= 3 && bot.resources.WHEAT >= 2) {
        const upgradeVertex = Object.keys(current.settlements).find(vId => {
          const s = current.settlements[parseInt(vId)];
          return s.playerId === bot.id && s.type === 'settlement';
        });
        if (upgradeVertex !== undefined) {
          current = upgradeToCity(current, parseInt(upgradeVertex));
          loop = true;
          continue;
        }
      }

      // 3. Can build settlement? (Needs 1 Wood, 1 Brick, 1 Sheep, 1 Wheat)
      if (bot.resources.WOOD >= 1 && bot.resources.BRICK >= 1 && bot.resources.SHEEP >= 1 && bot.resources.WHEAT >= 1) {
        const buildVertex = findBestEmptySettlementSpot(current, bot.id);
        if (buildVertex !== -1) {
          current = placeSettlement(current, buildVertex);
          loop = true;
          continue;
        }
      }

      // 4. Can build road? (Needs 1 Wood, 1 Brick)
      if (bot.resources.WOOD >= 1 && bot.resources.BRICK >= 1) {
        // Find best edge connected to our roads extending toward empty vertices
        const buildEdge = findBestRoadExtension(current, bot.id);
        if (buildEdge !== -1) {
          current = placeRoad(current, buildEdge);
          loop = true;
          continue;
        }
      }

      // 5. Can buy Dev Card? (1 Ore, 1 Wheat, 1 Sheep)
      if (bot.resources.ORE >= 1 && bot.resources.WHEAT >= 1 && bot.resources.SHEEP >= 1 && current.devCardDeck.length > 0) {
        // Buy only if we can't afford a city or settlement
        current = buyDevCard(current);
        loop = true;
        continue;
      }

      // 6. Maritime trade with bank to gain missing building materials
      const tradeAction = checkMaritimeTradeStrategy(current, bot);
      if (tradeAction) {
        current = maritimeTrade(current, tradeAction.give, tradeAction.get);
        loop = true;
        continue;
      }
    }

    // End turn
    current = endTurn(current);
  }

  return current;
}

// Check if robber blocks a high yield hex belonging to player
function blocksMyHighYieldHex(state: CatanState, playerId: string): boolean {
  const robberIdx = state.robberHexIndex;
  const hex = state.hexes[robberIdx];
  if (hex.numberToken <= 4 || hex.numberToken >= 10) return false; // Not high yield

  const layout = getBoardLayout();
  const adjacentVertices = layout.hexes[robberIdx].vertices;
  return adjacentVertices.some(vId => state.settlements[vId]?.playerId === playerId);
}

// Find best empty settlement vertex connected to P's road network
function findBestEmptySettlementSpot(state: CatanState, playerId: string): number {
  const layout = getBoardLayout();
  let bestSpot = -1;
  let bestScore = -9999;

  layout.vertices.forEach(v => {
    if (state.settlements[v.id]) return;
    
    // Distance rule
    const blocked = v.adjacentVertices.some(adj => state.settlements[adj]);
    if (blocked) return;

    // Connectivity: must touch player's road
    const connected = v.adjacentEdges.some(eId => state.roads[eId] === playerId);
    if (!connected) return;

    let score = 0;
    v.adjacentHexes.forEach(hexIdx => {
      const hex = state.hexes[hexIdx];
      if (hex.terrain !== 'DESERT' && !hex.hasRobber) {
        score += 6 - Math.abs(7 - hex.numberToken);
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestSpot = v.id;
    }
  });

  return bestSpot;
}

// Find best road edge adjacent to P's roads extending to open space
function findBestRoadExtension(state: CatanState, playerId: string): number {
  const layout = getBoardLayout();
  let bestEdge = -1;
  let bestScore = -9999;

  layout.edges.forEach(e => {
    if (state.roads[e.id]) return;

    // Must connect to player's road or settlement
    const connectedBuilding = e.vertices.some(vId => state.settlements[vId]?.playerId === playerId);
    const connectedRoad = e.adjacentEdges.some(adj => state.roads[adj] === playerId);

    if (!connectedBuilding && !connectedRoad) return;

    // Score based on nearby empty vertices
    let score = 0;
    e.vertices.forEach(vId => {
      const v = layout.vertices[vId];
      if (!state.settlements[vId]) {
        // Count surrounding number token weights
        v.adjacentHexes.forEach(hexIdx => {
          const hex = state.hexes[hexIdx];
          if (hex.terrain !== 'DESERT') {
            score += 6 - Math.abs(7 - hex.numberToken);
          }
        });
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestEdge = e.id;
    }
  });

  return bestEdge;
}

// Simple bot bank trading analysis
function checkMaritimeTradeStrategy(state: CatanState, bot: CatanPlayer): { give: ResourceType; get: ResourceType } | null {
  // Check if we have excess resources (> 4 of one type) and need another
  const layout = getBoardLayout();

  // Find best trade rates for each resource
  const rates: Record<ResourceType, number> = { WOOD: 4, BRICK: 4, SHEEP: 4, WHEAT: 4, ORE: 4 };
  RESOURCES.forEach(r => {
    layout.harbors.forEach(h => {
      const isAdjacentOccupied = h.vertices.some(vId => state.settlements[vId]?.playerId === bot.id);
      if (isAdjacentOccupied) {
        if (h.resource === r) rates[r] = Math.min(rates[r], 2);
        else if (h.resource === 'GENERIC') rates[r] = Math.min(rates[r], 3);
      }
    });
  });

  // Decide what we need most
  const hasRoadRes = bot.resources.WOOD >= 1 && bot.resources.BRICK >= 1;
  const hasSettlementRes = hasRoadRes && bot.resources.SHEEP >= 1 && bot.resources.WHEAT >= 1;

  let wanted: ResourceType | null = null;
  if (!hasRoadRes) {
    wanted = bot.resources.WOOD === 0 ? 'WOOD' : 'BRICK';
  } else if (!hasSettlementRes) {
    wanted = bot.resources.SHEEP === 0 ? 'SHEEP' : 'WHEAT';
  } else if (bot.resources.ORE < 3 || bot.resources.WHEAT < 2) {
    wanted = bot.resources.ORE < 3 ? 'ORE' : 'WHEAT';
  }

  if (!wanted) return null;

  // Find something we have excess of
  let donor: ResourceType | null = null;
  RESOURCES.forEach(r => {
    if (r === wanted) return;
    const rate = rates[r];
    if (bot.resources[r] >= rate + 1) { // Keep at least 1 for ourselves
      donor = r;
    }
  });

  if (donor && wanted) {
    return { give: donor, get: wanted };
  }

  return null;
}

// -------------------------------------------------------------
// Helper Routines
// -------------------------------------------------------------

function getTerrainResource(terrain: TerrainType): ResourceType | null {
  switch (terrain) {
    case 'FOREST': return 'WOOD';
    case 'HILLS': return 'BRICK';
    case 'PASTURE': return 'SHEEP';
    case 'FIELDS': return 'WHEAT';
    case 'MOUNTAINS': return 'ORE';
    default: return null;
  }
}

export function getPlayerName(state: CatanState, playerId: string): string {
  return state.players.find(p => p.id === playerId)?.name || 'Unknown';
}
