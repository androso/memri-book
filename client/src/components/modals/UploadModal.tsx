import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { HandDrawn } from "@/components/ui/hand-drawn";
import { X, CloudUpload, Image } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { Collection } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
}

export default function UploadModal({ isOpen, onClose, collections }: UploadModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // File dropzone handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      
      // Create preview
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreview(objectUrl);
      
      // Auto-fill title from filename if empty
      if (!title) {
        // Remove extension and replace dashes/underscores with spaces
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        const cleanedName = nameWithoutExt.replace(/[-_]/g, " ");
        // Capitalize first letter of each word
        const formattedName = cleanedName.replace(/\b\w/g, char => char.toUpperCase());
        setTitle(formattedName);
      }
    }
  }, [title]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !title || !collectionId) {
        throw new Error("Missing required fields");
      }
      
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('collectionId', collectionId);
      
      const response = await fetch(API_ENDPOINTS.photos, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload photo");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.photos] });
      toast({
        title: "Photo uploaded",
        description: "Your photo has been successfully uploaded.",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    uploadMutation.mutate();
  };
  
  const handleClose = () => {
    // Clean up preview URL
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setTitle("");
    setDescription("");
    setCollectionId("");
    setFile(null);
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-quicksand font-bold text-2xl text-[#4A4A4A]">
            Upload New Photo
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!preview ? (
            <HandDrawn>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed border-[#88B9B0] rounded-lg p-8 text-center cursor-pointer 
                  ${isDragActive ? 'bg-[#88B9B0] bg-opacity-10' : ''}`}
              >
                <input {...getInputProps()} />
                <CloudUpload className="h-12 w-12 text-[#88B9B0] mx-auto mb-3" />
                <p className="text-[#4A4A4A] mb-2">
                  {isDragActive ? "Drop your photo here..." : "Drag and drop your photo here"}
                </p>
                <p className="text-sm text-gray-500 mb-4">or</p>
                <Button 
                  type="button" 
                  className="bg-[#88B9B0] hover:bg-opacity-90 text-white font-quicksand"
                >
                  Browse Files
                </Button>
              </div>
            </HandDrawn>
          ) : (
            <div className="relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full h-48 object-contain border rounded-lg"
              />
              <Button 
                variant="ghost" 
                className="absolute top-1 right-1 text-white bg-black bg-opacity-40 hover:bg-opacity-60 rounded-full p-1 h-auto w-auto"
                onClick={() => {
                  URL.revokeObjectURL(preview);
                  setPreview(null);
                  setFile(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="title" className="font-quicksand font-medium text-[#4A4A4A]">
              Title
            </Label>
            <HandDrawn>
              <Input 
                id="title" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-[#E6B89C] font-lato"
                placeholder="Enter a title for your photo"
              />
            </HandDrawn>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="font-quicksand font-medium text-[#4A4A4A]">
              Description
            </Label>
            <HandDrawn>
              <Textarea 
                id="description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-[#E6B89C] font-lato"
                placeholder="Add a description (optional)"
                rows={3}
              />
            </HandDrawn>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="collection" className="font-quicksand font-medium text-[#4A4A4A]">
              Collection
            </Label>
            <HandDrawn>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger className="w-full px-4 py-2 bg-white border border-[#E6B89C] text-[#4A4A4A] font-lato">
                  <SelectValue placeholder="Choose a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map(collection => (
                    <SelectItem key={collection.id} value={collection.id.toString()}>
                      {collection.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Create New Collection...</SelectItem>
                </SelectContent>
              </Select>
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
              disabled={!file || !title || !collectionId || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </HandDrawn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
