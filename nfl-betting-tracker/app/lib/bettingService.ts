interface BetRequirement {
  id: string;
  team?: string;
  player?: string;
  stat: string;
  threshold: number;
  current: number;
  completed: boolean;
}

interface GameStats {
  gameId: string;
  teamStats: {
    home: {
      rushingTDs: number;
      passingTDs: number;
      fieldGoals: number;
      safeties: number;
      totalTDs: number;
    };
    away: {
      rushingTDs: number;
      passingTDs: number;
      fieldGoals: number;
      safeties: number;
      totalTDs: number;
    };
  };
  playerStats: {
    [teamKey: string]: {
      [statType: string]: {
        [playerName: string]: string[];
      };
    };
  };
  gameStatus: {
    type: {
      state: string;
      completed: boolean;
    };
  };
}

interface NFLGame {
  id: string;
  homeTeam: { name: string; abbreviation: string; };
  awayTeam: { name: string; abbreviation: string; };
  timeSlot: string;
  status: { type: string; };
}

export class BettingService {
  
  // Check team-level requirements (like "1+ Rushing TD")
  static checkTeamRequirement(
    requirement: BetRequirement, 
    gameStats: GameStats, 
    game: NFLGame
  ): { current: number; completed: boolean } {
    
    const statType = requirement.stat.toLowerCase();
    let current = 0;
    
    // Determine which team this requirement is for
    const isHomeTeam = game.homeTeam.name === requirement.team || 
                       game.homeTeam.abbreviation === requirement.team;
    const isAwayTeam = game.awayTeam.name === requirement.team || 
                       game.awayTeam.abbreviation === requirement.team;
    
    if (!isHomeTeam && !isAwayTeam) {
      return { current: 0, completed: false };
    }
    
    const teamKey = isHomeTeam ? 'home' : 'away';
    const teamStats = gameStats.teamStats[teamKey];
    
    // Map stat types to team stat values
    switch (statType) {
      case 'rushing td':
      case 'rushing touchdown':
        current = teamStats.rushingTDs;
        break;
      case 'field goal':
      case 'fg':
        current = teamStats.fieldGoals;
        break;
      case 'passing td':
      case 'passing touchdown':
        current = teamStats.passingTDs;
        break;
      case 'safety':
        current = teamStats.safeties;
        break;
      case 'touchdown':
      case 'td':
        current = teamStats.totalTDs;
        break;
      default:
        current = 0;
    }
    
    const completed = current >= requirement.threshold;
    return { current, completed };
  }
  
  // Check player-level requirements (like "Josh Allen 200+ Passing Yards")
  static checkPlayerRequirement(
    requirement: BetRequirement, 
    gameStats: GameStats
  ): { current: number; completed: boolean } {
    
    const statType = requirement.stat.toLowerCase();
    const playerName = requirement.player;
    let current = 0;
    
    if (!playerName) {
      return { current: 0, completed: false };
    }
    
    // Search through both teams' player stats
    for (const teamKey of ['home', 'away']) {
      const teamPlayerStats = gameStats.playerStats[teamKey];
      
      if (!teamPlayerStats) continue;
      
      // Map stat types to ESPN stat categories
      let statCategory = '';
      let statIndex = 0;
      
      switch (statType) {
        case 'passing yards':
          statCategory = 'passing';
          statIndex = 1; // Usually yards are at index 1 in ESPN stats
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
        case 'passing touchdown':
          statCategory = 'passing';
          statIndex = 2; // TDs usually at index 2
          break;
        case 'rushing td':
        case 'rushing touchdown':
          statCategory = 'rushing';
          statIndex = 2;
          break;
        case 'receiving td':
        case 'receiving touchdown':
          statCategory = 'receiving';
          statIndex = 2;
          break;
        case 'receptions':
          statCategory = 'receiving';
          statIndex = 0; // Receptions usually at index 0
          break;
        case 'completions':
          statCategory = 'passing';
          statIndex = 0;
          break;
      }
      
      if (statCategory && teamPlayerStats[statCategory]) {
        // Look for player in this stat category
        const playerStatsArray = teamPlayerStats[statCategory][playerName];
        
        if (playerStatsArray && playerStatsArray[statIndex]) {
          current = parseInt(playerStatsArray[statIndex]) || 0;
          break;
        }
      }
    }
    
    const completed = current >= requirement.threshold;
    return { current, completed };
  }
  
  // Update all requirements for a bet based on current game data
  static async updateBetRequirements(
    requirements: BetRequirement[],
    games: NFLGame[],
    betType: 'team_slate' | 'player_parlay',
    timeSlot?: string
  ): Promise<BetRequirement[]> {
    
    try {
      // Get all unique game IDs we need to check
      const gameIds = new Set<string>();
      
      if (betType === 'team_slate' && timeSlot) {
        // For team slate bets, get all games in the time slot
        games
          .filter(game => game.timeSlot === timeSlot)
          .forEach(game => gameIds.add(game.id));
      } else {
        // For player parlays, we need to check all active games
        games.forEach(game => gameIds.add(game.id));
      }
      
      // Fetch stats for all relevant games
      const gameStatsPromises = Array.from(gameIds).map(async (gameId) => {
        try {
          const response = await fetch(`/api/nfl/game/${gameId}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Error fetching stats for game ${gameId}:`, error);
          return null;
        }
      });
      
      const allGameStats = (await Promise.all(gameStatsPromises)).filter(Boolean);
      
      // Update each requirement
      const updatedRequirements = requirements.map(requirement => {
        let updated = { ...requirement };
        
        if (betType === 'team_slate' && requirement.team) {
          // Find the game this team is playing in
          const game = games.find(g => 
            g.homeTeam.name === requirement.team || 
            g.awayTeam.name === requirement.team ||
            g.homeTeam.abbreviation === requirement.team || 
            g.awayTeam.abbreviation === requirement.team
          );
          
          if (game) {
            const gameStats = allGameStats.find(stats => stats.gameId === game.id);
            if (gameStats) {
              const result = BettingService.checkTeamRequirement(requirement, gameStats, game);
              updated.current = result.current;
              updated.completed = result.completed;
            }
          }
        } else if (betType === 'player_parlay' && requirement.player) {
          // For player props, check all games for this player
          for (const gameStats of allGameStats) {
            const result = BettingService.checkPlayerRequirement(requirement, gameStats);
            if (result.current > 0) {
              updated.current = result.current;
              updated.completed = result.completed;
              break;
            }
          }
        }
        
        return updated;
      });
      
      return updatedRequirements;
      
    } catch (error) {
      console.error('Error updating bet requirements:', error);
      return requirements; // Return unchanged if error
    }
  }
  
  // Check if a bet should be marked as lost (any requirement failed)
  static isBetLost(requirements: BetRequirement[], games: NFLGame[]): boolean {
    return requirements.some(req => {
      if (req.team) {
        // Find the game for this team
        const game = games.find(g => 
          g.homeTeam.name === req.team || 
          g.awayTeam.name === req.team ||
          g.homeTeam.abbreviation === req.team || 
          g.awayTeam.abbreviation === req.team
        );
        
        // If game is finished and requirement not completed, bet is lost
        return game && 
               game.status.type.toLowerCase() === 'post' && 
               !req.completed;
      }
      
      // For player props, check if any relevant game is finished
      // This is more complex as we'd need to know which game the player was in
      // For now, we'll be conservative and not mark as lost until all games are done
      return false;
    });
  }
  
  // Check if a bet is won (all requirements completed)
  static isBetWon(requirements: BetRequirement[]): boolean {
    return requirements.length > 0 && requirements.every(req => req.completed);
  }
}