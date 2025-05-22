import { useState } from "react";
import { useLocation } from "wouter";
import { Collection } from "@shared/schema";
import { HandDrawn } from "@/components/ui/hand-drawn";
import { Button } from "@/components/ui/button";
import { Heart, Edit, Maximize, Calendar, Image } from "lucide-react";
import { formatDate } from "@/lib/constants";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

interface DateMemoriesGalleryProps {
  dateMemories: Collection[];
  isLoading: boolean;
}

export default function DateMemoriesGallery({ dateMemories, isLoading }: DateMemoriesGalleryProps) {
  const [, navigate] = useLocation();

  // Function to get a placeholder image when collection has no cover
  const getPlaceholderImage = (index: number) => {
    const placeholders = [
      'https://images.unsplash.com/photo-1490604001847-b712b0c2f967',
      'https://images.unsplash.com/photo-1578146165056-6e03aaae7ff5',
      'https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875',
      'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe',
      'https://images.unsplash.com/photo-1627483262769-04d0a1401487',
    ];
    return placeholders[index % placeholders.length];
  };

  const handleMemoryClick = (memory: Collection) => {
    navigate(`/date-memory/${memory.id}`);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="container mx-auto px-4 py-6 relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg overflow-hidden shadow-md">
              <Skeleton className="w-full h-56" />
              <div className="p-4">
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // No memories state
  if (!dateMemories || dateMemories.length === 0) {
    return (
      <section className="container mx-auto px-4 py-16 text-center">
        <HandDrawn className="bg-white p-8 max-w-lg mx-auto">
          <h3 className="font-quicksand font-bold text-xl mb-4 text-[#9C7178]">No Date Memories Found</h3>
          <p className="mb-6 text-[#4A4A4A]">
            Start creating your relationship timeline by adding your first date memory.
          </p>
          <Button className="bg-[#E6B89C] hover:bg-[#9C7178] text-white">
            Add Your First Date Memory
          </Button>
        </HandDrawn>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-6 relative">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dateMemories.map((memory, index) => (
          <div 
            key={memory.id} 
            className="memory-card relative bg-white rounded-lg overflow-hidden shadow-md cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg"
            onClick={() => handleMemoryClick(memory)}
          >
            <div className="relative overflow-hidden" style={{ height: "220px" }}>
              <img 
                src={getPlaceholderImage(index)}
                alt={memory.name} 
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
              <div className="absolute bottom-0 right-0 bg-white bg-opacity-80 px-2 py-1 m-2 rounded text-xs flex items-center">
                <Image size={12} className="mr-1" />
                <span>Multiple photos</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-quicksand font-semibold text-lg mb-1">{memory.name}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{memory.description || "No description available"}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(memory.createdAt)}
                </span>
                <div className="flex space-x-2">
                  <button className="text-[#88B9B0] hover:text-opacity-80">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    className="text-[#9C7178] hover:text-opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      // In the future you can open a modal here
                    }}
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {dateMemories.length >= 8 && (
        <div className="flex justify-center mt-12">
          <HandDrawn>
            <Button className="bg-[#E6B89C] hover:bg-[#9C7178] text-white px-6 py-6 font-quicksand text-lg">
              Load More Memories
            </Button>
          </HandDrawn>
        </div>
      )}
    </section>
  );
} 