import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HandDrawn } from "@/components/ui/hand-drawn";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CollectionModal({ isOpen, onClose }: CollectionModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Create collection mutation
  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", API_ENDPOINTS.collections, {
      name,
      description,
      type: "custom"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.collections] });
      toast({
        title: "Collection created",
        description: "Your new collection has been successfully created.",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to create collection",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({
        title: "Collection name required",
        description: "Please provide a name for your collection.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };
  
  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-quicksand font-bold text-2xl text-[#4A4A4A]">
            Create New Collection
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name" className="font-quicksand font-medium text-[#4A4A4A]">
              Collection Name
            </Label>
            <HandDrawn>
              <Input 
                id="collection-name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-[#E6B89C] font-lato"
                placeholder="Enter a name for your collection"
              />
            </HandDrawn>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="collection-description" className="font-quicksand font-medium text-[#4A4A4A]">
              Description
            </Label>
            <HandDrawn>
              <Textarea 
                id="collection-description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-[#E6B89C] font-lato"
                placeholder="Add a description (optional)"
                rows={3}
              />
            </HandDrawn>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="font-quicksand"
          >
            Cancel
          </Button>
          <HandDrawn>
            <Button 
              className="bg-[#9C7178] hover:bg-opacity-90 text-white font-quicksand"
              onClick={handleSubmit}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Collection'}
            </Button>
          </HandDrawn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
