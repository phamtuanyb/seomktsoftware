'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  imagesApi,
  type ImageAspectRatio,
  type ImageRecord,
  type ImageStyle,
  type ImageModel,
} from '@/lib/api/images';

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('mkt-brand');
  const [aspect, setAspect] = useState<ImageAspectRatio>('16:9');
  const [count, setCount] = useState(2);
  const [model, setModel] = useState<ImageModel>('flux-schnell');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stubFlags, setStubFlags] = useState<{ provider: boolean; storage: boolean }>({
    provider: false,
    storage: false,
  });

  function refresh() {
    imagesApi
      .list()
      .then(setImages)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(refresh, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const r = await imagesApi.generate({
        prompt: prompt.trim(),
        style,
        aspect_ratio: aspect,
        count,
        model,
      });
      setStubFlags({ provider: r.stats.provider_stub, storage: r.stats.storage_stub });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá ảnh này?')) return;
    try {
      await imagesApi.remove(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hình ảnh AI</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN6 — Flux Schnell ($0.003/ảnh) mặc định, DALL-E 3 ($0.08/ảnh) premium. Auto alt
          text qua Claude Haiku. Stub mode dùng placehold.co khi chưa có key.
        </p>
      </div>

      {(stubFlags.provider || stubFlags.storage) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm">
            <p className="font-medium text-amber-900">Đang chạy stub mode:</p>
            <ul className="ml-4 list-disc text-amber-800">
              {stubFlags.provider && (
                <li>
                  Provider chưa cấu hình → ảnh là placehold.co. Paste REPLICATE_API_TOKEN /
                  OPENAI_API_KEY thật để Flux/DALL-E hoạt động.
                </li>
              )}
              {stubFlags.storage && (
                <li>R2 chưa cấu hình → URL trả về là URL nguồn trực tiếp (không lưu trên CDN).</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>TN6 — Sinh ảnh</CardTitle>
              <CardDescription>
                Section 8 TN6 — safety check (no NSFW, no real-person) + style preset + Sharp resize
                + alt text auto chứa keyword.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt mô tả ảnh (5-1000 ký tự)</Label>
              <Textarea
                id="prompt"
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="VD: SEO local cho doanh nghiệp nhỏ — minh hoạ map pack Google Maps"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="style">Style</Label>
                <Select
                  id="style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value as ImageStyle)}
                >
                  <option value="mkt-brand">MKT brand</option>
                  <option value="realistic">Realistic</option>
                  <option value="illustration">Illustration</option>
                  <option value="3d">3D</option>
                  <option value="minimalist">Minimalist</option>
                  <option value="infographic">Infographic</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aspect">Aspect ratio</Label>
                <Select
                  id="aspect"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value as ImageAspectRatio)}
                >
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="1:1">1:1</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Số lượng (1-4)</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={4}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as ImageModel)}
                >
                  <option value="flux-schnell">Flux Schnell ($0.003)</option>
                  <option value="dalle-3">DALL-E 3 HD ($0.08)</option>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={generating || prompt.trim().length < 5}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang sinh ảnh...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Sinh {count} ảnh
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gallery</CardTitle>
          <CardDescription>{images.length} ảnh đã sinh</CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ảnh nào.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-md border bg-muted/30">
                  <div className="relative aspect-video bg-muted">
                    {img.url ? (
                      <Image
                        src={img.url}
                        alt={img.alt_text ?? img.prompt ?? 'image'}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        no image
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-3 text-xs">
                    <p className="line-clamp-2 font-medium">{img.alt_text}</p>
                    <p className="line-clamp-2 text-muted-foreground">{img.prompt}</p>
                    <p className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{img.model_used}</span>
                      <span>·</span>
                      <span>
                        {img.width}×{img.height}
                      </span>
                      <span>·</span>
                      <span>{img.style}</span>
                    </p>
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(img.id)}
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
