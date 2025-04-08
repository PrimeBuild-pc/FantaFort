import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { User } from "@/lib/types";
import MobileMenu from "./mobile-menu";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { data: user } = useQuery<User | null>({
    queryKey: ['/api/user/current'],
  });

  return (
    <>
      <nav className="bg-[#1E1E1E] shadow-md border-b border-[#333333] sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-1">
              <div className="h-10 w-10 bg-[#2D0E75] rounded-full flex items-center justify-center">
                <i className="fas fa-gamepad text-[#00F0B5] text-xl"></i>
              </div>
              <h1 className="text-2xl font-burbank text-[#00F0B5] tracking-wider">FORTNITE FANTASY</h1>
            </div>

            {/* Main Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className={`nav-item ${location === "/" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Dashboard
              </Link>
              <Link href="/team" className={`nav-item ${location === "/team" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                My Team
              </Link>
              <Link href="/team-management" className={`nav-item ${location === "/team-management" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Team Management
              </Link>
              <Link href="/workshop" className={`nav-item ${location === "/workshop" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Workshop
              </Link>
              <Link href="/leaderboard" className={`nav-item ${location === "/leaderboard" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Leaderboard
              </Link>
              <Link href="/marketplace" className={`nav-item ${location === "/marketplace" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Marketplace
              </Link>
              <Link href="/tournaments" className={`nav-item ${location === "/tournaments" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Tournaments
              </Link>
              <Link href="/game-management" className={`nav-item ${location === "/game-management" ? "active text-[#00F0B5]" : "text-gray-300 hover:text-[#00F0B5]"} font-medium`}>
                Game Management
              </Link>
            </div>

            {/* User menu */}
            <div className="flex items-center">
              {user ? (
                <>
                  <div className="mr-4 hidden md:block">
                    <span className="text-[#00F0B5] font-semibold">{user.coins.toLocaleString()}</span>
                    <i className="fas fa-coins ml-1 text-yellow-400"></i>
                  </div>
                  <div className="relative">
                    <button className="flex items-center space-x-2 focus:outline-none group">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#2D0E75] to-[#1890FF] flex items-center justify-center text-white font-semibold overflow-hidden transition-transform duration-300 group-hover:scale-110">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          user.username.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="hidden md:block font-medium text-white group-hover:text-[#00F0B5] transition-colors">{user.username}</span>
                    </button>
                  </div>
                </>
              ) : (
                <Link href="/auth">
                  <Button variant="fortnite" size="sm">
                    Login
                  </Button>
                </Link>
              )}
              <button className="ml-4 md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <i className="fas fa-bars text-gray-300"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <style>
        {`
        .nav-item {
          position: relative;
        }

        .nav-item::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background-color: #00F0B5;
          transition: width 0.3s ease;
        }

        .nav-item:hover::after,
        .nav-item.active::after {
          width: 100%;
        }
        `}
      </style>
    </>
  );
}
