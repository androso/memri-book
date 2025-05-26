import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WatercolorOverlay } from "@/components/ui/watercolor-overlay";
import { Camera, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    setSelectedUser(user);
    setPassword("");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !password) return;

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUser.id,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: `Welcome back, ${selectedUser.name}!`,
          description: "You have successfully signed in to Memri.",
        });
        
        // Navigate to the main app
        navigate("/");
      } else {
        toast({
          title: "Login Failed",
          description: data.message || "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPassword("");
    setShowPassword(false);
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
        {!selectedUser ? (
          <>
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
          </>
        ) : (
          /* Password Input Screen */
          <div className="w-full max-w-lg mx-auto">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-8 text-[#F4F1EA] hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back
            </Button>

            {/* User Avatar */}
            <div className="text-center mb-8">
              <div 
                className="w-24 h-24 rounded-lg flex items-center justify-center text-white text-3xl font-quicksand font-bold mx-auto mb-4 shadow-lg"
                style={{ backgroundColor: selectedUser.color }}
              >
                {selectedUser.avatar}
              </div>
              <h2 className="text-2xl font-quicksand font-medium text-[#F4F1EA]">
                {selectedUser.name}
              </h2>
            </div>

            {/* Typeform-style Password Input */}
            <form onSubmit={handlePasswordSubmit} className="space-y-8">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-3xl md:text-4xl font-quicksand font-medium text-[#F4F1EA] mb-2">
                    Enter your password
                  </h3>
                  <p className="text-[#F4F1EA] opacity-80 text-lg">
                    Please enter your password to continue
                  </p>
                </div>
                
                <div className="relative max-w-md mx-auto">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Type your password..."
                    className="h-16 text-xl bg-white/10 border-2 border-white/20 focus:border-white/40 focus:ring-0 text-[#F4F1EA] placeholder:text-[#F4F1EA]/60 rounded-xl backdrop-blur-sm"
                    required
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#F4F1EA]/60 hover:text-[#F4F1EA] hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <Button
                  type="submit"
                  disabled={!password || isLoading}
                  className="h-14 px-12 text-lg font-quicksand font-medium bg-[#F4F1EA] text-[#4A4A4A] hover:bg-white transition-all duration-200 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Signing in..." : "Continue"}
                </Button>
              </div>
            </form>
          </div>
        )}
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