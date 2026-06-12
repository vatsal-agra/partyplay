import { Game } from '@/app/types';

export const games: Game[] = [
  {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Buy, sell, and trade properties to become the wealthiest player in this classic board game of economic strategy.',
    minPlayers: 2,
    maxPlayers: 6,
    image: '/images/monopoly thumbnail.png',
    duration: '60-180 min',
    complexity: 'Medium',
    category: ['Strategy', 'Economic']
  },
  {
    id: 'battleship',
    name: 'Battleship',
    description: 'Strategically place your fleet and take turns firing at your opponent\'s ships in this classic naval combat game.',
    minPlayers: 2,
    maxPlayers: 2,
    image: '/images/Battleship thumbnail.png',
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Strategy', 'Deduction']
  },
  {
    id: 'catan',
    name: 'Catan',
    description: 'Collect resources and build settlements in this classic strategy game of trading and development.',
    minPlayers: 3,
    maxPlayers: 4,
    image: '/images/catan thumbnail.png',
    duration: '60-120 min',
    complexity: 'Medium',
    category: ['Strategy', 'Trading']
  },
  {
    id: 'uno',
    name: 'Uno',
    description: 'Be the first to play all your cards by matching color or number in this fast-paced card game.',
    minPlayers: 2,
    maxPlayers: 10,
    image: '/images/uno final thumbnail.png',
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Card Game', 'Family']
  },
  {
    id: 'poker',
    name: 'Poker',
    description: 'Test your luck and bluffing skills in this classic card game of strategy and chance.',
    minPlayers: 2,
    maxPlayers: 10,
    image: '/images/poker thumbnail.png',
    duration: '30-120 min',
    complexity: 'Medium',
    category: ['Card Game', 'Bluffing']
  },
  {
    id: 'cluedo',
    name: 'Cluedo',
    description: 'Solve the mystery of who committed the murder, with what weapon, and in which room.',
    minPlayers: 3,
    maxPlayers: 6,
    image: '/images/cluedo thumbnail.png',
    duration: '45-60 min',
    complexity: 'Easy',
    category: ['Deduction', 'Mystery']
  },
  {
    id: 'pictionary',
    name: 'Pictionary',
    description: 'Draw clues for your team to guess in this classic drawing and guessing game.',
    minPlayers: 4,
    maxPlayers: 8,
    image: '/images/pictionary thumbnail.png',
    duration: '30-60 min',
    complexity: 'Easy',
    category: ['Party', 'Drawing']
  },
  {
    id: 'scribble-io',
    name: 'Scribble.io',
    description: 'Draw and guess drawings in this fun online multiplayer game where creativity meets competition.',
    minPlayers: 2,
    maxPlayers: 12,
    image: '/images/scribbleio thumbnail.png',
    duration: '10-30 min',
    complexity: 'Easy',
    category: ['Online', 'Drawing']
  },
  {
    id: 'codenames',
    name: 'Codenames',
    description: 'Give one-word clues to help your team identify agents while avoiding the assassin.',
    minPlayers: 4,
    maxPlayers: 8,
    image: '/images/codenames thumbnal.png',
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Party', 'Word Game']
  },
  {
    id: 'terra-mystica',
    name: 'Terra Mystica',
    description: 'Shape the land and develop your civilization in this deep strategy game.',
    minPlayers: 2,
    maxPlayers: 5,
    image: '/images/terra mystica thumbnail.png',
    duration: '60-150 min',
    complexity: 'Hard'
  },
  {
    id: '7-wonders',
    name: '7 Wonders',
    description: 'Lead an ancient civilization as it rises from its barbaric roots to become a world power.',
    minPlayers: 3,
    maxPlayers: 7,
    image: '/images/7wonders thumbnail.png',
    duration: '30 min',
    complexity: 'Medium'
  }
]
