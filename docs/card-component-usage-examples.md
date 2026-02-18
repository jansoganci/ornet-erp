# Card Component Usage Examples

> **Yeni Composite Pattern Kullanım Kılavuzu**

---

## 🎯 İki Kullanım Şekli

Card component'i artık **iki şekilde** kullanılabilir:

1. **Eski Pattern (Backward Compatible)** - Mevcut kod çalışmaya devam eder
2. **Yeni Pattern (Composite)** - Daha modüler ve esnek

---

## 1. Eski Pattern (Mevcut Kullanım)

### Basit Card
```jsx
import { Card } from '@/components/ui';

<Card className="p-6">
  <p>Content here</p>
</Card>
```

### Padding Variants
```jsx
<Card padding="tight">...</Card>      // p-3
<Card padding="compact">...</Card>    // p-4
<Card padding="default">...</Card>   // p-6
```

### Variants
```jsx
<Card variant="default">...</Card>        // Normal card
<Card variant="interactive">...</Card>   // Hover effects
<Card variant="selected">...</Card>      // Selected state
```

### Header & Footer
```jsx
<Card 
  header={<h3>Title</h3>}
  footer={<Button>Action</Button>}
>
  Content here
</Card>
```

### Clickable Card
```jsx
<Card 
  onClick={() => navigate('/page')}
  variant="interactive"
>
  Click me
</Card>
```

---

## 2. Yeni Pattern (Composite)

### Basit Stat Card (shadcn/ui style)
```jsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Users, ArrowUpRight } from 'lucide-react';

<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
    <Users className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">$45,231.89</div>
    <div className="flex items-center pt-1 text-xs text-success-600">
      <ArrowUpRight className="mr-1 h-3 w-3" />
      <span>+20.1% from last month</span>
    </div>
  </CardContent>
</Card>
```

### Card with Description
```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content here</p>
  </CardContent>
</Card>
```

### Card with Footer
```jsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui';
import { Button } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Settings content</p>
  </CardContent>
  <CardFooter>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### Custom Header Layout
```jsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
    <Badge variant="success">New</Badge>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">+2,350</div>
  </CardContent>
</Card>
```

---

## 📊 Component API

### Card (Main Component)
```jsx
<Card
  variant="default" | "interactive" | "selected"
  padding="tight" | "compact" | "default"
  header={ReactNode}
  footer={ReactNode}
  onClick={Function}
  className={string}
>
  {children}
</Card>
```

### CardHeader
```jsx
<CardHeader className={string}>
  {children}
</CardHeader>
```

### CardTitle
```jsx
<CardTitle className={string}>
  {children}
</CardTitle>
```

### CardDescription
```jsx
<CardDescription className={string}>
  {children}
</CardDescription>
```

### CardContent
```jsx
<CardContent className={string}>
  {children}
</CardContent>
```

### CardFooter
```jsx
<CardFooter className={string}>
  {children}
</CardFooter>
```

---

## 🔄 Geçiş Örnekleri

### Önce (Eski Pattern)
```jsx
<Card header={<h3>Title</h3>} padding="compact">
  <p>Content</p>
</Card>
```

### Sonra (Yeni Pattern)
```jsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="p-4">
    <p>Content</p>
  </CardContent>
</Card>
```

---

## ✅ Avantajlar

### Yeni Pattern
- ✅ Daha modüler yapı
- ✅ Daha esnek layout kontrolü
- ✅ shadcn/ui ile uyumlu
- ✅ Daha iyi TypeScript desteği (gelecekte)

### Eski Pattern
- ✅ Daha kısa kod
- ✅ Hızlı kullanım
- ✅ Mevcut kod çalışmaya devam eder

---

## 🎨 Design Token'lar

Card component'i artık explicit design token'lar kullanıyor:

- `bg-white dark:bg-[#171717]` - Card background
- `text-neutral-900 dark:text-neutral-50` - Card text
- `border-neutral-200 dark:border-[#262626]` - Card border
- `text-neutral-500 dark:text-neutral-400` - Muted text

---

**Son Güncelleme:** 2026-02-18
