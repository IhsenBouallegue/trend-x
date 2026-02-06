"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AIConfigSection } from "@/components/ai-config/ai-config-section";
import { TelegramCredentialsForm, TwitterCredentialsForm } from "@/components/credential-forms";
import { ScheduleSection } from "@/components/settings/schedule-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigAll } from "@/hooks/queries";

export default function SettingsPage() {
  const { data: configData, isLoading } = useConfigAll();

  // Convert config array to key-value map
  const configMap: Record<string, string> = {};
  if (configData) {
    for (const item of configData) {
      configMap[item.key] = item.value;
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-muted" />
          <div className="h-64 bg-muted" />
          <div className="h-32 bg-muted" />
          <div className="h-32 bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-bold text-xl">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Twitter/X Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <TwitterCredentialsForm defaultValues={configMap} />
        </CardContent>
      </Card>

      <AIConfigSection />

      <ScheduleSection />

      <Card>
        <CardHeader>
          <CardTitle>Telegram Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <TelegramCredentialsForm defaultValues={configMap} />
        </CardContent>
      </Card>
    </div>
  );
}
