import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Check, 
  AlertTriangle,
  Camera
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { legacyTable } from '@/integrations/supabase/legacyTables';
import { toast } from '@/hooks/use-toast';

interface PhotoUploadSystemProps {
  evaluationId?: string;
  onPhotoUploaded?: (photoData: any) => void;
  maxPhotos?: number;
  allowedViews?: string[];
}

interface PhotoData {
  id: string;
  file: File;
  preview: string;
  viewType: string;
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
}

const PhotoUploadSystem = ({ 
  evaluationId, 
  onPhotoUploaded,
  maxPhotos = 4,
  allowedViews = ['anterior', 'posterior', 'lateral_direita', 'lateral_esquerda']
}: PhotoUploadSystemProps) => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (photos.length + files.length > maxPhotos) {
      toast({
        title: "Limite excedido",
        description: `Máximo de ${maxPhotos} fotos permitidas`,
        variant: "destructive"
      });
      return;
    }

    const newPhotos: PhotoData[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      viewType: allowedViews[photos.length + index] || 'anterior',
      uploadStatus: 'pending'
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const updatePhotoViewType = (photoId: string, viewType: string) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === photoId ? { ...photo, viewType } : photo
    ));
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === photoId);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.preview);
      }
      return prev.filter(p => p.id !== photoId);
    });
  };

  const uploadPhoto = async (photo: PhotoData): Promise<string | null> => {
    try {
      // Create unique filename
      const fileExt = photo.file.name.split('.').pop();
      const fileName = `temp/${evaluationId || 'temp'}/${photo.viewType}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, photo.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Save photo record to database if evaluation exists
      if (evaluationId) {
        const { data: photoData, error: dbError } = await legacyTable('photos')
          .insert([{
            evaluation_id: evaluationId,
            image_url: publicUrl,
            view_type: photo.viewType,
            measurements: [],
            is_validated: false
          }])
          .select()
          .single();

        if (dbError) throw dbError;

        // Call callback if provided
        onPhotoUploaded?.(photoData);
      }

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleUploadAll = async () => {
    if (photos.length === 0) return;

    setIsUploading(true);

    try {
      // Update all photos to uploading status
      setPhotos(prev => prev.map(photo => ({ 
        ...photo, 
        uploadStatus: 'uploading' as const 
      })));

      // Upload all photos concurrently
      const uploadPromises = photos.map(async (photo) => {
        try {
          const url = await uploadPhoto(photo);
          return { photoId: photo.id, url, status: 'success' as const };
        } catch (error) {
          return { photoId: photo.id, error, status: 'error' as const };
        }
      });

      const results = await Promise.all(uploadPromises);

      // Update photo statuses based on results
      setPhotos(prev => prev.map(photo => {
        const result = results.find(r => r.photoId === photo.id);
        return {
          ...photo,
          uploadStatus: result?.status || 'error',
          url: result?.url
        };
      }));

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      if (successCount > 0) {
        toast({
          title: "Upload concluído",
          description: `${successCount} foto(s) enviada(s) com sucesso`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: "Alguns uploads falharam",
          description: `${errorCount} foto(s) não puderam ser enviadas`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Upload all error:', error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar as fotos",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'success':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Camera className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Sistema de Upload de Fotos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-600">
              Clique para selecionar fotos
            </p>
            <p className="text-sm text-gray-500 mt-2">
              PNG, JPG até 10MB cada • Máximo {maxPhotos} fotos
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {photos.length > 0 && (
            <div className="flex justify-between items-center pt-4">
              <p className="text-sm text-gray-600">
                {photos.length} foto(s) selecionada(s)
              </p>
              <Button 
                onClick={handleUploadAll}
                disabled={isUploading || photos.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Todas
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Preview Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden">
              <div className="relative aspect-video">
                <img
                  src={photo.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full p-1">
                    {getStatusIcon(photo.uploadStatus)}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full p-1 h-8 w-8"
                    onClick={() => removePhoto(photo.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Label htmlFor={`view-${photo.id}`}>Tipo de Vista</Label>
                  <select
                    id={`view-${photo.id}`}
                    value={photo.viewType}
                    onChange={(e) => updatePhotoViewType(photo.id, e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {allowedViews.map((view) => (
                      <option key={view} value={view}>
                        {view.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {photo.file.name} • {(photo.file.size / 1024 / 1024).toFixed(2)}MB
                </div>
                {photo.uploadStatus === 'success' && photo.url && (
                  <div className="mt-2 text-xs text-green-600">
                    ✓ Upload concluído
                  </div>
                )}
                {photo.uploadStatus === 'error' && (
                  <div className="mt-2 text-xs text-red-600">
                    ✗ Falha no upload
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUploadSystem;