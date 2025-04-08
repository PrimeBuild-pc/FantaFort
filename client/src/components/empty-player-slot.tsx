import { useToast } from "@/hooks/use-toast";

interface EmptyPlayerSlotProps {
  remainingSlots: number;
  onAddPlayer?: () => void;
}

export default function EmptyPlayerSlot({ remainingSlots, onAddPlayer }: EmptyPlayerSlotProps) {
  const { toast } = useToast();
  
  const handleAddPlayer = () => {
    if (onAddPlayer) {
      onAddPlayer();
    } else {
      toast({
        title: "Coming Soon",
        description: "Player marketplace will be available in the next update.",
      });
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-[#333333] rounded-xl p-6 flex flex-col items-center justify-center bg-[#1E1E1E] bg-opacity-50 hover:border-[#00F0B5] transition-colors cursor-pointer"
      onClick={handleAddPlayer}
    >
      <div className="w-16 h-16 rounded-full bg-[#121212] flex items-center justify-center mb-2">
        <i className="fas fa-plus text-2xl text-gray-500"></i>
      </div>
      <p className="text-gray-400 font-medium">Add Player</p>
      <p className="text-xs text-gray-500 mt-1">{remainingSlots} slots remaining</p>
    </div>
  );
}
