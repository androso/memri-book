import { HandDrawn } from "@/components/ui/hand-drawn";
import { Button } from "@/components/ui/button";
import { Camera, Plus, BookOpen, Compass } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  onUploadClick: () => void;
}

export default function Header({ onUploadClick }: HeaderProps) {
  return (
    <header className="relative overflow-hidden">
      {/* Cloud decoration */}
      <div className="cloud-decoration top-10 left-1/4">
        <img 
          src="https://images.unsplash.com/photo-1517056338492-99899a9fccf0?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
          alt="" 
          className="w-48 h-auto opacity-20"
        />
      </div>
      <div className="cloud-decoration top-20 right-1/4">
        <img 
          src="https://images.unsplash.com/photo-1517056338492-99899a9fccf0?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
          alt="" 
          className="w-32 h-auto opacity-15"
        />
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
          <h1 className="font-quicksand font-bold text-2xl md:text-3xl text-[#9C7178]">Ghibli Memories</h1>
        </div>
        <div>
          <HandDrawn>
            <Button 
              className="bg-[#E6B89C] hover:bg-[#9C7178] text-white font-quicksand"
              onClick={onUploadClick}
            >
              <Plus className="mr-2 h-4 w-4" /> Upload
            </Button>
          </HandDrawn>
        </div>
      </nav>

      {/* Hero section */}
      <div className="container mx-auto px-4 pt-6 pb-12 md:pb-20 text-center relative">
        <h2 className="font-quicksand font-bold text-3xl md:text-4xl lg:text-5xl mb-4 text-[#4A4A4A]">
          Capture Your Magical Moments
        </h2>
        <p className="text-lg max-w-2xl mx-auto mb-8">
          Create whimsical photo collections inspired by the enchanting world of Studio Ghibli.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <HandDrawn>
            <Button className="bg-[#88B9B0] hover:bg-opacity-90 text-white px-6 py-6 font-quicksand text-lg">
              <BookOpen className="mr-2 h-5 w-5" /> My Albums
            </Button>
          </HandDrawn>
          <HandDrawn>
            <Button 
              variant="outline" 
              className="bg-white border-2 border-[#88B9B0] hover:bg-[#88B9B0] hover:bg-opacity-10 text-[#88B9B0] px-6 py-6 font-quicksand text-lg"
            >
              <Compass className="mr-2 h-5 w-5" /> Explore
            </Button>
          </HandDrawn>
        </div>
      </div>
    </header>
  );
}
