import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import CollectionFilter from "@/components/CollectionFilter";
import PhotoGallery from "@/components/PhotoGallery";
import NewCollectionBanner from "@/components/NewCollectionBanner";
import Footer from "@/components/Footer";
import UploadModal from "@/components/modals/UploadModal";
import CollectionModal from "@/components/modals/CollectionModal";
import { API_ENDPOINTS } from "@/lib/constants";
import { WatercolorOverlay } from "@/components/ui/watercolor-overlay";
import { Collection, Photo } from "@shared/schema";

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState<string | number>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  // Fetch collections
  const { data: collections = [] } = useQuery<Collection[]>({
    queryKey: [API_ENDPOINTS.collections],
  });

  // Fetch photos based on active collection
  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: [
      activeCollection === "all" 
        ? API_ENDPOINTS.photos 
        : API_ENDPOINTS.photosByCollection(activeCollection)
    ],
  });

  // Filter photos based on search query
  const filteredPhotos = searchQuery 
    ? photos.filter(photo => 
        photo.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (photo.description && photo.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : photos;

  // Sort photos based on sort order
  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    if (sortOrder === "newest") {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    } else if (sortOrder === "oldest") {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    } else if (sortOrder === "name") {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  // Handle collection change
  const handleCollectionChange = (collectionId: string | number) => {
    setActiveCollection(collectionId);
  };

  return (
    <div className="bg-[#F4F1EA] min-h-screen relative font-lato text-[#4A4A4A]">
      <WatercolorOverlay />
      
      <Header 
        onUploadClick={() => setIsUploadModalOpen(true)} 
      />
      
      <CollectionFilter 
        collections={collections}
        activeCollection={activeCollection}
        onCollectionChange={handleCollectionChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />
      
      <PhotoGallery 
        photos={sortedPhotos} 
        isLoading={photosLoading} 
      />
      
      <NewCollectionBanner 
        onCreateCollection={() => setIsCollectionModalOpen(true)} 
      />
      
      <Footer />
      
      {isUploadModalOpen && (
        <UploadModal 
          collections={collections}
          isOpen={isUploadModalOpen} 
          onClose={() => setIsUploadModalOpen(false)} 
        />
      )}
      
      {isCollectionModalOpen && (
        <CollectionModal 
          isOpen={isCollectionModalOpen} 
          onClose={() => setIsCollectionModalOpen(false)} 
        />
      )}
    </div>
  );
}
