import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "고객사" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("customers")
      .insert({ name: name.trim(), code: code.trim() || null });
    if (error) toast.error(error.message);
    else {
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
  }

  async function del(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("customers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <>
      <PageHeader title="고객사" description="시스템을 사용하는 화주사 목록" />
      <div className="p-8 space-y-4">
        <Card className="p-4 flex gap-2 items-end max-w-2xl">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">고객사명</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">코드</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button onClick={add}>
            <Plus className="size-4" /> 추가
          </Button>
        </Card>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">고객사명</th>
                <th className="text-left px-4 py-2.5">코드</th>
                <th className="text-left px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.code || "-"}</td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-sm text-muted-foreground">
                    등록된 고객사가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}