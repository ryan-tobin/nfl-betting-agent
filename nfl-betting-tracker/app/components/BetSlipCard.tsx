'use client';

import React, { useState } from 'react';
import { X, Check, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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

interface BetRequirement {
  id: string;
  team?: string;
  player?: string;
  stat: string;
  threshold: number;
  current: number;
  completed: boolean;
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

interface BetSlipCardProps {
  bet: Bet;
  games: NFLGame[]; // Add games prop to help with grouping
  onRemove: () => void;
}

export default function BetSlipCard({ bet, games, onRemove }: BetSlipCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const getStatusIcon = () => {
    switch (bet.status) {
      case 'won':
        return <Check className="text-green-500" size={20} />;
      case 'lost':
        return <X className="text-red-500" size={20} />;
      case 'active':
        return <Clock className="text-yellow-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = () => {
    switch (bet.status) {
      case 'won': return 'border-green-500 bg-gray-800';
      case 'lost': return 'border-red-500 bg-gray-800';
      case 'active': return 'border-yellow-500 bg-gray-800';
      default: return 'border-gray-600 bg-gray-800';
    }
  };

  const completedCount = bet.requirements.filter(req => req.completed).length;
  const totalCount = bet.requirements.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  return (
    <div className={`rounded-lg border-2 shadow-lg transition-all ${getStatusColor()}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon()}
            <div className="flex-1">
              <h3 className="font-bold text-lg text-white">{bet.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="capitalize">{bet.status}</span>
                {bet.timeSlots && bet.timeSlots.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{bet.timeSlots.join(', ')}</span>
                  </>
                )}
                <span>•</span>
                <span>{completedCount}/{totalCount} Complete</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1"
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                bet.status === 'won' ? 'bg-green-500' :
                bet.status === 'lost' ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div>
          {/* Requirements */}
          <div className="p-4">
          {bet.type === 'team_slate' ? (
            // Group by actual games for team slate bets
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(() => {
                // Group requirements by actual games
                const gameCards: JSX.Element[] = [];
                const processedTeams = new Set<string>();

                games.forEach(game => {
                  // Find requirements for both teams in this game
                  const homeReq = bet.requirements.find(req => 
                    req.team === game.homeTeam.name && !processedTeams.has(req.team)
                  );
                  const awayReq = bet.requirements.find(req => 
                    req.team === game.awayTeam.name && !processedTeams.has(req.team)
                  );

                  // Only create card if both teams are part of this bet
                  if (homeReq && awayReq) {
                    processedTeams.add(homeReq.team!);
                    processedTeams.add(awayReq.team!);

                    const homeCompleted = homeReq.completed;
                    const awayCompleted = awayReq.completed;
                    const bothCompleted = homeCompleted && awayCompleted;
                    const gameStatus = bothCompleted ? 'complete' : 
                                     (homeCompleted || awayCompleted) ? 'partial' : 'pending';

                    gameCards.push(
                      <div
                        key={game.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          gameStatus === 'complete' 
                            ? 'border-green-500 bg-gray-700' 
                            : gameStatus === 'partial'
                            ? 'border-yellow-500 bg-gray-700'
                            : 'border-gray-600 bg-gray-700'
                        }`}
                      >
                        {/* Game Header */}
                        <div className="text-center mb-2">
                          <div className="text-xs font-medium text-gray-300">
                            {bet.requirements[0]?.stat} {bet.requirements[0]?.threshold}+
                          </div>
                          <div className="text-xs text-gray-500">
                            {game.awayTeam.score} - {game.homeTeam.score}
                          </div>
                        </div>

                        {/* Teams */}
                        <div className="space-y-2">
                          {/* Away Team */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <div className={`w-3 h-3 rounded-full ${
                                awayCompleted ? 'bg-green-500' : 'bg-gray-600'
                              }`}></div>
                              <span className="text-xs font-medium truncate text-gray-200">
                                {game.awayTeam.name.split(' ').pop()} {/* Show just team name */}
                              </span>
                            </div>
                            <span className={`text-sm font-bold ${
                              awayCompleted ? 'text-green-400' : 'text-gray-300'
                            }`}>
                              {awayReq.current}
                            </span>
                          </div>

                          {/* Home Team */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <div className={`w-3 h-3 rounded-full ${
                                homeCompleted ? 'bg-green-500' : 'bg-gray-600'
                              }`}></div>
                              <span className="text-xs font-medium truncate text-gray-200">
                                {game.homeTeam.name.split(' ').pop()} {/* Show just team name */}
                              </span>
                            </div>
                            <span className={`text-sm font-bold ${
                              homeCompleted ? 'text-green-400' : 'text-gray-300'
                            }`}>
                              {homeReq.current}
                            </span>
                          </div>
                        </div>

                        {/* Game Status */}
                        <div className="mt-2 text-center">
                          <div className={`text-xs px-2 py-1 rounded ${
                            gameStatus === 'complete' 
                              ? 'bg-green-200 text-green-800' 
                              : gameStatus === 'partial'
                              ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {gameStatus === 'complete' ? '✓ Both' : 
                             gameStatus === 'partial' ? '½ Partial' : 'Pending'}
                          </div>
                        </div>
                      </div>
                    );
                  }
                });

                return gameCards;
              })()}
            </div>
          ) : (
            // Individual player requirements for parlays (unchanged)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bet.requirements.map((req) => (
                <div
                  key={req.id}
                  className={`p-3 rounded-lg border-2 ${
                    req.completed 
                      ? 'border-green-500 bg-gray-700' 
                      : 'border-gray-600 bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        req.completed ? 'bg-green-500' : 'bg-gray-600'
                      }`}>
                        {req.completed && <Check size={10} className="text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-gray-200">
                          {req.player}
                        </div>
                        <div className="text-xs text-gray-400">
                          {req.stat} {req.threshold}+
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-bold text-lg ${
                        req.completed ? 'text-green-400' : 'text-gray-300'
                      }`}>
                        {req.current}
                      </div>
                      <div className="text-xs text-gray-500">
                        {req.completed ? 'Hit' : 'Active'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {bet.notes && (
            <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
              <div className="text-sm text-blue-200">
                <strong>Notes:</strong> {bet.notes}
              </div>
            </div>
          )}

          {/* Created timestamp */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Created {bet.createdAt.toLocaleString()}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}