import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload, LogIn } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
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
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
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

  if (!user) {
    return (
      <div className="px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        <PageHeader title="Profile" description="Manage how you appear across the workspace." />
        <div className="panel">
          <EmptyState
            icon={<LogIn className="h-5 w-5" />}
            title="Local workspace mode"
            description="You're using API Unity OS without an account. Sign in to persist your profile, avatar, and run history."
            action={<Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const initials = (displayName || user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="Profile" description="Manage how you appear across the workspace." />

      <section className="panel p-6 space-y-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="font-medium text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <input id="avatar-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <Button
              variant="outline" size="sm"
              onClick={() => document.getElementById('avatar-input')?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {uploading ? 'Uploading…' : 'Change avatar'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">PNG or JPG up to 2MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
          <Input id="email" value={user.email ?? ''} disabled className="text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Display name</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="text-sm" />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          Save changes
        </Button>
      </section>
    </div>
  );
}
