'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ArticleResult } from '@/lib/api/content';

interface ArticleEditorProps {
  article: ArticleResult;
}

export function ArticleEditor({ article }: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Bài viết sẽ hiển thị ở đây...' }),
    ],
    content: article.content_html,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
      },
    },
    immediatelyRender: false,
  });

  // Re-sync when the article changes (e.g. user re-generates).
  useEffect(() => {
    if (editor && article.content_html) {
      editor.commands.setContent(article.content_html);
    }
  }, [article.id, article.content_html, editor]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{article.title}</CardTitle>
            <CardDescription className="mt-1">
              {article.word_count.toLocaleString()} từ · score{' '}
              <span
                className={
                  article.content_score >= 80
                    ? 'font-semibold text-green-700'
                    : article.content_score >= 60
                      ? 'font-semibold text-yellow-700'
                      : 'font-semibold text-red-700'
                }
              >
                {article.content_score}/100
              </span>{' '}
              · {article.ai_model}
              {article.is_stub && (
                <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                  STUB
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-background">
          <EditorContent editor={editor} />
        </div>

        <details className="rounded-md border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Meta &amp; score breakdown</summary>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meta title
              </p>
              <p>{article.meta_title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meta description
              </p>
              <p>{article.meta_description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Score breakdown
              </p>
              <ul className="mt-1 space-y-1 text-xs">
                {Object.entries(article.content_score_breakdown).map(([rule, val]) => (
                  <li key={rule} className="flex items-baseline justify-between gap-3">
                    <span className={val.passed ? 'text-green-700' : 'text-amber-700'}>
                      {val.passed ? '✓' : '⚠'} {rule}
                    </span>
                    <span className="text-muted-foreground">
                      {val.score}/100 {val.note ? `— ${val.note}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
