import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/constants";
import { Collection, Photo } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient"; 
import { useState } from "react";
import { WatercolorOverlay } from "@/components/ui/watercolor-overlay";
import { HandDrawn } from "@/components/ui/hand-drawn";
import { formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Edit, 
  Trash2, 
  Calendar,
  Image
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function ViewDateMemory() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Fetch memory details
  const { 
    data: memory, 
    isLoading: memoryLoading, 
    error: memoryError 
  } = useQuery<Collection>({
    queryKey: [API_ENDPOINTS.collection(id)],
  });

  // Fetch photos for this memory
  const {
    data: photos = [],
    isLoading: photosLoading,
    error: photosError
  } = useQuery<Photo[]>({
    queryKey: [API_ENDPOINTS.collectionPhotos(id)],
    // Only fetch if we have a valid memory
    enabled: !!memory,
  });

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", API_ENDPOINTS.collection(id), {}),
    onSuccess: () => {
      toast({
        title: "Memory deleted",
        description: "The date memory has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.collections] });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Failed to delete memory",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  });

  const handleDelete = () => {
    if (isDeleting) {
      deleteMutation.mutate();
    } else {
      setIsDeleting(true);
    }
  };

  const isLoading = memoryLoading || photosLoading;
  const error = memoryError || photosError;

  if (isLoading) {
    return (
      <div className="bg-[#F4F1EA] min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <Button variant="outline" className="mb-4" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gallery
          </Button>
          <div className="bg-white rounded-lg overflow-hidden shadow-md">
            <Skeleton className="w-full h-[40vh]" />
            <div className="p-6">
              <Skeleton className="h-8 w-2/3 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <div className="flex items-center mb-4">
                <Skeleton className="h-6 w-6 mr-2 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="bg-[#F4F1EA] min-h-screen p-4 flex items-center justify-center">
        <HandDrawn className="bg-white p-8 max-w-md">
          <h1 className="text-2xl font-quicksand font-bold text-[#9C7178] mb-4">Memory Not Found</h1>
          <p className="mb-6">We couldn't find the date memory you're looking for.</p>
          <Button onClick={() => navigate("/")}>Return to Gallery</Button>
        </HandDrawn>
      </div>
    );
  }

  const activePhoto = photos.length > 0 ? photos[activePhotoIndex] : null;
  const dateValue = memory.date ? new Date(memory.date) : new Date(memory.createdAt);
  const formattedDate = dateValue.toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });

  return (
    <div className="bg-[#F4F1EA] min-h-screen p-4 md:p-8 relative font-lato text-[#4A4A4A]">
      <WatercolorOverlay />
      
      <div className="max-w-5xl mx-auto relative z-10">
        <Button 
          variant="outline" 
          className="mb-4 font-quicksand" 
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Memories
        </Button>
        
        <HandDrawn className="bg-white overflow-hidden shadow-lg">
          {activePhoto ? (
            <div className="relative">
              <img 
                src={activePhoto.filePath} 
                alt={activePhoto.title || memory.name} 
                className="w-full object-contain max-h-[50vh]"
              />
              {activePhoto.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2">
                  <p className="text-lg font-medium">{activePhoto.title}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-100 flex items-center justify-center h-[40vh]">
              <div className="text-center p-8">
                <Image className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No photos in this memory yet</p>
              </div>
            </div>
          )}
          
          <div className="p-6">
            <div className="flex justify-between items-start mb-2">
              <h1 className="font-quicksand font-bold text-2xl md:text-3xl">{memory.name}</h1>
              <div className="flex items-center text-[#9C7178]">
                <Calendar className="h-5 w-5 mr-1" />
                <span>{formattedDate}</span>
              </div>
            </div>
            
            <p className="text-lg mb-6">{memory.description}</p>
            
            {/* Photo thumbnails */}
            {photos.length > 0 && (
              <div className="mb-6">
                <h3 className="font-quicksand font-medium text-lg mb-2">Photos from this moment:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 overflow-x-auto">
                  {photos.map((photo, index) => (
                    <div 
                      key={photo.id} 
                      className={`cursor-pointer border-2 overflow-hidden rounded-md ${
                        index === activePhotoIndex ? 'border-[#9C7178]' : 'border-transparent'
                      }`}
                      onClick={() => setActivePhotoIndex(index)}
                    >
                      <img 
                        src={photo.filePath} 
                        alt={photo.title || `Photo ${index + 1}`} 
                        className="w-full h-20 object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap justify-between items-center border-t pt-4">
              <div className="flex items-center">
                <Image className="h-4 w-4 mr-1" />
                <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
                <Button variant="outline" className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Like
                </Button>
                
                <Button variant="outline" className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share
                </Button>
                
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Edit
                </Button>
                
                <Button 
                  variant={isDeleting ? "destructive" : "outline"} 
                  className="flex items-center gap-2"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-5 w-5" />
                  {isDeleting ? 'Confirm Delete?' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </HandDrawn>
      </div>
    </div>
  );
} 