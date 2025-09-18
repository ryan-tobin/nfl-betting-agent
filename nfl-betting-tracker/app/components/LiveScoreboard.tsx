'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface NFLGame {
  id: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
  };
  status: {
    type: string;
    description: string;
    detail: string;
  };
  timeSlot: string;
}

interface LiveScoreboardProps {
  games: NFLGame[];
}

export default function LiveScoreboard({ games }: LiveScoreboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pre': return 'text-gray-500';
      case 'in': return 'text-green-500';
      case 'post': return 'text-gray-400';
      default: return 'text-gray-500';
    }
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  if (games.length === 0) {
    return (
      <div className="bg-black text-white">
        <div className="max-w-full overflow-x-auto">
          <div className="flex items-center justify-center py-4 px-6">
            <div className="text-center">
              <p className="text-sm text-gray-400">No NFL games today</p>
              <p className="text-xs text-gray-500">{formatTime(currentTime)} ET</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white shadow-lg">
      <div className="max-w-full overflow-x-auto">
        <div className="flex items-center py-3 px-4 min-w-max gap-4">
          {/* ESPN-style branding */}
          <div className="flex flex-col items-center justify-center px-3 border-r border-gray-600">
            <div className="bg-red-600 text-white px-2 py-1 rounded font-bold text-sm">
              NFL
            </div>
            <span className="text-xs text-gray-300 mt-1">
              {formatTime(currentTime)} ET
            </span>
          </div>

          {/* Games in compact square cards */}
          {games.map((game) => (
            <div key={game.id} className="flex flex-col bg-gray-800 rounded-lg p-3 min-w-[120px] border border-gray-700">
              {/* Game Status / Schedule at top */}
              <div className="text-center mb-2">
                <div className={`text-sm font-medium ${getStatusColor(game.status.type)}`}>
                  {game.status.description}
                </div>
                <div className="text-xs text-gray-300">
                  {game.status.detail}
                </div>
              </div>

              {/* Teams and Scores */}
              <div className="space-y-1">
                {/* Away Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image
                      src={game.awayTeam.logo}
                      alt={game.awayTeam.name}
                      width={18}
                      height={18}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-white">{game.awayTeam.abbreviation}</span>
                  </div>
                  <span className="text-lg font-bold text-white">{game.awayTeam.score}</span>
                </div>

                {/* Home Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image
                      src={game.homeTeam.logo}
                      alt={game.homeTeam.name}
                      width={18}
                      height={18}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-white">{game.homeTeam.abbreviation}</span>
                  </div>
                  <span className="text-lg font-bold text-white">{game.homeTeam.score}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Live indicator */}
          <div className="flex flex-col items-center justify-center px-3 border-l border-gray-600">
            <div className="text-sm text-gray-300 font-medium">
              Live
            </div>
            <div className="text-xs text-green-400 flex items-center gap-1 mt-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}