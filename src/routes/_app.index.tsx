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
  const [running, setRunning] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["dash-containers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("containers")
        .select("*, warehouse:warehouses(name), customer:customers(name)")
        .order("eta", { ascending: true });
      return data ?? [];
    },
  });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const containers = (data || []) as any[];
  const todayEta = containers.filter((c) => c.eta === todayStr).length;
  const pending = containers.filter(
    (c) => (c.shipment_mode || "").toUpperCase().includes("SEA") && c.dispatch_status === "PENDING",
  );
  const weekIn = containers.filter((c) => {
    if (!c.inbound_date) return false;
    const d = new Date(c.inbound_date);
    return d >= weekStart && d < weekEnd;
  }).length;
  const expiring = containers.filter((c) => {
    if (!c.return_deadline) return false;
    const days = (new Date(c.return_deadline).getTime() - today.getTime()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;

  async function onRun() {
    setRunning(true);
    try {
      const r = await applyAutoDispatch(supabase as any);
      toast.success(`자동 배차 완료 · 배정 ${r.placed} · 대기 ${r.failed}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "배차 실패");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="대시보드"
        description="오늘의 입항·통관·배차 현황을 한눈에 확인하세요"
        action={
          <Button onClick={onRun} disabled={running}>
            <Play className="size-4" /> {running ? "배차 중..." : "자동 배차 실행"}
          </Button>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Kpi icon={Ship} label="오늘 입항 예정" value={todayEta} tone="info" />
          <Kpi icon={Truck} label="배차 필요" value={pending.length} tone="warning" />
          <Kpi icon={CalendarRange} label="금주 입고 예정" value={weekIn} tone="primary" />
          <Kpi icon={AlertTriangle} label="반출기한 임박 (7일)" value={expiring} tone="destructive" />
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h2 className="text-sm font-semibold">배차 대기 리스트</h2>
              <p className="text-xs text-muted-foreground">
                SEA 컨테이너 중 배차되지 않은 건
              </p>
            </div>
            <Link to="/containers" className="text-xs text-primary hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <Th>BL NO</Th>
                  <Th>Container No</Th>
                  <Th>고객사</Th>
                  <Th>SBU</Th>
                  <Th>Item No</Th>
                  <Th>ETA</Th>
                  <Th>창고</Th>
                  <Th>추천 입고일</Th>
                  <Th>상태</Th>
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 15).map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <Td>{c.bl_no}</Td>
                    <Td>{c.container_no}</Td>
                    <Td>{c.customer?.name}</Td>
                    <Td>{c.sbu}</Td>
                    <Td>{c.item_no}</Td>
                    <Td>{c.eta}</Td>
                    <Td>{c.warehouse?.name || "-"}</Td>
                    <Td>{c.inbound_date || "-"}</Td>
                    <Td>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                        <Clock className="size-3" /> PENDING
                      </Badge>
                    </Td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                      배차 대기 중인 컨테이너가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
