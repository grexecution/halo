# Custom Pages

This directory is **gitignored** — files you add here will not be overwritten when you pull upstream updates.

## Adding a custom page

1. Create your page file: `apps/dashboard/app/custom/my-page/page.tsx`
2. Register it in `apps/dashboard/app/custom/pages.json`:

```json
[{ "href": "/custom/my-page", "label": "My Page", "icon": "🛠️" }]
```

The page will appear in the sidebar under a "Custom" section.

## Example page

```tsx
'use client'
export default function MyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Custom Page</h1>
    </div>
  )
}
```

## Notes

- Custom pages are fully standard Next.js App Router pages
- They inherit the global layout (sidebar, styles)
- They survive `git pull` because this directory is gitignored
