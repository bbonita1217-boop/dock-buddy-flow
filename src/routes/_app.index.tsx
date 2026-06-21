import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardSection } from "@/components/sections/dashboard-section";
import { UploadSection } from "@/components/sections/upload-section";
import { BoardSection } from "@/components/sections/board-section";
import { ContainersSection } from "@/components/sections/containers-section";
import { WarehousesSection } from "@/components/sections/warehouses-section";
import { CustomersSection } from "@/components/sections/customers-section";
import { RulesSection } from "@/components/sections/rules-section";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "컨테이너 배차 시스템" }] }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <PageHeader
        title="컨테이너 배차"
        description="업로드 · 일정보드 · 컨테이너 관리 · 설정을 한 화면에서"
      />
      <div className="p-6">
        <Tabs defaultValue="board" className="w-full">
          <TabsList className="h-10">
            <TabsTrigger value="dashboard">대시보드</TabsTrigger>
            <TabsTrigger value="upload">엑셀 업로드</TabsTrigger>
            <TabsTrigger value="board">일정 보드</TabsTrigger>
            <TabsTrigger value="containers">컨테이너</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardSection />
          </TabsContent>
          <TabsContent value="upload" className="mt-6">
            <UploadSection />
          </TabsContent>
          <TabsContent value="board" className="mt-6">
            <BoardSection />
          </TabsContent>
          <TabsContent value="containers" className="mt-6">
            <ContainersSection />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <Tabs defaultValue="warehouses" className="w-full">
              <TabsList>
                <TabsTrigger value="warehouses">창고</TabsTrigger>
                <TabsTrigger value="customers">거래처</TabsTrigger>
                <TabsTrigger value="rules">규칙</TabsTrigger>
              </TabsList>
              <TabsContent value="warehouses" className="mt-4">
                <WarehousesSection />
              </TabsContent>
              <TabsContent value="customers" className="mt-4">
                <CustomersSection />
              </TabsContent>
              <TabsContent value="rules" className="mt-4">
                <RulesSection />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
