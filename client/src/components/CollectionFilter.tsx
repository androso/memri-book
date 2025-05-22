import { HandDrawn } from "@/components/ui/hand-drawn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Collection } from "@shared/schema";

interface CollectionFilterProps {
  collections: Collection[];
  activeCollection: string | number;
  onCollectionChange: (collectionId: string | number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: string;
  onSortChange: (order: string) => void;
}

export default function CollectionFilter({
  collections,
  activeCollection,
  onCollectionChange,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange
}: CollectionFilterProps) {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between mb-6">
        <h2 className="font-quicksand font-bold text-2xl text-[#4A4A4A]">Our Dates</h2>
        
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
          <HandDrawn>
            <Button 
              variant={activeCollection === "all" ? "default" : "outline"}
              className={activeCollection === "all" 
                ? "bg-[#88B9B0] text-white font-quicksand" 
                : "bg-white border border-[#88B9B0] text-[#88B9B0] font-quicksand"}
              onClick={() => onCollectionChange("all")}
            >
              All Memories
            </Button>
          </HandDrawn>
          
          {collections.map(collection => (
            <HandDrawn key={collection.id}>
              <Button 
                variant={activeCollection === collection.id ? "default" : "outline"}
                className={activeCollection === collection.id 
                  ? "bg-[#88B9B0] text-white font-quicksand" 
                  : "bg-white border border-[#88B9B0] text-[#88B9B0] font-quicksand"}
                onClick={() => onCollectionChange(collection.id)}
              >
                {collection.name}
              </Button>
            </HandDrawn>
          ))}
        </div>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="relative min-w-[200px] flex-grow md:flex-grow-0">
          <HandDrawn>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-[#E6B89C]" size={16} />
              <Input 
                type="text" 
                placeholder="Search our moments..." 
                className="pl-10 pr-4 py-2 bg-white border border-[#E6B89C] font-lato"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </HandDrawn>
        </div>
        
        <div className="flex items-center">
          <span className="mr-2 text-[#4A4A4A]">Sort by:</span>
          <HandDrawn>
            <Select value={sortOrder} onValueChange={onSortChange}>
              <SelectTrigger className="min-w-[140px] bg-white border border-[#E6B89C] text-[#4A4A4A] font-lato">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Most Recent</SelectItem>
                <SelectItem value="oldest">First Dates</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </HandDrawn>
        </div>
      </div>
    </section>
  );
}
