import { Card } from "@/components/ui/card";
import { FortnitePlayer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface PlayerCardProps {
  player: FortnitePlayer;
  onViewStats?: (playerId: string) => void;
  onTrade?: (playerId: string) => void;
}

export default function PlayerCard({ player, onViewStats, onTrade }: PlayerCardProps) {
  const cardStyles = `
    .player-card {
      perspective: 1000px;
      transform-style: preserve-3d;
    }
    
    .player-card .wrapper {
      position: relative;
      transform-style: preserve-3d;
    }
    
    .player-card .wrapper::before,
    .player-card .wrapper::after {
      content: '';
      opacity: 0;
      width: 100%;
      height: 80px;
      transition: all 0.5s;
      position: absolute;
      left: 0;
    }
    
    .player-card .wrapper::before {
      top: 0;
      height: 100%;
      background-image: linear-gradient(
        to top,
        transparent 46%,
        rgba(12, 13, 19, 0.5) 68%,
        rgba(12, 13, 19) 97%
      );
    }
    
    .player-card .wrapper::after {
      bottom: 0;
      opacity: 1;
      background-image: linear-gradient(
        to bottom,
        transparent 46%,
        rgba(12, 13, 19, 0.5) 68%,
        rgba(12, 13, 19) 97%
      );
    }
    
    .player-card:hover .wrapper::before,
    .player-card:hover .wrapper::after {
      opacity: 1;
    }
    
    .player-card:hover .wrapper::after {
      height: 120px;
    }
    
    .title {
      width: 100%;
      transition: transform 0.5s;
    }
    
    .player-card:hover .title {
      transform: translate3d(0%, -50px, 100px);
    }
  `;
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  const handleViewStats = () => {
    if (onViewStats) {
      onViewStats(player.id);
    } else {
      // Navigate to the player stats page
      navigate(`/player-stats/${player.id}`);
    }
  };
  
  const handleTrade = () => {
    if (onTrade) {
      onTrade(player.id);
    } else {
      toast({
        title: "Coming Soon",
        description: "Player trading functionality will be available in the next update.",
      });
    }
  };

  return (
    <Card className="player-card overflow-hidden hover:transform hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2),_0_0_15px_rgba(45,14,117,0.5)]">
      <div className="flex items-center p-4">
        <div className="relative mr-3">
          <img 
            src={player.avatar || "https://via.placeholder.com/48"}
            alt={`${player.name} avatar`}
            className={`w-12 h-12 rounded-full object-cover border-2 ${player.isTeamCaptain ? 'border-[#2D0E75]' : 'border-[#1890FF]'}`}
          />
          {player.isTeamCaptain && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#1890FF] rounded-full flex items-center justify-center text-xs font-bold">
              C
            </div>
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-center">
            <h4 className="font-burbank text-lg text-white truncate">{player.name}</h4>
            <div className="text-xs bg-[#2D0E75] bg-opacity-40 text-[#00F0B5] px-2 py-1 rounded-full">
              {player.points} pts
            </div>
          </div>
          <p className="text-sm text-gray-400 truncate">Team: {player.team}</p>
        </div>
      </div>
      
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-[#121212] bg-opacity-50 rounded p-2">
            <p className="text-gray-400">Elims</p>
            <p className="text-white font-medium text-base">{player.stats.eliminations}</p>
          </div>
          <div className="bg-[#121212] bg-opacity-50 rounded p-2">
            <p className="text-gray-400">Win Rate</p>
            <p className="text-white font-medium text-base">{player.stats.winRate}%</p>
          </div>
          <div className="bg-[#121212] bg-opacity-50 rounded p-2">
            <p className="text-gray-400">K/D</p>
            <p className="text-white font-medium text-base">{player.stats.kd}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-[#333333] bg-opacity-50 px-4 py-2 flex justify-between items-center">
        <span className="text-xs text-gray-400">Last updated: {player.lastUpdated}</span>
        <div className="flex space-x-2">
          <button 
            className="text-gray-400 hover:text-[#00F0B5]"
            onClick={handleViewStats}
          >
            <i className="fas fa-chart-line"></i>
          </button>
          <button 
            className="text-gray-400 hover:text-[#00F0B5]"
            onClick={handleTrade}
          >
            <i className="fas fa-exchange-alt"></i>
          </button>
        </div>
      </div>
      
      {/* Gradient line at the top of card is applied via CSS classes */}
    </Card>
  );
}
