import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { WatercolorOverlay } from "@/components/ui/watercolor-overlay";
import { Camera, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);

  const users: User[] = [
    {
      id: "karold",
      name: "Karold",
      avatar: "K",
      color: "#E6B89C"
    },
    {
      id: "androso",
      name: "Androso", 
      avatar: "A",
      color: "#88B9B0"
    }
  ];

  const handleUserSelect = (user: User) => {
    // For now, this is client-side only, so we'll just simulate a login
    console.log("User selected:", { userId: user.id, userName: user.name });
    
    // Simulate successful login
    toast({
      title: `Welcome back, ${user.name}!`,
      description: "You have successfully signed in to Memri.",
    });
    
    // Navigate to the main app
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4A4A4A] via-[#9C7178] to-[#E6B89C] relative font-lato">
      <WatercolorOverlay opacity={0.15} />
      
      {/* Header */}
      <div className="relative z-10 p-6">
        <div className="flex items-center">
          <Camera className="h-8 w-8 text-[#F4F1EA] mr-3" />
          <h1 className="text-2xl font-quicksand font-bold text-[#F4F1EA]">
            Memri
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-quicksand font-bold text-[#F4F1EA] mb-4">
            Who's capturing memories?
          </h1>
        </div>

        {/* User Profiles */}
        <div className="flex gap-8 md:gap-12">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col items-center cursor-pointer group"
              onClick={() => handleUserSelect(user)}
              onMouseEnter={() => setHoveredUser(user.id)}
              onMouseLeave={() => setHoveredUser(null)}
            >
              {/* Avatar */}
              <div 
                className={`w-32 h-32 md:w-40 md:h-40 rounded-lg flex items-center justify-center text-white text-4xl md:text-5xl font-quicksand font-bold transition-all duration-300 shadow-lg ${
                  hoveredUser === user.id 
                    ? 'scale-110 shadow-2xl' 
                    : 'group-hover:scale-105'
                }`}
                style={{ backgroundColor: user.color }}
              >
                {user.avatar}
              </div>
              
              {/* Name */}
              <h2 className={`mt-4 text-xl md:text-2xl font-quicksand font-medium transition-colors duration-300 ${
                hoveredUser === user.id 
                  ? 'text-[#F4F1EA]' 
                  : 'text-[#F4F1EA] opacity-80'
              }`}>
                {user.name}
              </h2>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6">
        <p className="text-[#F4F1EA] text-sm opacity-80">
          Capture and cherish your most precious moments
        </p>
      </div>
    </div>
  );
} 