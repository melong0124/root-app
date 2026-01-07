import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hello World - Asset Management" },
    { name: "description", content: "Welcome to our new asset management app!" },
  ];
}

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl transition-all hover:shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            Hello World!
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            환영합니다! 새로운 자산 관리 프로젝트의 첫걸음입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-foreground/80 leading-relaxed">
            이 프로젝트는 React Router v7(Remix), Tailwind CSS v4, 그리고 shadcn/ui를 사용하여 
            최상의 퍼포먼스와 미려한 디자인을 목표로 합니다.
          </p>
          <div className="flex justify-end">
            <Button className="font-semibold transition-transform hover:scale-105 active:scale-95">
              시작하기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
