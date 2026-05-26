'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { keywordsApi, type KeywordProject } from '@/lib/api/keywords';
import { ProjectExportLink } from './suggest-results';

interface ProjectsPanelProps {
  projects: KeywordProject[];
  onChanged: () => void;
}

export function ProjectsPanel({ projects, onChanged }: ProjectsPanelProps) {
  const [name, setName] = useState('');
  const [seedKeyword, setSeedKeyword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await keywordsApi.createProject({
        name: name.trim(),
        seed_keyword: seedKeyword.trim() || undefined,
      });
      setName('');
      setSeedKeyword('');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá project này?')) return;
    try {
      await keywordsApi.deleteProject(id);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>{projects.length} project · lưu keyword + export</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có project nào.</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="flex items-start justify-between rounded-md border p-2">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.keyword_count} keyword · {p.language}/{p.country}
                  </p>
                  <div className="mt-1 flex gap-3">
                    <ProjectExportLink projectId={p.id} format="csv" />
                    <ProjectExportLink projectId={p.id} format="excel" />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p.id)}
                  aria-label="Xoá"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} className="space-y-2 border-t pt-4">
          <Label htmlFor="proj-name">Tạo project</Label>
          <Input
            id="proj-name"
            required
            minLength={2}
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên project"
          />
          <Input
            value={seedKeyword}
            onChange={(e) => setSeedKeyword(e.target.value)}
            placeholder="Seed keyword (tuỳ chọn)"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" type="submit" disabled={creating || name.trim().length < 2}>
            <Plus className="mr-2 h-4 w-4" /> Tạo project
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
