import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/constants";
import { Collection, Photo } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient"; 
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { WatercolorOverlay } from "@/components/ui/watercolor-overlay";
import { HandDrawn } from "@/components/ui/hand-drawn";
import { formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommentsSidebar } from "@/components/CommentsSidebar";
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Edit, 
  Trash2, 
  Calendar,
  Image,
  Plus,
  CloudUpload,
  X,
  MessageCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface PhotoUpload {
  file: File;
  preview: string;
  title: string;
}

export default function ViewDateMemory() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhotos, setUploadPhotos] = useState<PhotoUpload[]>([]);
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false);

  // Early return if no id
  if (!id) {
    navigate("/");
    return null;
  }

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
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.collectionsWithThumbnails] });
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

  // Upload photos mutation
  const uploadMutation = useMutation({
    mutationFn: async (photos: PhotoUpload[]) => {
      const uploadPromises = photos.map(async (photo) => {
        const formData = new FormData();
        formData.append('photo', photo.file);
        formData.append('title', photo.title || 'Uploaded Photo');
        formData.append('description', 'Added to memory');
        formData.append('collectionId', id);

        const response = await fetch(API_ENDPOINTS.photos, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          let errorMessage = "Failed to upload photo";
          try {
            const errorData = await response.json();
            if (errorData.code === 'DATABASE_TIMEOUT') {
              errorMessage = "Database connection timeout. Please try again in a moment.";
            } else if (errorData.code === 'CONNECTION_RESET') {
              errorMessage = "Connection was reset. Please try again.";
            } else {
              errorMessage = errorData.message || errorMessage;
            }
          } catch {
            // If JSON parsing fails, use status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        return await response.json();
      });

      return await Promise.all(uploadPromises);
    },
    onSuccess: (uploadedPhotos) => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.collectionPhotos(id)] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.photos] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.collectionsWithThumbnails] });
      
      toast({
        title: "Photos uploaded",
        description: `${uploadedPhotos.length} photo${uploadedPhotos.length !== 1 ? 's' : ''} added to this memory.`,
      });
      
      // Clean up
      uploadPhotos.forEach(photo => {
        URL.revokeObjectURL(photo.preview);
      });
      setUploadPhotos([]);
      setIsUploading(false);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      
      let title = "Upload failed";
      let description = "An unknown error occurred";
      
      if (error instanceof Error) {
        description = error.message;
        
        // Provide user-friendly messages for specific errors
        if (error.message.includes('timeout')) {
          title = "Connection timeout";
          description = "The upload took too long. Please check your connection and try again.";
        } else if (error.message.includes('reset')) {
          title = "Connection interrupted";
          description = "The connection was interrupted. Please try again.";
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPhotos = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, "") // Remove file extension
    }));
    
    setUploadPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: true
  });

  const removeUploadPhoto = (index: number) => {
    setUploadPhotos(prev => {
      const updatedPhotos = [...prev];
      URL.revokeObjectURL(updatedPhotos[index].preview);
      updatedPhotos.splice(index, 1);
      return updatedPhotos;
    });
  };

  const handleUpload = () => {
    if (uploadPhotos.length > 0) {
      uploadMutation.mutate(uploadPhotos);
    }
  };

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
  const dateValue = memory.createdAt ? new Date(memory.createdAt) : new Date();
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
              <Button 
                className="absolute top-4 right-4 bg-[#E6B89C] hover:bg-[#9C7178] text-white font-quicksand"
                onClick={() => setIsUploading(!isUploading)}
              >
                <Plus className="mr-2 h-4 w-4" /> Upload Photos
              </Button>
            </div>
          ) : (
            <div className="bg-gray-100 flex items-center justify-center h-[40vh] relative">
              <div className="text-center p-8">
                <Image className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No photos in this memory yet</p>
              </div>
              <Button 
                className="absolute top-4 right-4 bg-[#E6B89C] hover:bg-[#9C7178] text-white font-quicksand"
                onClick={() => setIsUploading(!isUploading)}
              >
                <Plus className="mr-2 h-4 w-4" /> Upload Photos
              </Button>
            </div>
          )}
          
          <div className="p-6">
            <h1 className="font-quicksand font-bold text-2xl md:text-3xl mb-2">{memory.name}</h1>
            <div className="flex items-center text-[#9C7178] mb-2">
              <Calendar className="h-5 w-5 mr-1" />
              <span>{formattedDate}</span>
            </div>
            <p className="text-lg mb-6">{memory.description}</p>
            
            {/* Upload section */}
            {isUploading && (
              <div className="mb-6 p-4 bg-[#F4F1EA] rounded-lg">
                <div className="space-y-4">
                  <HandDrawn>
                    <div 
                      {...getRootProps()} 
                      className={`border-2 border-dashed border-[#88B9B0] rounded-lg p-4 text-center cursor-pointer 
                        ${isDragActive ? 'bg-[#88B9B0] bg-opacity-10' : 'bg-white'}`}
                    >
                      <input {...getInputProps()} />
                      <CloudUpload className="h-8 w-8 text-[#88B9B0] mx-auto mb-2" />
                      <p className="text-[#4A4A4A] text-sm mb-1">
                        {isDragActive ? "Drop photos here..." : "Drag and drop photos here"}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">or</p>
                      <Button 
                        type="button" 
                        className="bg-[#88B9B0] hover:bg-opacity-90 text-white font-quicksand text-sm py-1 h-8"
                      >
                        Choose Photos
                      </Button>
                    </div>
                  </HandDrawn>
                  
                  {/* Upload photos preview */}
                  {uploadPhotos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{uploadPhotos.length} photo{uploadPhotos.length !== 1 ? 's' : ''} ready to upload:</p>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                        {uploadPhotos.map((photo, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={photo.preview} 
                              alt={`Upload ${index + 1}`} 
                              className="w-full h-20 object-cover rounded-md"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                              <Button 
                                variant="ghost" 
                                className="opacity-0 group-hover:opacity-100 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-1 h-7 w-7"
                                onClick={() => removeUploadPhoto(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <Input
                              value={photo.title}
                              onChange={(e) => {
                                const newPhotos = [...uploadPhotos];
                                newPhotos[index].title = e.target.value;
                                setUploadPhotos(newPhotos);
                              }}
                              className="mt-1 text-xs p-1 w-full h-6"
                              placeholder="Photo title"
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            uploadPhotos.forEach(photo => {
                              URL.revokeObjectURL(photo.preview);
                            });
                            setUploadPhotos([]);
                            setIsUploading(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-[#88B9B0] hover:bg-opacity-90 text-white"
                          onClick={handleUpload}
                          disabled={uploadMutation.isPending}
                        >
                          {uploadMutation.isPending ? 'Uploading...' : `Upload ${uploadPhotos.length} Photo${uploadPhotos.length !== 1 ? 's' : ''}`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
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
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => setIsCommentsSidebarOpen(true)}
                >
                  <MessageCircle className="h-5 w-5" />
                  Comments
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
        
        <CommentsSidebar 
          collectionId={id} 
          isOpen={isCommentsSidebarOpen}
          onOpenChange={setIsCommentsSidebarOpen}
        />
      </div>
    </div>
  );
} 