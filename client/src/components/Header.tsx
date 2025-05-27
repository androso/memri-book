import { HandDrawn } from "@/components/ui/hand-drawn";
import { Button } from "@/components/ui/button";
import { Camera, BookOpen, Compass, Plus } from "lucide-react";
import { motion } from "framer-motion";
import UserAccountMenu from "@/components/UserAccountMenu";

interface HeaderProps {
  onCreateCollection: () => void;
}

export default function Header({ onCreateCollection }: HeaderProps) {
  return (
    <header className="relative overflow-hidden">
      {/* Cloud decoration */}
      <div className="absolute top-10 left-1/4 opacity-20">
        <div className="relative">
          {/* Main cloud body */}
          <div className="w-32 h-20 bg-gradient-to-r from-[#88B9B0] to-[#E6B89C] rounded-full"></div>
          {/* Cloud bumps */}
          <div className="absolute -top-4 left-6 w-16 h-16 bg-gradient-to-r from-[#88B9B0] to-[#E6B89C] rounded-full"></div>
          <div className="absolute -top-2 right-4 w-12 h-12 bg-gradient-to-r from-[#E6B89C] to-[#9C7178] rounded-full"></div>
          <div className="absolute -top-6 left-16 w-20 h-20 bg-gradient-to-r from-[#88B9B0] to-[#E6B89C] rounded-full"></div>
        </div>
      </div>
      <div className="absolute top-20 right-1/4 opacity-15">
        <div className="relative">
          {/* Smaller cloud */}
          <div className="w-24 h-16 bg-gradient-to-r from-[#E6B89C] to-[#9C7178] rounded-full"></div>
          <div className="absolute -top-3 left-4 w-12 h-12 bg-gradient-to-r from-[#88B9B0] to-[#E6B89C] rounded-full"></div>
          <div className="absolute -top-1 right-2 w-8 h-8 bg-gradient-to-r from-[#E6B89C] to-[#9C7178] rounded-full"></div>
          <div className="absolute -top-4 left-12 w-16 h-16 bg-gradient-to-r from-[#88B9B0] to-[#E6B89C] rounded-full"></div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ 
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            <HandDrawn className="bg-[#88B9B0] p-3 mr-4 rounded-full">
              <Camera className="text-white" size={24} />
            </HandDrawn>
          </motion.div>
          <h1 className="font-quicksand font-bold text-2xl md:text-3xl text-[#9C7178]">Our Date Gallery</h1>
        </div>
        <div className="flex items-center gap-4">
          <UserAccountMenu />
          <HandDrawn>
            <Button 
              className="bg-[#9C7178] hover:bg-opacity-90 text-white font-quicksand"
              onClick={onCreateCollection}
            >
              <Plus className="mr-2 h-4 w-4" /> New Date
            </Button>
          </HandDrawn>
        </div>
      </nav>

      {/* Hero section */}
      <div className="container mx-auto px-4 pt-6 pb-12 md:pb-20 text-center relative">
        <h2 className="font-quicksand font-bold text-3xl md:text-4xl lg:text-5xl mb-4 text-[#4A4A4A]">
          Our Journey Together
        </h2>
        <p className="text-lg max-w-2xl mx-auto mb-8">
          Relive our special moments with photos, stories, and memories from each date we've shared.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <HandDrawn>
            <Button className="bg-[#88B9B0] hover:bg-opacity-90 text-white px-6 py-6 font-quicksand text-lg">
              <BookOpen className="mr-2 h-5 w-5" /> Our Dates
            </Button>
          </HandDrawn>
          <HandDrawn>
            <Button 
              variant="outline" 
              className="bg-white border-2 border-[#88B9B0] hover:bg-[#88B9B0] hover:bg-opacity-10 text-[#88B9B0] px-6 py-6 font-quicksand text-lg"
            >
              <Compass className="mr-2 h-5 w-5" /> Add Memory
            </Button>
          </HandDrawn>
        </div>
      </div>
    </header>
  );
}
