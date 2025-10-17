import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AssetSettings {
  founder_signature_url: { url: string | null; uploaded_at: string | null };
  company_logo_url: { url: string | null; uploaded_at: string | null };
}

export function AdminAssetSettings() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetSettings>({
    founder_signature_url: { url: null, uploaded_at: null },
    company_logo_url: { url: null, uploaded_at: null },
  });
  const [uploading, setUploading] = useState<{ signature: boolean; logo: boolean }>({
    signature: false,
    logo: false,
  });

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadAssets();
    }
  }, [isAdmin]);

  const loadAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['founder_signature_url', 'company_logo_url']);

      if (error) throw error;

      const settings: any = {};
      data?.forEach((item) => {
        settings[item.setting_key] = item.setting_value;
      });

      setAssets({
        founder_signature_url: settings.founder_signature_url || { url: null, uploaded_at: null },
        company_logo_url: settings.company_logo_url || { url: null, uploaded_at: null },
      });
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  const handleFileUpload = async (
    file: File,
    type: 'signature' | 'logo'
  ) => {
    try {
      setUploading((prev) => ({ ...prev, [type]: true }));

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Delete old file if exists
      const oldUrl = type === 'signature' 
        ? assets.founder_signature_url.url 
        : assets.company_logo_url.url;
      
      if (oldUrl) {
        const oldPath = oldUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('admin-assets').remove([oldPath]);
      }

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('admin-assets')
        .getPublicUrl(filePath);

      // Update database
      const settingKey = type === 'signature' ? 'founder_signature_url' : 'company_logo_url';
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: {
            url: publicUrl,
            uploaded_at: new Date().toISOString(),
          },
          updated_by: userProfile?.auth_user_id,
        })
        .eq('setting_key', settingKey);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from('audit_logs').insert({
        action_type: `upload_${type}`,
        performed_by: userProfile?.auth_user_id,
        target_type: 'admin_settings',
        status: 'success',
        details: {
          setting_key: settingKey,
          file_path: filePath,
        },
      });

      toast({
        title: "Upload Successful",
        description: `${type === 'signature' ? 'Founder signature' : 'Company logo'} has been updated.`,
      });

      loadAssets();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleRemoveAsset = async (type: 'signature' | 'logo') => {
    try {
      const url = type === 'signature' 
        ? assets.founder_signature_url.url 
        : assets.company_logo_url.url;

      if (!url) return;

      // Delete from storage
      const path = url.split('/').slice(-2).join('/');
      await supabase.storage.from('admin-assets').remove([path]);

      // Update database
      const settingKey = type === 'signature' ? 'founder_signature_url' : 'company_logo_url';
      const { error } = await supabase
        .from('admin_settings')
        .update({
          setting_value: { url: null, uploaded_at: null },
          updated_by: userProfile?.auth_user_id,
        })
        .eq('setting_key', settingKey);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        action_type: `remove_${type}`,
        performed_by: userProfile?.auth_user_id,
        target_type: 'admin_settings',
        status: 'success',
        details: { setting_key: settingKey },
      });

      toast({
        title: "Asset Removed",
        description: `${type === 'signature' ? 'Founder signature' : 'Company logo'} has been removed.`,
      });

      loadAssets();
    } catch (error: any) {
      console.error('Error removing asset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove asset.",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PDF Assets</h2>
        <p className="text-muted-foreground">
          Manage signature and logo used in certificates and portfolio PDFs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Founder Signature */}
        <Card>
          <CardHeader>
            <CardTitle>Founder Signature</CardTitle>
            <CardDescription>
              Used in certificates (recommended: 400x150px PNG with transparency)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assets.founder_signature_url.url ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <img
                    src={assets.founder_signature_url.url}
                    alt="Founder Signature"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
                {assets.founder_signature_url.uploaded_at && (
                  <p className="text-xs text-muted-foreground text-center">
                    Uploaded: {new Date(assets.founder_signature_url.uploaded_at).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => document.getElementById('signature-upload')?.click()}
                    disabled={uploading.signature}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveAsset('signature')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No signature uploaded
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('signature-upload')?.click()}
                    disabled={uploading.signature}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading.signature ? 'Uploading...' : 'Upload Signature'}
                  </Button>
                </div>
              </div>
            )}
            <input
              id="signature-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'signature');
                e.target.value = '';
              }}
            />
          </CardContent>
        </Card>

        {/* Company Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
            <CardDescription>
              Used in certificates and portfolios (recommended: 200x200px PNG)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assets.company_logo_url.url ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <img
                    src={assets.company_logo_url.url}
                    alt="Company Logo"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
                {assets.company_logo_url.uploaded_at && (
                  <p className="text-xs text-muted-foreground text-center">
                    Uploaded: {new Date(assets.company_logo_url.uploaded_at).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={uploading.logo}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveAsset('logo')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No logo uploaded
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={uploading.logo}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading.logo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            )}
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'logo');
                e.target.value = '';
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Founder signature appears at the bottom of all certificates</li>
            <li>Company logo appears at the top of certificates and portfolio PDFs</li>
            <li>Use transparent PNG files for best results</li>
            <li>Changes apply immediately to newly generated PDFs</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
