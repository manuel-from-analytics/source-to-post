import { Library, PenTool, FileText, TrendingUp, Plus, ArrowRight, Newspaper, Mic } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInputsCount } from "@/hooks/useInputs";
import { usePostsCount } from "@/hooks/usePosts";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Dashboard() {
  const { data: inputsCount = 0 } = useInputsCount();
  const { data: postsCount = 0 } = usePostsCount();
  const { t } = useLanguage();

  const quickActions = [
    { label: t("dashboard.createNewsletter"), icon: Newspaper, path: "/newsletter", description: t("dashboard.createNewsletterDesc") },
    { label: t("dashboard.addSource"), icon: Plus, path: "/library", description: t("dashboard.addSourceDesc") },
    { label: t("dashboard.createVoice"), icon: Mic, path: "/voice", description: t("dashboard.createVoiceDesc") },
    { label: t("dashboard.generatePost"), icon: PenTool, path: "/generator", description: t("dashboard.generatePostDesc") },
  ];

  const stats = [
    { label: t("dashboard.savedSources"), value: String(inputsCount), icon: Library, color: "text-primary" },
    { label: t("dashboard.generatedPosts"), value: String(postsCount), icon: FileText, color: "text-accent" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4 lg:p-6">
              <div className={`rounded-lg bg-secondary p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{t("dashboard.quickActions")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                <CardContent className="flex items-center gap-4 p-4 lg:p-6">
                  <div className="rounded-lg gradient-primary p-2.5 text-primary-foreground">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {inputsCount === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">{t("dashboard.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {t("dashboard.emptyDesc")}
            </p>
            <Button asChild>
              <Link to="/library">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.addFirstSource")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
