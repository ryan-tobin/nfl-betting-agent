'use client';

import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';

interface NFLGame {
  id: string;
  homeTeam: { name: string; abbreviation: string; };
  awayTeam: { name: string; abbreviation: string; };
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

interface CreateBetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBet: (bet: {
    title: string;
    type: 'team_slate' | 'player_parlay';
    timeSlots?: string[];
    status: 'active';
    requirements: BetRequirement[];
    notes?: string;
  }) => void;
  games: NFLGame[];
}

export default function CreateBetModal({ isOpen, onClose, onCreateBet, games }: CreateBetModalProps) {
  const [betType, setBetType] = useState<'team_slate' | 'player_parlay'>('team_slate');
  const [title, setTitle] = useState('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [stat, setStat] = useState('');
  const [threshold, setThreshold] = useState(1);
  const [notes, setNotes] = useState('');
  const [playerRequirements, setPlayerRequirements] = useState<Array<{
    player: string;
    stat: string;
    threshold: number;
  }>>([{ player: '', stat: '', threshold: 1 }]);

  // Get available time slots from games
  const availableTimeSlots = [...new Set(games.map(game => game.timeSlot))].sort();
  
  const teamStats = [
    'Rushing TD',
    'Field Goal',
    'Passing TD',
    'Interception',
    'Fumble Recovery',
    'Safety'
  ];
  const playerStats = [
    'Passing Yards',
    'Rushing Yards',
    'Receiving Yards',
    'Passing TD',
    'Rushing TD',
    'Receiving TD',
    'Receptions',
    'Completions'
  ];

  const toggleTimeSlot = (timeSlot: string) => {
    setSelectedTimeSlots(prev => 
      prev.includes(timeSlot) 
        ? prev.filter(slot => slot !== timeSlot)
        : [...prev, timeSlot]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    let requirements: BetRequirement[] = [];

    if (betType === 'team_slate') {
      if (selectedTimeSlots.length === 0 || !stat) return;
      
      // Get all teams for the selected time slots
      const slotGames = games.filter(game => selectedTimeSlots.includes(game.timeSlot));
      const teams: string[] = [];
      
      slotGames.forEach(game => {
        teams.push(game.homeTeam.name, game.awayTeam.name);
      });

      requirements = teams.map((team, index) => ({
        id: `req-${index}`,
        team,
        stat,
        threshold,
        current: 0,
        completed: false
      }));
    } else {
      // Player parlay
      requirements = playerRequirements
        .filter(req => req.player.trim() && req.stat)
        .map((req, index) => ({
          id: `req-${index}`,
          player: req.player.trim(),
          stat: req.stat,
          threshold: req.threshold,
          current: 0,
          completed: false
        }));
    }

    if (requirements.length === 0) return;

    onCreateBet({
      title,
      type: betType,
      timeSlots: betType === 'team_slate' ? selectedTimeSlots : undefined,
      status: 'active',
      requirements,
      notes: notes.trim() || undefined
    });

    // Reset form
    setTitle('');
    setSelectedTimeSlots([]);
    setStat('');
    setThreshold(1);
    setNotes('');
    setPlayerRequirements([{ player: '', stat: '', threshold: 1 }]);
    onClose();
  };

  const addPlayerRequirement = () => {
    setPlayerRequirements([...playerRequirements, { player: '', stat: '', threshold: 1 }]);
  };

  const removePlayerRequirement = (index: number) => {
    if (playerRequirements.length > 1) {
      setPlayerRequirements(playerRequirements.filter((_, i) => i !== index));
    }
  };

  const updatePlayerRequirement = (index: number, field: string, value: any) => {
    const updated = [...playerRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setPlayerRequirements(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
        
        <div className="relative bg-gray-800 rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Create New Bet</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-gray-800">
            {/* Bet Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bet Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setBetType('team_slate')}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    betType === 'team_slate'
                      ? 'border-red-500 bg-red-900 text-red-200'
                      : 'border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">Team Slate</div>
                  <div className="text-sm text-gray-400">All teams in time slot</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBetType('player_parlay')}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    betType === 'player_parlay'
                      ? 'border-red-500 bg-red-900 text-red-200'
                      : 'border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">Player Parlay</div>
                  <div className="text-sm text-gray-400">Custom player props</div>
                </button>
              </div>
            </div>

            {/* Bet Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bet Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                placeholder="e.g., 1+ Rushing TD - 1PM Slate"
                required
              />
            </div>

            {/* Team Slate Configuration */}
            {betType === 'team_slate' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Time Slots (Select Multiple)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTimeSlots.map(timeSlot => {
                      const gamesInSlot = games.filter(game => game.timeSlot === timeSlot).length;
                      return (
                        <button
                          key={timeSlot}
                          type="button"
                          onClick={() => toggleTimeSlot(timeSlot)}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            selectedTimeSlots.includes(timeSlot)
                              ? 'border-red-500 bg-red-900 text-red-200'
                              : 'border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500'
                          }`}
                        >
                          <div className="font-medium">{timeSlot}</div>
                          <div className="text-sm text-gray-400">{gamesInSlot} games</div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedTimeSlots.length > 0 && (
                    <div className="mt-2 text-sm text-gray-300">
                      Selected: {selectedTimeSlots.join(', ')} 
                      <span className="ml-2 font-medium text-white">
                        ({games.filter(game => selectedTimeSlots.includes(game.timeSlot)).length * 2} teams)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Stat Type
                  </label>
                  <select
                    value={stat}
                    onChange={(e) => setStat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="" className="text-gray-400">Select stat</option>
                    {teamStats.map(statType => (
                      <option key={statType} value={statType} className="text-white">{statType}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Threshold
                  </label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </>
            )}

            {/* Player Parlay Configuration */}
            {betType === 'player_parlay' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Player Requirements
                  </label>
                  <button
                    type="button"
                    onClick={addPlayerRequirement}
                    className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                  >
                    <Plus size={16} />
                    Add Player
                  </button>
                </div>

                <div className="space-y-4">
                  {playerRequirements.map((req, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Player {index + 1}
                        </span>
                        {playerRequirements.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePlayerRequirement(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={req.player}
                          onChange={(e) => updatePlayerRequirement(index, 'player', e.target.value)}
                          placeholder="Player name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                          required
                        />
                        <select
                          value={req.stat}
                          onChange={(e) => updatePlayerRequirement(index, 'stat', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                          required
                        >
                          <option value="">Select stat</option>
                          {playerStats.map(statType => (
                            <option key={statType} value={statType}>{statType}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={req.threshold}
                          onChange={(e) => updatePlayerRequirement(index, 'threshold', parseInt(e.target.value) || 1)}
                          min="1"
                          placeholder="Threshold"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 !text-white rounded-lg focus:ring-red-500 focus:border-red-500 placeholder-gray-400"
                placeholder="Any additional notes about this bet..."
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Create Bet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}