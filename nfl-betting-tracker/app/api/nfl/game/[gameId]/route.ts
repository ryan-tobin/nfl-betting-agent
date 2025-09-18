import { NextResponse } from 'next/server';

interface ESPNScoringPlay {
  id: string;
  type: {
    id: string;
    text: string;
    abbreviation: string;
  };
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
  text: string;
  awayScore: number;
  homeScore: number;
  period: {
    number: number;
  };
  clock: {
    displayValue: string;
  };
  scoringType?: {
    name: string;
    displayName: string;
  };
  athlete?: {
    id: string;
    fullName: string;
    displayName: string;
  };
}

interface ESPNPlayerStats {
  name: string;
  categories: Array<{
    name: string;
    displayName: string;
    athletes: Array<{
      athlete: {
        id: string;
        fullName: string;
        displayName: string;
      };
      stats: string[];
    }>;
  }>;
}

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;

    // Fetch detailed game data from ESPN
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NFLBettingTracker/1.0)',
        },
        next: { revalidate: 10 } // Cache for 10 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract scoring plays
    const scoringPlays = data.scoringPlays?.map((play: ESPNScoringPlay) => ({
      id: play.id,
      type: play.type?.text || '',
      team: play.team?.abbreviation || '',
      teamName: play.team?.displayName || '',
      text: play.text,
      period: play.period?.number,
      clock: play.clock?.displayValue,
      player: play.athlete?.displayName || null,
      scoringType: play.scoringType?.displayName || play.type?.text
    })) || [];

    // Extract player statistics
    const playerStats: any = {};
    
    if (data.boxscore?.players) {
      data.boxscore.players.forEach((team: ESPNPlayerStats, teamIndex: number) => {
        const teamKey = teamIndex === 0 ? 'away' : 'home';
        playerStats[teamKey] = {};

        team.categories?.forEach(category => {
          const statType = category.name.toLowerCase();
          playerStats[teamKey][statType] = {};

          category.athletes?.forEach(athleteData => {
            const playerName = athleteData.athlete.displayName;
            playerStats[teamKey][statType][playerName] = athleteData.stats;
          });
        });
      });
    }

    // Count team-level stats from scoring plays
    const teamStats = {
      home: {
        rushingTDs: 0,
        passingTDs: 0,
        fieldGoals: 0,
        safeties: 0,
        totalTDs: 0
      },
      away: {
        rushingTDs: 0,
        passingTDs: 0,
        fieldGoals: 0,
        safeties: 0,
        totalTDs: 0
      }
    };

    // Process scoring plays to count team stats
    scoringPlays.forEach((play: any) => {
      const teamKey = data.header?.competitions?.[0]?.competitors?.find(
        (team: any) => team.team.abbreviation === play.team
      )?.homeAway || 'away';

      const scoringType = play.scoringType?.toLowerCase() || '';
      
      if (scoringType.includes('rushing') && scoringType.includes('td')) {
        teamStats[teamKey as 'home' | 'away'].rushingTDs++;
        teamStats[teamKey as 'home' | 'away'].totalTDs++;
      } else if (scoringType.includes('passing') && scoringType.includes('td')) {
        teamStats[teamKey as 'home' | 'away'].passingTDs++;
        teamStats[teamKey as 'home' | 'away'].totalTDs++;
      } else if (scoringType.includes('field goal')) {
        teamStats[teamKey as 'home' | 'away'].fieldGoals++;
      } else if (scoringType.includes('safety')) {
        teamStats[teamKey as 'home' | 'away'].safeties++;
      }
    });

    return NextResponse.json({
      gameId,
      scoringPlays,
      playerStats,
      teamStats,
      gameStatus: data.header?.competitions?.[0]?.status,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching game details:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch game details',
        gameId: params.gameId,
        lastUpdated: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}