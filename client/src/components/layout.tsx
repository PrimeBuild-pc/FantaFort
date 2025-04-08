import Navbar from "./navbar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-gray-100 font-sans">
      <Navbar />
      
      <main className="flex-grow">
        {children}
      </main>
      
      <footer className="bg-[#1E1E1E] border-t border-[#333333] py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="h-8 w-8 bg-[#2D0E75] rounded-full flex items-center justify-center mr-2">
                <i className="fas fa-gamepad text-[#00F0B5] text-sm"></i>
              </div>
              <span className="text-sm text-gray-400">© 2023 Fortnite Fantasy League. All rights reserved.</span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-[#00F0B5] text-sm">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-[#00F0B5] text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-[#00F0B5] text-sm">Support</a>
            </div>
          </div>
        </div>
      </footer>
      
      <style>
        {`
        @font-face {
          font-family: 'Burbank Big Condensed';
          src: url('https://fonts.cdnfonts.com/css/burbank-big-condensed-black') format('woff2');
          font-weight: 700;
          font-style: normal;
        }
        
        body {
          background-color: #121212;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(45, 14, 117, 0.1) 0%, transparent 20%),
            radial-gradient(circle at 90% 80%, rgba(24, 144, 255, 0.1) 0%, transparent 20%);
          background-attachment: fixed;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #1E1E1E;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #2D0E75;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #3A1C98;
        }
        
        /* Fortnite-style cards */
        .fortnite-card {
          background: linear-gradient(135deg, #1E1E1E 0%, #2A2A2A 100%);
          border: 1px solid #333;
          position: relative;
          overflow: hidden;
        }
        
        .fortnite-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00F0B5, transparent);
        }
        
        /* Animated button glow effect */
        .btn-glow:hover {
          box-shadow: 0 0 15px rgba(0, 240, 181, 0.7);
          transition: all 0.3s ease;
        }
        
        /* Stats bar animation */
        .stats-bar {
          position: relative;
          overflow: hidden;
        }
        
        .stats-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 30px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shine 2s infinite;
        }
        
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        
        /* Navigation item hover effect */
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
        
        /* Player card hover effect */
        .player-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .player-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.2), 0 0 15px rgba(45, 14, 117, 0.5);
        }
        
        /* Loading animation for data */
        .loading-pulse {
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Font styles */
        .font-burbank {
          font-family: 'Burbank Big Condensed', Impact, sans-serif;
        }
        `}
      </style>
    </div>
  );
}
