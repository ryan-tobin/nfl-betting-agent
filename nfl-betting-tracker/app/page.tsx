'use client';

import { useState, useEffect, useCallback } from 'react';
import LiveScoreboard from './components/LiveScoreboard';
import BetSlipCard from './components/BetSlipCard';
import CreateBetModal from './components/CreateBetModal';
import { Plus } from 'lucide-react';

interface NFLGame {
  id: string;
  homeTeam: {
    name: string;
    logo: string;
    score: number;
  };
  awayTeam: {
    name: string;
    logo: string;
    score: number;
  };
  status: {
    type: string;
    detail: string;
  };
  timeSlot: string;
}

interface Bet {
  id: string;
  title: string;
  type: 'team_slate' | 'player_parlay';
  timeSlots?: string[];
  status: 'active' | 'won' | 'lost';
  requirements: BetRequirement[];
  notes?: string;
  createdAt: Date;
}

interface BetRequirement {
  id: string;
  team?: string;
  player?: string;
  stat: string;
  threshold: number;
  current: number;
  completed: boolean;
}

export default function Home() {
  const [games, setGames] = useState<NFLGame[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch NFL games
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/nfl/scoreboard');
        const data = await response.json();
        setGames(data.games || []);
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
    
    // Set up polling for live updates every 15 seconds
    const interval = setInterval(fetchGames, 15000);
    return () => clearInterval(interval);
  }, []);

  // Helper function to check team requirements
  const checkTeamRequirement = (requirement: BetRequirement, gameStats: any, game: NFLGame) => {
    const statType = requirement.stat.toLowerCase();
    let current = 0;
    
    const isHomeTeam = game.homeTeam.name === requirement.team;
    const teamKey = isHomeTeam ? 'home' : 'away';
    const teamStatsData = gameStats.teamStats?.[teamKey];
    
    if (teamStatsData) {
      switch (statType) {
        case 'rushing td':
        case 'rushing touchdown':
          current = teamStatsData.rushingTDs || 0;
          break;
        case 'field goal':
        case 'fg':
          current = teamStatsData.fieldGoals || 0;
          break;
        case 'passing td':
        case 'passing touchdown':
          current = teamStatsData.passingTDs || 0;
          break;
        default:
          current = 0;
      }
    }
    
    return { current, completed: current >= requirement.threshold };
  };

  // Helper function to check player requirements
  const checkPlayerRequirement = (requirement: BetRequirement, gameStats: any) => {
    const statType = requirement.stat.toLowerCase();
    const playerName = requirement.player;
    let current = 0;
    
    if (!playerName || !gameStats.playerStats) {
      return { current: 0, completed: false };
    }
    
    // Search through both teams' player stats
    for (const teamKey of ['home', 'away']) {
      const teamPlayerStats = gameStats.playerStats[teamKey];
      if (!teamPlayerStats) continue;
      
      let statCategory = '';
      let statIndex = 0;
      
      switch (statType) {
        case 'passing yards':
          statCategory = 'passing';
          statIndex = 1;
          break;
        case 'rushing yards':
          statCategory = 'rushing';
          statIndex = 1;
          break;
        case 'receiving yards':
          statCategory = 'receiving';
          statIndex = 1;
          break;
        case 'passing td':
          statCategory = 'passing';
          statIndex = 2;
          break;
        case 'rushing td':
          statCategory = 'rushing';
          statIndex = 2;
          break;
        case 'receiving td':
          statCategory = 'receiving';
          statIndex = 2;
          break;
      }
      
      if (statCategory && teamPlayerStats[statCategory]?.[playerName]) {
        const playerStatsArray = teamPlayerStats[statCategory][playerName];
        if (playerStatsArray && playerStatsArray[statIndex]) {
          current = parseInt(playerStatsArray[statIndex]) || 0;
          break;
        }
      }
    }
    
    return { current, completed: current >= requirement.threshold };
  };

  // Update bet requirements when games change
  const updateBetRequirements = useCallback(async () => {
    if (games.length === 0 || bets.length === 0) return;

    try {
      const updatedBets = await Promise.all(
        bets.map(async (bet) => {
          // Skip completed bets
          if (bet.status === 'won' || bet.status === 'lost') return bet;

          // Get relevant game IDs for this bet
          let gameIds: string[] = [];
          
          if (bet.type === 'team_slate' && bet.timeSlots) {
            gameIds = games
              .filter(game => bet.timeSlots!.includes(game.timeSlot))
              .map(game => game.id);
          } else {
            gameIds = games.map(game => game.id);
          }

          // Fetch stats for relevant games
          const gameStatsPromises = gameIds.map(async (gameId) => {
            try {
              const response = await fetch(`/api/nfl/game/${gameId}`);
              return response.ok ? await response.json() : null;
            } catch (error) {
              console.error(`Error fetching stats for game ${gameId}:`, error);
              return null;
            }
          });

          const allGameStats = (await Promise.all(gameStatsPromises)).filter(Boolean);

          // Update each requirement
          const updatedRequirements = bet.requirements.map(requirement => {
            let current = requirement.current;
            let completed = requirement.completed;

            if (bet.type === 'team_slate' && requirement.team) {
              // Find the game this team is playing in
              const game = games.find(g => 
                g.homeTeam.name === requirement.team || 
                g.awayTeam.name === requirement.team
              );
              
              if (game) {
                const gameStats = allGameStats.find(stats => stats.gameId === game.id);
                if (gameStats) {
                  const result = checkTeamRequirement(requirement, gameStats, game);
                  current = result.current;
                  completed = result.completed;
                }
              }
            } else if (bet.type === 'player_parlay' && requirement.player) {
              // Check all games for this player
              for (const gameStats of allGameStats) {
                const result = checkPlayerRequirement(requirement, gameStats);
                if (result.current > 0) {
                  current = result.current;
                  completed = result.completed;
                  break;
                }
              }
            }

            return {
              ...requirement,
              current,
              completed
            };
          });

          // Check if bet is won or lost
          let newStatus = bet.status;
          const allCompleted = updatedRequirements.every(req => req.completed);
          const anyFailed = updatedRequirements.some(req => {
            if (req.team) {
              const game = games.find(g => 
                g.homeTeam.name === req.team || g.awayTeam.name === req.team
              );
              return game && game.status.type.toLowerCase() === 'post' && !req.completed;
            }
            return false;
          });

          if (allCompleted) {
            newStatus = 'won';
          } else if (anyFailed) {
            newStatus = 'lost';
          }

          return {
            ...bet,
            requirements: updatedRequirements,
            status: newStatus
          };
        })
      );

      setBets(updatedBets);
    } catch (error) {
      console.error('Error updating bets:', error);
    }
  }, [games, bets, checkTeamRequirement, checkPlayerRequirement]);

  // Update bets when games change (but avoid infinite loops)
  useEffect(() => {
    if (games.length === 0 || bets.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      updateBetRequirements();
    }, 1000); // Debounce updates

    return () => clearTimeout(timeoutId);
  }, [games]); // Only depend on games, not bets to avoid infinite loops

  const addBet = (newBet: Omit<Bet, 'id' | 'createdAt'>) => {
    const bet: Bet = {
      ...newBet,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    setBets(prev => [...prev, bet]);
  };

  const removeBet = (betId: string) => {
    setBets(prev => prev.filter(bet => bet.id !== betId));
  };

  // Filter out completed bets after 30 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      setBets(prev => prev.filter(bet => {
        if (bet.status === 'won' || bet.status === 'lost') {
          const timeSinceCompletion = Date.now() - bet.createdAt.getTime();
          return timeSinceCompletion < 30000; // Keep for 30 seconds
        }
        return true;
      }));
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading NFL data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* ESPN-style header with live scores */}
      <LiveScoreboard games={games} />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">NFL Betting Tracker</h1>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            New Bet
          </button>
        </div>

        {/* Active bets */}
        <div className="overflow-x-auto">
          {bets.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg shadow">
              <p className="text-gray-300 text-lg">No active bets</p>
              <p className="text-gray-500">Create your first bet to get started!</p>
            </div>
          ) : (
            <div className="flex gap-4 pb-4 min-w-max">
              {bets.map(bet => (
                <div key={bet.id} className="flex-shrink-0 w-96">
                  <BetSlipCard
                    bet={bet}
                    games={games}
                    onRemove={() => removeBet(bet.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create bet modal */}
      <CreateBetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateBet={addBet}
        games={games}
      />
    </div>
  );
}