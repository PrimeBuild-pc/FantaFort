import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { User } from "@/lib/types";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { data: user } = useQuery<User | null>({
    queryKey: ['/api/user/current'],
  });
  const [location] = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 overflow-hidden">
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-between items-center border-b border-[#333333]">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-[#2D0E75] rounded-full flex items-center justify-center">
              <i className="fas fa-gamepad text-[#00F0B5] text-sm"></i>
            </div>
            <h2 className="text-xl font-burbank text-[#00F0B5]">FORTNITE FANTASY</h2>
          </div>
          <button onClick={onClose}>
            <i className="fas fa-times text-gray-300 text-xl"></i>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          <div className="space-y-3">
            <Link href="/" onClick={onClose} className={`block p-3 ${location === "/" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Dashboard
            </Link>
            <Link href="/team" onClick={onClose} className={`block p-3 ${location === "/team" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              My Team
            </Link>
            <Link href="/team-management" onClick={onClose} className={`block p-3 ${location === "/team-management" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Team Management
            </Link>
            <Link href="/workshop" onClick={onClose} className={`block p-3 ${location === "/workshop" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Workshop
            </Link>
            <Link href="/leaderboard" onClick={onClose} className={`block p-3 ${location === "/leaderboard" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Leaderboard
            </Link>
            <Link href="/marketplace" onClick={onClose} className={`block p-3 ${location === "/marketplace" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Marketplace
            </Link>
            <Link href="/tournaments" onClick={onClose} className={`block p-3 ${location === "/tournaments" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Tournaments
            </Link>
            <Link href="/game-management" onClick={onClose} className={`block p-3 ${location === "/game-management" ? "bg-[#2D0E75] bg-opacity-20 text-[#00F0B5]" : "bg-[#1E1E1E] text-gray-300 hover:text-white"} rounded-lg font-medium`}>
              Game Management
            </Link>
            <Link href="#" onClick={onClose} className="block p-3 bg-[#1E1E1E] rounded-lg text-gray-300 hover:text-white font-medium">
              Profile Settings
            </Link>
          </div>

          {user && (
            <div className="mt-6 p-3 rounded-lg bg-[#1E1E1E]">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-[#2D0E75] to-[#1890FF] flex items-center justify-center text-white font-semibold">
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-white">{user.username}</p>
                    <p className="text-sm text-gray-400">Premium Member</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between p-2 bg-[#121212] rounded-lg">
                <span className="text-sm text-gray-300">Balance</span>
                <div className="flex items-center">
                  <span className="text-[#00F0B5] font-bold">{user.coins.toLocaleString()}</span>
                  <i className="fas fa-coins ml-1 text-yellow-400"></i>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#333333]">
          {user ? (
            <button
              className="w-full bg-[#1E1E1E] hover:bg-[#333333] text-gray-300 font-medium py-3 rounded-lg"
              onClick={onClose}
            >
              Logout
            </button>
          ) : (
            <Link href="/auth"
              className="block w-full bg-gradient-to-r from-[#2D0E75] to-[#1890FF] text-white text-center font-medium py-3 rounded-lg"
              onClick={onClose}
            >
              Login / Register
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
