'use client';

import { useCallback, useEffect, useState } from 'react';
import { SuggestForm } from '@/components/features/keywords/suggest-form';
import { SuggestResults } from '@/components/features/keywords/suggest-results';
import { ProjectsPanel } from '@/components/features/keywords/projects-panel';
import { keywordsApi, type KeywordProject, type SuggestionResult } from '@/lib/api/keywords';

export default function KeywordsPage() {
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const [projects, setProjects] = useState<KeywordProject[]>([]);

  const refreshProjects = useCallback(() => {
    keywordsApi
      .listProjects()
      .then(setProjects)
      .catch(() => {
        // empty list is fine
      });
  }, []);

  useEffect(refreshProjects, [refreshProjects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nghiên cứu từ khóa</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN1 + TN2 — suggest từ 3 nguồn, analyze volume + KD + intent. Stub mode đến khi
          paste SCRAPERAPI_KEY và DATAFORSEO credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <SuggestForm onResult={setResult} />
          {result && (
            <SuggestResults
              result={result}
              projects={projects}
              onProjectsChanged={refreshProjects}
            />
          )}
        </div>
        <ProjectsPanel projects={projects} onChanged={refreshProjects} />
      </div>
    </div>
  );
}
