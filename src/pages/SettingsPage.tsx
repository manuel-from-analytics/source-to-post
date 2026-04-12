import { useEffect, useState } from "react";
import { User, Key, Palette, Loader2, Globe } from "lucide-react";
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
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import type { AppLanguage } from "@/i18n/translations";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: voices } = useVoices();
  const { t, language: currentAppLang, setLanguage: setAppLangContext } = useLanguage();

  // Profile
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // App language
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(currentAppLang);
  const [savingAppLang, setSavingAppLang] = useState(false);

  // Post generation preferences
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
        .select("full_name, preferred_language, default_writing_style, default_voice_id, default_length, default_cta, app_language")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setFullName(data.full_name || "");
        const al = (data as any).app_language || "es";
        setAppLanguage(al);
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
    if (error) toast.error(t("common.error"));
    else toast.success(t("common.success"));
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("settings.newPasswordPlaceholder"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("common.error"));
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("common.success"));
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSaveAppLanguage = async () => {
    if (!user) return;
    setSavingAppLang(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        app_language: appLanguage,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", user.id);
    setSavingAppLang(false);
    if (error) {
      toast.error(t("common.error"));
    } else {
      setAppLangContext(appLanguage);
      toast.success(t("common.success"));
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
    if (error) toast.error(t("common.error"));
    else toast.success(t("common.success"));
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
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("settings.profile")}
          </CardTitle>
          <CardDescription>{t("settings.profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("settings.fullName")} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.email")}</Label>
            <Input type="email" disabled value={user?.email || ""} className="opacity-60" />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("settings.saving")}</> : t("settings.saveChanges")}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            {t("settings.password")}
          </CardTitle>
          <CardDescription>{t("settings.passwordDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.newPassword")}</Label>
            <Input type="password" placeholder={t("settings.newPasswordPlaceholder")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.confirmPassword")}</Label>
            <Input type="password" placeholder={t("settings.confirmPasswordPlaceholder")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("settings.changingPassword")}</> : t("settings.changePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* App Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("settings.appLanguage")}
          </CardTitle>
          <CardDescription>{t("settings.appLanguageDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.language")}</Label>
            <Select value={appLanguage} onValueChange={(v) => setAppLanguage(v as AppLanguage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleSaveAppLanguage} disabled={savingAppLang}>
            {savingAppLang ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("settings.saving")}</> : t("settings.saveLanguage")}
          </Button>
        </CardContent>
      </Card>

      {/* Post generation preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("settings.postPrefs")}
          </CardTitle>
          <CardDescription>{t("settings.postPrefsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.postLanguage")}</Label>
            <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("common.spanish")}</SelectItem>
                <SelectItem value="en">{t("common.english")}</SelectItem>
                <SelectItem value="pt">{t("common.portuguese")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.defaultVoice")}</Label>
            <Select value={defaultVoiceId} onValueChange={setDefaultVoiceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings.noDefaultVoice")}</SelectItem>
                {voices?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.defaultLength")}</Label>
            <Select value={defaultLength} onValueChange={setDefaultLength}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("generator.noPreference")}</SelectItem>
                <SelectItem value="short">{t("generator.short")}</SelectItem>
                <SelectItem value="medium">{t("generator.medium")}</SelectItem>
                <SelectItem value="long">{t("generator.long")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.defaultCta")}</Label>
            <Select value={defaultCta} onValueChange={setDefaultCta}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("generator.noPreference")}</SelectItem>
                <SelectItem value="question">{t("generator.ctaQuestion")}</SelectItem>
                <SelectItem value="share">{t("generator.ctaShare")}</SelectItem>
                <SelectItem value="follow">{t("generator.ctaFollow")}</SelectItem>
                <SelectItem value="link">{t("generator.ctaLink")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("settings.saving")}</> : t("settings.savePrefs")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
