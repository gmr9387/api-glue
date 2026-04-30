import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setDisplayName(data.display_name ?? '');
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(publicUrl);
    setUploading(false);
    toast.success('Avatar uploaded — click Save to apply');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, avatar_url: avatarUrl })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Profile updated');
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const initials = (displayName || user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Update how you appear in the app.</p>
      </div>

      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border border-border/50">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="font-mono text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('avatar-input')?.click()}
              disabled={uploading}
              className="text-xs font-mono"
            >
              {uploading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Upload className="h-3 w-3 mr-1.5" />}
              {uploading ? 'Uploading…' : 'Change avatar'}
            </Button>
            <p className="text-[10px] font-mono text-muted-foreground mt-2">PNG/JPG up to 2MB</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <Input id="email" value={user?.email ?? ''} disabled className="font-mono text-xs bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Display name
          </Label>
          <Input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="font-mono text-xs bg-muted"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full text-xs font-mono">
          {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
