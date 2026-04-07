import { useEffect, useState } from "react";
import { User, Key, Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoices } from "@/hooks/useVoices";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: voices } = useVoices();

  // Profile
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Preferences
  const [preferredLanguage, setPreferredLanguage] = useState("es");
  
  const [defaultVoiceId, setDefaultVoiceId] = useState("none");
  const [defaultLength, setDefaultLength] = useState("none");
  const [defaultCta, setDefaultCta] = useState("none");
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, preferred_language, default_writing_style, default_voice_id, default_length, default_cta")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setFullName(data.full_name || "");
        setPreferredLanguage(data.preferred_language || "es");
        
        setDefaultVoiceId((data as any).default_voice_id || "none");
        setDefaultLength((data as any).default_length || "none");
        setDefaultCta((data as any).default_cta || "none");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Error al guardar el perfil");
    else toast.success("Perfil actualizado");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Contraseña actualizada");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        preferred_language: preferredLanguage,
        
        default_voice_id: defaultVoiceId !== "none" ? defaultVoiceId : null,
        default_length: defaultLength !== "none" ? defaultLength : null,
        default_cta: defaultCta !== "none" ? defaultCta : null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) toast.error("Error al guardar preferencias");
    else toast.success("Preferencias guardadas");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1">Configura tu perfil y preferencias</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
          <CardDescription>Tu información personal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" disabled value={user?.email || ""} className="opacity-60" />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Contraseña
          </CardTitle>
          <CardDescription>Actualiza tu contraseña</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar contraseña</Label>
            <Input type="password" placeholder="Repite la contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Cambiando...</> : "Cambiar contraseña"}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Preferencias de generación
          </CardTitle>
          <CardDescription>Valores por defecto para el generador de posts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Idioma preferido</Label>
            <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">Inglés</SelectItem>
                <SelectItem value="pt">Portugués</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Voz por defecto</Label>
            <Select value={defaultVoiceId} onValueChange={setDefaultVoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin voz por defecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin voz por defecto</SelectItem>
                {voices?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Longitud por defecto</Label>
            <Select value={defaultLength} onValueChange={setDefaultLength}>
              <SelectTrigger>
                <SelectValue placeholder="Sin preferencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin preferencia</SelectItem>
                <SelectItem value="short">Corto (~100 palabras)</SelectItem>
                <SelectItem value="medium">Medio (~200 palabras)</SelectItem>
                <SelectItem value="long">Largo (~300 palabras)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Call to Action por defecto</Label>
            <Select value={defaultCta} onValueChange={setDefaultCta}>
              <SelectTrigger>
                <SelectValue placeholder="Sin preferencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin preferencia</SelectItem>
                <SelectItem value="question">Pregunta abierta</SelectItem>
                <SelectItem value="share">Invitar a compartir</SelectItem>
                <SelectItem value="follow">Invitar a seguir</SelectItem>
                <SelectItem value="link">Visitar un enlace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : "Guardar preferencias"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
