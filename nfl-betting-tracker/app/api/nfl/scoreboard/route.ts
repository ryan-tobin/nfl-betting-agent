import { NextResponse } from 'next/server';

interface ESPNGame {
  id: string;
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away';
      team: {
        name: string;
        displayName: string;
        logo: string;
        abbreviation: string;
      };
      score: string;
    }>;
    status: {
      type: {
        description: string;
        detail: string;
        state: string;
      };
    };
    date: string;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
  season: {
    year: number;
    type: number;
  };
  week: {
    number: number;
  };
}

export async function GET() {
  try {
    // Fetch from ESPN API
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NFLBettingTracker/1.0)',
        },
        // Cache for 10 seconds to avoid rate limits
        next: { revalidate: 10 }
      }
    );

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNResponse = await response.json();

    // Transform ESPN data to our format
    const games = data.events?.map(game => {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
      const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
      
      // Better time slot detection based on actual game time
      const gameDate = new Date(competition.date);
      const easternTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(gameDate);
      
      const hour = gameDate.getUTCHours() - 4; // Convert to ET (approximate)
      const dayOfWeek = gameDate.getDay(); // 0 = Sunday, 1 = Monday
      
      let timeSlot = easternTime; // Use actual time as default
      
      // Group similar times into slots
      if (hour >= 13 && hour < 16) {
        timeSlot = '1PM Slot';
      } else if (hour >= 16 && hour < 19) {
        timeSlot = '4PM Slot';
      } else if (hour >= 20 && hour < 24 && dayOfWeek === 0) {
        timeSlot = 'SNF';
      } else if (hour >= 20 && hour < 24 && dayOfWeek === 1) {
        timeSlot = 'MNF';
      } else if (hour >= 9 && hour < 13) {
        timeSlot = 'Early Games';
      }

      return {
        id: game.id,
        homeTeam: {
          name: homeTeam?.team.displayName || '',
          abbreviation: homeTeam?.team.abbreviation || '',
          logo: homeTeam?.team.logo || '',
          score: parseInt(homeTeam?.score || '0')
        },
        awayTeam: {
          name: awayTeam?.team.displayName || '',
          abbreviation: awayTeam?.team.abbreviation || '',
          logo: awayTeam?.team.logo || '',
          score: parseInt(awayTeam?.score || '0')
        },
        status: {
          type: competition.status.type.state,
          description: competition.status.type.description,
          detail: competition.status.type.detail
        },
        timeSlot,
        actualTime: easternTime, // Keep the actual time too
        date: competition.date
      };
    }) || [];

    // Get unique time slots for easier selection
    const uniqueTimeSlots = [...new Set(games.map(game => game.timeSlot))].sort();

    return NextResponse.json({
      games,
      timeSlots: uniqueTimeSlots,
      season: data.season,
      week: data.week,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching NFL scoreboard:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFL data',
        games: [],
        lastUpdated: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}